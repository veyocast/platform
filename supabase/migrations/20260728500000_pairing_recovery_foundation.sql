-- S48: let a Player holding a pending credential cancel only its own
-- unclaimed pairing attempt. The installation identifier is non-secret, but
-- is hashed before it crosses the database boundary.

create table private.player_pairing_recovery_events (
  id bigint generated always as identity primary key,
  installation_id_hash text not null
    check (installation_id_hash ~ '^[a-f0-9]{64}$'),
  recovery_mode text not null check (recovery_mode in ('soft', 'hard')),
  event_type text not null check (event_type in ('pending_pairing.cancelled')),
  created_at timestamptz not null default now()
);

create index player_pairing_recovery_events_installation_time_idx
  on private.player_pairing_recovery_events(installation_id_hash, created_at desc);

revoke all on private.player_pairing_recovery_events
from public, anon, authenticated;

create or replace function public.recover_pending_pairing_v1(
  p_pending_token_hash text,
  p_installation_id_hash text,
  p_recovery_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_token_hash text :=
    lower(nullif(btrim(p_pending_token_hash), ''));
  normalized_installation_hash text :=
    lower(nullif(btrim(p_installation_id_hash), ''));
  normalized_mode text := lower(nullif(btrim(p_recovery_mode), ''));
  cancelled_count integer := 0;
begin
  if normalized_token_hash is null
    or normalized_token_hash !~ '^[a-f0-9]{64}$'
    or normalized_installation_hash is null
    or normalized_installation_hash !~ '^[a-f0-9]{64}$'
    or normalized_mode not in ('soft', 'hard')
  then
    raise exception 'invalid pairing recovery input' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_token_hash, 48)
  );

  update public.pairing_sessions
  set status = 'cancelled'::public.pairing_session_status
  where pending_token_hash = normalized_token_hash
    and status = 'pending'::public.pairing_session_status;
  get diagnostics cancelled_count = row_count;

  if cancelled_count > 0 then
    insert into private.player_pairing_recovery_events (
      installation_id_hash,
      recovery_mode,
      event_type
    )
    values (
      normalized_installation_hash,
      normalized_mode,
      'pending_pairing.cancelled'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'cancelledPendingPairing', cancelled_count > 0
  );
end;
$$;

revoke all on function public.recover_pending_pairing_v1(text, text, text)
from public;
grant execute on function public.recover_pending_pairing_v1(text, text, text)
to anon, authenticated;
