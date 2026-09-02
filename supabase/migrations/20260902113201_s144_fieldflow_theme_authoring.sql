-- S144: FieldFlow is the only theme offered for new or changed content.
-- Historical immutable releases keep their stored theme identifiers and
-- remain renderable; there is deliberately no data backfill.

alter table public.tenant_settings
  drop constraint tenant_settings_default_theme_id_check;

alter table public.tenant_settings
  add constraint tenant_settings_default_theme_id_check
    check (default_theme_id in (
      'fieldflow',
      'editorial', 'obsidian', 'atelier', 'velocity', 'heritage',
      'halo', 'swiss', 'pavilion', 'tactical', 'terrace'
    )),
  alter column default_theme_id set default 'fieldflow';

create or replace function private.theme_selection_is_valid_v1(
  p_selection jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    pg_catalog.jsonb_typeof(p_selection) = 'object'
    and p_selection -> 'ref' ->> 'catalog' = 'v2'
    and p_selection -> 'ref' ->> 'id' in (
      'fieldflow',
      'editorial', 'obsidian', 'atelier', 'velocity', 'heritage',
      'halo', 'swiss', 'pavilion', 'tactical', 'terrace'
    )
    and p_selection -> 'ref' ->> 'version' ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
    and p_selection -> 'modePolicy' ->> 'kind' in (
      'fixed', 'schedule', 'auto'
    )
    and (
      not (p_selection ? 'accent')
      or p_selection -> 'accent' = 'null'::jsonb
      or p_selection ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$'
    )
    and (
      not (p_selection ? 'support')
      or p_selection -> 'support' = 'null'::jsonb
      or p_selection ->> 'support' ~ '^#[0-9A-Fa-f]{6}$'
    );
$$;

revoke all on function private.theme_selection_is_valid_v1(jsonb)
  from public, anon, authenticated;

alter function private.validate_menu_document_v2(uuid, uuid, jsonb)
  rename to validate_menu_document_before_fieldflow_v3;

create function private.validate_menu_document_v2(
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
  if p_document #>> '{theme,themeId}' is distinct from 'fieldflow' then
    raise exception 'new menu documents must use FieldFlow 1.0.0'
      using errcode = '23514';
  end if;
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

revoke all on function private.validate_menu_document_before_fieldflow_v3(
  uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function private.validate_menu_document_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;

create or replace function private.enforce_fieldflow_tenant_theme_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.default_theme_id <> 'fieldflow'
    or new.default_theme_version <> '1.0.0'
  then
    raise exception 'new tenant theme settings must use FieldFlow 1.0.0'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_fieldflow_tenant_theme_v1()
  from public, anon, authenticated;

create trigger tenant_settings_enforce_fieldflow_theme_v1
before insert or update of default_theme_id, default_theme_version
on public.tenant_settings
for each row execute function private.enforce_fieldflow_tenant_theme_v1();

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
    new.configuration_json #>> '{menuDocument,theme,themeId}'
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
  from public, anon, authenticated;

create trigger dynamic_slides_enforce_fieldflow_authoring_v1
before insert or update of configuration_json
on public.dynamic_slides
for each row execute function private.enforce_fieldflow_dynamic_authoring_v1();

create trigger dynamic_slide_versions_enforce_fieldflow_authoring_v1
before insert or update of configuration_json
on public.dynamic_slide_versions
for each row execute function private.enforce_fieldflow_dynamic_authoring_v1();
