-- S152: keep historical Menu Studio documents renderable while FieldFlow
-- remains mandatory for every new or changed authoring document.

create or replace function private.validate_menu_document_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_document jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  validation_document jsonb := p_document;
begin
  if p_document #>> '{theme,themeId}' = 'fieldflow' then
    validation_document := jsonb_set(
      p_document,
      '{theme,themeId}',
      '"editorial"'::jsonb,
      false
    );
  end if;

  perform private.validate_menu_document_before_fieldflow_v3(
    p_tenant_id,
    p_data_source_id,
    validation_document
  );
end;
$$;

revoke all on function private.validate_menu_document_v2(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_fieldflow_dynamic_authoring_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  authored_theme_id text := coalesce(
    new.configuration_json #>> '{editorial,themeSelection,ref,id}',
    new.configuration_json #>> '{themeSelection,ref,id}',
    new.configuration_json #>> '{menuDocument,theme,themeId}',
    new.configuration_json #>> '{theme,themeId}'
  );
begin
  if authored_theme_id is not null and authored_theme_id <> 'fieldflow' then
    raise exception 'new or changed dynamic content must use FieldFlow 1.0.0'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_fieldflow_dynamic_authoring_v1()
  from public, anon, authenticated, service_role;
