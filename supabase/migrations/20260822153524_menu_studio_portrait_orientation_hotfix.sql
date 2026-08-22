create or replace function public.set_menu_studio_orientation_v2(
  p_slide_id uuid,
  p_expected_revision bigint,
  p_orientation text,
  p_template_version_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  template_record record;
  existing record;
  canonical jsonb;
  request_hash text;
  next_revision bigint := p_expected_revision + 1;
begin
  select * into slide
  from public.dynamic_slides
  where id = p_slide_id
    and status <> 'archived'
  for update;

  if not found
    or slide.slide_type <> 'price_list'
    or slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    raise exception 'Menu Studio draft not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot change Menu Studio orientation'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'read')
    or not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'authoring')
  then
    raise exception 'Menu Studio v2 authoring is not enabled'
      using errcode = '42501';
  end if;
  if p_orientation not in ('landscape', 'portrait')
    or p_template_version_id is null
    or p_operation_id is null
  then
    raise exception 'Menu Studio orientation input is invalid'
      using errcode = '22023';
  end if;

  request_hash := encode(extensions.digest(
    pg_catalog.convert_to(
      p_orientation || ':' || p_template_version_id::text,
      'UTF8'
    ),
    'sha256'
  ), 'hex');
  select operation.next_revision, operation.candidate_sha256
  into existing
  from public.menu_studio_operations operation
  where operation.dynamic_slide_id = slide.id
    and operation.operation_id = p_operation_id;
  if found then
    if existing.candidate_sha256 <> request_hash then
      raise exception 'operation id was already used for different input'
        using errcode = '23505';
    end if;
    if slide.menu_document_revision <> existing.next_revision then
      raise exception 'Menu Studio operation was applied before a newer revision'
        using errcode = '40001';
    end if;
    return jsonb_build_object(
      'outcome', 'already_applied',
      'revision', existing.next_revision,
      'orientation', slide.orientation,
      'templateVersionId', slide.template_version_id,
      'document', slide.configuration_json
    );
  end if;
  if slide.menu_document_revision <> p_expected_revision then
    raise exception 'Menu Studio revision conflict' using errcode = '40001';
  end if;

  select template.id as template_id, version.id as version_id
  into template_record
  from public.dynamic_template_versions version
  join public.dynamic_templates template on template.id = version.template_id
  where version.id = p_template_version_id
    and version.status = 'published'
    and template.status = 'published'
    and template.current_published_version_id = version.id
    and template.slide_type = 'price_list'
    and template.orientation = p_orientation;
  if not found then
    raise exception 'published price-list orientation template not found'
      using errcode = 'P0002';
  end if;

  canonical := jsonb_set(
    jsonb_set(
      slide.configuration_json - 'publication',
      '{revision}',
      to_jsonb(next_revision),
      true
    ),
    '{updatedAt}',
    to_jsonb(now()),
    true
  );
  perform private.validate_menu_document_v2(
    slide.tenant_id, slide.data_source_id, canonical
  );

  update public.dynamic_slides
  set orientation = p_orientation,
      template_id = template_record.template_id,
      template_version_id = template_record.version_id,
      configuration_json = canonical,
      menu_document_revision = next_revision,
      revision = revision + 1,
      updated_by = actor_id,
      last_error_code = null
  where id = slide.id;

  insert into public.menu_studio_operations (
    tenant_id, dynamic_slide_id, operation_id, base_revision,
    next_revision, command_json, candidate_sha256, actor_id
  ) values (
    slide.tenant_id, slide.id, p_operation_id, p_expected_revision,
    next_revision,
    jsonb_build_object(
      'kind', 'set-orientation',
      'orientation', p_orientation,
      'templateVersionId', p_template_version_id
    ),
    request_hash,
    actor_id
  );
  perform private.audit_event(
    slide.tenant_id,
    'menu_studio.orientation.changed',
    'dynamic_slides',
    slide.id,
    'success',
    jsonb_build_object(
      'from', slide.orientation,
      'to', p_orientation,
      'revision', next_revision,
      'operationId', p_operation_id
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'revision', next_revision,
    'orientation', p_orientation,
    'templateVersionId', p_template_version_id,
    'document', canonical
  );
end;
$$;

revoke all on function public.set_menu_studio_orientation_v2(
  uuid, bigint, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.set_menu_studio_orientation_v2(
  uuid, bigint, text, uuid, uuid
) to authenticated, service_role;
