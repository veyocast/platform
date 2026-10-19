-- S235: independent Source defaults for explicitly created new designs.
-- Forward-only; legacy tenant theme rollout and immutable releases remain independent.
-- Only new-design defaults change; legacy global theme rollout stays independent.

create function private.sync_theme_creation_defaults_is_valid_v1(p_defaults jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  scale_value numeric;
begin
  if pg_catalog.jsonb_typeof(p_defaults) is distinct from 'object'
    or pg_catalog.octet_length(p_defaults::text) > 2048
  then
    return false;
  end if;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_defaults)) <> 7
    or not (p_defaults ?& array[
      'accent', 'font', 'mode', 'scale', 'background', 'motion', 'showLogo'
    ]::text[])
  then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_defaults -> 'accent') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_defaults -> 'font') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_defaults -> 'mode') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_defaults -> 'scale') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_defaults -> 'background') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_defaults -> 'motion') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_defaults -> 'showLogo') is distinct from 'boolean'
  then
    return false;
  end if;
  if (p_defaults ->> 'accent') !~ '^#[0-9a-fA-F]{6}$'
    or (p_defaults ->> 'font') not in ('Manrope', 'Inter', 'Georgia', 'Arial')
    or (p_defaults ->> 'mode') not in ('light', 'dark', 'auto')
    or (p_defaults ->> 'background') not in ('clubkleur', 'gradient', 'stadium')
    or (p_defaults ->> 'motion') not in ('rustig', 'geen', 'dynamisch')
  then
    return false;
  end if;
  scale_value := (p_defaults ->> 'scale')::numeric;
  return scale_value between 90 and 120
    and scale_value = pg_catalog.trunc(scale_value);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$function$;

revoke all on function private.sync_theme_creation_defaults_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;

alter table public.tenant_theme_profiles
  add column sync_creation_defaults jsonb,
  add column sync_creation_defaults_revision bigint not null default 0,
  add constraint tenant_theme_profiles_sync_creation_defaults_check check (
    sync_creation_defaults is null
    or private.sync_theme_creation_defaults_is_valid_v1(sync_creation_defaults)
  ),
  add constraint tenant_theme_profiles_sync_creation_defaults_revision_check check (
    (sync_creation_defaults is null and sync_creation_defaults_revision = 0)
    or (sync_creation_defaults is not null and sync_creation_defaults_revision between 1 and 9007199254740991)
  );

-- No table grants or policy changes: existing ENABLE/FORCE RLS and default-deny
-- direct mutations remain. Neither legacy profile.revision nor appearance changes.
comment on column public.tenant_theme_profiles.sync_creation_defaults is
  'Source settings applied only when explicitly creating/choosing a theme for a new design. Never read as live release or legacy rollout authority.';
comment on column public.tenant_theme_profiles.sync_creation_defaults_revision is
  'Independent Source creation-default CAS revision. Not the immutable global rollout settings revision.';

create function public.read_sync_theme_creation_defaults_v1(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  active_theme text;
  profile_rows jsonb;
begin
  if private.current_user_id() is null or p_tenant_id is null
    or not (
      private.has_tenant_capability(p_tenant_id, 'tenant.settings.read')
      or private.has_tenant_capability(p_tenant_id, 'tenant.settings.manage')
      or private.has_tenant_capability(p_tenant_id, 'tenant.studio.read')
      or private.has_tenant_capability(p_tenant_id, 'tenant.studio.create')
      or private.has_tenant_capability(p_tenant_id, 'tenant.dynamic_slide.read')
      or private.has_tenant_capability(p_tenant_id, 'tenant.dynamic_slide.write')
    )
  then
    raise exception 'actor cannot read Source theme creation defaults' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tenants tenant
    where tenant.id = p_tenant_id and tenant.status in ('active', 'paused')
  ) then
    raise exception 'Source theme creation defaults are unavailable in this tenant' using errcode = '42501';
  end if;

  select settings.default_theme_id into active_theme
  from public.tenant_settings settings where settings.tenant_id = p_tenant_id;
  if not found then
    raise exception 'tenant theme settings are unavailable' using errcode = '55000';
  end if;
  -- Historic, non-authorable theme IDs are preserved in their original row.
  -- Null means the UI must state its explicit catalog fallback, not claim a save.
  if active_theme not in ('fieldflow', 'onzetrots-tv') then active_theme := null; end if;

  if exists (
    select 1 from public.tenant_theme_profiles profile
    where profile.tenant_id = p_tenant_id
      and profile.theme_id in ('fieldflow', 'onzetrots-tv')
      and (
        (profile.theme_id = 'fieldflow' and profile.theme_version <> '1.0.0')
        or (profile.theme_id = 'onzetrots-tv' and profile.theme_version <> '11.0.0')
        or (profile.sync_creation_defaults is not null
          and not private.sync_theme_creation_defaults_is_valid_v1(profile.sync_creation_defaults))
      )
  ) then
    raise exception 'stored Source theme creation defaults cannot be validated' using errcode = '55000';
  end if;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'themeId', supported.theme_id,
    'themeVersion', supported.theme_version,
    'revision', coalesce(profile.sync_creation_defaults_revision, 0),
    'configured', profile.sync_creation_defaults is not null,
    'defaults', profile.sync_creation_defaults
  ) order by supported.ordinal) into profile_rows
  from (values ('fieldflow', '1.0.0', 1), ('onzetrots-tv', '11.0.0', 2))
    as supported(theme_id, theme_version, ordinal)
  left join public.tenant_theme_profiles profile
    on profile.tenant_id = p_tenant_id and profile.theme_id = supported.theme_id;

  return pg_catalog.jsonb_build_object(
    'schemaVersion', 1, 'tenantId', p_tenant_id,
    'defaultThemeId', active_theme, 'profiles', profile_rows
  );
