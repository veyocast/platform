-- S191: reference checks run only inside bounded indexed candidate pages.
-- S190's LIMIT followed a volatile predicate and sort over the entire tenant
-- history. On the 21,909-snapshot/1,218-authoring-history regression it exceeded
-- 45 seconds, rolling back every small cleanup attempt. Preserve all references,
-- immutable deletion allowlists and binding-before-queue SKIP LOCKED ordering.

-- Preserve the previous strpos(UUID) semantics, including UUIDs in nested
-- strings/keys. Only canonical lowercase UUID substrings matched that predicate.
create function private.publication_authoring_uuid_refs_v1(p_document jsonb)
returns uuid[] language sql immutable strict security invoker set search_path='' as $$
  select coalesce(array_agg(distinct captured[1]::uuid order by captured[1]::uuid),'{}'::uuid[])
  from pg_catalog.regexp_matches(p_document::text,
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}','g') captured
$$;
revoke all on function private.publication_authoring_uuid_refs_v1(jsonb) from public,anon,authenticated,service_role;
-- PostgreSQL evaluates expression-index functions as the row writer. This
-- immutable invoker reads only its JSON argument and exposes no database rows.
grant execute on function private.publication_authoring_uuid_refs_v1(jsonb) to authenticated;
create index publication_authoring_uuid_refs_idx on public.playlist_release_authoring_snapshots
  using gin (private.publication_authoring_uuid_refs_v1(snapshot_json));
create index publication_tenant_template_uuid_refs_idx on public.tenant_playlist_templates
  using gin (private.publication_authoring_uuid_refs_v1(snapshot_json));
create index publication_items_snapshot_reference_idx on public.playlist_items(tenant_id,dynamic_snapshot_id)
  where dynamic_snapshot_id is not null;
create index publication_release_items_snapshot_reference_idx on public.playlist_release_items(tenant_id,dynamic_snapshot_id)
  where dynamic_snapshot_id is not null;
create index publication_snapshots_prune_page_idx on public.dynamic_slide_snapshots(tenant_id,created_at,id)
  where status in ('ready','failed');
create index publication_releases_prune_page_idx on public.playlist_releases(tenant_id,published_at,id);
create index publication_versions_prune_page_idx on public.dynamic_slide_versions(tenant_id,created_at,id)
  where status in ('published','archived');

alter table private.publication_version_prune_queue
  add column release_scan_at timestamptz,add column release_scan_id uuid,
  add column version_scan_at timestamptz,add column version_scan_id uuid,
  add column snapshot_scan_at timestamptz,add column snapshot_scan_id uuid,
  add column release_scan_complete boolean not null default false,
  add column version_scan_complete boolean not null default false,
  add column snapshot_scan_complete boolean not null default false,
  add constraint publication_prune_cursor_pairs_check check(
    (release_scan_at is null)=(release_scan_id is null)
    and (version_scan_at is null)=(version_scan_id is null)
    and (snapshot_scan_at is null)=(snapshot_scan_id is null));

-- Composition publication and device acknowledgement use the same queue
-- directly. A new request invalidates every cursor, including mid-sweep; the
-- maintenance command only changes updated_at and never triggers this reset.
create function private.reset_publication_prune_scan_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.requested_at is distinct from old.requested_at then
    new.release_scan_at:=null;new.release_scan_id:=null;
    new.version_scan_at:=null;new.version_scan_id:=null;
    new.snapshot_scan_at:=null;new.snapshot_scan_id:=null;
    new.release_scan_complete:=false;new.version_scan_complete:=false;new.snapshot_scan_complete:=false;
  end if;
  return new;
end $$;
revoke all on function private.reset_publication_prune_scan_v1() from public,anon,authenticated,service_role;
create trigger publication_prune_reset_new_request before update of requested_at
  on private.publication_version_prune_queue for each row execute function private.reset_publication_prune_scan_v1();

