-- Provider ingestion commits normalized data without rendering or building
-- published projections. One durable, coalesced lease per frozen binding.
create table private.published_data_refresh_queue (
  tenant_id uuid not null,
  snapshot_id uuid not null,
  data_source_id uuid not null,
  generation bigint not null default 1,
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  locked_by text,
  last_error_code text,
  primary key (tenant_id,snapshot_id),
  foreign key (tenant_id,snapshot_id) references public.dynamic_slide_snapshots(tenant_id,id) on delete cascade,
  foreign key (tenant_id,data_source_id) references public.dynamic_data_sources(tenant_id,id) on delete cascade,
  check (generation > 0 and attempt_count >= 0),
  check ((lease_token is null) = (lease_until is null))
);
create index published_data_refresh_queue_due_idx on private.published_data_refresh_queue(next_attempt_at,lease_until);
alter table private.published_data_refresh_queue enable row level security;
alter table private.published_data_refresh_queue force row level security;
revoke all on private.published_data_refresh_queue from public,anon,authenticated,service_role;

create function private.enqueue_published_binding_v1(p_tenant_id uuid,p_snapshot_id uuid)
returns void language sql security definer set search_path='' as $$
  insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id)
  select tenant_id,snapshot_id,data_source_id from public.published_dynamic_data
  where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id
  on conflict (tenant_id,snapshot_id) do update set
    generation=private.published_data_refresh_queue.generation+1,
    requested_at=clock_timestamp(),
    next_attempt_at=least(private.published_data_refresh_queue.next_attempt_at,clock_timestamp());
$$;
revoke all on function private.enqueue_published_binding_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- Keep the old private entry point for registered releases and source callers.
-- It now only queues IDs; no JSON projections or new content versions are made.
create or replace function private.refresh_published_data_v1(p_tenant_id uuid,p_source_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare queued integer;
begin
  insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id)
  select data.tenant_id,data.snapshot_id,data.data_source_id
  from public.published_dynamic_data data
  where data.tenant_id=p_tenant_id and data.data_source_id=p_source_id
    and exists(select 1 from public.playlist_release_items item
      join private.referenced_publication_releases_v1(p_tenant_id) used on used.release_id=item.release_id
      where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled)
  on conflict (tenant_id,snapshot_id) do update set
    generation=private.published_data_refresh_queue.generation+1,
    requested_at=clock_timestamp(),
    next_attempt_at=least(private.published_data_refresh_queue.next_attempt_at,clock_timestamp());
  get diagnostics queued=row_count;
  return queued;
end $$;

create or replace function private.register_published_data_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.live_data_enabled then
    insert into public.published_dynamic_data(tenant_id,snapshot_id,data_source_id,content_hash,data_json,source_revision)
    select snapshot.tenant_id,snapshot.id,snapshot.data_source_id,
      private.published_data_hash_v1(snapshot.snapshot_data_json),snapshot.snapshot_data_json,source.revision
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_data_sources source on source.tenant_id=snapshot.tenant_id and source.id=snapshot.data_source_id
    where snapshot.tenant_id=new.tenant_id and snapshot.id=new.dynamic_snapshot_id
    on conflict (snapshot_id) do nothing;
    -- Publication pointers are finalized later in this transaction. Enqueue
    -- this exact binding regardless; workers cannot see it before commit.
    perform private.enqueue_published_binding_v1(new.tenant_id,new.dynamic_snapshot_id);
  end if;
  return new;
end $$;

create or replace function private.refresh_published_data_after_source_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Also evaluate date windows when a successful observation has unchanged data.
  perform private.refresh_published_data_v1(new.tenant_id,new.id);
  return new;
end $$;
drop trigger if exists dynamic_data_sources_queue_latest_snapshots on public.dynamic_data_sources;

-- Birthday imports/manual links and old workers use this private compatibility
-- route. Preserve deliberate design/theme rendering, eliminate source churn.
alter function private.queue_latest_dynamic_snapshots_v2(uuid,uuid,text[],text)
  rename to queue_latest_dynamic_snapshots_before_live_refresh_v2;
create function private.queue_latest_dynamic_snapshots_v2(
  p_tenant_id uuid,p_data_source_id uuid,p_slide_types text[] default null,
  p_reason text default 'source_content_changed'
) returns integer language plpgsql security definer set search_path='' as $$
begin
  if p_reason='tenant_theme_colors_changed' then
    return private.queue_latest_dynamic_snapshots_before_live_refresh_v2(p_tenant_id,p_data_source_id,p_slide_types,p_reason);
  end if;
  return private.refresh_published_data_v1(p_tenant_id,p_data_source_id);
