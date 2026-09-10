-- S162: make the immutable theme rollout planner set-based.
--
-- The S153 planner performed one snapshot build, hash, insert, mapping insert,
-- and render-job insert per source snapshot. That is safe but too slow for
-- tenants with a full slide library: the synchronous theme save could hit
-- PostgreSQL's statement timeout before the rollout was even queued. This
-- replacement keeps the same source selection, historical version override,
-- rollout marker, immutable snapshot identity, and release-branch semantics,
-- while letting PostgreSQL plan the work as one bounded statement.

create or replace function private.start_tenant_theme_rollout_v2(
  p_tenant_id uuid,
  p_theme_id text,
  p_settings_revision bigint,
  p_created_by uuid,
  p_retry_of_rollout_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_release_count integer := 0;
  snapshot_total integer := 0;
  v_rollout_id uuid;
begin
  if not exists (
    select 1
    from public.tenant_theme_profiles profile
    where profile.tenant_id = p_tenant_id
      and profile.theme_id = p_theme_id
      and profile.revision = p_settings_revision
  ) then
    raise exception 'tenant theme revision is unavailable' using errcode = '40001';
  end if;

  insert into public.tenant_theme_rollouts(
    tenant_id, theme_id, settings_revision, status, created_by,
    retry_of_rollout_id
  ) values (
    p_tenant_id, p_theme_id, p_settings_revision, 'queued', p_created_by,
    p_retry_of_rollout_id
  ) returning id into v_rollout_id;

  -- A new rollout id is part of the frozen snapshot payload, so every row
  -- created by this statement has a fresh content identity. The source rows
  -- are collapsed before the insert: one old snapshot can be both the current
  -- slide snapshot and a member of an active release, but it must be mapped
  -- only once while retaining the stronger advance_current=true intent.
  with active_releases as materialized (
    select release_id
    from private.theme_rollout_active_release_ids_v1(p_tenant_id)
  ), source_ids as materialized (
    select slide.current_snapshot_id as old_snapshot_id, true as advance_current
    from public.dynamic_slides slide
    where slide.tenant_id = p_tenant_id
      and slide.status <> 'archived'
      and slide.current_published_version_id is not null
      and slide.current_snapshot_id is not null
    union all
    select release_item.dynamic_snapshot_id, false
    from active_releases active_release
    join public.playlist_release_items release_item
      on release_item.tenant_id = p_tenant_id
     and release_item.release_id = active_release.release_id
    where release_item.dynamic_snapshot_id is not null
  ), collapsed as materialized (
    select old_snapshot_id, bool_or(advance_current) as advance_current
    from source_ids
    where old_snapshot_id is not null
    group by old_snapshot_id
  ), source_rows as materialized (
    select
      snapshot.tenant_id,
      snapshot.id as old_snapshot_id,
      snapshot.dynamic_slide_id,
      snapshot.dynamic_slide_version_id,
      case
        -- Match assign_dynamic_snapshot_version_v1: a valid historical
        -- published/archived version remains the immutable source identity,
        -- including when the slide has a newer current publication.
        when version.status in ('published', 'archived')
          and version.template_version_id is not distinct from
            snapshot.template_version_id
          and version.data_source_id is not distinct from
            snapshot.data_source_id
          then snapshot.dynamic_slide_version_id
        when active_version.status = 'publishing' then slide.active_draft_version_id
        when slide.current_published_version_id is not null
          then slide.current_published_version_id
        when active_version.status = 'draft' then slide.active_draft_version_id
        else snapshot.dynamic_slide_version_id
      end as insert_version_id,
      snapshot.template_version_id,
      snapshot.data_source_id,
      snapshot.snapshot_data_json,
      collapsed.advance_current,
      slide as slide_record,
      version as source_version
    from collapsed
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = p_tenant_id
     and snapshot.id = collapsed.old_snapshot_id
     and snapshot.status = 'ready'
     and snapshot.output_media_asset_id is not null
    join public.dynamic_slides slide
      on slide.tenant_id = snapshot.tenant_id
     and slide.id = snapshot.dynamic_slide_id
    left join public.dynamic_slide_versions active_version
      on active_version.tenant_id = slide.tenant_id
     and active_version.dynamic_slide_id = slide.id
     and active_version.id = slide.active_draft_version_id
    join public.dynamic_slide_versions version
      on version.tenant_id = snapshot.tenant_id
     and version.dynamic_slide_id = snapshot.dynamic_slide_id
     and version.id = snapshot.dynamic_slide_version_id
    where coalesce(
      snapshot.snapshot_data_json #>> '{themePresentation,selection,ref,id}',
      version.theme_selection_json #>> '{ref,id}',
      version.configuration_json #>> '{editorial,themeSelection,ref,id}',
      version.configuration_json #>> '{theme,themeId}'
    ) = p_theme_id
  ), prepared as materialized (
    select
      source.tenant_id,
      source.old_snapshot_id,
      source.dynamic_slide_id,
      source.insert_version_id,
      source.template_version_id,
      source.data_source_id,
      source.advance_current,
      private.apply_tenant_theme_to_snapshot_v1(
        p_tenant_id,
        source.snapshot_data_json,
        v_rollout_id
      ) as snapshot_data,
      pg_catalog.jsonb_populate_record(
        source.slide_record,
        pg_catalog.jsonb_build_object(
          'name', (source.source_version).name,
          'slide_type', (source.source_version).slide_type,
          'orientation', (source.source_version).orientation,
          'template_id', (source.source_version).template_id,
          'template_version_id', (source.source_version).template_version_id,
          'data_source_id', (source.source_version).data_source_id,
          'selection_mode', (source.source_version).selection_mode,
          'configuration_json', (source.source_version).configuration_json
        )
      ) as hash_slide
    from source_rows source
  ), hashed as materialized (
    select
      prepared.tenant_id,
      prepared.old_snapshot_id,
      prepared.dynamic_slide_id,
      prepared.insert_version_id,
      prepared.template_version_id,
      prepared.data_source_id,
      prepared.advance_current,
      prepared.snapshot_data,
      private.dynamic_snapshot_content_hash_v1(
        prepared.hash_slide,
        prepared.snapshot_data
      ) as content_hash
    from prepared
  ), inserted_snapshots as (
    insert into public.dynamic_slide_snapshots(
      tenant_id,
      dynamic_slide_id,
      dynamic_slide_version_id,
      template_version_id,
      data_source_id,
      source_revision_hash,
      snapshot_data_json,
      created_by
    )
    select
      hashed.tenant_id,
      hashed.dynamic_slide_id,
      hashed.insert_version_id,
      hashed.template_version_id,
      hashed.data_source_id,
      hashed.content_hash,
      hashed.snapshot_data,
      p_created_by
    from hashed
    order by hashed.dynamic_slide_id, hashed.old_snapshot_id
    on conflict (
      dynamic_slide_id,
      dynamic_slide_version_id,
      source_revision_hash,
      template_version_id
    ) do nothing
    returning
      id,
      tenant_id,
      dynamic_slide_id,
      dynamic_slide_version_id,
      template_version_id,
      source_revision_hash
  ), inserted_mappings as (
    insert into private.tenant_theme_rollout_snapshots(
      tenant_id,
      rollout_id,
      dynamic_slide_id,
      old_snapshot_id,
      new_snapshot_id,
      advance_current
    )
    select
      hashed.tenant_id,
      v_rollout_id,
      hashed.dynamic_slide_id,
      hashed.old_snapshot_id,
      inserted.id,
      hashed.advance_current
    from hashed
    join inserted_snapshots inserted
      on inserted.tenant_id = hashed.tenant_id
     and inserted.dynamic_slide_id = hashed.dynamic_slide_id
     and inserted.dynamic_slide_version_id = hashed.insert_version_id
     and inserted.template_version_id = hashed.template_version_id
     and inserted.source_revision_hash = hashed.content_hash
    returning old_snapshot_id, new_snapshot_id
  ), inserted_jobs as (
    insert into public.dynamic_render_jobs(tenant_id, snapshot_id)
    select p_tenant_id, mapping.new_snapshot_id
    from inserted_mappings mapping
    on conflict (snapshot_id) do nothing
    returning snapshot_id
  )
  select count(*)::integer
  into snapshot_total
  from inserted_mappings mapping
  left join inserted_jobs job
    on job.snapshot_id = mapping.new_snapshot_id;

  insert into private.tenant_theme_rollout_release_branches(
    tenant_id, rollout_id, source_release_id
  )
  select distinct p_tenant_id, v_rollout_id, active_release.release_id
  from private.theme_rollout_active_release_ids_v1(p_tenant_id) active_release
  join public.playlist_release_items release_item
    on release_item.tenant_id = p_tenant_id
   and release_item.release_id = active_release.release_id
  join private.tenant_theme_rollout_snapshots mapping
    on mapping.tenant_id = release_item.tenant_id
   and mapping.rollout_id = v_rollout_id
   and mapping.old_snapshot_id = release_item.dynamic_snapshot_id;
  get diagnostics active_release_count = row_count;

  update public.tenant_theme_rollouts rollout
  set snapshot_count = snapshot_total,
      ready_snapshot_count = 0,
      release_target_count = active_release_count,
      release_count = 0,
      status = case when snapshot_total = 0 then 'ready' else 'rendering' end,
      completed_at = case when snapshot_total = 0 then pg_catalog.now() else null end
  where rollout.tenant_id = p_tenant_id
    and rollout.id = v_rollout_id;

  return v_rollout_id;
end;
$$;

revoke all on function private.start_tenant_theme_rollout_v2(
  uuid, text, bigint, uuid, uuid
) from public, anon, authenticated, service_role;

comment on function private.start_tenant_theme_rollout_v2(
  uuid, text, bigint, uuid, uuid
) is
  'Queue an immutable tenant theme rollout with a set-based snapshot planner; historical snapshots, releases, and Player-LKG remain untouched.';
