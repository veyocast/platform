-- S190: prune superseded, unreachable configuration records after replacement.
-- Source refreshes never enqueue this work. Active/offline device references,
-- schedules, sponsor proof, immutable current payloads and all media bytes remain.
create table private.publication_version_prune_queue (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  pending boolean not null default true,
  requested_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  not_before timestamptz not null default clock_timestamp()
);
create index publication_version_prune_due_idx
  on private.publication_version_prune_queue(not_before,tenant_id) where pending;
create index publication_version_prune_resweep_idx
  on private.publication_version_prune_queue(updated_at,tenant_id) where not pending;
alter table private.publication_version_prune_queue enable row level security;
alter table private.publication_version_prune_queue force row level security;
revoke all on private.publication_version_prune_queue from public,anon,authenticated,service_role;

-- A caller-controlled GUC is insufficient authorization for immutable deletion.
-- Only the owner command can write this exact transaction/candidate allowlist.
create table private.publication_version_prune_context (
  backend_pid integer not null,
  transaction_id bigint not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  release_ids uuid[] not null default '{}',
  snapshot_ids uuid[] not null default '{}',
  version_ids uuid[] not null default '{}',
  target_ids uuid[] not null default '{}',
  primary key(backend_pid,transaction_id)
);
create index publication_version_prune_context_tenant_idx
  on private.publication_version_prune_context(tenant_id);
alter table private.publication_version_prune_context enable row level security;
alter table private.publication_version_prune_context force row level security;
revoke all on private.publication_version_prune_context from public,anon,authenticated,service_role;

