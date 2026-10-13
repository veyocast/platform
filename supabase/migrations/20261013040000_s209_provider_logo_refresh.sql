-- S209: an explicit Studio logo remains authoritative. Old Sportlink v2
-- wrote tenant-media logos; v4 now advances the separate provider pointer.
-- Select the current provider version for that same active club before its
-- stale legacy media pointer. Never rewrite historical snapshots or releases.
-- Both private aliases keep their existing canonical content/theme callers.
begin;
-- Keep any stricter session limit and fail this replacement atomically if
-- its catalog lock or execution exceeds the existing migration budget.
do $$
begin
  if current_setting('lock_timeout')::interval = interval '0'
     or current_setting('lock_timeout')::interval > interval '1 second' then
    perform set_config('lock_timeout', '1s', true);
  end if;
  if current_setting('statement_timeout')::interval = interval '0'
     or current_setting('statement_timeout')::interval > interval '30 seconds' then
    perform set_config('statement_timeout', '30s', true);
  end if;
end;
$$;

create or replace function private.build_dynamic_snapshot_data_before_menu_studio_v2(
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
  club_version_id uuid;
begin
  result := private.build_dynamic_snapshot_data_before_provider_cache_v1(p_slide);
  -- Tenant authors select overrides in Studio; sports_clubs' legacy logo
  -- pointer is provider-owned, not a second human branding override.
  if exists (select 1 from public.studio_tenant_brand_kits kit
    where kit.tenant_id = p_slide.tenant_id and kit.logo_media_asset_id is not null)
  then
    return result;
  end if;
  select coalesce(club.logo_provider_asset_version_id, club.logo_media_asset_id)
  into club_version_id
  from public.sports_clubs club
  join public.sportlink_connections connection
    on connection.tenant_id = club.tenant_id and connection.id = club.source_connection_id
  where club.tenant_id = p_slide.tenant_id and club.active
    and coalesce(club.logo_provider_asset_version_id, club.logo_media_asset_id) is not null
  order by case when p_slide.slide_type like 'sport\_%' escape '\'
    and connection.data_source_id = p_slide.data_source_id then 0 else 1 end,
    club.last_synced_at desc, club.id
  limit 1;
  if club_version_id is null then return result; end if;
  return coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'brand', coalesce(result -> 'brand', '{}'::jsonb) ||
      jsonb_build_object('logoMediaAssetId', club_version_id)
  );
end;
$$;

-- Menu-document.v2 bypasses the ordinary legacy brand chain. Preserve every
-- document/theme calculation and apply the same provider-before-legacy fallback.
create or replace function private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  document jsonb;
  selection jsonb;
  result jsonb;
  club_name text;
  club_logo_id uuid;
  published_at timestamptz := now();
begin
  if p_slide.slide_type <> 'price_list'
    or p_slide.configuration_json ->> 'schemaVersion' is distinct from 'menu-document.v2'
  then
    return private.build_dynamic_snapshot_data_before_menu_studio_v2(p_slide);
  end if;

  document := private.resolve_menu_document_v2(
    p_slide.tenant_id,
    p_slide.data_source_id,
    p_slide.configuration_json
  );
  perform private.validate_menu_document_v2(
    p_slide.tenant_id, p_slide.data_source_id, document
  );
  document := jsonb_set(document, '{publication}', jsonb_build_object(
    'documentRevision', p_slide.menu_document_revision,
    'rendererVersion', '2.0.0',
    'contentFitVersion', 'dom-measured-2.0.0',
    'themeManifestVersion', '1.0.0',
    'assetManifestVersion', '1.0.0',
    'publishedAt', published_at
  ), true);
  select tenant.name into club_name
  from public.tenants tenant where tenant.id = p_slide.tenant_id;
  select coalesce(
    (select kit.logo_media_asset_id
     from public.studio_tenant_brand_kits kit
     where kit.tenant_id = p_slide.tenant_id),
    (select coalesce(club.logo_provider_asset_version_id, club.logo_media_asset_id)
     from public.sports_clubs club
     where club.tenant_id = p_slide.tenant_id
       and club.active
       and coalesce(club.logo_provider_asset_version_id, club.logo_media_asset_id) is not null
     order by club.last_synced_at desc, club.id limit 1)
  ) into club_logo_id;
  selection := jsonb_build_object(
    'accent', document #>> '{theme,brand,accent}',
    'support', document #>> '{theme,brand,support}',
    'categoryOverrides', '[]'::jsonb,
    'modePolicy', jsonb_build_object(
      'kind', 'fixed', 'mode', document #>> '{theme,mode}'
    ),
    'ref', jsonb_build_object(
      'catalog', 'v2',
      'id', document #>> '{theme,themeId}',
      'version', document #>> '{theme,themeVersion}'
    )
  );
  result := jsonb_build_object(
    'type', 'price_list',
    'menuDocument', document,
    'brand', jsonb_strip_nulls(jsonb_build_object(
      'clubName', club_name,
      'logoMediaAssetId', club_logo_id,
      'primaryColor', document #>> '{theme,brand,accent}'
    )),
    'themePresentation', jsonb_build_object(
      'catalogVersion', '1.0.0',
      'resolvedMode', jsonb_build_object(
        'mode', document #>> '{theme,mode}',
        'policy', selection -> 'modePolicy',
        'resolvedAt', published_at,
        'timezone', 'UTC'
      ),
      'selection', selection,
      'snapshotVersion', 1
    )
  );
  return result;
end;
$$;

revoke all on function private.build_dynamic_snapshot_data_before_menu_studio_v2(public.dynamic_slides)
  from public, anon, authenticated, service_role;
revoke all on function private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(public.dynamic_slides)
  from public, anon, authenticated, service_role;
commit;
