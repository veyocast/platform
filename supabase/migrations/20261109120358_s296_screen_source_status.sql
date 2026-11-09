-- S296: narrowly authorized, read-only source metadata for an exact screen.
-- This does not acknowledge a source revision or alter a publication/queue.
create function private.screen_frame_timestamp_s296_v1(p_value text)
returns timestamptz language plpgsql immutable strict set search_path='' as $$
begin
  if p_value !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$' then return null; end if;
  return p_value::timestamptz;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end;
$$;
revoke all on function private.screen_frame_timestamp_s296_v1(text) from public,anon,authenticated,service_role;

create function private.screen_source_status_s296_v1(p_tenant_id uuid,p_screen_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if private.current_user_id() is null or not private.has_tenant_capability(p_tenant_id,'tenant.screen.read')
    or not exists(select 1 from public.screens s join public.tenants t on t.id=s.tenant_id
      where s.tenant_id=p_tenant_id and s.id=p_screen_id and s.deleted_at is null and t.status in ('active','paused')) then
    raise exception using errcode='42501',message='screen source metadata is not authorized';
  end if;
  with target as (
    select assigned_release_id,composition_id from public.screens where tenant_id=p_tenant_id and id=p_screen_id
  ), confirmed as (
    select d.active_release_id,d.active_composition_id from public.player_devices d
    cross join lateral(select private.screen_frame_timestamp_s296_v1(d.current_sync_detail#>>'{publicationTrace,firstFrameAt}') frame_at) frame
    where d.tenant_id=p_tenant_id and d.screen_id=p_screen_id and d.status='paired'
      and d.active_release_id is not null and d.current_sync_detail#>>'{publicationTrace,releaseId}'=d.active_release_id::text
      and frame.frame_at is not null and d.last_seen_at is not null
      and frame.frame_at <= d.last_seen_at and d.last_seen_at <= statement_timestamp()
  ), compositions as (
    select composition_id from target where composition_id is not null
    union select active_composition_id from confirmed where active_composition_id is not null
  ), used_releases as (
    select assigned_release_id release_id from target where assigned_release_id is not null
    union select active_release_id from confirmed
    -- Main's effective assignment may be a scheduled replacement of the
    -- composition default. Only its actual desired/confirmed pointer is used.
    union select b.release_id from public.screen_composition_bindings b join compositions c on c.composition_id=b.composition_id
      where b.tenant_id=p_tenant_id and b.zone_id<>'main'
    union select b.fallback_release_id from public.screen_composition_bindings b join compositions c on c.composition_id=b.composition_id
      where b.tenant_id=p_tenant_id and b.zone_id<>'main' and b.fallback_release_id is not null
  ), used_snapshots as (
    select item.dynamic_snapshot_id snapshot_id,bool_or(item.live_data_enabled) live_enabled
    from public.playlist_release_items item join used_releases r on r.release_id=item.release_id
    where item.tenant_id=p_tenant_id and item.enabled and item.dynamic_snapshot_id is not null
    group by item.dynamic_snapshot_id
  ), frozen_sources as (
    select snapshot.id snapshot_id,source.id source_id,source.name source_name,source.kind source_kind,
      source.last_successful_sync_at,source.last_attempt_at,source.last_error_code source_error,
      coalesce(version.slide_type,slide.slide_type) slide_type,
      coalesce(version.configuration_json#>>'{syncConfiguration,seed,family}',snapshot.snapshot_data_json#>>'{syncConfiguration,seed,family}') family,
      snapshot.snapshot_data_json#>'{sport,matchday}' matchday,
      binding.checked_at,binding.data_revision,binding.content_hash,binding.last_error_code binding_error
    from used_snapshots used
    join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=p_tenant_id and snapshot.id=used.snapshot_id
    join public.dynamic_slides slide on slide.tenant_id=p_tenant_id and slide.id=snapshot.dynamic_slide_id
    left join public.dynamic_slide_versions version on version.tenant_id=p_tenant_id and version.id=snapshot.dynamic_slide_version_id
    join public.dynamic_data_sources source on source.tenant_id=p_tenant_id and source.id=snapshot.data_source_id
    left join public.published_dynamic_data binding on used.live_enabled and binding.tenant_id=p_tenant_id
      and binding.snapshot_id=snapshot.id and binding.data_source_id=source.id
  ), datasets as (
    select frozen.*,dataset_key from frozen_sources frozen cross join lateral unnest(case
      when source_kind<>'sportlink' then array[case when source_kind in ('manual_products','twelve_excel') then 'products' else source_kind end]
      when family='matchday' or jsonb_typeof(matchday)='object' then array['matches','competitions']
      when slide_type in ('sport_standing','sport_period_standing') then array['competitions']
      when slide_type='sport_birthdays' then array['public_people']
      when slide_type='sport_team' then array['teams']
      when slide_type in ('sport_activities','sport_trainings') then array['activities']
      when slide_type='sport_volunteers' then array['volunteers']
      when slide_type in ('sport_dressing_rooms','sport_officials') then array['matches','match_details']
      when slide_type='sport_sponsor' then array['club_profile']
      else array['matches'] end) dataset_key
  ), rows as (
    select d.snapshot_id,d.dataset_key,jsonb_build_object(
      'snapshotId',d.snapshot_id,'sourceName',d.source_name,'sourceKind',d.source_kind,'datasetKey',d.dataset_key,
      'lastSuccessAt',case when d.source_kind='sportlink' then policy.last_success_at else d.last_successful_sync_at end,
      'lastAttemptAt',case when d.source_kind='sportlink' then policy.last_attempt_at else d.last_attempt_at end,
      'checkedAt',d.checked_at,
      'dataRevision',case when d.data_revision between 1 and 9007199254740991 then d.data_revision else null end,
      'contentHash',d.content_hash,
      'lastErrorCode',private.live_integration_safe_code_v1(coalesce(
        case when d.source_kind='sportlink' then case when latest.status in ('failed','partial') then latest.error_code end else d.source_error end,
        d.binding_error))
    ) payload
    from datasets d
    left join public.sportlink_connections connection on d.source_kind='sportlink' and connection.tenant_id=p_tenant_id and connection.data_source_id=d.source_id
    left join public.sportlink_sync_policies policy on policy.tenant_id=p_tenant_id and policy.connection_id=connection.id and policy.dataset_group=d.dataset_key
    left join lateral(select run.status,run.error_code from public.sportlink_sync_runs run
      where run.tenant_id=p_tenant_id and run.connection_id=connection.id and run.dataset_group=d.dataset_key
      order by run.started_at desc,run.id desc limit 1) latest on true
    order by d.snapshot_id,d.dataset_key limit 200
  ) select coalesce(jsonb_agg(payload order by snapshot_id,dataset_key),'[]'::jsonb) into result from rows;
  return result;
end;
$$;
revoke all on function private.screen_source_status_s296_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.screen_source_status_s296_v1(uuid,uuid) to authenticated;

create function public.get_screen_source_status_s296_v1(p_tenant_id uuid,p_screen_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.screen_source_status_s296_v1(p_tenant_id,p_screen_id);
$$;
revoke all on function public.get_screen_source_status_s296_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_screen_source_status_s296_v1(uuid,uuid) to authenticated;