create function private.publication_prune_contains_v1(p_tenant_id uuid,p_kind text,p_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
  select exists(select 1 from private.publication_version_prune_context context
    where context.backend_pid=pg_backend_pid() and context.transaction_id=txid_current()
      and context.tenant_id=p_tenant_id and p_id=any(case p_kind
        when 'release' then context.release_ids when 'snapshot' then context.snapshot_ids
        when 'version' then context.version_ids when 'target' then context.target_ids
        else '{}'::uuid[] end))
$$;
revoke all on function private.publication_prune_contains_v1(uuid,text,uuid)
  from public,anon,authenticated,service_role;
-- Invoker triggers may ask only whether their own transaction has an exact
-- owner-written candidate. This exposes no rows and grants no context writes.
grant execute on function private.publication_prune_contains_v1(uuid,text,uuid) to authenticated,service_role;

create or replace function private.reject_playlist_release_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if private.playlist_delete_context_v1() or private.publication_prune_contains_v1(
      old.tenant_id,'release',case when tg_table_name='playlist_releases' then old.id else (to_jsonb(old)->>'release_id')::uuid end
    ) then return old; end if;
  end if;
  raise exception 'playlist releases are immutable' using errcode='23514';
end $$;
revoke all on function private.reject_playlist_release_mutation() from public,anon,authenticated,service_role;

create or replace function private.reject_publisher_target_snapshot_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if private.playlist_delete_context_v1() then
    if tg_op='DELETE' then return old; end if;
    if tg_op='UPDATE' and tg_table_name='publisher_target_snapshots' then
      if old.schedule_id is not null and new.schedule_id is null and new.id=old.id then return new; end if;
    end if;
  end if;
  if tg_op='DELETE' then
    if tg_table_name='playlist_release_authoring_snapshots' then
      if private.publication_prune_contains_v1(old.tenant_id,'release',old.release_id) then return old; end if;
    elsif tg_table_name='publisher_target_snapshots' then
      if private.publication_prune_contains_v1(old.tenant_id,'target',old.id) then return old; end if;
    elsif tg_table_name='publisher_target_snapshot_screens' then
      if private.publication_prune_contains_v1(old.tenant_id,'target',old.snapshot_id) then return old; end if;
    end if;
  end if;
  raise exception 'publisher target snapshots are immutable' using errcode='23514';
end $$;
revoke all on function private.reject_publisher_target_snapshot_mutation() from public,anon,authenticated,service_role;

create or replace function private.reject_dynamic_immutable_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and tg_table_name='dynamic_slide_snapshots' then
    if private.publication_prune_contains_v1(old.tenant_id,'snapshot',old.id) then return old; end if;
  end if;
  raise exception 'dynamic snapshot records are immutable' using errcode='55000';
end $$;
revoke all on function private.reject_dynamic_immutable_mutation() from public,anon,authenticated,service_role;

create or replace function private.reject_published_dynamic_slide_version_mutation_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if private.publication_prune_contains_v1(old.tenant_id,'version',old.id) then return old; end if;
  elsif tg_op='UPDATE' then
    -- Clear only obsolete provenance, never authoring/render configuration.
    if old.based_on_version_id is not null and new.based_on_version_id is null
      and (to_jsonb(new)-'based_on_version_id')=(to_jsonb(old)-'based_on_version_id')
      and private.publication_prune_contains_v1(old.tenant_id,'version',old.based_on_version_id)
    then return new; end if;
    if old.published_snapshot_id is not null and new.published_snapshot_id is null
      and (to_jsonb(new)-'published_snapshot_id')=(to_jsonb(old)-'published_snapshot_id')
      and private.publication_prune_contains_v1(old.tenant_id,'version',old.id)
    then return new; end if;
  end if;
  if tg_op='DELETE' or old.status in ('published','archived') then
    raise exception 'published dynamic slide versions are immutable' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function private.reject_published_dynamic_slide_version_mutation_v1()
  from public,anon,authenticated,service_role;

create function private.enqueue_publication_version_prune_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='playlist_publications' then
    if tg_op='UPDATE' and new.release_id is not distinct from old.release_id then return new; end if;
  elsif tg_table_name='dynamic_slide_versions' then
    if new.status<>'published' or (tg_op='UPDATE' and old.status='published') then return new; end if;
  elsif tg_table_name='player_devices' then
    if new.status<>'paired' or new.active_release_id is null
      or new.active_release_id is not distinct from old.active_release_id then return new; end if;
  end if;
  insert into private.publication_version_prune_queue(tenant_id) values(new.tenant_id)
  on conflict(tenant_id) do update set pending=true,requested_at=clock_timestamp(),
    updated_at=clock_timestamp(),not_before=clock_timestamp();
  return new;
end $$;
revoke all on function private.enqueue_publication_version_prune_v1() from public,anon,authenticated,service_role;
create trigger current_publication_enqueue_version_prune after insert or update of release_id
  on public.playlist_publications for each row execute function private.enqueue_publication_version_prune_v1();
create trigger published_slide_enqueue_version_prune after insert or update of status
  on public.dynamic_slide_versions for each row execute function private.enqueue_publication_version_prune_v1();
create trigger active_player_enqueue_version_prune after update of active_release_id
  on public.player_devices for each row execute function private.enqueue_publication_version_prune_v1();

-- A failed latest rollout at the current profile revision remains retryable.
-- Its dependency records must remain until a newer revision supersedes it.
create function private.theme_rollout_can_prune_dependencies_v1(p_tenant_id uuid,p_rollout_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select rollout.status='ready' or (rollout.status='failed' and not exists(
    select 1 from public.tenant_theme_profiles profile where profile.tenant_id=rollout.tenant_id
      and profile.theme_id=rollout.theme_id and profile.revision=rollout.settings_revision))
    from public.tenant_theme_rollouts rollout where rollout.tenant_id=p_tenant_id and rollout.id=p_rollout_id),false)
$$;
revoke all on function private.theme_rollout_can_prune_dependencies_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

