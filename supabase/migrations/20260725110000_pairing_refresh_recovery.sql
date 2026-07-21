-- Keep pairing creation bounded without extending a legitimate Player lockout
-- every time a rate-limited browser retries or refreshes.

create or replace function public.create_pairing_session_v3(
  p_code_hash text,
  p_token_hash text,
  p_device_fingerprint_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code_hash text := lower(nullif(btrim(p_code_hash), ''));
  normalized_token_hash text := lower(nullif(btrim(p_token_hash), ''));
  normalized_fingerprint_hash text := lower(nullif(btrim(p_device_fingerprint_hash), ''));
  expires_at timestamptz := now() + interval '10 minutes';
  fingerprint_attempts integer;
  global_attempts integer;
  oldest_fingerprint_attempt timestamptz;
  oldest_global_attempt timestamptz;
  retry_after_seconds integer := 1;
begin
  if normalized_code_hash is null or normalized_code_hash !~ '^[a-f0-9]{64}$'
    or normalized_token_hash is null or normalized_token_hash !~ '^[a-f0-9]{64}$'
    or normalized_fingerprint_hash is null or normalized_fingerprint_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'pairing hashes must be sha256' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_fingerprint_hash, 27)
  );
  delete from private.pairing_creation_attempts
  where attempted_at < now() - interval '1 day';

  select count(*)::integer, min(attempted_at)
  into fingerprint_attempts, oldest_fingerprint_attempt
  from private.pairing_creation_attempts
  where fingerprint_hash = normalized_fingerprint_hash
    and outcome = 'created'
    and attempted_at >= now() - interval '10 minutes';

  select count(*)::integer, min(attempted_at)
  into global_attempts, oldest_global_attempt
  from private.pairing_creation_attempts
  where outcome = 'created'
    and attempted_at >= now() - interval '1 minute';

  if fingerprint_attempts >= 5 or global_attempts >= 300 then
    if fingerprint_attempts >= 5 and oldest_fingerprint_attempt is not null then
      retry_after_seconds := greatest(
        retry_after_seconds,
        ceil(extract(epoch from (
          oldest_fingerprint_attempt + interval '10 minutes' - now()
        )))::integer
      );
    end if;
    if global_attempts >= 300 and oldest_global_attempt is not null then
      retry_after_seconds := greatest(
        retry_after_seconds,
        ceil(extract(epoch from (
          oldest_global_attempt + interval '1 minute' - now()
        )))::integer
      );
    end if;

    insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
    values (normalized_fingerprint_hash, 'rate_limited');
    return jsonb_build_object(
      'ok', false,
      'code', 'RATE_LIMITED',
      'retryAfterSeconds', retry_after_seconds
    );
  end if;

  update public.pairing_sessions
  set status = 'cancelled'::public.pairing_session_status
  where device_fingerprint_hash = normalized_fingerprint_hash
    and status = 'pending'::public.pairing_session_status;

  insert into public.pairing_sessions (
    code_hash, pending_token_hash, device_fingerprint_hash, expires_at
  ) values (
    normalized_code_hash, normalized_token_hash,
    normalized_fingerprint_hash, expires_at
  );
  insert into private.pairing_creation_attempts(fingerprint_hash, outcome)
  values (normalized_fingerprint_hash, 'created');
  return jsonb_build_object('ok', true, 'expiresAt', expires_at);
end;
$$;

revoke all on function public.create_pairing_session_v3(text, text, text) from public;
grant execute on function public.create_pairing_session_v3(text, text, text)
  to anon, authenticated;
