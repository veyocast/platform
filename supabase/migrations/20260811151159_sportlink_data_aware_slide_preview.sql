-- Data-aware dynamic-slide previews use the exact canonical snapshot builder
-- without persisting a mutable draft, render job or provider response. The
-- caller must own the tenant write capability; the Player/provider boundary is
-- unchanged because only normalized database content is returned.

create or replace function public.preview_dynamic_slide_v1(
  p_tenant_id uuid,
  p_name text,
  p_template_version_id uuid,
  p_data_source_id uuid,
  p_configuration_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  preview_slide public.dynamic_slides%rowtype;
  selected_template record;
  selected_source public.dynamic_data_sources%rowtype;
  snapshot_data jsonb;
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id,
    'tenant.dynamic_slide.write'
  ) then
    raise exception 'actor cannot preview dynamic slides'
      using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);

  if jsonb_typeof(coalesce(p_configuration_json, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_configuration_json, '{}'::jsonb)::text) > 16384
  then
    raise exception 'dynamic slide preview configuration is invalid'
      using errcode = '22023';
  end if;

  select
    template.id as template_id,
    template.orientation,
    template.slide_type,
    template.slug,
    version.id as version_id
  into selected_template
  from public.dynamic_template_versions version
  join public.dynamic_templates template
    on template.id = version.template_id
  where version.id = p_template_version_id
    and version.status = 'published'
    and template.status = 'published'
    and template.current_published_version_id = version.id;

  if selected_template.version_id is null then
    raise exception 'dynamic slide preview template unavailable'
      using errcode = 'P0002';
  end if;

  select *
  into selected_source
  from public.dynamic_data_sources source
  where source.id = p_data_source_id
    and source.tenant_id = p_tenant_id
    and source.status = 'active';

  if selected_source.id is null then
    raise exception 'dynamic slide preview source unavailable'
      using errcode = 'P0002';
  end if;

  if (
    selected_template.slide_type = 'menu'
    and selected_source.kind not in ('manual_products', 'twelve_excel')
  ) or (
    selected_template.slide_type = 'news'
    and selected_source.kind <> 'rss'
  ) or (
    selected_template.slide_type like 'sport\_%' escape '\'
    and selected_source.kind <> 'sportlink'
  ) then
    raise exception 'dynamic slide preview source does not match template'
      using errcode = '23514';
  end if;

  preview_slide.id := gen_random_uuid();
  preview_slide.tenant_id := p_tenant_id;
  preview_slide.name := left(
    coalesce(nullif(btrim(p_name), ''), 'Voorbeeld'),
    120
  );
  preview_slide.slide_type := selected_template.slide_type;
  preview_slide.orientation := selected_template.orientation;
  preview_slide.template_id := selected_template.template_id;
  preview_slide.template_version_id := selected_template.version_id;
  preview_slide.data_source_id := selected_source.id;
  preview_slide.selection_mode := 'latest';
  preview_slide.status := 'draft';
  preview_slide.configuration_json := coalesce(
    p_configuration_json,
    '{}'::jsonb
  );
  preview_slide.revision := 0;
  preview_slide.created_by := actor_id;
  preview_slide.updated_by := actor_id;
  preview_slide.created_at := now();
  preview_slide.updated_at := now();

  snapshot_data := private.build_dynamic_snapshot_data(preview_slide);

  return jsonb_build_object(
    'previewId', preview_slide.id,
    'data', snapshot_data,
    'orientation', selected_template.orientation,
    'slideType', selected_template.slide_type,
    'templateSlug', selected_template.slug,
    'templateVersionId', selected_template.version_id,
    'source', jsonb_build_object(
      'id', selected_source.id,
      'lastErrorCode', selected_source.last_error_code,
      'lastSuccessfulSyncAt', selected_source.last_successful_sync_at,
      'providerStatus', selected_source.provider_status,
      'revision', selected_source.revision
    )
  );
end
$$;

revoke all on function public.preview_dynamic_slide_v1(
  uuid, text, uuid, uuid, jsonb
) from public, anon;
grant execute on function public.preview_dynamic_slide_v1(
  uuid, text, uuid, uuid, jsonb
) to authenticated, service_role;
