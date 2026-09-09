-- S159: opt-in Royal blue FieldFlow reset and a versioned renderer boundary.
--
-- The reset is deliberately owner-only. Deploying this migration does not
-- mutate tenant settings. The protected GitHub workflow invokes the command
-- for one exact tenant after the matching Control and Player release is live.
-- Existing snapshots and playlist releases stay immutable; only snapshots
-- built after this migration carry the runtime marker.

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s159_theme_runtime_v2;

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
  result jsonb;
begin
  result := private.build_dynamic_snapshot_data_before_s159_theme_runtime_v2(
    p_slide
  );
  return pg_catalog.jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{_veyocastThemeRuntime}',
    '{"version":2}'::jsonb,
    true
  );
end;
$$;

revoke all on function private.build_dynamic_snapshot_data(
  public.dynamic_slides
) from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s159_theme_runtime_v2(
  public.dynamic_slides
) from public, anon, authenticated, service_role;

alter function private.apply_tenant_theme_to_snapshot_v1(uuid, jsonb, uuid)
  rename to apply_tenant_theme_to_snapshot_before_s159_runtime_v2;

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
  result jsonb;
begin
  result := private.apply_tenant_theme_to_snapshot_before_s159_runtime_v2(
    p_tenant_id,
    p_snapshot_data,
    p_rollout_id
  );
  return pg_catalog.jsonb_set(
    coalesce(result, '{}'::jsonb),
    '{_veyocastThemeRuntime}',
    '{"version":2}'::jsonb,
    true
  );
end;
$$;