create function private.publication_release_is_referenced_v1(p_tenant_id uuid,p_release_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.playlist_publications where tenant_id=p_tenant_id and release_id=p_release_id)
    or exists(select 1 from public.screens where tenant_id=p_tenant_id and
      (assigned_release_id=p_release_id or default_release_id=p_release_id))
    or exists(select 1 from public.screen_groups where tenant_id=p_tenant_id and default_release_id=p_release_id)
    or exists(select 1 from public.player_devices where tenant_id=p_tenant_id and
      (active_release_id=p_release_id or desired_release_id=p_release_id))
    or exists(select 1 from public.content_schedules where tenant_id=p_tenant_id and release_id=p_release_id)
    or exists(select 1 from public.sponsor_plan_revisions where tenant_id=p_tenant_id and content_release_id=p_release_id)
    or exists(select 1 from public.publisher_target_snapshots target where target.tenant_id=p_tenant_id
      and target.release_id=p_release_id and (
        exists(select 1 from public.screens where tenant_id=p_tenant_id and active_target_snapshot_id=target.id)
        or exists(select 1 from public.content_schedules where tenant_id=p_tenant_id and target_snapshot_id=target.id)
        or exists(select 1 from public.release_screen_assignments where tenant_id=p_tenant_id
          and target_snapshot_id=target.id and release_id<>p_release_id)))
    or exists(select 1 from private.tenant_theme_rollout_release_branches branch where branch.tenant_id=p_tenant_id
      and (branch.source_release_id=p_release_id or branch.replacement_release_id=p_release_id)
      and not private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,branch.rollout_id))
    or exists(select 1 from private.tenant_theme_rollout_releases mapping where mapping.tenant_id=p_tenant_id
      and mapping.release_id=p_release_id and not private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,mapping.rollout_id))
$$;
revoke all on function private.publication_release_is_referenced_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

create function private.publication_snapshot_is_referenced_v1(
  p_tenant_id uuid,p_snapshot_id uuid,p_ignored_version_id uuid default null
) returns boolean language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.dynamic_slides where tenant_id=p_tenant_id and current_snapshot_id=p_snapshot_id)
    or exists(select 1 from public.playlist_items where tenant_id=p_tenant_id and dynamic_snapshot_id=p_snapshot_id)
    or exists(select 1 from public.playlist_release_items where tenant_id=p_tenant_id and dynamic_snapshot_id=p_snapshot_id)
    -- Restore-to-draft also owns its frozen item references, including a latest
    -- selection whose authoring snapshot differs from the materialized item.
    or exists(select 1 from public.playlist_release_authoring_snapshots where tenant_id=p_tenant_id
      and strpos(snapshot_json::text,p_snapshot_id::text)>0)
    or exists(select 1 from public.dynamic_slide_versions where tenant_id=p_tenant_id and published_snapshot_id=p_snapshot_id
      and id is distinct from p_ignored_version_id)
    or exists(select 1 from public.dynamic_slide_snapshots snapshot join public.dynamic_slide_versions version
      on version.tenant_id=snapshot.tenant_id and version.id=snapshot.dynamic_slide_version_id
      where snapshot.tenant_id=p_tenant_id and snapshot.id=p_snapshot_id and
        (version.status in ('draft','publishing') or exists(select 1 from public.dynamic_slides slide
          where slide.tenant_id=p_tenant_id and slide.active_draft_version_id=version.id)))
    or exists(select 1 from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id and status in ('queued','rendering'))
    or exists(select 1 from public.dynamic_render_jobs where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and status in ('queued','rendering'))
    or exists(select 1 from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id
      and lease_token is not null and lease_until>statement_timestamp())
    or exists(select 1 from private.tenant_theme_rollout_snapshots mapping where mapping.tenant_id=p_tenant_id
      and (mapping.old_snapshot_id=p_snapshot_id or mapping.new_snapshot_id=p_snapshot_id)
      and not private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,mapping.rollout_id))
