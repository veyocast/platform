-- S31-B: safely refresh tenant playlist templates from an editable source draft.

create or replace function public.update_tenant_playlist_template_v1(
  p_template_id uuid,
  p_expected_revision bigint,
  p_playlist_id uuid,
  p_name text,
  p_description text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  template_record public.tenant_playlist_templates%rowtype;
  playlist_record public.playlists%rowtype;
  normalized_name text := nullif(btrim(p_name), '');
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  request_json jsonb;
  replay jsonb;
  snapshot jsonb;
  computed_snapshot_hash text;
  outcome jsonb;
begin
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected template revision is required' using errcode = '23514';
  end if;

  select template.* into template_record
  from public.tenant_playlist_templates template
  where template.id = p_template_id
  for update;

  if not found then
    raise exception 'tenant template not found' using errcode = 'P0002';
  end if;
  if template_record.status <> 'active' then
    raise exception 'archived tenant templates cannot be changed' using errcode = '23514';
  end if;
  if actor_id is null or not private.can_write_playlist(template_record.tenant_id) then
    raise exception 'actor cannot update tenant templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(template_record.tenant_id);

  if template_record.revision <> p_expected_revision then
    return jsonb_build_object(
      'outcome', 'conflict',
      'templateId', template_record.id,
      'revision', template_record.revision
    );
  end if;
  if normalized_name is null or length(normalized_name) not between 2 and 120
    or (normalized_description is not null and length(normalized_description) > 500)
  then
    raise exception 'template details are invalid' using errcode = '22023';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
    and playlist.tenant_id = template_record.tenant_id
    and playlist.status <> 'archived'::public.playlist_status;

  if not found then
    raise exception 'editable source playlist not found in tenant' using errcode = 'P0002';
  end if;

  request_json := jsonb_build_object(
    'templateId', p_template_id,
    'expectedRevision', p_expected_revision,
    'playlistId', p_playlist_id,
    'name', normalized_name,
    'description', normalized_description
  );
  replay := private.begin_publisher_command(
    template_record.tenant_id,
    'tenant_template.update',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  snapshot := private.build_playlist_authoring_snapshot(playlist_record.id);
  computed_snapshot_hash := encode(
    extensions.digest(pg_catalog.convert_to(snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.tenant_playlist_templates
  set
    source_playlist_id = playlist_record.id,
    name = normalized_name,
    description = normalized_description,
    snapshot_json = snapshot,
    snapshot_hash = computed_snapshot_hash,
    revision = revision + 1,
    updated_by = actor_id
  where id = template_record.id;

  outcome := jsonb_build_object(
    'outcome', 'updated',
    'templateId', template_record.id,
    'revision', template_record.revision + 1
  );
  return private.complete_publisher_command(
    template_record.tenant_id,
    'tenant_template.update',
    p_idempotency_key,
    request_json,
    'tenant_playlist_templates',
    template_record.id,
    outcome,
    'publisher.template.updated'
  );
end;
$$;

revoke all on function public.update_tenant_playlist_template_v1(
  uuid, bigint, uuid, text, text, uuid
) from public, anon;
grant execute on function public.update_tenant_playlist_template_v1(
  uuid, bigint, uuid, text, text, uuid
) to authenticated;
