-- S161: versioned Royal Current v8 appearance contract.
-- Historical appearance v1 values and immutable releases remain valid and
-- untouched. Newly provisioned theme profiles start on appearance v2.

create or replace function private.theme_appearance_settings_is_valid_v1(
  p_appearance jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  font_ref text;
  schema_version text;
begin
  if pg_catalog.jsonb_typeof(p_appearance) is distinct from 'object' then
    return false;
  end if;

  schema_version := p_appearance ->> 'schemaVersion';
  if schema_version = '1' then
    if (select count(*) from pg_catalog.jsonb_object_keys(p_appearance)) <> 3
      or not (p_appearance ?& array['schemaVersion', 'surfaces', 'typography'])
      or pg_catalog.jsonb_typeof(p_appearance -> 'schemaVersion') is distinct from 'number'
      or pg_catalog.jsonb_typeof(p_appearance -> 'surfaces') is distinct from 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_appearance -> 'surfaces')) <> 2
      or not ((p_appearance -> 'surfaces') ?& array['clubLogoBackground', 'homeLogoBackground'])
      or coalesce(p_appearance #>> '{surfaces,clubLogoBackground}', '') !~* '^#[0-9a-f]{6}$'
      or coalesce(p_appearance #>> '{surfaces,homeLogoBackground}', '') !~* '^#[0-9a-f]{6}$'
      or pg_catalog.jsonb_typeof(p_appearance -> 'typography') is distinct from 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_appearance -> 'typography')) <> 4
      or not ((p_appearance -> 'typography') ?& array['baseScale', 'bodyFontRef', 'displayFontRef', 'sportScale'])
      or pg_catalog.jsonb_typeof(p_appearance #> '{typography,baseScale}') is distinct from 'number'
      or pg_catalog.jsonb_typeof(p_appearance #> '{typography,sportScale}') is distinct from 'number'
      or (p_appearance #>> '{typography,baseScale}')::numeric not between 0.85 and 1.25
      or (p_appearance #>> '{typography,sportScale}')::numeric not between 0.9 and 1.4
    then
      return false;
    end if;
  elsif schema_version = '2' then
    if (select count(*) from pg_catalog.jsonb_object_keys(p_appearance)) <> 6
      or not (p_appearance ?& array[
        'designRevision', 'motionEnabled', 'palette', 'schemaVersion',
        'surfaces', 'typography'
      ])
      or pg_catalog.jsonb_typeof(p_appearance -> 'schemaVersion') is distinct from 'number'
      or coalesce(p_appearance ->> 'designRevision', '') <> 'royal-current-v8'
      or pg_catalog.jsonb_typeof(p_appearance -> 'motionEnabled') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(p_appearance -> 'palette') is distinct from 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_appearance -> 'palette')) <> 4
      or not ((p_appearance -> 'palette') ?& array['background', 'primary', 'secondary', 'version'])
      or coalesce(p_appearance #>> '{palette,background}', '') not in ('club', 'neutral')
      or coalesce(p_appearance #>> '{palette,primary}', '') !~* '^#[0-9a-f]{6}$'
      or not (
        pg_catalog.jsonb_typeof(p_appearance #> '{palette,secondary}') = 'null'
        or (
          pg_catalog.jsonb_typeof(p_appearance #> '{palette,secondary}') = 'string'
          and coalesce(p_appearance #>> '{palette,secondary}', '') ~* '^#[0-9a-f]{6}$'
        )
      )
      or pg_catalog.jsonb_typeof(p_appearance #> '{palette,version}') is distinct from 'number'
      or p_appearance #>> '{palette,version}' <> '1'
      or pg_catalog.jsonb_typeof(p_appearance -> 'surfaces') is distinct from 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_appearance -> 'surfaces')) <> 2
      or not ((p_appearance -> 'surfaces') ?& array['clubLogoBackground', 'homeLogoBackground'])
      or coalesce(p_appearance #>> '{surfaces,clubLogoBackground}', '') !~* '^#[0-9a-f]{6}$'
      or coalesce(p_appearance #>> '{surfaces,homeLogoBackground}', '') !~* '^#[0-9a-f]{6}$'
      or pg_catalog.jsonb_typeof(p_appearance -> 'typography') is distinct from 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_appearance -> 'typography')) <> 4
      or not ((p_appearance -> 'typography') ?& array['baseScale', 'bodyFontRef', 'displayFontRef', 'sportScale'])
      or pg_catalog.jsonb_typeof(p_appearance #> '{typography,baseScale}') is distinct from 'number'
      or pg_catalog.jsonb_typeof(p_appearance #> '{typography,sportScale}') is distinct from 'number'
      or (p_appearance #>> '{typography,baseScale}')::numeric not between 0.9 and 1.2
      or (p_appearance #>> '{typography,sportScale}')::numeric not between 0.9 and 1.4
    then
      return false;
    end if;
  else
    return false;
  end if;

  foreach font_ref in array array[
    p_appearance #>> '{typography,bodyFontRef}',
    p_appearance #>> '{typography,displayFontRef}'
  ]
  loop
    if font_ref is null or font_ref <> all(array[
      'vc-roboto-v1',
      'vc-inter-v1',
      'vc-newsreader-v1',
      'vc-space-grotesk-v1',
      'vc-fraunces-v1',
      'vc-barlow-condensed-v1',
      'vc-source-serif-4-v1',
      'vc-manrope-v1',
      'vc-cormorant-garamond-v1',
      'vc-ibm-plex-mono-v1',
      'vc-anton-v1'
    ]) then
      return false;
    end if;
  end loop;
  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

revoke all on function private.theme_appearance_settings_is_valid_v1(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.ensure_tenant_theme_profile_v1(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_theme_profiles (
    tenant_id,
    theme_id,
    theme_version,
    selection_json,
    color_overrides,
    appearance_config,
    revision,
    updated_by,
    created_at,
    updated_at
  )
  select
    settings.tenant_id,
    'fieldflow',
    '1.0.0',
    pg_catalog.jsonb_build_object(
      'ref', pg_catalog.jsonb_build_object(
        'catalog', 'v2', 'id', 'fieldflow', 'version', '1.0.0'
      ),
      'modePolicy', pg_catalog.jsonb_build_object('kind', 'fixed', 'mode', 'light'),
      'accent', pg_catalog.to_jsonb(coalesce(settings.theme_accent, '#2459ED')),
      'support', case
        when settings.theme_support is null then 'null'::jsonb
        else pg_catalog.to_jsonb(settings.theme_support)
      end,
      'categoryOverrides', '[]'::jsonb
    ),
    '{}'::jsonb,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'designRevision', 'royal-current-v8',
      'motionEnabled', true,
      'palette', pg_catalog.jsonb_build_object(
        'version', 1,
        'primary', coalesce(settings.theme_accent, '#2459ED'),
        'background', 'club',
        'secondary', case
          when settings.theme_support is null then 'null'::jsonb
          else pg_catalog.to_jsonb(settings.theme_support)
        end
      ),
      'surfaces', pg_catalog.jsonb_build_object(
        'clubLogoBackground', '#FFFFFF',
        'homeLogoBackground', '#FFFFFF'
      ),
      'typography', pg_catalog.jsonb_build_object(
        'baseScale', 1,
        'bodyFontRef', 'vc-roboto-v1',
        'displayFontRef', 'vc-roboto-v1',
        'sportScale', 1
      )
    ),
    settings.theme_settings_revision,
    settings.updated_by,
    settings.created_at,
    settings.updated_at
  from public.tenant_settings settings
  where settings.tenant_id = p_tenant_id
  on conflict (tenant_id, theme_id) do nothing;
end;
$$;

revoke all on function private.ensure_tenant_theme_profile_v1(uuid)
  from public, anon, authenticated, service_role;

comment on function private.theme_appearance_settings_is_valid_v1(jsonb) is
  'Strict compatibility validator for immutable appearance v1 and Royal Current v8 appearance v2.';

comment on function private.ensure_tenant_theme_profile_v1(uuid) is
  'Provision one FieldFlow profile; new tenants start on Royal Current v8 while existing profiles remain immutable until explicitly edited.';

-- Scheduled presentation is owned by the timezone frozen in the policy. Keep
-- this resolution in one private helper so ordinary snapshot builds and
-- forced rollout successors cannot disagree when the tenant timezone differs.
create function private.resolve_tenant_theme_timezone_v1(
  p_tenant_id uuid,
  p_mode_policy jsonb
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(p_mode_policy ->> 'kind', 'fixed') = 'schedule' then
      coalesce(
        nullif(p_mode_policy ->> 'timezone', ''),
        tenant_timezone.value
      )
    else tenant_timezone.value
  end
  from (
    select coalesce(
      (
        select settings.timezone_name
        from public.tenant_settings settings
        where settings.tenant_id = p_tenant_id
      ),
      'Europe/Amsterdam'
    ) as value
  ) tenant_timezone
$$;

revoke all on function private.resolve_tenant_theme_timezone_v1(uuid, jsonb)
  from public, anon, authenticated, service_role;

-- The earlier snapshot builder only recognized an editorial.themeSelection.
-- Royal Current is tenant-scoped and must also reach birthdays, Menu Studio and
-- every other dynamic family without mutating their source configuration.
alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s161_royal_current;

create function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  appearance jsonb;
  color_overrides jsonb;
  mode_policy jsonb;
  profile public.tenant_theme_profiles%rowtype;
  resolved_at timestamptz := statement_timestamp();
  resolved_mode text;
  result jsonb;
  timezone_name text;
begin
  result := private.build_dynamic_snapshot_data_before_s161_royal_current(
    p_slide
  );

  -- S150 deliberately replaced visitor controls with one fixed two-card
  -- presentation. Royal Current supports one, two or three fixed slots and
  -- must freeze the validated authoring choice instead of those stale values.
  if p_slide.slide_type = 'sport_visitor_arrivals'
    and private.sportlink_arrival_config_is_valid_v1(
      p_slide.configuration_json -> 'arrival'
    )
    and (p_slide.configuration_json #>> '{arrival,cardCount}')::integer
      between 1 and 3
  then
    result := pg_catalog.jsonb_set(
      result,
      '{sport,arrivalConfig}',
      p_slide.configuration_json -> 'arrival',
      true
    );
  end if;

  select candidate.* into profile
  from public.tenant_theme_profiles candidate
  where candidate.tenant_id = p_slide.tenant_id
    and candidate.theme_id = 'fieldflow';

  appearance := profile.appearance_config;
  if profile.tenant_id is null
    or not private.theme_selection_is_valid_v1(profile.selection_json)
    or not private.theme_appearance_settings_is_valid_v1(appearance)
    or appearance #>> '{schemaVersion}' <> '2'
    or appearance ->> 'designRevision' <> 'royal-current-v8'
  then
    return result;
  end if;

  -- Keep the tenant's complete 26-role palette alongside the frozen
  -- appearance. The strict themePresentation contract intentionally stays
  -- small; this namespaced value lets every renderer honour individually
  -- edited color roles without mutating historical snapshots.
  color_overrides := profile.color_overrides;
  if private.tenant_theme_color_overrides_is_valid_v1(color_overrides) then
    result := pg_catalog.jsonb_set(
      result,
      '{_veyocastThemeColorOverrides}',
      color_overrides -> 'fieldflow',
      true
    );
  end if;

  mode_policy := profile.selection_json -> 'modePolicy';
  timezone_name := private.resolve_tenant_theme_timezone_v1(
    p_slide.tenant_id,
    mode_policy
  );
  resolved_mode := private.resolve_theme_mode_v1(
    mode_policy,
    timezone_name,
    resolved_at
  );

  return pg_catalog.jsonb_set(
    result,
    '{themePresentation}',
    pg_catalog.jsonb_build_object(
      'appearance', appearance,
      'catalogVersion', '1.0.0',
      'settingsRevision', profile.revision,
      'snapshotVersion', 2,
      'selection', profile.selection_json,
      'resolvedMode', pg_catalog.jsonb_build_object(
        'mode', resolved_mode,
        'policy', mode_policy,
        'resolvedAt', pg_catalog.to_char(
          resolved_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        'timezone', timezone_name
      )
    ),
    true
  );
end;
$$;

create function private.reset_tenant_fieldflow_royal_v2(
  p_tenant_name text,
  p_reason text,
  p_operator text,
  p_workflow_run_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  royal_appearance constant jsonb := '{
    "schemaVersion": 2,
    "designRevision": "royal-current-v8",
    "motionEnabled": true,
    "palette": {
      "version": 1,
      "primary": "#2459ED",
      "background": "club",
      "secondary": null
    },
    "surfaces": {
      "clubLogoBackground": "#FFFFFF",
      "homeLogoBackground": "#FFFFFF"
    },
    "typography": {
      "baseScale": 1.05,
      "bodyFontRef": "vc-roboto-v1",
      "displayFontRef": "vc-roboto-v1",
      "sportScale": 1.4
    }
  }'::jsonb;
  royal_color_overrides constant jsonb := '{}'::jsonb;
  royal_mode_policy constant jsonb :=
    '{"kind":"fixed","mode":"dark"}'::jsonb;
  royal_selection constant jsonb := '{
    "ref": {"catalog":"v2","id":"fieldflow","version":"1.0.0"},
    "modePolicy": {"kind":"fixed","mode":"dark"},
    "accent": "#2459ED",
    "support": null,
    "categoryOverrides": []
  }'::jsonb;
  matched_tenant_id uuid;
  matched_tenant_name text;
  matched_tenant_status public.tenant_status;
  profile public.tenant_theme_profiles%rowtype;
  settings public.tenant_settings%rowtype;
  audit_id uuid;
  next_revision bigint;
  rollout public.tenant_theme_rollouts%rowtype;
  rollout_id uuid;
begin
  if p_tenant_name is null
    or p_tenant_name is distinct from pg_catalog.btrim(p_tenant_name)
    or pg_catalog.length(p_tenant_name) not between 2 and 120
    or p_tenant_name ~ '[[:cntrl:]]'
  then
    raise exception 'theme reset tenant name is invalid' using errcode = '22023';
  end if;
  if p_reason is null
    or p_reason is distinct from pg_catalog.btrim(p_reason)
    or pg_catalog.length(p_reason) not between 10 and 240
    or p_reason ~ '[[:cntrl:]]'
  then
    raise exception 'theme reset reason is invalid' using errcode = '22023';
  end if;
  if p_operator is null
    or p_operator !~ '^github:[A-Za-z0-9-]{1,39}$'
  then
    raise exception 'theme reset operator is invalid' using errcode = '22023';
  end if;
  if p_workflow_run_url is null
    or p_workflow_run_url !~
      '^https://github[.]com/veyocast/platform/actions/runs/[0-9]+$'
  then
    raise exception 'theme reset workflow run is invalid' using errcode = '22023';
  end if;
  if royal_color_overrides <> '{}'::jsonb
    or not private.theme_appearance_settings_is_valid_v1(royal_appearance)
    or not private.theme_selection_is_valid_v1(royal_selection)
  then
    raise exception 'embedded Royal Current v8 theme is invalid'
      using errcode = '23514';
  end if;

  begin
    select tenant.id, tenant.name, tenant.status
    into strict matched_tenant_id, matched_tenant_name, matched_tenant_status
    from public.tenants tenant
    where pg_catalog.lower(pg_catalog.btrim(tenant.name)) =
      pg_catalog.lower(p_tenant_name)
    for update;
  exception
    when no_data_found then
      raise exception 'theme reset tenant not found' using errcode = 'P0002';
    when too_many_rows then
      raise exception 'theme reset tenant name is not unique' using errcode = '21000';
  end;
  if matched_tenant_status <> 'active'::public.tenant_status then
    raise exception 'theme reset tenant is not active' using errcode = '55000';
  end if;

  select tenant_settings.* into settings
  from public.tenant_settings tenant_settings
  where tenant_settings.tenant_id = matched_tenant_id
  for update;
  if not found then
    raise exception 'theme reset tenant settings not found' using errcode = 'P0002';
  end if;

  perform private.ensure_tenant_theme_profile_v1(matched_tenant_id);
  select candidate.* into profile
  from public.tenant_theme_profiles candidate
  where candidate.tenant_id = matched_tenant_id
    and candidate.theme_id = 'fieldflow'
  for update;
  if not found then
    raise exception 'theme reset profile not found' using errcode = 'P0002';
  end if;

  if profile.theme_version = '1.0.0'
    and profile.selection_json = royal_selection
    and profile.color_overrides = royal_color_overrides
    and profile.appearance_config = royal_appearance
    and settings.default_theme_id = 'fieldflow'
    and settings.default_theme_version = '1.0.0'
    and settings.theme_mode_policy = royal_mode_policy
    and settings.theme_accent = '#2459ED'
    and settings.theme_support is null
    and settings.theme_color_overrides = royal_color_overrides
    and settings.theme_settings_revision = profile.revision
  then
    select candidate.* into rollout
    from public.tenant_theme_rollouts candidate
    where candidate.tenant_id = matched_tenant_id
      and candidate.theme_id = 'fieldflow'
      and candidate.settings_revision = profile.revision
    order by candidate.created_at desc, candidate.id desc
    limit 1;
    if found then
      return pg_catalog.jsonb_build_object(
        'auditId', null,
        'outcome', 'noop',
        'releaseTargetCount', rollout.release_target_count,
        'revision', profile.revision,
        'rolloutId', rollout.id,
        'snapshotCount', rollout.snapshot_count,
        'status', rollout.status,
        'tenantId', matched_tenant_id,
        'tenantName', matched_tenant_name,
        'verified', true
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'auditId', null,
      'outcome', 'noop',
      'releaseTargetCount', 0,
      'revision', profile.revision,
      'rolloutId', null,
      'snapshotCount', 0,
      'status', 'ready',
      'tenantId', matched_tenant_id,
      'tenantName', matched_tenant_name,
      'verified', true
    );
  end if;

  perform slide.id
  from public.dynamic_slides slide
  where slide.tenant_id = matched_tenant_id
    and slide.status <> 'archived'
    and slide.current_published_version_id is not null
  order by slide.id
  for update;
  if exists (
    select 1
    from public.dynamic_slides slide
    join public.dynamic_slide_versions version
      on version.tenant_id = slide.tenant_id
     and version.id = slide.active_draft_version_id
     and version.status = 'publishing'
    where slide.tenant_id = matched_tenant_id
      and slide.status <> 'archived'
  ) then
    raise exception 'wait for active slide publication before theme reset'
      using errcode = '55000';
  end if;

  next_revision := profile.revision + 1;
  update public.tenant_theme_profiles candidate
  set theme_version = '1.0.0',
      selection_json = royal_selection,
      color_overrides = royal_color_overrides,
      appearance_config = royal_appearance,
      revision = next_revision,
      updated_by = null,
      updated_at = pg_catalog.now()
  where candidate.tenant_id = matched_tenant_id
    and candidate.theme_id = 'fieldflow';

  update public.tenant_settings tenant_settings
  set default_theme_id = 'fieldflow',
      default_theme_version = '1.0.0',
      theme_mode_policy = royal_mode_policy,
      theme_accent = '#2459ED',
      theme_support = null,
      theme_color_overrides = royal_color_overrides,
      theme_settings_revision = next_revision,
      updated_by = null,
      updated_at = pg_catalog.now()
  where tenant_settings.tenant_id = matched_tenant_id;

  rollout_id := private.start_tenant_theme_rollout_v2(
    matched_tenant_id,
    'fieldflow',
    next_revision,
    null,
    null
  );
  select candidate.* into strict rollout
  from public.tenant_theme_rollouts candidate
  where candidate.tenant_id = matched_tenant_id
    and candidate.id = rollout_id;

  insert into public.audit_events (
    tenant_id,
    actor_user_id,
    actor_device_id,
    action,
    target_type,
    target_id,
    result,
    metadata
  ) values (
    matched_tenant_id,
    null,
    null,
    'tenant.theme.royal_current_reset',
    'tenant_theme_profiles',
    matched_tenant_id,
    'success',
    pg_catalog.jsonb_build_object(
      'designRevision', 'royal-current-v8',
      'immutable', true,
      'operator', p_operator,
      'reason', p_reason,
      'releaseTargetCount', rollout.release_target_count,
      'rolloutId', rollout_id,
      'settingsRevision', next_revision,
      'snapshotCount', rollout.snapshot_count,
      'workflowRun', p_workflow_run_url
    )
  ) returning id into audit_id;

  if not exists (
    select 1
    from public.tenant_theme_profiles verified_profile
    join public.tenant_settings verified_settings
      on verified_settings.tenant_id = verified_profile.tenant_id
    join public.tenant_theme_rollouts verified_rollout
      on verified_rollout.tenant_id = verified_profile.tenant_id
     and verified_rollout.id = rollout_id
     and verified_rollout.theme_id = verified_profile.theme_id
     and verified_rollout.settings_revision = verified_profile.revision
    join public.audit_events verified_audit
      on verified_audit.tenant_id = verified_profile.tenant_id
     and verified_audit.id = audit_id
     and verified_audit.action = 'tenant.theme.royal_current_reset'
     and verified_audit.target_type = 'tenant_theme_profiles'
     and verified_audit.target_id = verified_profile.tenant_id
     and verified_audit.result = 'success'
    where verified_profile.tenant_id = matched_tenant_id
      and verified_profile.theme_id = 'fieldflow'
      and verified_profile.theme_version = '1.0.0'
      and verified_profile.selection_json = royal_selection
      and verified_profile.color_overrides = royal_color_overrides
      and verified_profile.appearance_config = royal_appearance
      and verified_profile.revision = next_revision
      and verified_settings.default_theme_id = 'fieldflow'
      and verified_settings.default_theme_version = '1.0.0'
      and verified_settings.theme_mode_policy = royal_mode_policy
      and verified_settings.theme_accent = '#2459ED'
      and verified_settings.theme_support is null
      and verified_settings.theme_color_overrides = royal_color_overrides
      and verified_settings.theme_settings_revision = next_revision
      and verified_audit.metadata ->> 'designRevision' = 'royal-current-v8'
      and verified_audit.metadata ->> 'operator' = p_operator
      and verified_audit.metadata ->> 'reason' = p_reason
      and verified_audit.metadata ->> 'workflowRun' = p_workflow_run_url
      and verified_audit.metadata ->> 'rolloutId' = rollout_id::text
      and (verified_audit.metadata ->> 'settingsRevision')::bigint =
        next_revision
  ) then
    raise exception 'Royal Current v8 theme reset readback differs'
      using errcode = '55000';
  end if;

  return pg_catalog.jsonb_build_object(
    'auditId', audit_id,
    'outcome', 'applied',
    'releaseTargetCount', rollout.release_target_count,
    'revision', next_revision,
    'rolloutId', rollout_id,
    'snapshotCount', rollout.snapshot_count,
    'status', rollout.status,
    'tenantId', matched_tenant_id,
    'tenantName', matched_tenant_name,
    'verified', true
  );
end;
$$;

-- S153/S159 rollout snapshots clone their immutable provider payload instead
-- of rebuilding it. Preserve that path and correct only the frozen mode
-- authority so it shares the same policy-timezone resolver as new snapshots.
alter function private.apply_tenant_theme_to_snapshot_v1(uuid, jsonb, uuid)
  rename to apply_tenant_theme_to_snapshot_before_s161_royal_current;

create function private.apply_tenant_theme_to_snapshot_v1(
  p_tenant_id uuid,
  p_snapshot_data jsonb,
  p_rollout_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  color_overrides jsonb;
  mode_policy jsonb;
  resolved_at timestamptz := statement_timestamp();
  resolved_mode text;
  result jsonb;
  timezone_name text;
begin
  result := private.apply_tenant_theme_to_snapshot_before_s161_royal_current(
    p_tenant_id,
    p_snapshot_data,
    p_rollout_id
  );
  select profile.color_overrides
  into color_overrides
  from public.tenant_theme_profiles profile
  where profile.tenant_id = p_tenant_id
    and profile.theme_id = 'fieldflow';
  if private.tenant_theme_color_overrides_is_valid_v1(color_overrides) then
    result := pg_catalog.jsonb_set(
      result,
      '{_veyocastThemeColorOverrides}',
      color_overrides -> 'fieldflow',
      true
    );
  end if;
  mode_policy := result #> '{themePresentation,selection,modePolicy}';
  timezone_name := private.resolve_tenant_theme_timezone_v1(
    p_tenant_id,
    mode_policy
  );
  resolved_mode := private.resolve_theme_mode_v1(
    mode_policy,
    timezone_name,
    resolved_at
  );

  return pg_catalog.jsonb_set(
    result,
    '{themePresentation,resolvedMode}',
    pg_catalog.jsonb_build_object(
      'mode', resolved_mode,
      'policy', mode_policy,
      'resolvedAt', pg_catalog.to_char(
        resolved_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'timezone', timezone_name
    ),
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s161_royal_current(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.apply_tenant_theme_to_snapshot_v1(
  uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.apply_tenant_theme_to_snapshot_before_s161_royal_current(
  uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.reset_tenant_fieldflow_royal_v2(
  text, text, text, text
) from public, anon, authenticated, service_role;

comment on function private.build_dynamic_snapshot_data(public.dynamic_slides) is
  'Builds a new immutable snapshot and applies Royal Current v8 tenant authority to every dynamic slide family; legacy profile snapshots remain unchanged.';

comment on function private.apply_tenant_theme_to_snapshot_v1(uuid, jsonb, uuid) is
  'Clones immutable rollout data while freezing Royal Current mode in the same policy timezone as ordinary snapshot builds.';

comment on function private.reset_tenant_fieldflow_royal_v2(
  text, text, text, text
) is 'Owner-only, audited Royal Current v8 FieldFlow reset for one exact tenant through the protected GitHub environment workflow.';