end;
$function$;

revoke all on function public.read_sync_theme_creation_defaults_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_sync_theme_creation_defaults_v1(uuid)
  to authenticated;

create function public.save_sync_theme_creation_defaults_v1(
  p_tenant_id uuid,
  p_theme_id text,
  p_expected_revision bigint,
  p_defaults jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := private.current_user_id();
  request jsonb;
  result jsonb;
  current_profile public.tenant_theme_profiles%rowtype;
  next_revision bigint;
  applied_outcome text;
begin
  -- Existing canonical capability helper includes its existing platform override;
  -- no new role inference, browser metadata or service-role authorization is used.
  if actor_id is null or p_tenant_id is null
    or not private.has_tenant_capability(p_tenant_id, 'tenant.settings.manage')
  then
    raise exception 'actor cannot update Source theme creation defaults' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if p_theme_id is null or p_theme_id not in ('fieldflow', 'onzetrots-tv')
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740991
    or p_idempotency_key is null
    or not private.sync_theme_creation_defaults_is_valid_v1(p_defaults)
  then
    raise exception 'Source theme creation defaults command is invalid' using errcode = '22023';
  end if;

  -- Tenant-first order agrees with the existing theme API. Hold lifecycle state
  -- against a concurrent pause; settings is locked, never updated by this writer.
  perform tenant.id from public.tenants tenant
    where tenant.id = p_tenant_id and tenant.status = 'active' for share;
  if not found then
    raise exception 'tenant mutations require an active tenant' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(p_tenant_id);
  perform settings.tenant_id from public.tenant_settings settings
    where settings.tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'tenant theme settings are unavailable' using errcode = '55000';
  end if;

  request := pg_catalog.jsonb_build_object(
    'tenantId', p_tenant_id, 'themeId', p_theme_id,
    'expectedRevision', p_expected_revision, 'defaults', p_defaults
  );
  result := private.begin_publisher_command(
    p_tenant_id, 'sync.theme.creation-defaults.save', p_idempotency_key, request
  );
  if result is not null then return result; end if;

  -- Existing provisioning supplies valid legacy identity/appearance fields only
  -- if the supported row is missing. Read RPC never invokes this mutating helper.
  if not exists (
    select 1 from public.tenant_theme_profiles profile
    where profile.tenant_id = p_tenant_id and profile.theme_id = p_theme_id
  ) then
    perform private.ensure_tenant_theme_profile_v1(p_tenant_id);
  end if;
  select profile.* into current_profile
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id and profile.theme_id = p_theme_id
  for update;
  if not found or (p_theme_id = 'fieldflow' and current_profile.theme_version <> '1.0.0')
    or (p_theme_id = 'onzetrots-tv' and current_profile.theme_version <> '11.0.0')
  then
    raise exception 'tenant Source theme profile is unavailable' using errcode = '55000';
  end if;
  if current_profile.sync_creation_defaults_revision <> p_expected_revision then
    raise exception 'Source theme creation defaults changed; reload and confirm the current values' using errcode = 'PT409';
  end if;

  next_revision := current_profile.sync_creation_defaults_revision;
  applied_outcome := 'noop';
  if current_profile.sync_creation_defaults is distinct from p_defaults then
    if next_revision = 9007199254740991 then
      raise exception 'Source theme creation defaults revision range exhausted' using errcode = '22023';
    end if;
    next_revision := next_revision + 1;
    update public.tenant_theme_profiles profile
    set sync_creation_defaults = p_defaults,
      sync_creation_defaults_revision = next_revision
    where profile.tenant_id = p_tenant_id and profile.theme_id = p_theme_id;
    applied_outcome := 'applied';
  end if;
  result := pg_catalog.jsonb_build_object(
    'schemaVersion', 1, 'outcome', applied_outcome,
    'tenantId', p_tenant_id, 'themeId', p_theme_id,
    'revision', next_revision, 'defaults', p_defaults
  );
  return private.complete_publisher_command(
    p_tenant_id, 'sync.theme.creation-defaults.save', p_idempotency_key,
    request, 'tenant_theme_profiles', p_tenant_id, result,
    'sync.theme.creation_defaults.updated', 'success'
  );
end;
$function$;

revoke all on function public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)
  to authenticated;

notify pgrst, 'reload schema';
