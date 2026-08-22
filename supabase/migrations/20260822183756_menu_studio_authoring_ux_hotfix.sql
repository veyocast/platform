create or replace function public.save_menu_studio_document_v2(
  p_slide_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_command jsonb,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  canonical jsonb;
  request_hash text;
  existing record;
  next_revision bigint := p_expected_revision + 1;
begin
  select * into slide from public.dynamic_slides
  where id = p_slide_id and status <> 'archived' for update;
  if not found or slide.slide_type <> 'price_list'
    or slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    raise exception 'Menu Studio draft not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot save Menu Studio drafts' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'read')
    or not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'authoring')
  then
    raise exception 'Menu Studio v2 authoring is not enabled' using errcode = '42501';
  end if;
  if p_operation_id is null or jsonb_typeof(p_command) <> 'object'
    or octet_length(p_command::text) > 65536
  then
    raise exception 'Menu Studio operation is invalid' using errcode = '22023';
  end if;
  request_hash := encode(extensions.digest(
    pg_catalog.convert_to(
      coalesce(p_document, '{}'::jsonb)::text || p_command::text,
      'UTF8'
    ), 'sha256'
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
      'document', slide.configuration_json
    );
  end if;
  if slide.menu_document_revision <> p_expected_revision then
    raise exception 'Menu Studio revision conflict' using errcode = '40001';
  end if;

  canonical := (coalesce(p_document, '{}'::jsonb) - 'publication') ||
    jsonb_build_object(
      'schemaVersion', 'menu-document.v2',
      'id', slide.id,
      'tenantId', slide.tenant_id,
      'revision', next_revision,
      'createdAt', slide.configuration_json -> 'createdAt',
      'updatedAt', now()
    );
  canonical := private.resolve_menu_document_v2(
    slide.tenant_id, slide.data_source_id, canonical
  );
  perform private.validate_menu_document_v2(
    slide.tenant_id, slide.data_source_id, canonical
  );
  if p_command ->> 'kind' = 'set-title' and (
    length(btrim(coalesce(p_command ->> 'title', ''))) not between 2 and 120
    or btrim(coalesce(canonical ->> 'title', '')) is distinct from
      btrim(coalesce(p_command ->> 'title', ''))
  ) then
    raise exception 'Menu Studio title command is invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from private.collect_menu_nodes_v2(canonical) collected(node)
    where collected.node ? 'pricePolicy'
  ) and
    not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'linked_groups')
  then
    raise exception 'Menu Studio linked groups are not enabled' using errcode = '42501';
  end if;
  if jsonb_array_length(canonical -> 'assets') > 0 and
    not private.menu_studio_flag_enabled_v2(slide.tenant_id, 'media')
  then
    raise exception 'Menu Studio media is not enabled' using errcode = '42501';
  end if;

  update public.dynamic_slides
  set name = case
        when p_command ->> 'kind' in ('set-title', 'restore-content')
          and length(btrim(coalesce(canonical ->> 'title', ''))) between 2 and 120
        then btrim(canonical ->> 'title')
        else name
      end,
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
    next_revision, p_command, request_hash, actor_id
  );
  perform private.audit_event(
    slide.tenant_id, 'menu_studio.document.saved', 'dynamic_slides',
    slide.id, 'success', jsonb_build_object(
      'baseRevision', p_expected_revision,
      'revision', next_revision,
      'operationId', p_operation_id
    )
  );
  return jsonb_build_object(
    'outcome', 'applied', 'revision', next_revision, 'document', canonical
  );
end;
$$;

revoke all on function public.save_menu_studio_document_v2(
  uuid, bigint, uuid, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.save_menu_studio_document_v2(
  uuid, bigint, uuid, jsonb, jsonb
) to authenticated, service_role;
