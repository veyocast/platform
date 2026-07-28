-- Idempotent mobile wrapper for the existing lightweight playlist draft RPC.

create or replace function public.mutate_playlist_draft_mobile_v1(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  mutation_outcome text;
  actual_revision bigint;
  outcome jsonb;
begin
  if actor_id is null then
    raise exception 'authenticated actor required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
    or p_idempotency_key is null
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in (
      'add_item',
      'update_item',
      'move_item',
      'remove_item'
    )
  then
    raise exception 'mobile playlist mutation is invalid' using errcode = '22023';
  end if;

  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot mutate this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.mobile.v1.' || normalized_operation,
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select mutation.outcome, mutation.actual_revision
  into mutation_outcome, actual_revision
  from public.mutate_playlist_draft_v1(
    p_playlist_id,
    p_expected_revision,
    normalized_operation,
    p_payload
  ) mutation;

  outcome := jsonb_build_object(
    'outcome', mutation_outcome,
    'actualRevision', actual_revision
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.mobile.v1.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'playlists',
    playlist_record.id,
    outcome,
    case
      when mutation_outcome = 'applied'
        then 'publisher.playlist.mobile_mutated'
      else 'publisher.playlist.conflict'
    end,
    case when mutation_outcome = 'applied' then 'success' else 'failed' end
  );
end;
$$;

revoke all on function public.mutate_playlist_draft_mobile_v1(
  uuid, bigint, text, jsonb, uuid
) from public, anon;
grant execute on function public.mutate_playlist_draft_mobile_v1(
  uuid, bigint, text, jsonb, uuid
) to authenticated;