$$;
revoke all on function private.publication_snapshot_is_referenced_v1(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;

create function private.publication_version_can_prune_v1(p_tenant_id uuid,p_version_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.dynamic_slide_versions version where version.tenant_id=p_tenant_id
    and version.id=p_version_id and version.status in ('published','archived')
    -- Preserve the high-water version, so existing MAX(version_number)+1 stays monotone.
    and exists(select 1 from public.dynamic_slide_versions newer where newer.tenant_id=p_tenant_id
      and newer.dynamic_slide_id=version.dynamic_slide_id and newer.version_number>version.version_number)
    and not exists(select 1 from public.dynamic_slides where tenant_id=p_tenant_id
      and (current_published_version_id=version.id or active_draft_version_id=version.id))
    and not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=p_tenant_id
      and snapshot.dynamic_slide_version_id=version.id
      and private.publication_snapshot_is_referenced_v1(p_tenant_id,snapshot.id,version.id)))
$$;
revoke all on function private.publication_version_can_prune_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

-- Complete/fail refresh commands take the binding before its queue row. Match
-- that order without waiting for a running writer, including an expired lease.
create function private.publication_prune_lock_bindings_v1(p_tenant_id uuid,p_snapshot_ids uuid[])
returns boolean language plpgsql security invoker set search_path='' as $$
declare locked_ids uuid[];
begin
  select coalesce(array_agg(snapshot_id),'{}'::uuid[]) into locked_ids from (
    select snapshot_id from public.published_dynamic_data where tenant_id=p_tenant_id
      and snapshot_id=any(p_snapshot_ids) order by snapshot_id for update skip locked
  ) locked;
  if exists(select 1 from public.published_dynamic_data where tenant_id=p_tenant_id
    and snapshot_id=any(p_snapshot_ids) and not(snapshot_id=any(locked_ids))) then return false; end if;
  select coalesce(array_agg(snapshot_id),'{}'::uuid[]) into locked_ids from (
    select snapshot_id from private.published_data_refresh_queue where tenant_id=p_tenant_id
      and snapshot_id=any(p_snapshot_ids) order by snapshot_id for update skip locked
  ) locked;
  return not exists(select 1 from private.published_data_refresh_queue where tenant_id=p_tenant_id
    and snapshot_id=any(p_snapshot_ids) and not(snapshot_id=any(locked_ids)));
end $$;
revoke all on function private.publication_prune_lock_bindings_v1(uuid,uuid[])
  from public,anon,authenticated,service_role;

