-- S53 hotfix: let the deployment smoke remove only its own unpaired
-- installation through the service-role boundary. The public Player and
-- authenticated Control roles must never be able to call this function.

create or replace function public.cleanup_player_pairing_smoke_v1(
  p_installation_id_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_installation_hash text :=
    lower(nullif(btrim(p_installation_id_hash), ''));
  installation_record public.player_installations%rowtype;
begin
  if normalized_installation_hash is null
    or normalized_installation_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'invalid smoke installation hash' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_installation_hash, 53)
  );

  select installation.*
  into installation_record
  from public.player_installations installation
  where installation.public_identifier_hash = normalized_installation_hash
  for update;

  if found and installation_record.bound_device_id is not null then
    raise exception 'refusing to delete a bound Player installation'
      using errcode = '23514';
  end if;

  delete from private.player_pairing_recovery_events
  where installation_id_hash = normalized_installation_hash;

  delete from private.pairing_creation_attempts
  where fingerprint_hash = normalized_installation_hash;

  if installation_record.id is null then
    return jsonb_build_object(
      'ok', true,
      'deleted', false
    );
  end if;

  delete from private.player_pairing_events event
  where event.installation_id = installation_record.id
    or event.pairing_session_id in (
      select pairing.id
      from public.pairing_sessions pairing
      where pairing.installation_id = installation_record.id
    );

  delete from public.pairing_sessions
  where installation_id = installation_record.id;

  delete from public.player_installations
  where id = installation_record.id;

  return jsonb_build_object(
    'ok', true,
    'deleted', true
  );
end;
$$;

revoke all on function public.cleanup_player_pairing_smoke_v1(text)
from public, anon, authenticated;
grant execute on function public.cleanup_player_pairing_smoke_v1(text)
to service_role;