end $$;
revoke all on function private.queue_latest_dynamic_snapshots_before_live_refresh_v2(uuid,uuid,text[],text) from public,anon,authenticated,service_role;
revoke all on function private.queue_latest_dynamic_snapshots_v2(uuid,uuid,text[],text) from public,anon,authenticated,service_role;

-- The legacy brand editor previously disguised a design change as a source
-- revision. Preserve its explicit render behavior without reopening ingestion.
create or replace function private.refresh_news_slides_after_primary_color()
returns trigger language plpgsql security definer set search_path='' as $$
declare source record;
begin
  if tg_op='UPDATE' and new.primary_color is not distinct from old.primary_color then return new; end if;
  for source in select distinct data.id from public.dynamic_data_sources data
    join public.dynamic_slides slide on slide.tenant_id=data.tenant_id and slide.data_source_id=data.id
    where data.tenant_id=new.tenant_id and data.status='active'
      and slide.selection_mode='latest' and slide.status<>'archived'
  loop
    perform private.queue_latest_dynamic_snapshots_before_live_refresh_v2(new.tenant_id,source.id,null,'tenant_primary_color_changed');
  end loop;
  return new;
end $$;

create or replace function public.refresh_sportlink_time_sensitive_slides_v1(p_connection_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare connection public.sportlink_connections%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select * into connection from public.sportlink_connections where id=p_connection_id;
  if connection.id is null then raise exception 'connection not found' using errcode='P0002'; end if;
  return private.refresh_published_data_v1(connection.tenant_id,connection.data_source_id);
end $$;

create function public.claim_published_data_refresh_v1(p_worker_id text,p_lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path='' as $$
declare claimed private.published_data_refresh_queue%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if nullif(btrim(p_worker_id),'') is null or length(p_worker_id)>120 then
    raise exception 'worker required' using errcode='22023';
  end if;
  select * into claimed from private.published_data_refresh_queue
  where next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp())
  order by next_attempt_at,requested_at,tenant_id,snapshot_id for update skip locked limit 1;
  if not found then return null; end if;
  update private.published_data_refresh_queue set
    lease_token=extensions.gen_random_uuid(),lease_until=clock_timestamp()+make_interval(secs=>least(greatest(p_lease_seconds,30),120)),
    locked_by=p_worker_id,attempt_count=attempt_count+1
  where tenant_id=claimed.tenant_id and snapshot_id=claimed.snapshot_id returning * into claimed;
  return jsonb_build_object('tenantId',claimed.tenant_id,'snapshotId',claimed.snapshot_id,'leaseToken',claimed.lease_token);
end $$;

create function public.fail_published_data_refresh_v1(p_tenant_id uuid,p_snapshot_id uuid,p_lease_token uuid,p_error_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare safe_code text; changed integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  safe_code:=case when p_error_code ~ '^[A-Za-z0-9_]{1,80}$' then p_error_code else 'PUBLISHED_DATA_REFRESH_FAILED' end;
  -- Completion locks output before briefly finalizing its queue row. Failure
  -- recording must use the same order, including a client timeout race.
  perform 1 from public.published_dynamic_data where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id for update;
  update private.published_data_refresh_queue set
    lease_token=null,lease_until=null,locked_by=null,last_error_code=safe_code,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(300,greatest(5,power(2,least(attempt_count,8))::integer)))
  where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and lease_token=p_lease_token
    and lease_until>clock_timestamp();
  get diagnostics changed=row_count;
  if changed>0 then
    update public.published_dynamic_data set checked_at=clock_timestamp(),last_error_code=safe_code
    where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
  end if;
  return changed>0;
end $$;

create function public.complete_published_data_refresh_v1(p_tenant_id uuid,p_snapshot_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  work private.published_data_refresh_queue%rowtype;
  binding public.published_dynamic_data%rowtype;
  frozen public.dynamic_slide_snapshots%rowtype;
  definition public.dynamic_slides%rowtype;
  dataset jsonb; hash text; observed_revision bigint; safe_code text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  -- Lock only the output row while building. Ingestion can coalesce the queue
  -- concurrently and is never held behind a slow projection.
  select * into binding from public.published_dynamic_data
    where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id for update;
  select * into work from private.published_data_refresh_queue
    where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and lease_token=p_lease_token and lease_until>clock_timestamp();
  if work.snapshot_id is null or binding.snapshot_id is null then raise exception 'lease unavailable' using errcode='42501'; end if;
  begin
    if exists(select 1 from public.playlist_release_items item
      join private.referenced_publication_releases_v1(p_tenant_id) used on used.release_id=item.release_id
      where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=p_snapshot_id and item.live_data_enabled) then
      select * into strict frozen from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_snapshot_id;
      select (jsonb_populate_record(slide,jsonb_build_object(
        'name',version.name,'slide_type',version.slide_type,'orientation',version.orientation,
        'template_id',version.template_id,'template_version_id',version.template_version_id,
        'data_source_id',version.data_source_id,'selection_mode',version.selection_mode,
        'configuration_json',version.configuration_json))).* into definition
      from public.dynamic_slides slide join public.dynamic_slide_versions version
        on version.tenant_id=slide.tenant_id and version.dynamic_slide_id=slide.id
      where slide.tenant_id=p_tenant_id and slide.id=frozen.dynamic_slide_id
        and version.id=frozen.dynamic_slide_version_id and version.status in ('published','archived');
      if definition.id is null then raise exception 'published definition missing' using errcode='23514'; end if;
      select private.build_dynamic_snapshot_data(definition),source.revision into dataset,observed_revision
        from public.dynamic_data_sources source where source.tenant_id=p_tenant_id and source.id=work.data_source_id;
      dataset:=dataset||(select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
        from jsonb_each(frozen.snapshot_data_json)
        where key in ('themePresentation','editorial','presentation','_veyocastThemeRuntime','_veyocastThemeColorOverrides','theme','layout'));
      if frozen.snapshot_data_json ? 'brand' then
        dataset:=jsonb_set(dataset,'{brand}',coalesce(dataset->'brand','{}'::jsonb)||(select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
          from jsonb_each(frozen.snapshot_data_json->'brand') where key in ('primaryColor','secondaryColor','backgroundMediaAssetId')));
      end if;
      if jsonb_typeof(dataset) is distinct from 'object' then raise exception 'invalid data' using errcode='23514'; end if;
      hash:=private.published_data_hash_v1(dataset);
      update public.published_dynamic_data set
        data_json=case when content_hash<>hash then dataset else data_json end,
        data_revision=data_revision+case when content_hash<>hash then 1 else 0 end,
        changed_at=case when content_hash<>hash then clock_timestamp() else changed_at end,
        content_hash=hash,checked_at=clock_timestamp(),last_error_code=null,source_revision=observed_revision
      where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id;
    end if;
    -- Compare the request generation at finalization. A newer source commit
    -- arriving during the build must still be processed by another pass.
    delete from private.published_data_refresh_queue where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id
      and lease_token=p_lease_token and lease_until>clock_timestamp() and generation=work.generation;
    if not found then
      update private.published_data_refresh_queue set lease_token=null,lease_until=null,locked_by=null,
        attempt_count=0,last_error_code=null,next_attempt_at=clock_timestamp()
      where tenant_id=p_tenant_id and snapshot_id=p_snapshot_id and lease_token=p_lease_token and lease_until>clock_timestamp();
      if not found then raise exception 'lease lost' using errcode='42501'; end if;
    end if;
    return jsonb_build_object('status','completed');
  exception when sqlstate '57014' or others then
    get stacked diagnostics safe_code=returned_sqlstate;
    perform public.fail_published_data_refresh_v1(p_tenant_id,p_snapshot_id,p_lease_token,safe_code);
    return jsonb_build_object('status','retry');
  end;
end $$;

revoke all on function public.claim_published_data_refresh_v1(text,integer) from public,anon,authenticated;
revoke all on function public.complete_published_data_refresh_v1(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.fail_published_data_refresh_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_published_data_refresh_v1(text,integer) to service_role;
grant execute on function public.complete_published_data_refresh_v1(uuid,uuid,uuid) to service_role;
grant execute on function public.fail_published_data_refresh_v1(uuid,uuid,uuid,text) to service_role;

-- One recoverable pass for existing current publications; no provider calls,
-- no configuration changes, no historical snapshot or release rewriting.
do $$ declare source record; begin
  for source in select distinct tenant_id,data_source_id from public.published_dynamic_data loop
    perform private.refresh_published_data_v1(source.tenant_id,source.data_source_id);
  end loop;
end $$;
notify pgrst,'reload schema';