revoke all on function private.apply_tenant_theme_to_snapshot_v1(
  uuid, jsonb, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.apply_tenant_theme_to_snapshot_before_s159_runtime_v2(
  uuid, jsonb, uuid
) from public, anon, authenticated, service_role;

create function private.reset_tenant_fieldflow_royal_v1(
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
    "schemaVersion": 1,
    "surfaces": {
      "clubLogoBackground": "#FFFFFF",
      "homeLogoBackground": "#FFFFFF"
    },
    "typography": {
      "baseScale": 1.05,
      "bodyFontRef": "vc-inter-v1",
      "displayFontRef": "vc-manrope-v1",
      "sportScale": 1.4
    }
  }'::jsonb;
  royal_color_overrides constant jsonb := '{
    "fieldflow": {
      "dark": {
        "accent": "#4169E1",
        "accentSoft": "rgba(65, 105, 225, 0.24)",
        "border": "rgba(255, 255, 255, 0.22)",
        "borderSoft": "rgba(255, 255, 255, 0.12)",
        "canvas": "#071538",
        "danger": "#FF8580",
        "divider": "rgba(255, 255, 255, 0.18)",
        "imageOverlayEnd": "rgba(3, 8, 24, 0.10)",
        "imageOverlayMid": "rgba(3, 8, 24, 0.72)",
        "imageOverlayStart": "rgba(3, 8, 24, 0.96)",
        "neutral": "#8697C2",
        "panel": "#10265D",
        "qrInk": "#071538",
        "qrSurface": "#FFFFFF",
        "row": "#0C2257",
        "rowSelected": "#2447C7",
        "shadow": "rgba(0, 0, 0, 0.42)",
        "success": "#58D99A",
        "surface": "#3154D4",
        "surfaceRaised": "#2447A8",
        "text": "#FFFFFF",
        "textFaint": "rgba(255, 255, 255, 0.82)",
        "textMuted": "#E5EBFF",
        "textOnAccent": "#FFFFFF",
        "textOnSelected": "#FFFFFF",
        "warning": "#FFD078"
      },
      "light": {
        "accent": "#4169E1",
        "accentSoft": "rgba(65, 105, 225, 0.22)",
        "border": "rgba(255, 255, 255, 0.28)",
        "borderSoft": "rgba(255, 255, 255, 0.16)",
        "canvas": "#17327A",
        "danger": "#FF8F88",
        "divider": "rgba(255, 255, 255, 0.22)",
        "imageOverlayEnd": "rgba(4, 12, 36, 0.12)",
        "imageOverlayMid": "rgba(4, 12, 36, 0.68)",
        "imageOverlayStart": "rgba(4, 12, 36, 0.94)",
        "neutral": "#AAB9E3",
        "panel": "#234AAE",
        "qrInk": "#071538",
        "qrSurface": "#FFFFFF",
        "row": "#1E429C",
        "rowSelected": "#3154D4",
        "shadow": "rgba(4, 15, 52, 0.32)",
        "success": "#67D99F",
        "surface": "#365CCB",
        "surfaceRaised": "#2A50B8",
        "text": "#FFFFFF",
        "textFaint": "rgba(255, 255, 255, 0.82)",
        "textMuted": "#F4F7FF",
        "textOnAccent": "#FFFFFF",
        "textOnSelected": "#FFFFFF",
        "warning": "#FFD27A"
      },
      "mode": "dark"
    }
  }'::jsonb;
  royal_mode_policy constant jsonb := '{"kind":"fixed","mode":"dark"}'::jsonb;
  royal_selection constant jsonb := '{
    "ref": {"catalog":"v2","id":"fieldflow","version":"1.0.0"},
    "modePolicy": {"kind":"fixed","mode":"dark"},
    "accent": "#4169E1",
    "support": "#7A5CE6",
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
    or p_tenant_name is distinct from btrim(p_tenant_name)
    or length(p_tenant_name) not between 2 and 120
    or p_tenant_name ~ '[[:cntrl:]]'
  then
    raise exception 'theme reset tenant name is invalid' using errcode = '22023';
  end if;
  if p_reason is null
    or p_reason is distinct from btrim(p_reason)
    or length(p_reason) not between 10 and 240
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
  if not private.tenant_theme_color_overrides_is_valid_v1(
    royal_color_overrides
  ) or not private.theme_appearance_settings_is_valid_v1(royal_appearance)
    or not private.theme_selection_is_valid_v1(royal_selection)
  then
    raise exception 'embedded Royal blue theme is invalid' using errcode = '23514';
  end if;

  begin
    select tenant.id, tenant.name, tenant.status
    into strict matched_tenant_id, matched_tenant_name, matched_tenant_status
    from public.tenants tenant
    where lower(btrim(tenant.name)) = lower(p_tenant_name)
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
    and settings.theme_accent = '#4169E1'
    and settings.theme_support = '#7A5CE6'
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
      updated_at = now()
  where candidate.tenant_id = matched_tenant_id
    and candidate.theme_id = 'fieldflow';

  update public.tenant_settings tenant_settings
  set default_theme_id = 'fieldflow',
      default_theme_version = '1.0.0',
      theme_mode_policy = royal_mode_policy,
      theme_accent = '#4169E1',
      theme_support = '#7A5CE6',
      theme_color_overrides = royal_color_overrides,
      theme_settings_revision = next_revision,
      updated_by = null,
      updated_at = now()
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
    'tenant.theme.royal_blue_reset',
    'tenant_theme_profiles',
    matched_tenant_id,
    'success',
    pg_catalog.jsonb_build_object(
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
     and verified_audit.action = 'tenant.theme.royal_blue_reset'
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
      and verified_settings.theme_accent = '#4169E1'
      and verified_settings.theme_support = '#7A5CE6'
      and verified_settings.theme_color_overrides = royal_color_overrides
      and verified_settings.theme_settings_revision = next_revision
      and verified_audit.metadata ->> 'operator' = p_operator
      and verified_audit.metadata ->> 'reason' = p_reason
      and verified_audit.metadata ->> 'workflowRun' = p_workflow_run_url
      and verified_audit.metadata ->> 'rolloutId' = rollout_id::text
      and (verified_audit.metadata ->> 'settingsRevision')::bigint =
        next_revision
  ) then
    raise exception 'Royal blue theme reset readback differs'
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

revoke all on function private.reset_tenant_fieldflow_royal_v1(
  text, text, text, text
) from public, anon, authenticated, service_role;

comment on function private.reset_tenant_fieldflow_royal_v1(
  text, text, text, text
) is 'Owner-only, audited Royal blue FieldFlow reset for the protected GitHub environment workflow.';