create function public.prune_superseded_publication_versions_v1(p_tenant_id uuid,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  candidate record;
  snapshots uuid[];
  targets uuid[];
  previous_lock_timeout text:=current_setting('lock_timeout');
  deleted_releases jsonb:='[]';
  deleted_versions jsonb:='[]';
  deleted_snapshots uuid[]:='{}';
  detached_bases jsonb:='[]';
  cleared_snapshot_provenance jsonb:='[]';
  candidate_detached_bases jsonb;
  candidate_cleared_provenance jsonb;
  release_count integer:=0;
  version_count integer:=0;
  snapshot_count integer:=0;
  skipped_count integer:=0;
  remaining boolean;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if p_tenant_id is null or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid prune scope or batch limit' using errcode='22023';
  end if;
  if not exists(select 1 from public.tenants where id=p_tenant_id) then
    raise exception 'tenant not found' using errcode='P0002';
  end if;
  perform set_config('lock_timeout','250ms',true);
  insert into private.publication_version_prune_queue(tenant_id,pending) values(p_tenant_id,true)
    on conflict(tenant_id) do nothing;
  perform 1 from private.publication_version_prune_queue where tenant_id=p_tenant_id for update;
  insert into private.publication_version_prune_context(backend_pid,transaction_id,tenant_id)
    values(pg_backend_pid(),txid_current(),p_tenant_id);

  for candidate in select release.* from public.playlist_releases release where release.tenant_id=p_tenant_id
    and exists(select 1 from public.playlist_releases newer where newer.tenant_id=p_tenant_id
      and newer.playlist_id=release.playlist_id and newer.version>release.version)
    and not private.publication_release_is_referenced_v1(p_tenant_id,release.id)
    order by release.published_at,release.id limit p_limit for update of release skip locked
  loop
    begin
      if private.publication_release_is_referenced_v1(p_tenant_id,candidate.id) then
        skipped_count:=skipped_count+1; continue;
      end if;
      select coalesce(array_agg(id),'{}'::uuid[]) into targets from public.publisher_target_snapshots
        where tenant_id=p_tenant_id and release_id=candidate.id;
      update private.publication_version_prune_context set release_ids=array[candidate.id],target_ids=targets
        where backend_pid=pg_backend_pid() and transaction_id=txid_current();
      delete from public.player_heartbeats where tenant_id=p_tenant_id and active_release_id=candidate.id;
      delete from public.player_sync_events where tenant_id=p_tenant_id and release_id=candidate.id;
      delete from public.release_screen_assignments where tenant_id=p_tenant_id and release_id=candidate.id;
      delete from public.publisher_target_snapshot_screens where tenant_id=p_tenant_id and snapshot_id=any(targets);
      delete from public.publisher_target_snapshots where tenant_id=p_tenant_id and id=any(targets);
      delete from private.tenant_theme_rollout_release_branches where tenant_id=p_tenant_id
        and (source_release_id=candidate.id or replacement_release_id=candidate.id)
        and private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,rollout_id);
      delete from private.tenant_theme_rollout_releases where tenant_id=p_tenant_id and release_id=candidate.id
        and private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,rollout_id);
      delete from public.playlist_release_authoring_snapshots where tenant_id=p_tenant_id and release_id=candidate.id;
      delete from public.playlist_release_items where tenant_id=p_tenant_id and release_id=candidate.id;
      delete from public.playlist_releases where tenant_id=p_tenant_id and id=candidate.id;
      deleted_releases:=deleted_releases||jsonb_build_array(jsonb_build_object(
        'id',candidate.id,'playlistId',candidate.playlist_id,'version',candidate.version,
        'manifestHash',candidate.manifest_hash,'targetIds',to_jsonb(targets)));
      release_count:=release_count+1;
    exception when foreign_key_violation or lock_not_available then
      -- Roll back this whole candidate, including historical dependants. A new
      -- reference or future FK must never leave a half-deleted configuration.
      skipped_count:=skipped_count+1;
    end;
    update private.publication_version_prune_context set release_ids='{}',target_ids='{}'
      where backend_pid=pg_backend_pid() and transaction_id=txid_current();
  end loop;

  for candidate in select version.* from public.dynamic_slide_versions version
    where version.tenant_id=p_tenant_id and private.publication_version_can_prune_v1(p_tenant_id,version.id)
    order by version.created_at,version.id limit p_limit for update of version skip locked
  loop
    candidate_detached_bases:='[]';
    candidate_cleared_provenance:='[]';
    begin
      if not private.publication_version_can_prune_v1(p_tenant_id,candidate.id) then
        skipped_count:=skipped_count+1; continue;
      end if;
      select coalesce(array_agg(id),'{}'::uuid[]) into snapshots from (
        select snapshot.id from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=p_tenant_id
          and snapshot.dynamic_slide_version_id=candidate.id
          and not private.publication_snapshot_is_referenced_v1(p_tenant_id,snapshot.id,candidate.id)
        order by snapshot.created_at,snapshot.id limit greatest(p_limit-snapshot_count,0)
        for update of snapshot skip locked
      ) selected;
      if cardinality(snapshots)=0 and exists(select 1 from public.dynamic_slide_snapshots
        where tenant_id=p_tenant_id and dynamic_slide_version_id=candidate.id) then continue; end if;
      -- Release all candidate locks through its exception subtransaction when
      -- a binding writer/claimer owns any row; never invert its lock order.
      if not private.publication_prune_lock_bindings_v1(p_tenant_id,snapshots) then
        raise exception 'publication binding is busy' using errcode='55P03';
      end if;
      if exists(select 1 from unnest(snapshots) id where
        private.publication_snapshot_is_referenced_v1(p_tenant_id,id,candidate.id)) then
        skipped_count:=skipped_count+1; continue;
      end if;
      update private.publication_version_prune_context set version_ids=array[candidate.id],snapshot_ids=snapshots
        where backend_pid=pg_backend_pid() and transaction_id=txid_current();
      -- Lock the basis dependants before clearing only their ancestry pointer.
      perform 1 from public.dynamic_slide_versions where tenant_id=p_tenant_id
        and based_on_version_id=candidate.id order by id for update;
      select coalesce(jsonb_agg(jsonb_build_object('versionId',id,'basedOnVersionId',based_on_version_id)),'[]'::jsonb)
        into candidate_detached_bases from public.dynamic_slide_versions where tenant_id=p_tenant_id and based_on_version_id=candidate.id;
      update public.dynamic_slide_versions set based_on_version_id=null
        where tenant_id=p_tenant_id and based_on_version_id=candidate.id;
      if candidate.published_snapshot_id is not null then
        update public.dynamic_slide_versions set published_snapshot_id=null where tenant_id=p_tenant_id and id=candidate.id;
        candidate_cleared_provenance:=jsonb_build_array(jsonb_build_object(
          'versionId',candidate.id,'snapshotId',candidate.published_snapshot_id));
      end if;
      delete from private.tenant_theme_rollout_snapshots where tenant_id=p_tenant_id
        and (old_snapshot_id=any(snapshots) or new_snapshot_id=any(snapshots))
        and private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,rollout_id);
      delete from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=any(snapshots);
      if not exists(select 1 from public.dynamic_slide_snapshots where tenant_id=p_tenant_id
        and dynamic_slide_version_id=candidate.id) then
        delete from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=candidate.id;
        deleted_versions:=deleted_versions||jsonb_build_array(jsonb_build_object(
          'id',candidate.id,'slideId',candidate.dynamic_slide_id,'version',candidate.version_number));
        version_count:=version_count+1;
      end if;
      deleted_snapshots:=deleted_snapshots||snapshots;
      snapshot_count:=snapshot_count+cardinality(snapshots);
      detached_bases:=detached_bases||candidate_detached_bases;
      cleared_snapshot_provenance:=cleared_snapshot_provenance||candidate_cleared_provenance;
    exception when foreign_key_violation or lock_not_available then
      skipped_count:=skipped_count+1;
    end;
    update private.publication_version_prune_context set version_ids='{}',snapshot_ids='{}'
      where backend_pid=pg_backend_pid() and transaction_id=txid_current();
  end loop;

  -- Source-generated historical snapshots within a retained design can also be
  -- obsolete. Its published fallback, current mirror, draft pins and LKG remain.
  for candidate in select snapshot.* from public.dynamic_slide_snapshots snapshot
    where snapshot.tenant_id=p_tenant_id and snapshot.status in ('ready','failed')
      and not private.publication_snapshot_is_referenced_v1(p_tenant_id,snapshot.id)
    order by snapshot.created_at,snapshot.id limit greatest(p_limit-snapshot_count,0)
    for update of snapshot skip locked
  loop
    begin
      if not private.publication_prune_lock_bindings_v1(p_tenant_id,array[candidate.id]) then
        raise exception 'publication binding is busy' using errcode='55P03';
      end if;
      if private.publication_snapshot_is_referenced_v1(p_tenant_id,candidate.id) then
        skipped_count:=skipped_count+1; continue;
      end if;
      update private.publication_version_prune_context set snapshot_ids=array[candidate.id]
        where backend_pid=pg_backend_pid() and transaction_id=txid_current();
      delete from private.tenant_theme_rollout_snapshots where tenant_id=p_tenant_id
        and (old_snapshot_id=candidate.id or new_snapshot_id=candidate.id)
        and private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,rollout_id);
      delete from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=candidate.id;
      deleted_snapshots:=array_append(deleted_snapshots,candidate.id);
      snapshot_count:=snapshot_count+1;
    exception when foreign_key_violation or lock_not_available then skipped_count:=skipped_count+1;
    end;
    update private.publication_version_prune_context set snapshot_ids='{}'
      where backend_pid=pg_backend_pid() and transaction_id=txid_current();
  end loop;
  delete from private.publication_version_prune_context
    where backend_pid=pg_backend_pid() and transaction_id=txid_current();

  remaining:=exists(select 1 from public.playlist_releases release where release.tenant_id=p_tenant_id
    and exists(select 1 from public.playlist_releases newer where newer.tenant_id=p_tenant_id
      and newer.playlist_id=release.playlist_id and newer.version>release.version)
    and not private.publication_release_is_referenced_v1(p_tenant_id,release.id))
    or exists(select 1 from public.dynamic_slide_versions version where version.tenant_id=p_tenant_id
      and private.publication_version_can_prune_v1(p_tenant_id,version.id))
    or exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=p_tenant_id
      and snapshot.status in ('ready','failed') and not private.publication_snapshot_is_referenced_v1(p_tenant_id,snapshot.id));
  insert into private.publication_version_prune_queue(tenant_id,pending,not_before)
    values(p_tenant_id,remaining,clock_timestamp()+case when skipped_count>0 then interval '1 minute' else interval '0 seconds' end)
  on conflict(tenant_id) do update set pending=excluded.pending,not_before=excluded.not_before,updated_at=clock_timestamp();
  if release_count+version_count+snapshot_count>0 then
    insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
    values(p_tenant_id,'publication.superseded_versions.pruned','tenants',p_tenant_id,'success',jsonb_build_object(
      'systemExecuted',true,'releases',deleted_releases,'versions',deleted_versions,
      'snapshotIds',to_jsonb(deleted_snapshots),'detachedBasis',detached_bases,
      'clearedSnapshotProvenance',cleared_snapshot_provenance,'assetsDeleted',0,
      'activeReferencesPreserved',true));
  end if;
  perform set_config('lock_timeout',previous_lock_timeout,true);
  return jsonb_build_object('status','completed','tenantId',p_tenant_id,'releasesDeleted',release_count,
    'versionsDeleted',version_count,'snapshotsDeleted',snapshot_count,'assetsDeleted',0,
    'skippedReferences',skipped_count,'pending',remaining);
