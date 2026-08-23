-- S122: one logical dynamic slide with immutable configuration versions.
-- Runtime columns on dynamic_slides remain the backwards-compatible
-- materialisation consumed by the existing resolver/player pipeline.

create or replace function private.dynamic_slide_theme_selection_v1(
  p_configuration jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  menu_theme jsonb;
  selection jsonb;
begin
  selection := p_configuration #> '{editorial,themeSelection}';
  if pg_catalog.jsonb_typeof(selection) = 'object' then
    return selection;
  end if;

  menu_theme := p_configuration -> 'theme';
  if p_configuration ->> 'schemaVersion' = 'menu-document.v2'
    and pg_catalog.jsonb_typeof(menu_theme) = 'object'
    and menu_theme ->> 'themeId' is not null
  then
    return jsonb_build_object(
      'ref', jsonb_build_object(
        'catalog', 'v2',
        'id', menu_theme ->> 'themeId',
        'version', coalesce(menu_theme ->> 'themeVersion', '1.0.0')
      ),
      'modePolicy', jsonb_build_object(
        'kind', 'fixed',
        'mode', case when menu_theme ->> 'mode' = 'dark' then 'dark' else 'light' end
      ),
      'accent', coalesce(menu_theme #> '{brand,accent}', 'null'::jsonb),
      'support', coalesce(menu_theme #> '{brand,support}', 'null'::jsonb),
      'categoryOverrides', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'ref', jsonb_build_object(
      'catalog', 'legacy',
      'legacyThemeId', 'editorial-arena',
      'version', 1
    ),
    'modePolicy', jsonb_build_object(
      'kind', 'fixed',
      'mode', case
        when p_configuration #>> '{editorial,theme,mode}' = 'dark' then 'dark'
        else 'light'
      end
    ),
    'accent', 'null'::jsonb,
    'support', 'null'::jsonb,
    'categoryOverrides', '[]'::jsonb
  );
end;
$$;

revoke all on function private.dynamic_slide_theme_selection_v1(jsonb)
  from public, anon, authenticated;

create table public.dynamic_slide_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dynamic_slide_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (
    status in ('draft', 'publishing', 'published', 'archived')
  ),
  name text not null check (length(btrim(name)) between 2 and 120),
  slide_type text not null,
  orientation text not null check (orientation in ('landscape', 'portrait')),
  template_id uuid not null,
  template_version_id uuid not null,
  data_source_id uuid not null,
  selection_mode text not null check (selection_mode in ('latest', 'pinned')),
  configuration_json jsonb not null check (
    jsonb_typeof(configuration_json) = 'object'
  ),
  theme_selection_json jsonb not null check (
    jsonb_typeof(theme_selection_json) = 'object'
  ),
  edit_revision bigint not null default 0 check (edit_revision >= 0),
  based_on_version_id uuid,
  published_snapshot_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  foreign key (tenant_id, dynamic_slide_id)
    references public.dynamic_slides(tenant_id, id) on delete restrict,
  foreign key (template_id, template_version_id)
    references public.dynamic_template_versions(template_id, id) on delete restrict,
  foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (dynamic_slide_id, id),
  unique (dynamic_slide_id, version_number),
  check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

alter table public.dynamic_slide_versions
  add constraint dynamic_slide_versions_basis_fkey
  foreign key (dynamic_slide_id, based_on_version_id)
  references public.dynamic_slide_versions(dynamic_slide_id, id)
  on delete restrict;

create unique index dynamic_slide_versions_one_open_draft_idx
  on public.dynamic_slide_versions(dynamic_slide_id)
  where status in ('draft', 'publishing');
create index dynamic_slide_versions_history_idx
  on public.dynamic_slide_versions(tenant_id, dynamic_slide_id, version_number desc);
create index dynamic_slide_versions_status_idx
  on public.dynamic_slide_versions(tenant_id, status, created_at desc);

alter table public.dynamic_slides
  add column current_published_version_id uuid,
  add column active_draft_version_id uuid;

insert into public.dynamic_slide_versions (
  tenant_id, dynamic_slide_id, version_number, status, name, slide_type,
  orientation, template_id, template_version_id, data_source_id,
  selection_mode, configuration_json, theme_selection_json, edit_revision,
  created_by, published_by, created_at, published_at
)
select
  slide.tenant_id,
  slide.id,
  1,
  case when slide.current_snapshot_id is null then 'draft' else 'published' end,
  slide.name,
  slide.slide_type,
  slide.orientation,
  slide.template_id,
  slide.template_version_id,
  slide.data_source_id,
  slide.selection_mode,
  slide.configuration_json,
  private.dynamic_slide_theme_selection_v1(slide.configuration_json),
  slide.revision,
  slide.created_by,
  case when slide.current_snapshot_id is null then null else slide.updated_by end,
  slide.created_at,
  case when slide.current_snapshot_id is null then null else slide.updated_at end
from public.dynamic_slides slide;

update public.dynamic_slides slide
set current_published_version_id = case
      when version.status = 'published' then version.id else null end,
    active_draft_version_id = case
      when version.status = 'draft' then version.id else null end
from public.dynamic_slide_versions version
where version.dynamic_slide_id = slide.id
  and version.version_number = 1;

alter table public.dynamic_slides
  add constraint dynamic_slides_current_version_fkey
  foreign key (id, current_published_version_id)
  references public.dynamic_slide_versions(dynamic_slide_id, id)
  on delete restrict,
  add constraint dynamic_slides_active_draft_fkey
  foreign key (id, active_draft_version_id)
  references public.dynamic_slide_versions(dynamic_slide_id, id)
  on delete restrict;

alter table public.dynamic_slide_snapshots
  add column dynamic_slide_version_id uuid;

update public.dynamic_slide_snapshots snapshot
set dynamic_slide_version_id = version.id
from public.dynamic_slide_versions version
where version.dynamic_slide_id = snapshot.dynamic_slide_id
  and version.version_number = 1;

alter table public.dynamic_slide_snapshots
  alter column dynamic_slide_version_id set not null,
  add constraint dynamic_slide_snapshots_version_fkey
  foreign key (dynamic_slide_id, dynamic_slide_version_id)
  references public.dynamic_slide_versions(dynamic_slide_id, id)
  on delete restrict;

-- Snapshot identity is scoped to an immutable design version. The content
-- hash itself stays purely content-addressed so identical output can still
-- reuse the same generated fallback asset across logical slides.
alter table public.dynamic_slide_snapshots
  drop constraint dynamic_slide_snapshots_dynamic_slide_id_source_revision_ha_key,
  add constraint dynamic_slide_snapshots_slide_version_content_key
  unique (
    dynamic_slide_id, dynamic_slide_version_id, source_revision_hash,
    template_version_id
  );

create index dynamic_slide_snapshots_version_idx
  on public.dynamic_slide_snapshots(
    tenant_id, dynamic_slide_version_id, created_at desc
  );

update public.dynamic_slide_versions version
set published_snapshot_id = slide.current_snapshot_id
from public.dynamic_slides slide
where slide.current_published_version_id = version.id
  and slide.current_snapshot_id is not null;

alter table public.dynamic_slide_versions
  add constraint dynamic_slide_versions_snapshot_fkey
  foreign key (tenant_id, published_snapshot_id)
  references public.dynamic_slide_snapshots(tenant_id, id)
  on delete restrict;

alter table public.dynamic_slide_versions enable row level security;
alter table public.dynamic_slide_versions force row level security;
revoke all on public.dynamic_slide_versions from public, anon, authenticated;
grant select on public.dynamic_slide_versions to authenticated;
grant select, insert, update on public.dynamic_slide_versions to service_role;

create policy dynamic_slide_versions_tenant_read
on public.dynamic_slide_versions for select to authenticated
using (private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read'));

create or replace function private.reject_published_dynamic_slide_version_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status in ('published', 'archived') then
    raise exception 'published dynamic slide versions are immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_published_dynamic_slide_version_mutation_v1()
  from public, anon, authenticated;

create trigger dynamic_slide_versions_reject_immutable_mutation
before update or delete on public.dynamic_slide_versions
for each row execute function private.reject_published_dynamic_slide_version_mutation_v1();

create or replace function private.create_initial_dynamic_slide_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_id uuid;
begin
  insert into public.dynamic_slide_versions (
    tenant_id, dynamic_slide_id, version_number, status, name, slide_type,
    orientation, template_id, template_version_id, data_source_id,
    selection_mode, configuration_json, theme_selection_json, edit_revision,
    created_by
  ) values (
    new.tenant_id, new.id, 1, 'draft', new.name, new.slide_type,
    new.orientation, new.template_id, new.template_version_id,
    new.data_source_id, new.selection_mode, new.configuration_json,
    private.dynamic_slide_theme_selection_v1(new.configuration_json),
    new.revision, new.created_by
  ) returning id into version_id;

  update public.dynamic_slides
  set active_draft_version_id = version_id
  where id = new.id;
  return new;
end;
$$;

revoke all on function private.create_initial_dynamic_slide_version_v1()
  from public, anon, authenticated;

create trigger dynamic_slides_create_initial_version
after insert on public.dynamic_slides
for each row execute function private.create_initial_dynamic_slide_version_v1();

create or replace function private.mirror_dynamic_slide_draft_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active_draft_version_id is null then return new; end if;
  update public.dynamic_slide_versions version
  set name = case
        when new.name is distinct from old.name then new.name
        when new.slide_type = 'price_list'
          and nullif(btrim(new.configuration_json ->> 'title'), '') is not null
          then btrim(new.configuration_json ->> 'title')
        else version.name
      end,
      slide_type = new.slide_type,
      orientation = new.orientation,
      template_id = new.template_id,
      template_version_id = new.template_version_id,
      data_source_id = new.data_source_id,
      selection_mode = new.selection_mode,
      configuration_json = new.configuration_json,
      theme_selection_json = private.dynamic_slide_theme_selection_v1(new.configuration_json),
      edit_revision = case
        when new.configuration_json ->> 'schemaVersion' = 'menu-document.v2'
          then coalesce((new.configuration_json ->> 'revision')::bigint, version.edit_revision)
        else greatest(version.edit_revision, new.revision)
      end
  where version.id = new.active_draft_version_id
    and version.dynamic_slide_id = new.id
    and version.status = 'draft';
  return new;
end;
$$;

revoke all on function private.mirror_dynamic_slide_draft_v1()
  from public, anon, authenticated;

create trigger dynamic_slides_mirror_active_draft
after update of name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, configuration_json,
  revision
on public.dynamic_slides
for each row execute function private.mirror_dynamic_slide_draft_v1();

create or replace function private.guard_dynamic_slide_design_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.dynamic_slide_versions%rowtype;
begin
  if old.current_published_version_id is null then return new; end if;
  select * into candidate from public.dynamic_slide_versions
  where id = new.active_draft_version_id
    and dynamic_slide_id = new.id;
  if candidate.status = 'draft' then return new; end if;
  if candidate.status = 'publishing'
    and new.name is not distinct from candidate.name
    and new.slide_type is not distinct from candidate.slide_type
    and new.orientation is not distinct from candidate.orientation
    and new.template_id is not distinct from candidate.template_id
    and new.template_version_id is not distinct from candidate.template_version_id
    and new.data_source_id is not distinct from candidate.data_source_id
    and new.selection_mode is not distinct from candidate.selection_mode
    and new.configuration_json is not distinct from candidate.configuration_json
  then return new; end if;
  raise exception 'published slide design requires an active draft version'
    using errcode = '55000';
end;
$$;

revoke all on function private.guard_dynamic_slide_design_mutation_v1()
  from public, anon, authenticated;

create trigger dynamic_slides_guard_versioned_design
before update of name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, configuration_json
on public.dynamic_slides
for each row execute function private.guard_dynamic_slide_design_mutation_v1();

create or replace function private.assign_dynamic_snapshot_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
  draft_status text;
begin
  select * into slide_record
  from public.dynamic_slides slide
  where slide.id = new.dynamic_slide_id;
  if not found then
    raise exception 'dynamic slide not found' using errcode = 'P0002';
  end if;

  if slide_record.active_draft_version_id is not null then
    select status into draft_status
    from public.dynamic_slide_versions
    where id = slide_record.active_draft_version_id;
  end if;

  if draft_status = 'publishing' then
    new.dynamic_slide_version_id := slide_record.active_draft_version_id;
  elsif slide_record.current_published_version_id is not null then
    new.dynamic_slide_version_id := slide_record.current_published_version_id;
  elsif draft_status = 'draft' then
    update public.dynamic_slide_versions
    set status = 'publishing'
    where id = slide_record.active_draft_version_id;
    new.dynamic_slide_version_id := slide_record.active_draft_version_id;
  else
    raise exception 'dynamic slide has no runtime version' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.assign_dynamic_snapshot_version_v1()
  from public, anon, authenticated;

create trigger dynamic_snapshots_assign_version
before insert on public.dynamic_slide_snapshots
for each row execute function private.assign_dynamic_snapshot_version_v1();

create or replace function private.finalize_dynamic_slide_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_id uuid;
begin
  if new.current_snapshot_id is null
    or new.current_snapshot_id is not distinct from old.current_snapshot_id
  then return new; end if;

  select snapshot.dynamic_slide_version_id into version_id
  from public.dynamic_slide_snapshots snapshot
  where snapshot.id = new.current_snapshot_id
    and snapshot.tenant_id = new.tenant_id
    and snapshot.status = 'ready';
  if version_id is null then return new; end if;

  update public.dynamic_slide_versions version
  set status = 'published',
      published_snapshot_id = new.current_snapshot_id,
      published_by = coalesce(version.published_by, new.updated_by),
      published_at = coalesce(version.published_at, now())
  where version.id = version_id
    and version.status = 'publishing';

  if found then
    update public.dynamic_slides slide
    set current_published_version_id = version_id,
        active_draft_version_id = null,
        menu_last_published_revision = case
          when slide.slide_type = 'price_list'
            then (slide.configuration_json ->> 'revision')::bigint
          else slide.menu_last_published_revision
        end
    where slide.id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.finalize_dynamic_slide_version_v1()
  from public, anon, authenticated;

create trigger dynamic_slides_finalize_version
after update of current_snapshot_id on public.dynamic_slides
for each row execute function private.finalize_dynamic_slide_version_v1();

create or replace function public.create_or_resume_dynamic_slide_version_v1(
  p_slide_id uuid,
  p_basis_version_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  basis public.dynamic_slide_versions%rowtype;
  draft public.dynamic_slide_versions%rowtype;
  next_number integer;
begin
  select * into slide from public.dynamic_slides
  where id = p_slide_id and status <> 'archived' for update;
  if not found then raise exception 'dynamic slide not found' using errcode = 'P0002'; end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then raise exception 'actor cannot version dynamic slide' using errcode = '42501'; end if;
  perform private.require_active_tenant_command(slide.tenant_id);

  if slide.active_draft_version_id is not null then
    select * into draft from public.dynamic_slide_versions
    where id = slide.active_draft_version_id;
    return jsonb_build_object(
      'outcome', case when draft.status = 'publishing' then 'publishing' else 'resumed' end,
      'slideId', slide.id,
      'versionId', draft.id,
      'versionNumber', draft.version_number,
      'editRevision', draft.edit_revision
    );
  end if;

  select * into basis from public.dynamic_slide_versions version
  where version.dynamic_slide_id = slide.id
    and version.id = coalesce(p_basis_version_id, slide.current_published_version_id)
    and version.status in ('published', 'archived');
  if not found then raise exception 'published slide version not found' using errcode = 'P0002'; end if;

  select coalesce(max(version_number), 0) + 1 into next_number
  from public.dynamic_slide_versions where dynamic_slide_id = slide.id;
  insert into public.dynamic_slide_versions (
    tenant_id, dynamic_slide_id, version_number, status, name, slide_type,
    orientation, template_id, template_version_id, data_source_id,
    selection_mode, configuration_json, theme_selection_json,
    edit_revision, based_on_version_id, created_by
  ) values (
    basis.tenant_id, basis.dynamic_slide_id, next_number, 'draft', basis.name,
    basis.slide_type, basis.orientation, basis.template_id,
    basis.template_version_id, basis.data_source_id, basis.selection_mode,
    basis.configuration_json, basis.theme_selection_json,
    case
      when basis.configuration_json ->> 'schemaVersion' = 'menu-document.v2'
        then coalesce((basis.configuration_json ->> 'revision')::bigint, 1)
      else 0
    end,
    basis.id, actor_id
  ) returning * into draft;
  update public.dynamic_slides
  set active_draft_version_id = draft.id,
      name = draft.name,
      slide_type = draft.slide_type,
      orientation = draft.orientation,
      template_id = draft.template_id,
      template_version_id = draft.template_version_id,
      data_source_id = draft.data_source_id,
      selection_mode = draft.selection_mode,
      configuration_json = draft.configuration_json,
      menu_document_revision = case
        when draft.configuration_json ->> 'schemaVersion' = 'menu-document.v2'
          then coalesce((draft.configuration_json ->> 'revision')::bigint, 1)
        else menu_document_revision
      end,
      revision = revision + 1,
      updated_by = actor_id,
      updated_at = now()
  where id = slide.id;

  perform private.audit_event(
    slide.tenant_id, 'dynamic_slide.version.created',
    'dynamic_slide_versions', draft.id, 'success',
    jsonb_build_object(
      'slideId', slide.id, 'version', next_number,
      'basedOnVersionId', basis.id
    )
  );
  return jsonb_build_object(
    'outcome', 'created', 'slideId', slide.id,
    'versionId', draft.id, 'versionNumber', next_number,
    'editRevision', draft.edit_revision
  );
end;
$$;

revoke all on function public.create_or_resume_dynamic_slide_version_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_or_resume_dynamic_slide_version_v1(uuid, uuid)
  to authenticated;

create or replace function public.save_dynamic_slide_version_v1(
  p_slide_id uuid,
  p_version_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_template_version_id uuid,
  p_data_source_id uuid,
  p_orientation text,
  p_selection_mode text,
  p_configuration jsonb,
  p_theme_selection jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  version public.dynamic_slide_versions%rowtype;
  template_record record;
  next_revision bigint;
begin
  select * into slide from public.dynamic_slides
  where id = p_slide_id and status <> 'archived' for update;
  select * into version from public.dynamic_slide_versions
  where id = p_version_id and dynamic_slide_id = p_slide_id for update;
  if slide.id is null or version.id is null or version.status <> 'draft'
    or slide.active_draft_version_id is distinct from version.id
  then raise exception 'active dynamic slide draft not found' using errcode = 'P0002'; end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then raise exception 'actor cannot save dynamic slide version' using errcode = '42501'; end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if version.edit_revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict', 'actualRevision', version.edit_revision);
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 2 and 120
    or p_orientation not in ('landscape', 'portrait')
    or p_selection_mode not in ('latest', 'pinned')
    or jsonb_typeof(p_configuration) <> 'object'
    or jsonb_typeof(p_theme_selection) <> 'object'
    or not (
      private.theme_selection_is_valid_v1(p_theme_selection)
      or p_theme_selection #>> '{ref,catalog}' = 'legacy'
    )
  then raise exception 'dynamic slide version input is invalid' using errcode = '22023'; end if;

  select template.id, template.slide_type into template_record
  from public.dynamic_template_versions template_version
  join public.dynamic_templates template on template.id = template_version.template_id
  where template_version.id = p_template_version_id
    and template_version.status = 'published'
    and template.status = 'published'
    and template.current_published_version_id = template_version.id
    and template.orientation = p_orientation;
  if not found then raise exception 'published slide template not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.dynamic_data_sources source
    where source.id = p_data_source_id and source.tenant_id = slide.tenant_id
      and source.status <> 'archived'
  ) then raise exception 'dynamic data source not found' using errcode = 'P0002'; end if;

  next_revision := version.edit_revision + 1;
  update public.dynamic_slide_versions
  set name = btrim(p_name), slide_type = template_record.slide_type,
      orientation = p_orientation, template_id = template_record.id,
      template_version_id = p_template_version_id,
      data_source_id = p_data_source_id, selection_mode = p_selection_mode,
      configuration_json = p_configuration,
      theme_selection_json = p_theme_selection,
      edit_revision = next_revision
  where id = version.id;

  -- Materialise the draft for the existing preview/editor pipeline. Automatic
  -- provider refresh ignores slides with an open draft; the ready current
  -- snapshot and every historical playlist release remain untouched.
  update public.dynamic_slides
  set slide_type = template_record.slide_type,
      orientation = p_orientation, template_id = template_record.id,
      template_version_id = p_template_version_id,
      data_source_id = p_data_source_id, selection_mode = p_selection_mode,
      configuration_json = p_configuration,
      revision = revision + 1, updated_by = actor_id, updated_at = now()
  where id = slide.id;

  perform private.audit_event(
    slide.tenant_id, 'dynamic_slide.version.saved',
    'dynamic_slide_versions', version.id, 'success',
    jsonb_build_object('slideId', slide.id, 'revision', next_revision)
  );
  return jsonb_build_object(
    'outcome', 'applied', 'slideId', slide.id, 'versionId', version.id,
    'versionNumber', version.version_number, 'editRevision', next_revision
  );
end;
$$;

revoke all on function public.save_dynamic_slide_version_v1(
  uuid, uuid, bigint, text, uuid, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.save_dynamic_slide_version_v1(
  uuid, uuid, bigint, text, uuid, uuid, text, text, jsonb, jsonb
) to authenticated;

create or replace function public.publish_dynamic_slide_version_v1(
  p_slide_id uuid,
  p_version_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide public.dynamic_slides%rowtype;
  version public.dynamic_slide_versions%rowtype;
  snapshot_result jsonb;
begin
  select * into slide from public.dynamic_slides
  where id = p_slide_id and status <> 'archived' for update;
  select * into version from public.dynamic_slide_versions
  where id = p_version_id and dynamic_slide_id = p_slide_id for update;
  if slide.id is null or version.id is null
    or slide.active_draft_version_id is distinct from version.id
  then raise exception 'active dynamic slide draft not found' using errcode = 'P0002'; end if;
  if actor_id is null or not private.has_tenant_capability(
    slide.tenant_id, 'tenant.dynamic_slide.write'
  ) then raise exception 'actor cannot publish dynamic slide version' using errcode = '42501'; end if;
  perform private.require_active_tenant_command(slide.tenant_id);
  if version.status = 'publishing' then
    return jsonb_build_object(
      'outcome', 'publishing', 'slideId', slide.id,
      'versionId', version.id, 'versionNumber', version.version_number
    );
  end if;
  if version.status <> 'draft' or version.edit_revision <> p_expected_revision then
    return jsonb_build_object('outcome', 'conflict', 'actualRevision', version.edit_revision);
  end if;
  if version.configuration_json ->> 'schemaVersion' = 'menu-document.v2' then
    perform private.validate_menu_document_v2(
      slide.tenant_id, version.data_source_id, version.configuration_json
    );
  end if;

  update public.dynamic_slide_versions
  set status = 'publishing', published_by = actor_id
  where id = version.id;
  update public.dynamic_slides
  set name = version.name, slide_type = version.slide_type,
      orientation = version.orientation, template_id = version.template_id,
      template_version_id = version.template_version_id,
      data_source_id = version.data_source_id,
      selection_mode = version.selection_mode,
      configuration_json = version.configuration_json,
      status = case when current_snapshot_id is null then 'draft' else status end,
      revision = revision + 1, updated_by = actor_id, updated_at = now()
  where id = slide.id;

  snapshot_result := public.refresh_dynamic_slide_v1(slide.id);
  perform private.audit_event(
    slide.tenant_id, 'dynamic_slide.version.publish_started',
    'dynamic_slide_versions', version.id, 'success',
    jsonb_build_object(
      'slideId', slide.id, 'version', version.version_number,
      'snapshotId', snapshot_result ->> 'snapshotId'
    )
  );
  return snapshot_result || jsonb_build_object(
    'outcome', 'publishing', 'slideId', slide.id,
    'versionId', version.id, 'versionNumber', version.version_number
  );
end;
$$;

revoke all on function public.publish_dynamic_slide_version_v1(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.publish_dynamic_slide_version_v1(uuid, uuid, bigint)
  to authenticated;

alter function private.dynamic_snapshot_content_hash_v1(
  public.dynamic_slides, jsonb
) rename to dynamic_snapshot_content_hash_before_s122_versions;

create or replace function private.dynamic_snapshot_content_hash_v1(
  p_slide public.dynamic_slides,
  p_snapshot_data jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.dynamic_snapshot_content_hash_before_s122_versions(
    p_slide, p_snapshot_data
  )
$$;

revoke all on function private.dynamic_snapshot_content_hash_v1(
  public.dynamic_slides, jsonb
) from public, anon, authenticated;

-- Provider data refresh must never render an unpublished design draft.
create or replace function private.queue_latest_dynamic_snapshots_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_slide_types text[] default null,
  p_reason text default 'source_content_changed'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  content_hash text;
  new_snapshot_id uuid;
  runtime_version_id uuid;
  queued_count integer := 0;
begin
  for slide_record in
    select slide.* from public.dynamic_slides slide
    where slide.tenant_id = p_tenant_id
      and slide.data_source_id = p_data_source_id
      and slide.selection_mode = 'latest'
      and slide.status <> 'archived'
      and (
        slide.current_published_version_id is not null
        or exists (
          select 1 from public.dynamic_slide_versions publishing
          where publishing.id = slide.active_draft_version_id
            and publishing.status = 'publishing'
        )
      )
      and not exists (
        select 1 from public.dynamic_slide_versions draft
        where draft.id = slide.active_draft_version_id
          and draft.status = 'draft'
      )
      and (p_slide_types is null or slide.slide_type = any(p_slide_types))
    order by slide.id
  loop
    select case
      when active.status = 'publishing' then slide_record.active_draft_version_id
      else slide_record.current_published_version_id
    end into runtime_version_id
    from (select 1) singleton
    left join public.dynamic_slide_versions active
      on active.id = slide_record.active_draft_version_id;
    snapshot_data := private.build_dynamic_snapshot_data(slide_record);
    content_hash := private.dynamic_snapshot_content_hash_v1(slide_record, snapshot_data);
    new_snapshot_id := null;
    if exists (
      select 1 from public.dynamic_slide_snapshots current_snapshot
      where current_snapshot.id = slide_record.current_snapshot_id
        and current_snapshot.dynamic_slide_id = slide_record.id
        and current_snapshot.dynamic_slide_version_id = runtime_version_id
        and current_snapshot.template_version_id = slide_record.template_version_id
        and private.dynamic_snapshot_content_hash_v1(
          slide_record, current_snapshot.snapshot_data_json
        ) = content_hash
    ) then continue; end if;
    insert into public.dynamic_slide_snapshots(
      tenant_id, dynamic_slide_id, template_version_id, data_source_id,
      source_revision_hash, snapshot_data_json
    ) values (
      slide_record.tenant_id, slide_record.id, slide_record.template_version_id,
      slide_record.data_source_id, content_hash, snapshot_data
    ) on conflict (
      dynamic_slide_id, dynamic_slide_version_id, source_revision_hash,
      template_version_id
    )
      do nothing returning id into new_snapshot_id;
    if new_snapshot_id is not null then
      insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
      values (slide_record.tenant_id, new_snapshot_id);
      update public.dynamic_slides set status = 'rendering', last_error_code = null
      where id = slide_record.id;
      queued_count := queued_count + 1;
    end if;
  end loop;
  if queued_count > 0 then
    insert into public.audit_events(
      tenant_id, action, target_type, target_id, result, metadata
    ) values (
      p_tenant_id, 'dynamic.snapshot.auto_queued', 'dynamic_data_sources',
      p_data_source_id, 'success', jsonb_build_object(
        'systemExecuted', true,
        'reason', left(coalesce(p_reason, 'source_content_changed'), 120),
        'queuedCount', queued_count
      )
    );
  end if;
  return queued_count;
end;
$$;

revoke all on function private.queue_latest_dynamic_snapshots_v2(
  uuid, uuid, text[], text
) from public, anon, authenticated;

create or replace function public.refresh_dynamic_slide_v1(
  p_slide_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  slide_record public.dynamic_slides%rowtype;
  snapshot_data jsonb;
  content_hash text;
  target_snapshot_id uuid;
  target_version_id uuid;
  snapshot_status text;
  draft_status text;
  job_id uuid;
  created_snapshot boolean := false;
begin
  select * into slide_record from public.dynamic_slides
  where id = p_slide_id and status <> 'archived';
  if not found then raise exception 'dynamic slide not found' using errcode = 'P0002'; end if;
  if actor_id is null or not private.has_tenant_capability(
    slide_record.tenant_id, 'tenant.dynamic_slide.write'
  ) then raise exception 'actor cannot refresh dynamic slide' using errcode = '42501'; end if;

  if slide_record.active_draft_version_id is not null then
    select status into draft_status from public.dynamic_slide_versions
    where id = slide_record.active_draft_version_id;
  end if;
  if draft_status = 'draft' and slide_record.current_published_version_id is not null then
    raise exception 'publish the active slide draft before rendering'
      using errcode = '55000';
  end if;
  target_version_id := case
    when draft_status in ('draft', 'publishing')
      then slide_record.active_draft_version_id
    else slide_record.current_published_version_id
  end;
  if target_version_id is null then
    raise exception 'dynamic slide has no renderable version' using errcode = '55000';
  end if;

  snapshot_data := private.build_dynamic_snapshot_data(slide_record);
  if snapshot_data = '{}'::jsonb
    or (
      slide_record.slide_type = 'menu'
      and jsonb_array_length(snapshot_data #> '{menu,products}') = 0
    )
    or (
      slide_record.slide_type = 'news'
      and jsonb_array_length(snapshot_data #> '{news,articles}') = 0
    )
  then raise exception 'data source has no renderable content' using errcode = '23514'; end if;

  content_hash := private.dynamic_snapshot_content_hash_v1(
    slide_record, snapshot_data
  );
  select snapshot.id, snapshot.status
  into target_snapshot_id, snapshot_status
  from public.dynamic_slide_snapshots snapshot
  where snapshot.id = slide_record.current_snapshot_id
    and snapshot.dynamic_slide_id = slide_record.id
    and snapshot.dynamic_slide_version_id = target_version_id
    and snapshot.template_version_id = slide_record.template_version_id
    and private.dynamic_snapshot_content_hash_v1(
      slide_record, snapshot.snapshot_data_json
    ) = content_hash;

  if target_snapshot_id is null then
    select snapshot.id, snapshot.status
    into target_snapshot_id, snapshot_status
    from public.dynamic_slide_snapshots snapshot
    where snapshot.dynamic_slide_id = slide_record.id
      and snapshot.dynamic_slide_version_id = target_version_id
      and snapshot.template_version_id = slide_record.template_version_id
      and snapshot.source_revision_hash = content_hash;
  end if;

  if target_snapshot_id is null then
    insert into public.dynamic_slide_snapshots(
      tenant_id, dynamic_slide_id, template_version_id, data_source_id,
      source_revision_hash, snapshot_data_json, created_by
    ) values (
      slide_record.tenant_id, slide_record.id,
      slide_record.template_version_id, slide_record.data_source_id,
      content_hash, snapshot_data, actor_id
    ) returning id, status into target_snapshot_id, snapshot_status;
    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    values (slide_record.tenant_id, target_snapshot_id)
    returning id into job_id;
    created_snapshot := true;
    update public.dynamic_slides
    set status = 'rendering', last_error_code = null,
        revision = revision + 1, updated_by = actor_id
    where id = slide_record.id;
    perform private.audit_event(
      slide_record.tenant_id, 'dynamic.snapshot.created',
      'dynamic_slide_snapshots', target_snapshot_id, 'success',
      jsonb_build_object(
        'slideId', slide_record.id, 'versionId', target_version_id,
        'jobId', job_id
      )
    );
  else
    select job.id into job_id from public.dynamic_render_jobs job
    where job.snapshot_id = target_snapshot_id;
  end if;

  return jsonb_build_object(
    'slideId', slide_record.id,
    'versionId', target_version_id,
    'snapshotId', target_snapshot_id,
    'jobId', job_id,
    'status', case when created_snapshot then 'rendering' else snapshot_status end,
    'changed', created_snapshot
  );
end;
$$;

revoke all on function public.refresh_dynamic_slide_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_dynamic_slide_v1(uuid)
  to authenticated;

create or replace function private.restore_failed_dynamic_slide_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slide_record public.dynamic_slides%rowtype;
begin
  if new.status <> 'failed' or old.status = 'failed' then return new; end if;
  select * into slide_record from public.dynamic_slides
  where id = new.dynamic_slide_id for update;
  if slide_record.active_draft_version_id is distinct from new.dynamic_slide_version_id
  then return new; end if;

  if slide_record.current_published_version_id is not null then
    update public.dynamic_slides
    set status = 'ready',
        last_error_code = coalesce(new.error_code, 'VERSION_RENDER_FAILED')
    where id = slide_record.id;
  end if;

  -- Restore the runtime materialisation while the candidate still has the
  -- publishing state. The draft mirror deliberately ignores that state, so a
  -- failed render cannot overwrite the user's draft with the old current
  -- configuration.
  update public.dynamic_slide_versions
  set status = 'draft', published_by = null
  where id = new.dynamic_slide_version_id and status = 'publishing';
  return new;
end;
$$;

revoke all on function private.restore_failed_dynamic_slide_version_v1()
  from public, anon, authenticated;

create trigger dynamic_snapshots_restore_failed_version
after update of status on public.dynamic_slide_snapshots
for each row execute function private.restore_failed_dynamic_slide_version_v1();

-- S119 retained the brand payload but accidentally dropped the frozen S109
-- themePresentation for typed Sportlink blueprints. Restore that canonical
-- payload instead of introducing a second renderer theme path.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s122_theme_restore;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  themed_base jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_s122_theme_restore(p_slide);
  if p_slide.configuration_json ->> 'blueprintKey' is null then return result; end if;
  themed_base := private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide);
  return result
    || jsonb_build_object(
      'brand', coalesce(themed_base -> 'brand', '{}'::jsonb),
      'themePresentation', themed_base -> 'themePresentation'
    );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(public.dynamic_slides)
  from public, anon, authenticated;

create or replace function public.create_sportlink_slide_batch_v2(
  p_tenant_id uuid,
  p_data_source_id uuid,
  p_drafts jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  batch_id uuid;
  draft jsonb;
  expected_type text;
  actual_type text;
  result jsonb;
  results jsonb := '[]'::jsonb;
  selection jsonb;
  allowed_keys constant text[] := array[
    'sportlink.club_schedule_today', 'sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today', 'sportlink.club_results_previous_7_days',
    'sportlink.pool_schedule_next_7_days', 'sportlink.pool_results_previous_7_days',
    'sportlink.pool_standings', 'sportlink.visitor_arrivals',
    'sportlink.referee_arrivals'
  ];
begin
  if actor_id is null or not private.has_tenant_capability(
    p_tenant_id, 'tenant.dynamic_slide.write'
  ) then raise exception 'actor cannot create Sportlink slides' using errcode = '42501'; end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists (
    select 1 from public.dynamic_data_sources
    where id = p_data_source_id and tenant_id = p_tenant_id
      and kind = 'sportlink' and status = 'active'
  ) then raise exception 'Sportlink source unavailable' using errcode = '23514'; end if;
  if jsonb_typeof(p_drafts) <> 'array'
    or jsonb_array_length(p_drafts) not between 1 and 25
  then raise exception 'invalid Sportlink batch' using errcode = '22023'; end if;

  select id, result_json into batch_id, result
  from public.sportlink_slide_batches
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if batch_id is not null then return result; end if;
  insert into public.sportlink_slide_batches(
    tenant_id, data_source_id, idempotency_key, created_by
  ) values (
    p_tenant_id, p_data_source_id, p_idempotency_key, actor_id
  ) returning id into batch_id;

  for draft in select value from jsonb_array_elements(p_drafts) loop
    selection := draft -> 'themeSelection';
    if draft ->> 'blueprintKey' <> all(allowed_keys)
      or length(btrim(coalesce(draft ->> 'name', ''))) not between 2 and 120
      or draft ->> 'orientation' not in ('landscape', 'portrait')
      or jsonb_typeof(draft -> 'context') <> 'object'
      or length(coalesce(draft #>> '{context,providerTeamId}', '')) not between 1 and 200
      or draft #>> '{context,competitionSelectionMode}' not in ('auto_current', 'pinned')
      or not private.theme_selection_is_valid_v1(selection)
      or selection #>> '{ref,version}' <> '1.0.0'
    then raise exception 'invalid Sportlink draft' using errcode = '22023'; end if;

    expected_type := case
      when draft ->> 'blueprintKey' in (
        'sportlink.club_schedule_today', 'sportlink.club_schedule_next_7_days',
        'sportlink.pool_schedule_next_7_days'
      ) then 'sport_program'
      when draft ->> 'blueprintKey' in (
        'sportlink.club_results_today', 'sportlink.club_results_previous_7_days',
        'sportlink.pool_results_previous_7_days'
      ) then 'sport_results'
      when draft ->> 'blueprintKey' = 'sportlink.pool_standings' then 'sport_standing'
      when draft ->> 'blueprintKey' = 'sportlink.visitor_arrivals' then 'sport_visitor_arrivals'
      else 'sport_referee_arrivals'
    end;
    select template.slide_type into actual_type
    from public.dynamic_template_versions version
    join public.dynamic_templates template on template.id = version.template_id
    where version.id = (draft ->> 'templateVersionId')::uuid
      and version.status = 'published' and template.status = 'published'
      and template.orientation = draft ->> 'orientation';
    if actual_type is distinct from expected_type then
      raise exception 'template does not match Sportlink blueprint' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.sports_teams team
      join public.sportlink_connections connection
        on connection.id = team.source_connection_id
        and connection.tenant_id = team.tenant_id
      where team.tenant_id = p_tenant_id
        and connection.data_source_id = p_data_source_id
        and team.external_id = draft #>> '{context,providerTeamId}'
        and team.active
    ) then raise exception 'Sportlink team unavailable' using errcode = '23514'; end if;

    result := public.create_dynamic_slide_v1(
      p_tenant_id,
      draft ->> 'name',
      (draft ->> 'templateVersionId')::uuid,
      p_data_source_id,
      'latest',
      jsonb_strip_nulls(jsonb_build_object(
        'schemaVersion', 1,
        'blueprintKey', draft ->> 'blueprintKey',
        'title', draft ->> 'title',
        'context', draft -> 'context',
        'arrival', draft -> 'arrival',
        'display', draft -> 'display',
        'editorial', jsonb_build_object(
          'schemaVersion', 2,
          'themeSelection', selection
        ),
        'maxItems', 40
      ))
    );
    results := results || jsonb_build_array(jsonb_build_object(
      'slideId', result ->> 'slideId',
      'snapshotId', result ->> 'snapshotId',
      'name', draft ->> 'name',
      'blueprintKey', draft ->> 'blueprintKey'
    ));
  end loop;

  result := jsonb_build_object(
    'batchId', batch_id, 'slides', results,
    'count', jsonb_array_length(results)
  );
  update public.sportlink_slide_batches set result_json = result where id = batch_id;
  perform private.audit_event(
    p_tenant_id, 'sportlink.slide_batch.created',
    'sportlink_slide_batches', batch_id, 'success',
    jsonb_build_object(
      'count', jsonb_array_length(results),
      'dataSourceId', p_data_source_id,
      'themeId', p_drafts #>> '{0,themeSelection,ref,id}'
    )
  );
  return result;
end;
$$;

revoke all on function public.create_sportlink_slide_batch_v2(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.create_sportlink_slide_batch_v2(
  uuid, uuid, jsonb, uuid
) to authenticated;