create or replace function private.publication_snapshot_is_referenced_v1(
  p_tenant_id uuid,p_snapshot_id uuid,p_ignored_version_id uuid default null
) returns boolean language sql volatile security definer set search_path='' as $$
  select exists(select 1 from public.dynamic_slides where tenant_id=p_tenant_id and current_snapshot_id=p_snapshot_id)
    or exists(select 1 from public.playlist_items where tenant_id=p_tenant_id and dynamic_snapshot_id=p_snapshot_id)
    or exists(select 1 from public.playlist_release_items where tenant_id=p_tenant_id and dynamic_snapshot_id=p_snapshot_id)
    -- Restore-to-draft also owns its frozen item references, including a latest
    -- selection whose authoring snapshot differs from the materialized item.
    or exists(select 1 from public.playlist_release_authoring_snapshots where tenant_id=p_tenant_id
      and private.publication_authoring_uuid_refs_v1(snapshot_json) @> array[p_snapshot_id])
    -- Saved active and archived templates keep their exact reusable source
    -- snapshot even when no draft or release currently references that data.
    or exists(select 1 from public.tenant_playlist_templates where tenant_id=p_tenant_id
      and private.publication_authoring_uuid_refs_v1(snapshot_json) @> array[p_snapshot_id])
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

create or replace function private.publication_version_can_prune_v1(p_tenant_id uuid,p_version_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
  with version as materialized (
    select * from public.dynamic_slide_versions version where version.tenant_id=p_tenant_id
      and version.id=p_version_id and version.status in ('published','archived')
      and exists(select 1 from public.dynamic_slide_versions newer where newer.tenant_id=p_tenant_id
        and newer.dynamic_slide_id=version.dynamic_slide_id and newer.version_number>version.version_number)
      and not exists(select 1 from public.dynamic_slides where tenant_id=p_tenant_id
        and (current_published_version_id=version.id or active_draft_version_id=version.id))
  ), snapshots as materialized (
    select snapshot.id,snapshot.status from public.dynamic_slide_snapshots snapshot join version
      on version.id=snapshot.dynamic_slide_version_id where snapshot.tenant_id=p_tenant_id
  )
  select exists(select 1 from version)
    and not exists(select 1 from snapshots join public.dynamic_slides slide
      on slide.tenant_id=p_tenant_id and slide.current_snapshot_id=snapshots.id)
    and not exists(select 1 from snapshots join public.playlist_items item
      on item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshots.id)
    and not exists(select 1 from snapshots join public.playlist_release_items item
      on item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshots.id)
    and not exists(select 1 from public.playlist_release_authoring_snapshots authoring
      where authoring.tenant_id=p_tenant_id and private.publication_authoring_uuid_refs_v1(authoring.snapshot_json)
        && coalesce((select array_agg(id) from snapshots),'{}'::uuid[]))
    and not exists(select 1 from public.tenant_playlist_templates template
      where template.tenant_id=p_tenant_id and private.publication_authoring_uuid_refs_v1(template.snapshot_json)
        && coalesce((select array_agg(id) from snapshots),'{}'::uuid[]))
    and not exists(select 1 from snapshots join public.dynamic_slide_versions other
      on other.tenant_id=p_tenant_id and other.published_snapshot_id=snapshots.id and other.id<>p_version_id)
    and not exists(select 1 from snapshots where status in ('queued','rendering'))
    and not exists(select 1 from snapshots join public.dynamic_render_jobs job
      on job.tenant_id=p_tenant_id and job.snapshot_id=snapshots.id and job.status in ('queued','rendering'))
    and not exists(select 1 from snapshots join private.published_data_refresh_queue queue
      on queue.tenant_id=p_tenant_id and queue.snapshot_id=snapshots.id
      and queue.lease_token is not null and queue.lease_until>statement_timestamp())
    and not exists(select 1 from private.tenant_theme_rollout_snapshots mapping
      where mapping.tenant_id=p_tenant_id and (
        mapping.old_snapshot_id in(select id from snapshots) or mapping.new_snapshot_id in(select id from snapshots))
      and not private.theme_rollout_can_prune_dependencies_v1(p_tenant_id,mapping.rollout_id))
$$;
revoke all on function private.publication_version_can_prune_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Candidate pages contain only technical identities. The expensive eligibility
-- checks and immutable row locks happen after this hard bound, not before LIMIT.
create function private.publication_prune_page_v1(
  p_tenant_id uuid,p_kind text,p_after_at timestamptz,p_after_id uuid,p_limit integer
) returns table(id uuid,scan_at timestamptz)
language plpgsql security invoker set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 100 or p_tenant_id is null then
    raise exception 'invalid prune page scope' using errcode='22023';
  end if;
  if p_kind='release' then
    return query select release.id,release.published_at from public.playlist_releases release
      where release.tenant_id=p_tenant_id
      and (p_after_at is null or (release.published_at,release.id)>(p_after_at,p_after_id))
      order by release.published_at,release.id limit p_limit;
  elsif p_kind='version' then
    return query select version.id,version.created_at from public.dynamic_slide_versions version
      where version.tenant_id=p_tenant_id and version.status in ('published','archived')
      and (p_after_at is null or (version.created_at,version.id)>(p_after_at,p_after_id))
      order by version.created_at,version.id limit p_limit;
  elsif p_kind='snapshot' then
    return query select snapshot.id,snapshot.created_at from public.dynamic_slide_snapshots snapshot
      where snapshot.tenant_id=p_tenant_id and snapshot.status in ('ready','failed')
      and (p_after_at is null or (snapshot.created_at,snapshot.id)>(p_after_at,p_after_id))
      order by snapshot.created_at,snapshot.id limit p_limit;
  else raise exception 'invalid prune page kind' using errcode='22023'; end if;
end $$;
revoke all on function private.publication_prune_page_v1(uuid,text,timestamptz,uuid,integer)
  from public,anon,authenticated,service_role;

create or replace function public.prune_versions_before_composition_v1(p_tenant_id uuid,p_limit integer default 25)
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
  queue_state private.publication_version_prune_queue%rowtype;
  page_limit integer:=least(100,greatest(25,p_limit*4));
  release_page uuid[]; version_page uuid[]; snapshot_page uuid[];
  release_last_at timestamptz;release_last_id uuid;
  version_last_at timestamptz;version_last_id uuid;
  snapshot_last_at timestamptz;snapshot_last_id uuid;
  release_remaining boolean;version_remaining boolean;snapshot_remaining boolean;
  release_complete boolean;version_complete boolean;snapshot_complete boolean;
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
  select * into queue_state from private.publication_version_prune_queue where tenant_id=p_tenant_id for update;
  if queue_state.release_scan_complete then release_page:='{}'; else
  select coalesce(array_agg(id order by scan_at,id),'{}'::uuid[]),
    (array_agg(scan_at order by scan_at desc,id desc))[1],(array_agg(id order by scan_at desc,id desc))[1]
    into release_page,release_last_at,release_last_id
    from private.publication_prune_page_v1(p_tenant_id,'release',queue_state.release_scan_at,queue_state.release_scan_id,page_limit);
  end if;
  if queue_state.version_scan_complete then version_page:='{}'; else
  select coalesce(array_agg(id order by scan_at,id),'{}'::uuid[]),
    (array_agg(scan_at order by scan_at desc,id desc))[1],(array_agg(id order by scan_at desc,id desc))[1]
    into version_page,version_last_at,version_last_id
    from private.publication_prune_page_v1(p_tenant_id,'version',queue_state.version_scan_at,queue_state.version_scan_id,page_limit);
  end if;
  if queue_state.snapshot_scan_complete then snapshot_page:='{}'; else
  select coalesce(array_agg(id order by scan_at,id),'{}'::uuid[]),
    (array_agg(scan_at order by scan_at desc,id desc))[1],(array_agg(id order by scan_at desc,id desc))[1]
    into snapshot_page,snapshot_last_at,snapshot_last_id
    from private.publication_prune_page_v1(p_tenant_id,'snapshot',queue_state.snapshot_scan_at,queue_state.snapshot_scan_id,page_limit);
  end if;
  insert into private.publication_version_prune_context(backend_pid,transaction_id,tenant_id)
    values(pg_backend_pid(),txid_current(),p_tenant_id);

  for candidate in select release.* from public.playlist_releases release where release.tenant_id=p_tenant_id and release.id=any(release_page)
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
    where version.tenant_id=p_tenant_id and version.id=any(version_page) and private.publication_version_can_prune_v1(p_tenant_id,version.id)
    order by version.created_at,version.id limit p_limit for update of version skip locked
  loop
    candidate_detached_bases:='[]';
    candidate_cleared_provenance:='[]';
    begin
      if not private.publication_version_can_prune_v1(p_tenant_id,candidate.id) then
        skipped_count:=skipped_count+1; continue;
      end if;
      select coalesce(array_agg(id),'{}'::uuid[]) into snapshots from (
        with page as materialized (
          select id from public.dynamic_slide_snapshots where tenant_id=p_tenant_id
            and dynamic_slide_version_id=candidate.id order by created_at,id limit page_limit
        ) select snapshot.id from public.dynamic_slide_snapshots snapshot join page on page.id=snapshot.id
        where snapshot.tenant_id=p_tenant_id and not private.publication_snapshot_is_referenced_v1(p_tenant_id,snapshot.id,candidate.id)
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
    where snapshot.tenant_id=p_tenant_id and snapshot.id=any(snapshot_page) and snapshot.status in ('ready','failed')
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

  -- A remaining eligible row in the same page keeps the cursor in place until
  -- the deletion budget or a busy FK can be retried. Otherwise advance over
  -- protected rows. A full page schedules one more bounded pass; an exhausted
  -- sweep resets its cursor for the existing low-frequency reference resweep.
  release_remaining:=exists(select 1 from public.playlist_releases release where release.tenant_id=p_tenant_id
    and release.id=any(release_page)
    and exists(select 1 from public.playlist_releases newer where newer.tenant_id=p_tenant_id
      and newer.playlist_id=release.playlist_id and newer.version>release.version)
    and not private.publication_release_is_referenced_v1(p_tenant_id,release.id));
  version_remaining:=exists(select 1 from public.dynamic_slide_versions version where version.tenant_id=p_tenant_id
    and version.id=any(version_page) and private.publication_version_can_prune_v1(p_tenant_id,version.id));
  snapshot_remaining:=exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=p_tenant_id
    and snapshot.id=any(snapshot_page) and snapshot.status in ('ready','failed')
    and not private.publication_snapshot_is_referenced_v1(p_tenant_id,snapshot.id));
  release_complete:=queue_state.release_scan_complete or(not release_remaining and cardinality(release_page)<page_limit);
  version_complete:=queue_state.version_scan_complete or(not version_remaining and cardinality(version_page)<page_limit);
  snapshot_complete:=queue_state.snapshot_scan_complete or(not snapshot_remaining and cardinality(snapshot_page)<page_limit);
  remaining:=not(release_complete and version_complete and snapshot_complete);
  update private.publication_version_prune_queue set pending=remaining,
    not_before=clock_timestamp()+case when skipped_count>0 then interval '1 minute' else interval '0 seconds' end,
    updated_at=clock_timestamp(),
    release_scan_complete=remaining and release_complete,
    version_scan_complete=remaining and version_complete,
    snapshot_scan_complete=remaining and snapshot_complete,
    release_scan_at=case when release_remaining then queue_state.release_scan_at
      when cardinality(release_page)=page_limit then release_last_at else null end,
    release_scan_id=case when release_remaining then queue_state.release_scan_id
      when cardinality(release_page)=page_limit then release_last_id else null end,
    version_scan_at=case when version_remaining then queue_state.version_scan_at
      when cardinality(version_page)=page_limit then version_last_at else null end,
    version_scan_id=case when version_remaining then queue_state.version_scan_id
      when cardinality(version_page)=page_limit then version_last_id else null end,
    snapshot_scan_at=case when snapshot_remaining then queue_state.snapshot_scan_at
      when cardinality(snapshot_page)=page_limit then snapshot_last_at else null end,
    snapshot_scan_id=case when snapshot_remaining then queue_state.snapshot_scan_id
      when cardinality(snapshot_page)=page_limit then snapshot_last_id else null end
  where tenant_id=p_tenant_id;
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
revoke all on function public.prune_versions_before_composition_v1(uuid,integer)
  from public,anon,authenticated,service_role;


create or replace function private.enqueue_publication_version_prune_v1() returns trigger
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
    updated_at=clock_timestamp(),not_before=clock_timestamp(),
    release_scan_at=null,release_scan_id=null,version_scan_at=null,version_scan_id=null,
    snapshot_scan_at=null,snapshot_scan_id=null,
    release_scan_complete=false,version_scan_complete=false,snapshot_scan_complete=false;
  return new;
end $$;
revoke all on function private.enqueue_publication_version_prune_v1() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