end $$;
revoke all on function public.prune_superseded_publication_versions_v1(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.prune_superseded_publication_versions_v1(uuid,integer) to service_role;

create function public.prune_queued_publication_versions_v1(p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path='' as $$
declare scoped_tenant uuid; is_resweep boolean:=false;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid prune batch limit' using errcode='22023'; end if;
  select tenant_id into scoped_tenant from private.publication_version_prune_queue
    where pending and not_before<=statement_timestamp() order by requested_at,tenant_id limit 1 for update skip locked;
  -- The worker's existing slow safety pass calls this even without a queue
  -- hint. Recheck one quiet tenant after ten minutes, so removing a schedule,
  -- draft pin or other reference cannot strand history without source churn.
  if scoped_tenant is null then
    select tenant_id into scoped_tenant from private.publication_version_prune_queue
      where not pending and updated_at<=statement_timestamp()-interval '10 minutes'
      order by updated_at,tenant_id limit 1 for update skip locked;
    is_resweep:=scoped_tenant is not null;
  end if;
  if scoped_tenant is null then return jsonb_build_object('status','idle'); end if;
  return public.prune_superseded_publication_versions_v1(scoped_tenant,p_limit)
    ||jsonb_build_object('resweep',is_resweep);
end $$;
revoke all on function public.prune_queued_publication_versions_v1(integer)
  from public,anon,authenticated,service_role;
grant execute on function public.prune_queued_publication_versions_v1(integer) to service_role;

-- Existing history is checked asynchronously by the same bounded command.
-- This migration itself deletes no records and touches no immutable bytes.
insert into private.publication_version_prune_queue(tenant_id)
select distinct tenant_id from public.playlist_releases
union select distinct tenant_id from public.dynamic_slide_versions
on conflict(tenant_id) do nothing;
select pg_catalog.pg_notify('pgrst','reload schema');
