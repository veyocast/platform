-- S185 expand: immutable configuration, one current publication and independent data.
-- No historic release bytes, screen assignments or active reports are rewritten.
create table public.playlist_publications (
  tenant_id uuid not null,
  playlist_id uuid primary key,
  release_id uuid not null,
  config_revision bigint not null check (config_revision > 0),
  definition_hash text not null check (definition_hash ~ '^[a-f0-9]{64}$'),
  published_at timestamptz not null,
  foreign key (tenant_id, playlist_id) references public.playlists(tenant_id,id) on delete cascade,
  foreign key (tenant_id, release_id) references public.playlist_releases(tenant_id,id) on delete cascade
);
create index playlist_publications_tenant_idx on public.playlist_publications(tenant_id,playlist_id);
create index playlist_publications_release_idx on public.playlist_publications(tenant_id,release_id);
alter table public.playlist_publications enable row level security;
alter table public.playlist_publications force row level security;
revoke all on public.playlist_publications from public,anon,authenticated,service_role;
grant select on public.playlist_publications to authenticated,service_role;
create policy playlist_publications_read on public.playlist_publications for select to authenticated
  using (private.is_tenant_member(tenant_id));

alter table public.screens add column target_revision bigint not null default 1,
  add column target_changed_at timestamptz not null default now(),
  add column schedule_evaluated_at timestamptz;
create function private.advance_screen_target_v1() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.target_revision := 1;
  elsif row(new.assigned_release_id,new.active_assignment_source,new.active_schedule_id)
    is distinct from row(old.assigned_release_id,old.active_assignment_source,old.active_schedule_id) then
    new.target_revision := old.target_revision + 1;
    new.target_changed_at := clock_timestamp();
  else
    new.target_revision := old.target_revision;
    new.target_changed_at := old.target_changed_at;
  end if;
  return new;
end $$;
revoke all on function private.advance_screen_target_v1() from public,anon,authenticated,service_role;
create trigger zz_screens_advance_target before insert or update on public.screens
  for each row execute function private.advance_screen_target_v1();

-- This flag is materialized from the published item; draft changes cannot change it.
alter table public.playlist_release_items add column live_data_enabled boolean not null default false;
create index playlist_release_items_live_binding_idx on public.playlist_release_items(tenant_id,dynamic_snapshot_id,release_id) where live_data_enabled;
create index screens_current_publication_idx on public.screens(tenant_id,assigned_release_id) where deleted_at is null;
create function private.materialize_published_data_binding_v1() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.source_item_id is not null then
    select item.dynamic_selection_mode = 'latest' into new.live_data_enabled
    from public.playlist_items item where item.tenant_id=new.tenant_id
      and item.playlist_id=new.playlist_id and item.id=new.source_item_id;
    new.live_data_enabled := coalesce(new.live_data_enabled,false) and new.dynamic_snapshot_id is not null;
  end if;
  return new;
end $$;
revoke all on function private.materialize_published_data_binding_v1() from public,anon,authenticated,service_role;
create trigger zz_release_item_live_binding before insert on public.playlist_release_items
  for each row execute function private.materialize_published_data_binding_v1();

create table public.published_dynamic_data (
  tenant_id uuid not null,
  snapshot_id uuid primary key,
  data_source_id uuid not null,
  data_revision bigint not null default 1 check (data_revision > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  data_json jsonb not null check (jsonb_typeof(data_json)='object'),
  source_revision bigint not null default 0,
  checked_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  last_error_code text,
  foreign key (tenant_id,snapshot_id) references public.dynamic_slide_snapshots(tenant_id,id) on delete cascade,
  foreign key (tenant_id,data_source_id) references public.dynamic_data_sources(tenant_id,id)
);
create index published_dynamic_data_source_idx on public.published_dynamic_data(tenant_id,data_source_id,snapshot_id);
alter table public.published_dynamic_data enable row level security;
alter table public.published_dynamic_data force row level security;
revoke all on public.published_dynamic_data from public,anon,authenticated,service_role;
grant select on public.published_dynamic_data to service_role;
-- No direct client policy: only the device-authorized Player API reads these rows.

create function private.published_data_hash_v1(p_data jsonb) returns text language sql immutable
set search_path = '' as $$
  select encode(extensions.digest(convert_to(((p_data
    #- '{menu,generatedAt}' #- '{news,generatedAt}' #- '{sport,generatedAt}')
    - 'generatedAt' - '_veyocastContentRecovery' - '_veyocastThemeRollout')::text,'UTF8'),'sha256'),'hex')
$$;
revoke all on function private.published_data_hash_v1(jsonb) from public,anon,authenticated,service_role;

create function private.register_published_data_v1() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.live_data_enabled then
    insert into public.published_dynamic_data(tenant_id,snapshot_id,data_source_id,content_hash,data_json,source_revision)
    select snapshot.tenant_id,snapshot.id,snapshot.data_source_id,
      private.published_data_hash_v1(snapshot.snapshot_data_json),snapshot.snapshot_data_json,source.revision
    from public.dynamic_slide_snapshots snapshot
    join public.dynamic_data_sources source on source.tenant_id=snapshot.tenant_id and source.id=snapshot.data_source_id
    where snapshot.tenant_id=new.tenant_id and snapshot.id=new.dynamic_snapshot_id
    on conflict (snapshot_id) do nothing;
    if found then
      perform private.refresh_published_data_v1(new.tenant_id,
        (select data_source_id from public.dynamic_slide_snapshots where tenant_id=new.tenant_id and id=new.dynamic_snapshot_id));
    end if;
  end if;
  return new;
end $$;
revoke all on function private.register_published_data_v1() from public,anon,authenticated,service_role;
create trigger release_item_register_live_data after insert on public.playlist_release_items
  for each row execute function private.register_published_data_v1();

-- Only live references are refreshed; historical dataset rows are not a second
-- unbounded branch of the source worker. Recent offline devices retain grace.
create function private.referenced_publication_releases_v1(p_tenant_id uuid)
returns table(release_id uuid) language sql stable security definer set search_path='' as $$
  select release_id from public.playlist_publications where tenant_id=p_tenant_id
  union select assigned_release_id from public.screens where tenant_id=p_tenant_id and deleted_at is null
  union select default_release_id from public.screens where tenant_id=p_tenant_id and deleted_at is null
  union select default_release_id from public.screen_groups where tenant_id=p_tenant_id and status='active'
  union select release_id from public.content_schedules where tenant_id=p_tenant_id and enabled and (ends_at is null or ends_at>statement_timestamp())
  union select active_release_id from public.player_devices where tenant_id=p_tenant_id and status='paired' and coalesce(last_seen_at,paired_at)>statement_timestamp()-interval '30 days'
  union select desired_release_id from public.player_devices where tenant_id=p_tenant_id and status='paired'
$$;
revoke all on function private.referenced_publication_releases_v1(uuid) from public,anon,authenticated,service_role;

-- The source is fetched once by existing workers. Build selections from exact
-- immutable version configuration, never from the mutable slide mirror.
create function private.refresh_published_data_v1(p_tenant_id uuid,p_source_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  binding record;
  frozen public.dynamic_slide_snapshots%rowtype;
  definition public.dynamic_slides%rowtype;
  dataset jsonb;
  hash text;
  changed integer := 0;
  error_code text;
begin
  for binding in select data.* from public.published_dynamic_data data
    where data.tenant_id=p_tenant_id and data.data_source_id=p_source_id
      and exists(select 1 from public.playlist_release_items item
        join private.referenced_publication_releases_v1(p_tenant_id) used on used.release_id=item.release_id
        where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled)
    order by data.snapshot_id for update
  loop
    begin
      select * into strict frozen from public.dynamic_slide_snapshots
        where tenant_id=p_tenant_id and id=binding.snapshot_id;
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
      dataset := private.build_dynamic_snapshot_data(definition);
      -- Theme and layout belong to publication, not current tenant settings.
      dataset := dataset || (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
        from jsonb_each(frozen.snapshot_data_json)
        where key in ('themePresentation','editorial','presentation','_veyocastThemeRuntime','_veyocastThemeColorOverrides','theme','layout'));
      if frozen.snapshot_data_json ? 'brand' then
        dataset:=jsonb_set(dataset,'{brand}',coalesce(dataset->'brand','{}'::jsonb) ||
          (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(frozen.snapshot_data_json->'brand')
            where key in ('primaryColor','secondaryColor','backgroundMediaAssetId')));
      end if;
      if jsonb_typeof(dataset) <> 'object' then raise exception 'invalid data' using errcode='23514'; end if;
      hash := private.published_data_hash_v1(dataset);
      update public.published_dynamic_data set
        data_json=case when content_hash<>hash then dataset else data_json end,
        data_revision=data_revision+case when content_hash<>hash then 1 else 0 end,
        changed_at=case when content_hash<>hash then clock_timestamp() else changed_at end,
        content_hash=hash,checked_at=clock_timestamp(),last_error_code=null,
        source_revision=(select revision from public.dynamic_data_sources where tenant_id=p_tenant_id and id=p_source_id)
      where tenant_id=p_tenant_id and snapshot_id=binding.snapshot_id;
      if binding.content_hash<>hash then changed:=changed+1; end if;
    exception when others then
      get stacked diagnostics error_code=returned_sqlstate;
      update public.published_dynamic_data set checked_at=clock_timestamp(),last_error_code=error_code
      where tenant_id=p_tenant_id and snapshot_id=binding.snapshot_id;
    end;
  end loop;
  return changed;
end $$;
revoke all on function private.refresh_published_data_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function private.refresh_published_data_after_source_v1() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.revision is distinct from old.revision then
    perform private.refresh_published_data_v1(new.tenant_id,new.id);
  end if;
  return new;
end $$;
revoke all on function private.refresh_published_data_after_source_v1() from public,anon,authenticated,service_role;
create trigger dynamic_sources_refresh_published_data after update of revision on public.dynamic_data_sources
  for each row execute function private.refresh_published_data_after_source_v1();

-- Do not backfill a concept hash from mutable draft state. Legacy definitions
-- are mapped exactly; their first deliberate publish establishes the new hash.
insert into public.playlist_publications(tenant_id,playlist_id,release_id,config_revision,definition_hash,published_at)
select distinct on (release.playlist_id) release.tenant_id,release.playlist_id,release.id,
  release.version,release.manifest_hash,release.published_at
from public.playlist_releases release
where exists(select 1 from public.playlist_release_items item where item.tenant_id=release.tenant_id and item.release_id=release.id)
order by release.playlist_id,release.version desc;

-- Only the server subscribes; no tenant or device receives table access.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='screens') then
    alter publication supabase_realtime add table public.screens;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='published_dynamic_data') then
    alter publication supabase_realtime add table public.published_dynamic_data;
  end if;
end $$;

-- One MVCC statement resolves credential, assignment, revision and data identity.
create function public.get_player_effective_target_v1(p_token_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'device_id',device.id,'tenant_id',screen.tenant_id,'screen_id',screen.id,
    'screen_name',screen.name,'screen_status',screen.status,'device_status',device.status,
    'active_release_id',device.active_release_id,'desired_release_id',screen.assigned_release_id,
    'target_revision',screen.target_revision::text,'target_changed_at',screen.target_changed_at,
    'assignment_source',screen.active_assignment_source,'publication_id',release.playlist_id,
    'config_revision',release.version::text,
    'data_key',coalesce((select string_agg(data.snapshot_id::text || ':' || data.data_revision::text,',' order by data.snapshot_id)
      from public.playlist_release_items item join public.published_dynamic_data data
        on data.tenant_id=item.tenant_id and data.snapshot_id=item.dynamic_snapshot_id
      where item.tenant_id=screen.tenant_id and item.release_id=screen.assigned_release_id and item.live_data_enabled),''),
    'sponsor_key',coalesce((select target.plan_revision_id::text from public.sponsor_plan_targets target
      where target.tenant_id=screen.tenant_id and target.screen_id=screen.id order by target.created_at desc limit 1),''))
  from public.player_devices device join public.screens screen
    on screen.tenant_id=device.tenant_id and screen.id=device.screen_id
  left join public.playlist_releases release on release.tenant_id=screen.tenant_id and release.id=screen.assigned_release_id
  where device.token_hash=lower(nullif(btrim(p_token_hash),'')) and device.status='paired'
    and screen.status='active' and screen.deleted_at is null
$$;
revoke all on function public.get_player_effective_target_v1(text) from public,anon,authenticated,service_role;
grant execute on function public.get_player_effective_target_v1(text) to service_role;

create function private.playlist_configuration_hash_v1(p_playlist_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'defaults',jsonb_build_object('imageDuration',playlist.default_image_duration_seconds,
      'transition',playlist.default_transition,'fit',playlist.default_fit_mode,
      'background',playlist.default_background_color,'muted',playlist.default_video_muted,'loop',playlist.loop_enabled),
    'items',coalesce((select jsonb_agg(
      (to_jsonb(item)-array['created_at','updated_at','created_by','tenant_id','playlist_id','sort_order'])
        - case when item.dynamic_slide_id is null then array[]::text[] else array['media_asset_id','dynamic_snapshot_id'] end
        || jsonb_build_object('section',case when section.id is not null then
          jsonb_build_object('id',section.id,'name',section.name,'position',section.position_key,'enabled',section.enabled) end,
          'dynamicVersion',snapshot.dynamic_slide_version_id,
          'publishedTheme',snapshot.snapshot_data_json->'themePresentation',
          'publishedEditorial',snapshot.snapshot_data_json->'editorial')
      order by case when section.id is null then 0 else 1 end,section.position_key,item.position_key,item.id)
      from public.playlist_items item left join public.playlist_sections section
        on section.tenant_id=item.tenant_id and section.playlist_id=item.playlist_id and section.id=item.section_id
      left join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
      where item.tenant_id=playlist.tenant_id and item.playlist_id=playlist.id and item.enabled and coalesce(section.enabled,true)), '[]'::jsonb)
    )::text,'UTF8'),'sha256'),'hex')
  from public.playlists playlist where playlist.id=p_playlist_id
$$;
revoke all on function private.playlist_configuration_hash_v1(uuid) from public,anon,authenticated,service_role;

-- Retain the validated immutable materializer behind the private boundary.
alter function public.publish_playlist(uuid,text) rename to materialize_playlist_configuration_s185;
alter function public.materialize_playlist_configuration_s185(uuid,text) set schema private;
revoke all on function private.materialize_playlist_configuration_s185(uuid,text) from public,anon,authenticated,service_role;
create function public.publish_playlist(p_playlist_id uuid,p_release_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare playlist public.playlists%rowtype; hash text; current_publication public.playlist_publications%rowtype; result uuid;
begin
  select * into strict playlist from public.playlists where id=p_playlist_id for update;
  if private.current_user_id() is null or not private.can_publish_playlist(playlist.tenant_id) then
    raise exception 'actor cannot publish this playlist' using errcode='42501';
  end if;
  perform private.require_active_tenant_command(playlist.tenant_id);
  if playlist.status='archived' then raise exception 'playlist archived' using errcode='23514'; end if;
  hash:=private.playlist_configuration_hash_v1(playlist.id);
  select * into current_publication from public.playlist_publications where playlist_id=playlist.id;
  if current_publication.definition_hash=hash then return current_publication.release_id; end if;
  result:=private.materialize_playlist_configuration_s185(playlist.id,p_release_notes);
  insert into public.playlist_publications(tenant_id,playlist_id,release_id,config_revision,definition_hash,published_at)
    select tenant_id,playlist_id,id,version,hash,published_at from public.playlist_releases where id=result
  on conflict (playlist_id) do update set release_id=excluded.release_id,config_revision=excluded.config_revision,
    definition_hash=excluded.definition_hash,published_at=excluded.published_at;
  return result;
end $$;
revoke all on function public.publish_playlist(uuid,text) from public,anon,authenticated,service_role;
-- v3 remains the only human publish command; the materializer is not a public bypass.

notify pgrst,'reload schema';

create or replace function public.publish_playlist_to_targets_v3(
  p_playlist_id uuid,
  p_expected_revision bigint,
  p_screen_ids uuid[],
  p_release_notes text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
  request_json jsonb;
  replay jsonb;
  publish_outcome text;
  publish_revision bigint;
  new_release_id uuid;
  authoring_snapshot jsonb;
  authoring_hash text;
  target_snapshot_id uuid;
  outcome jsonb;
begin
  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id
  for update;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if private.current_user_id() is null
    or not private.can_publish_playlist(playlist_record.tenant_id)
  then
    raise exception 'actor cannot publish this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  if p_expected_revision is null or p_expected_revision < 0
    or coalesce(array_length(p_screen_ids, 1), 0) = 0
  then
    raise exception 'publish targets are invalid' using errcode = '22023';
  end if;

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'expectedRevision', p_expected_revision,
    'screenIds', to_jsonb(p_screen_ids),
    'releaseNotes', p_release_notes
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.publish.v3',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  if playlist_record.revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'actualRevision', playlist_record.revision
    );
    return private.complete_publisher_command(
      playlist_record.tenant_id,
      'playlist.publish.v3',
      p_idempotency_key,
      request_json,
      'playlists',
      playlist_record.id,
      outcome,
      'publisher.playlist.publish_conflict',
      'failed'
    );
  end if;

  authoring_snapshot := private.build_playlist_authoring_snapshot(playlist_record.id);
  authoring_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(authoring_snapshot::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select result.outcome, result.actual_revision, result.release_id
  into publish_outcome, publish_revision, new_release_id
  from public.publish_playlist_to_screens_v2(
    p_playlist_id,
    p_expected_revision,
    p_screen_ids,
    p_release_notes
  ) result;

  if publish_outcome <> 'published' or new_release_id is null then
    raise exception 'playlist publication did not create a release'
      using errcode = 'P0001';
  end if;

  insert into public.playlist_release_authoring_snapshots (
    tenant_id,
    playlist_id,
    release_id,
    snapshot_json,
    snapshot_hash
  )
  values (
    playlist_record.tenant_id,
    playlist_record.id,
    new_release_id,
    authoring_snapshot,
    authoring_hash
  ) on conflict (tenant_id,release_id) do nothing;

  target_snapshot_id := private.create_publisher_target_snapshot(
    playlist_record.tenant_id,
    new_release_id,
    null,
    'direct',
    null,
    p_screen_ids,
    private.current_user_id()
  );

  update public.screens
  set active_target_snapshot_id = case when active_schedule_id is null then target_snapshot_id else active_target_snapshot_id end,
      default_playlist_id = playlist_record.id,
      default_release_id = new_release_id
  where tenant_id = playlist_record.tenant_id
    and id = any(p_screen_ids);

  outcome := jsonb_build_object(
    'outcome', 'published',
    'actualRevision', publish_revision,
    'releaseId', new_release_id,
    'targetSnapshotId', target_snapshot_id
  );
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.publish.v3',
    p_idempotency_key,
    request_json,
    'playlist_releases',
    new_release_id,
    outcome,
    'publisher.playlist.published'
  );
end;
$$;


create or replace function public.publish_playlist_to_screens(
  p_playlist_id uuid,
  p_screen_ids uuid[],
  p_release_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  playlist_record public.playlists%rowtype;
  release_id uuid;
  target_count integer;
begin
  select playlist.*
  into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;

  if private.current_user_id() is null or not private.can_publish_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot publish' using errcode='42501';
  end if;

  if coalesce(array_length(p_screen_ids, 1), 0) = 0 then
    raise exception 'at least one target screen is required' using errcode = '23514';
  end if;

  select count(*)::integer
  into target_count
  from public.screens screen
  where screen.tenant_id = playlist_record.tenant_id
    and screen.id = any(p_screen_ids)
    and screen.status <> 'disabled'::public.screen_status;

  if target_count <> array_length(p_screen_ids, 1) then
    raise exception 'one or more target screens are unavailable' using errcode = '23514';
  end if;

  release_id := public.publish_playlist(p_playlist_id, p_release_notes);

  update public.screens
  set
    default_playlist_id = p_playlist_id,
    default_release_id = release_id,
    assigned_playlist_id = case when active_schedule_id is null then p_playlist_id else assigned_playlist_id end,
    assigned_release_id = case when active_schedule_id is null then release_id else assigned_release_id end
  where tenant_id = playlist_record.tenant_id
    and id = any(p_screen_ids);

  update public.player_devices
  set desired_release_id = (select screen.assigned_release_id from public.screens screen
    where screen.tenant_id=playlist_record.tenant_id and screen.id=player_devices.screen_id)
  where tenant_id = playlist_record.tenant_id
    and screen_id = any(p_screen_ids)
    and status = 'paired'::public.player_device_status;

  perform private.audit_event(
    playlist_record.tenant_id,
    'playlist.release.assigned',
    'playlist_releases',
    release_id,
    'success',
    jsonb_build_object(
      'playlistId', p_playlist_id,
      'screenIds', p_screen_ids
    )
  );

  return release_id;
end;
$$;


-- Cut over the data side effect, including old worker calls still in flight.
-- Background render jobs remain available for explicit designs and fallbacks.
drop trigger if exists dynamic_slide_auto_publishes_latest on public.dynamic_slides;
create or replace function private.publish_queued_dynamic_release_v1(p_tenant_id uuid,p_playlist_id uuid)
returns integer language sql security definer set search_path = '' as $$ select 0 $$;
create or replace function private.process_dynamic_release_refresh_v1(p_tenant_id uuid,p_playlist_id uuid,p_worker_id text)
returns integer language sql security definer set search_path = '' as $$ select 0 $$;
create or replace function private.process_due_dynamic_release_refresh_v1(p_worker_id text)
returns integer language sql security definer set search_path = '' as $$ select 0 $$;
revoke all on function private.publish_queued_dynamic_release_v1(uuid,uuid),
  private.process_dynamic_release_refresh_v1(uuid,uuid,text),
  private.process_due_dynamic_release_refresh_v1(text) from public,anon,authenticated,service_role;
update private.dynamic_release_refresh_queue set pending=false,not_before=null,
  first_requested_at=null,last_requested_at=null,updated_at=clock_timestamp()
where pending;

-- Metadata-only checks must not generate a data invalidation.
alter table public.published_dynamic_data replica identity full;

-- Every explicit configuration producer advances the same current pointer.
-- Historical screen pins remain on their exact immutable release.
create function private.track_current_publication_v1() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.playlist_publications(tenant_id,playlist_id,release_id,config_revision,definition_hash,published_at)
  values(new.tenant_id,new.playlist_id,new.id,new.version,new.manifest_hash,new.published_at)
  on conflict(playlist_id) do update set release_id=excluded.release_id,config_revision=excluded.config_revision,
    definition_hash=excluded.definition_hash,published_at=excluded.published_at
  where public.playlist_publications.config_revision<excluded.config_revision;
  return new;
end $$;
revoke all on function private.track_current_publication_v1() from public,anon,authenticated,service_role;
create trigger releases_track_current_publication after insert on public.playlist_releases
  for each row execute function private.track_current_publication_v1();

create or replace function public.apply_due_content_schedules_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  applied_count integer := 0;
  assignment_kind text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'schedule application requires service role' using errcode = '42501';
  end if;
  if p_now is null then
    raise exception 'schedule evaluation time is required' using errcode = '22023';
  end if;

  for target in
    select
      screen.id as screen_id,
      screen.target_revision,
      screen.schedule_evaluated_at,
      screen.tenant_id,
      screen.default_playlist_id,
      screen.default_release_id,
      screen.assigned_playlist_id,
      screen.assigned_release_id,
      screen.active_assignment_source,
      screen.active_schedule_id,
      screen.active_target_snapshot_id,
      null::uuid as schedule_id,
      null::uuid as schedule_playlist_id,
      null::uuid as schedule_release_id,
      null::text as schedule_source,
      null::uuid as target_snapshot_id
    from public.screens screen
    where screen.status <> 'disabled'::public.screen_status
      and exists (
        select 1 from public.tenants tenant
        where tenant.id = screen.tenant_id
          and tenant.status in (
            'active'::public.tenant_status,
            'paused'::public.tenant_status
          )
      )
    order by screen.id
    for update of screen
  loop
    if target.schedule_evaluated_at is not null and target.schedule_evaluated_at > p_now then continue; end if;
    -- Resolve AFTER acquiring the screen lock: a stale lateral query evaluated
    -- before a concurrent Publisher commit must never supply the winner.
    select schedule.id,schedule.playlist_id,schedule.release_id,schedule.source,schedule.target_snapshot_id
    into target.schedule_id,target.schedule_playlist_id,target.schedule_release_id,target.schedule_source,target.target_snapshot_id
    from public.content_schedules schedule
    join public.publisher_target_snapshot_screens snapshot_screen on snapshot_screen.tenant_id=schedule.tenant_id
      and snapshot_screen.snapshot_id=schedule.target_snapshot_id and snapshot_screen.screen_id=target.screen_id
    where schedule.tenant_id=target.tenant_id and private.content_schedule_is_due(schedule,p_now)
    order by case schedule.source when 'override' then 3 when 'publisher' then 2 else 1 end desc,
      case schedule.target_kind when 'screen' then 2 else 1 end desc,schedule.priority desc,schedule.starts_at desc,schedule.id
    limit 1;
    update public.screens set schedule_evaluated_at=p_now where tenant_id=target.tenant_id and id=target.screen_id
      and schedule_evaluated_at is distinct from p_now;
    if target.schedule_id is not null then
      assignment_kind := 'scheduled';
      if target.assigned_release_id is not distinct from target.schedule_release_id
        and target.active_schedule_id is not distinct from target.schedule_id
        and target.active_target_snapshot_id is not distinct from target.target_snapshot_id
      then
        continue;
      end if;

      update public.screens
      set assigned_playlist_id = target.schedule_playlist_id,
          assigned_release_id = target.schedule_release_id,
          active_assignment_source = case
            when target.schedule_source = 'override' then 'override'
            else 'schedule'
          end,
          active_schedule_id = target.schedule_id,
          active_target_snapshot_id = target.target_snapshot_id
      where tenant_id = target.tenant_id
        and id = target.screen_id;
    else
      assignment_kind := 'fallback';
      if target.assigned_release_id is not distinct from target.default_release_id
        and target.active_assignment_source = 'default'
        and target.active_schedule_id is null
      then
        continue;
      end if;

      update public.screens
      set assigned_playlist_id = target.default_playlist_id,
          assigned_release_id = target.default_release_id,
          active_assignment_source = 'default',
          active_schedule_id = null,
          active_target_snapshot_id = null
      where tenant_id = target.tenant_id
        and id = target.screen_id;
    end if;

    update public.player_devices
    set desired_release_id = coalesce(
          target.schedule_release_id,
          target.default_release_id
        )
    where tenant_id = target.tenant_id
      and screen_id = target.screen_id
      and status = 'paired'::public.player_device_status;

    if coalesce(target.schedule_release_id, target.default_release_id) is not null then
      insert into public.release_screen_assignments (
        tenant_id,
        release_id,
        screen_id,
        assignment_kind,
        assigned_by,
        target_snapshot_id
      )
      values (
        target.tenant_id,
        coalesce(target.schedule_release_id, target.default_release_id),
        target.screen_id,
        assignment_kind,
        null,
        target.target_snapshot_id
      );
    end if;

    insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
    values(target.tenant_id,case when target.schedule_id is null then 'publisher.schedule.fallback_applied'
      else 'publisher.schedule.applied' end,'screens',target.screen_id,'success',
      jsonb_build_object('systemExecuted',true,'executor','content_scheduler',
        'scheduleId',target.schedule_id,'releaseId',coalesce(target.schedule_release_id,target.default_release_id),
        'evaluatedAt',p_now));
    applied_count := applied_count + 1;
  end loop;

  return applied_count;
end;
$$;


-- Compact current status, written at the existing authenticated device boundary.
alter table public.player_devices add column current_sync_phase text,
  add column current_sync_detail jsonb not null default '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.record_player_heartbeat_v2(p_token_hash text, p_runtime_state text, p_active_release_id uuid DEFAULT NULL::uuid, p_desired_release_id uuid DEFAULT NULL::uuid, p_storage_used_bytes bigint DEFAULT NULL::bigint, p_storage_quota_bytes bigint DEFAULT NULL::bigint, p_app_version text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_capabilities jsonb DEFAULT '{}'::jsonb, p_sync_phase text DEFAULT NULL::text, p_sync_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  heartbeat_id uuid;
  heartbeat_record public.player_heartbeats%rowtype;
  device_record public.player_devices%rowtype;
  sync_release_id uuid;
  reported_error_code text;
begin
  if p_capabilities is null or jsonb_typeof(p_capabilities) <> 'object'
    or p_sync_detail is null or jsonb_typeof(p_sync_detail) <> 'object'
  then
    raise exception 'heartbeat capabilities and detail must be objects' using errcode = '23514';
  end if;
  reported_error_code := nullif(btrim(p_sync_detail #>> '{lastPlaybackError,code}'), '');
  if reported_error_code is not null and reported_error_code !~ '^[A-Za-z0-9_-]{1,100}$' then
    reported_error_code := 'PLAYER_ERROR_REDACTED';
  end if;

  heartbeat_id := public.record_player_heartbeat(
    p_token_hash, p_runtime_state, p_active_release_id,
    p_storage_used_bytes, p_storage_quota_bytes, p_app_version, null, p_sync_detail
  );
  select heartbeat.* into heartbeat_record
  from public.player_heartbeats heartbeat where heartbeat.id = heartbeat_id;
  select device.* into device_record
  from public.player_devices device
  where device.tenant_id = heartbeat_record.tenant_id
    and device.id = heartbeat_record.device_id
  for update;

  if p_desired_release_id is not null
    and p_desired_release_id is distinct from device_record.desired_release_id
    and p_desired_release_id is distinct from p_active_release_id
  then
    raise exception 'reported desired release does not match device assignment' using errcode = '23514';
  end if;

  update public.player_devices
  set current_sync_phase = p_sync_phase,
      current_sync_detail = p_sync_detail,
      capabilities = p_capabilities,
      platform = coalesce(nullif(btrim(p_platform), ''), platform),
      last_error_code = reported_error_code,
      last_error_at = case when reported_error_code is null then null else now() end,
      sync_retry_requested_at = null
  where id = device_record.id;

  if p_sync_phase is not null then
    sync_release_id := case when p_sync_phase = 'active' then p_active_release_id
      else coalesce(p_desired_release_id, p_active_release_id) end;
    insert into public.player_sync_events (
      tenant_id, device_id, screen_id, release_id, phase, detail
    ) values (
      heartbeat_record.tenant_id, heartbeat_record.device_id,
      heartbeat_record.screen_id, sync_release_id, p_sync_phase,
      coalesce(p_sync_detail, '{}'::jsonb)
    );
  end if;
  return heartbeat_id;
end;
$function$;


-- One row per current publication. History is accessed through an explicit detail.
create function public.list_current_publications_v1(p_tenant_id uuid)
returns table(id uuid,playlist_id uuid,playlist_name text,version integer,
  published_at timestamptz,published_by text,release_notes text,manifest_hash text,
  item_count integer,total_duration_seconds integer,total_bytes bigint,current_screen_count bigint)
language sql stable security invoker set search_path='' as $$
  select release.id,release.playlist_id,playlist.name,release.version,release.published_at,
    coalesce(profile.display_name,case when release.published_by is null then 'Systeem' else 'Onbekende gebruiker' end),
    release.release_notes,release.manifest_hash,release.item_count,release.total_duration_seconds,release.total_bytes,
    (select count(*) from public.screens screen where screen.tenant_id=p_tenant_id
      and screen.assigned_release_id=release.id and screen.deleted_at is null)
  from public.playlist_publications current_publication
  join public.playlist_releases release on release.tenant_id=current_publication.tenant_id and release.id=current_publication.release_id
  join public.playlists playlist on playlist.tenant_id=release.tenant_id and playlist.id=release.playlist_id
  left join public.profiles profile on profile.id=release.published_by
  where current_publication.tenant_id=p_tenant_id and playlist.status<>'archived'
$$;
revoke all on function public.list_current_publications_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_current_publications_v1(uuid) to authenticated;

-- Explicit theme publication reuses the immutable materializer under a current-target fence.
create or replace function private.clone_theme_release_branch_v1(
  p_tenant_id uuid,
  p_rollout_id uuid,
  p_source_release_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_default_screen_ids uuid[];
  manifest_document jsonb;
  manifest_hash text;
  manifest_items jsonb;
  new_release_id uuid;
  next_version integer;
  new_target_snapshot_id uuid;
  release_published_at timestamptz := clock_timestamp();
  replaced_item_count integer;
  resolved_snapshot_by_sort_order jsonb;
  schedule_record public.content_schedules%rowtype;
  source_release public.playlist_releases%rowtype;
  switched_schedule_screen_ids uuid[];
  total_bytes bigint;
begin
  select * into source_release
  from public.playlist_releases release
  where release.tenant_id = p_tenant_id
    and release.id = p_source_release_id;
  if not found then
    raise exception 'theme source release is unavailable' using errcode = 'P0002';
  end if;

  -- Match manual Publisher ordering before deriving the next immutable version.
  perform 1
  from public.playlists playlist
  where playlist.tenant_id = source_release.tenant_id
    and playlist.id = source_release.playlist_id
    and playlist.status <> 'archived'
  for update;
  if not found then
    return null;
  end if;

  -- A deferred theme render is a configuration change, never permission to
  -- resurrect an obsolete publication or expand an explicitly historic pin.
  if not exists (select 1 from public.playlist_publications current_publication
    where current_publication.tenant_id=p_tenant_id
      and current_publication.playlist_id=source_release.playlist_id
      and current_publication.release_id=source_release.id)
    or not exists (select 1 from public.tenant_theme_rollouts rollout
      join public.tenant_theme_profiles profile on profile.tenant_id=rollout.tenant_id
        and profile.theme_id=rollout.theme_id and profile.revision=rollout.settings_revision
      where rollout.tenant_id=p_tenant_id and rollout.id=p_rollout_id
        and rollout.status in ('queued','rendering')) then
    return null;
  end if;

  perform 1
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and (
      screen.assigned_release_id = p_source_release_id
      or screen.default_release_id = p_source_release_id
    )
  order by screen.id
  for update;
  perform 1
  from public.player_devices device
  join public.screens screen
    on screen.tenant_id = device.tenant_id
   and screen.id = device.screen_id
  where screen.tenant_id = p_tenant_id
    and screen.status <> 'disabled'
    and screen.deleted_at is null
    and screen.assigned_release_id = p_source_release_id
    and device.status = 'paired'
  order by device.id
  for update of device;
  perform 1
  from public.screen_groups screen_group
  where screen_group.tenant_id = p_tenant_id
    and screen_group.status = 'active'
    and screen_group.default_release_id = p_source_release_id
  order by screen_group.id
  for update;
  perform 1
  from public.content_schedules schedule
  where schedule.tenant_id = p_tenant_id
    and schedule.release_id = p_source_release_id
    and (
      (
        schedule.enabled
        and (
          schedule.ends_at is null
          or schedule.ends_at >= statement_timestamp()
        )
      )
      or exists (
        select 1
        from public.screens active_screen
        where active_screen.tenant_id = schedule.tenant_id
          and active_screen.active_schedule_id = schedule.id
          and active_screen.status <> 'disabled'
          and active_screen.deleted_at is null
      )
    )
  order by schedule.id
  for update;

  if not exists (
    select 1
    from private.theme_rollout_active_release_ids_v1(p_tenant_id) active_release
    where active_release.release_id = p_source_release_id
  ) then
    return null;
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(
      release_item.sort_order::text,
      pg_catalog.to_jsonb(mapping.new_snapshot_id)
    ),
    '{}'::jsonb
  )
  into resolved_snapshot_by_sort_order
  from public.playlist_release_items release_item
  join private.tenant_theme_rollout_snapshots mapping
    on mapping.tenant_id = release_item.tenant_id
   and mapping.rollout_id = p_rollout_id
   and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id;

  select count(*)::integer
  into replaced_item_count
  from public.playlist_release_items release_item
  where release_item.tenant_id = p_tenant_id
    and release_item.release_id = p_source_release_id
    and resolved_snapshot_by_sort_order ? release_item.sort_order::text;
  -- Normal theme changes still skip an unchanged branch. Only an explicitly
  -- audited owner recovery may clone an asset-only release. A missing mapping
  -- on a dynamic release remains an error/no-op, never an incomplete publish.
  if replaced_item_count = 0 and not (
    not exists (select 1 from public.playlist_release_items item
      where item.tenant_id = p_tenant_id and item.release_id = p_source_release_id
        and item.dynamic_snapshot_id is not null)
    and exists (select 1 from private.tenant_theme_rollout_release_branches branch
      join public.audit_events audit on audit.tenant_id = branch.tenant_id
        and audit.target_id = branch.rollout_id
        and audit.action = 'tenant.content.recovery_queued'
      where branch.tenant_id = p_tenant_id and branch.rollout_id = p_rollout_id
        and branch.source_release_id = p_source_release_id)
  ) then
    return null;
  end if;

  if exists (
    select 1
    from public.playlist_release_items release_item
    join private.tenant_theme_rollout_snapshots mapping
      on mapping.tenant_id = release_item.tenant_id
     and mapping.rollout_id = p_rollout_id
     and mapping.old_snapshot_id = release_item.dynamic_snapshot_id
    left join public.dynamic_slide_snapshots replacement_snapshot
      on replacement_snapshot.tenant_id = mapping.tenant_id
     and replacement_snapshot.id = mapping.new_snapshot_id
     and replacement_snapshot.status = 'ready'
     and replacement_snapshot.output_media_asset_id is not null
    left join public.media_assets replacement_asset
      on replacement_asset.tenant_id = replacement_snapshot.tenant_id
     and replacement_asset.id = replacement_snapshot.output_media_asset_id
     and replacement_asset.status = 'ready'
     and replacement_asset.deleted_at is null
    left join public.media_variants replacement_variant
      on replacement_variant.tenant_id = replacement_asset.tenant_id
     and replacement_variant.asset_id = replacement_asset.id
     and replacement_variant.variant_type = 'original'
    where release_item.tenant_id = p_tenant_id
      and release_item.release_id = p_source_release_id
      and (
        replacement_snapshot.id is null
        or replacement_asset.id is null
        or replacement_variant.id is null
      )
  ) then
    raise exception 'theme release replacement render is incomplete'
      using errcode = '55000';
  end if;

  select
    pg_catalog.jsonb_agg(
      case
        when replacement_snapshot.id is not null
        then manifest_item.value || pg_catalog.jsonb_build_object(
          'mediaAssetId', replacement_asset.id,
          'mediaVariantId', replacement_variant.id,
          'kind', replacement_asset.kind,
          'title', replacement_asset.title,
          'storage', pg_catalog.jsonb_build_object(
            'bucket', replacement_variant.storage_bucket,
            'path', replacement_variant.storage_path,
            'mimeType', replacement_variant.mime_type,
            'bytes', replacement_variant.file_size_bytes,
            'checksumSha256', replacement_variant.checksum_sha256
          ),
          'metadata', coalesce(
            manifest_item.value -> 'metadata', '{}'::jsonb
          ) || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
            'width', replacement_variant.width,
            'height', replacement_variant.height,
            'durationSeconds', replacement_variant.duration_seconds
          ))
        )
        else manifest_item.value
      end
      order by manifest_item.ordinality
    ),
    sum(
      case when replacement_snapshot.id is not null
        then replacement_variant.file_size_bytes
        else release_item.file_size_bytes
      end
    )::bigint
  into manifest_items, total_bytes
  from pg_catalog.jsonb_array_elements(source_release.manifest_json -> 'items')
    with ordinality as manifest_item(value, ordinality)
  join public.playlist_release_items release_item
    on release_item.tenant_id = source_release.tenant_id
   and release_item.release_id = source_release.id
   and release_item.sort_order = manifest_item.ordinality - 1
  left join public.dynamic_slide_snapshots replacement_snapshot
    on replacement_snapshot.tenant_id = release_item.tenant_id
   and replacement_snapshot.id = (
     resolved_snapshot_by_sort_order ->> release_item.sort_order::text
   )::uuid
   and replacement_snapshot.status = 'ready'
  left join public.media_assets replacement_asset
    on replacement_asset.tenant_id = replacement_snapshot.tenant_id
   and replacement_asset.id = replacement_snapshot.output_media_asset_id
   and replacement_asset.status = 'ready'
   and replacement_asset.deleted_at is null
  left join public.media_variants replacement_variant
    on replacement_variant.tenant_id = replacement_asset.tenant_id
   and replacement_variant.asset_id = replacement_asset.id
   and replacement_variant.variant_type = 'original';
  if manifest_items is null or total_bytes is null then
    raise exception 'theme release manifest could not be materialized'
      using errcode = '55000';
  end if;

  select coalesce(max(release.version), 0) + 1
  into next_version
  from public.playlist_releases release
  where release.tenant_id = source_release.tenant_id
    and release.playlist_id = source_release.playlist_id;
  manifest_document := source_release.manifest_json || pg_catalog.jsonb_build_object(
    'version', next_version,
    'publishedAt', release_published_at,
    'totalBytes', total_bytes,
    'items', manifest_items
  );
  manifest_hash := encode(
    extensions.digest(
      pg_catalog.convert_to(manifest_document::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.playlist_releases(
    tenant_id, playlist_id, version, release_notes, manifest_hash,
    manifest_json, item_count, total_duration_seconds, total_bytes,
    published_by, published_at
  ) values (
    source_release.tenant_id,
    source_release.playlist_id,
    next_version,
    'Geforceerde FieldFlow-thema-uitrol',
    manifest_hash,
    manifest_document,
    source_release.item_count,
    source_release.total_duration_seconds,
    total_bytes,
    null,
    release_published_at
  ) returning id into new_release_id;

  insert into public.playlist_release_items(
    tenant_id, playlist_id, release_id, source_item_id,
    media_asset_id, media_variant_id, sort_order, duration_seconds,
    fit_mode, muted, asset_kind, asset_title, storage_bucket, storage_path,
    mime_type, file_size_bytes, checksum_sha256, width, height,
    asset_duration_seconds, dynamic_snapshot_id,
    youtube_source_id, youtube_video_id, youtube_title, youtube_online_only,
    engage_campaign_id, engage_public_id, engage_title, engage_question,
    display_title, transition,
    crop_focus_x, crop_focus_y, background_color, volume_percent,
    trim_start_seconds, trim_end_seconds, visible_from, visible_until,
    enabled, accessibility_name, section_source_id, section_name,
    section_position_key
  )
  select
    release_item.tenant_id,
    release_item.playlist_id,
    new_release_id,
    null,
    coalesce(replacement_asset.id, release_item.media_asset_id),
    coalesce(replacement_variant.id, release_item.media_variant_id),
    release_item.sort_order,
    release_item.duration_seconds,
    release_item.fit_mode,
    release_item.muted,
    coalesce(replacement_asset.kind, release_item.asset_kind),
    coalesce(replacement_asset.title, release_item.asset_title),
    coalesce(replacement_variant.storage_bucket, release_item.storage_bucket),
    coalesce(replacement_variant.storage_path, release_item.storage_path),
    coalesce(replacement_variant.mime_type, release_item.mime_type),
    coalesce(replacement_variant.file_size_bytes, release_item.file_size_bytes),
    coalesce(replacement_variant.checksum_sha256, release_item.checksum_sha256),
    coalesce(replacement_variant.width, release_item.width),
    coalesce(replacement_variant.height, release_item.height),
    coalesce(
      replacement_variant.duration_seconds,
      release_item.asset_duration_seconds
    ),
    coalesce(replacement_snapshot.id, release_item.dynamic_snapshot_id),
    release_item.youtube_source_id,
    release_item.youtube_video_id,
    release_item.youtube_title,
    release_item.youtube_online_only,
    release_item.engage_campaign_id,
    release_item.engage_public_id,
    release_item.engage_title,
    release_item.engage_question,
    release_item.display_title,
    release_item.transition,
    release_item.crop_focus_x,
    release_item.crop_focus_y,
    release_item.background_color,
    release_item.volume_percent,
    release_item.trim_start_seconds,
    release_item.trim_end_seconds,
    release_item.visible_from,
    release_item.visible_until,
    release_item.enabled,
    release_item.accessibility_name,
    release_item.section_source_id,
    release_item.section_name,
    release_item.section_position_key
  from public.playlist_release_items release_item
  left join public.dynamic_slide_snapshots replacement_snapshot
    on replacement_snapshot.tenant_id = release_item.tenant_id
   and replacement_snapshot.id = (
     resolved_snapshot_by_sort_order ->> release_item.sort_order::text
   )::uuid
   and replacement_snapshot.status = 'ready'
  left join public.media_assets replacement_asset
    on replacement_asset.tenant_id = replacement_snapshot.tenant_id
   and replacement_asset.id = replacement_snapshot.output_media_asset_id
   and replacement_asset.status = 'ready'
   and replacement_asset.deleted_at is null
  left join public.media_variants replacement_variant
    on replacement_variant.tenant_id = replacement_asset.tenant_id
   and replacement_variant.asset_id = replacement_asset.id
   and replacement_variant.variant_type = 'original'
  where release_item.tenant_id = source_release.tenant_id
    and release_item.release_id = source_release.id
  order by release_item.sort_order;

  insert into public.playlist_release_authoring_snapshots(
    tenant_id, playlist_id, release_id, snapshot_json, snapshot_hash
  )
  select
    snapshot.tenant_id,
    snapshot.playlist_id,
    new_release_id,
    snapshot.snapshot_json,
    snapshot.snapshot_hash
  from public.playlist_release_authoring_snapshots snapshot
  where snapshot.tenant_id = source_release.tenant_id
    and snapshot.release_id = source_release.id
  on conflict do nothing;

  -- Defaults are independent from a currently active schedule assignment.
  update public.screens screen
  set default_release_id = new_release_id
  where screen.tenant_id = p_tenant_id
    and screen.default_playlist_id = source_release.playlist_id
    and screen.default_release_id = source_release.id
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  update public.screen_groups screen_group
  set default_release_id = new_release_id,
      revision = screen_group.revision + 1,
      updated_at = now()
  where screen_group.tenant_id = p_tenant_id
    and screen_group.default_playlist_id = source_release.playlist_id
    and screen_group.default_release_id = source_release.id
    and screen_group.status = 'active';

  -- A schedule keeps its exact immutable target set and provenance. Only its
  -- immutable release pointer and target snapshot are superseded.
  for schedule_record in
    select schedule.*
    from public.content_schedules schedule
    where schedule.tenant_id = p_tenant_id
      and schedule.release_id = source_release.id
      and (
        (
          schedule.enabled
          and (
            schedule.ends_at is null
            or schedule.ends_at >= statement_timestamp()
          )
        )
        or exists (
          select 1
          from public.screens active_screen
          where active_screen.tenant_id = schedule.tenant_id
            and active_screen.active_schedule_id = schedule.id
            and active_screen.status <> 'disabled'
            and active_screen.deleted_at is null
        )
      )
    order by schedule.id
    for update
  loop
    if schedule_record.target_snapshot_id is null then
      raise exception 'active schedule target snapshot is unavailable'
        using errcode = '55000';
    end if;
    new_target_snapshot_id := private.clone_theme_target_snapshot_v1(
      p_tenant_id,
      schedule_record.target_snapshot_id,
      new_release_id
    );
    update public.content_schedules schedule
    set playlist_id = source_release.playlist_id,
        release_id = new_release_id,
        target_snapshot_id = new_target_snapshot_id,
        revision = schedule.revision + 1,
        updated_at = now()
    where schedule.tenant_id = p_tenant_id
      and schedule.id = schedule_record.id
      and schedule.release_id = source_release.id
      and schedule.target_snapshot_id = schedule_record.target_snapshot_id;

    select pg_catalog.array_agg(screen.id order by screen.id)
    into switched_schedule_screen_ids
    from public.screens screen
    where screen.tenant_id = p_tenant_id
      and screen.active_schedule_id = schedule_record.id
      and screen.assigned_release_id = source_release.id
      and screen.status <> 'disabled'
      and screen.deleted_at is null;
    if coalesce(pg_catalog.array_length(switched_schedule_screen_ids, 1), 0) > 0
    then
      update public.screens screen
      set assigned_playlist_id = source_release.playlist_id,
          assigned_release_id = new_release_id,
          active_target_snapshot_id = new_target_snapshot_id
      where screen.tenant_id = p_tenant_id
        and screen.id = any(switched_schedule_screen_ids)
        and screen.active_schedule_id = schedule_record.id
        and screen.assigned_release_id = source_release.id;
      update public.player_devices device
      set desired_release_id = new_release_id
      where device.tenant_id = p_tenant_id
        and device.screen_id = any(switched_schedule_screen_ids)
        and device.status = 'paired'
        and device.desired_release_id = source_release.id;
      insert into public.release_screen_assignments(
        tenant_id, release_id, screen_id, assignment_kind,
        assigned_by, target_snapshot_id
      )
      select
        p_tenant_id,
        new_release_id,
        screen_id,
        'scheduled',
        null,
        new_target_snapshot_id
      from unnest(switched_schedule_screen_ids) screen_id;
    end if;
  end loop;

  select pg_catalog.array_agg(screen.id order by screen.id)
  into active_default_screen_ids
  from public.screens screen
  where screen.tenant_id = p_tenant_id
    and screen.assigned_release_id = source_release.id
    and screen.active_assignment_source = 'default'
    and screen.active_schedule_id is null
    and screen.status <> 'disabled'
    and screen.deleted_at is null;
  if coalesce(pg_catalog.array_length(active_default_screen_ids, 1), 0) > 0 then
    new_target_snapshot_id := private.create_publisher_target_snapshot(
      p_tenant_id,
      new_release_id,
      null,
      'direct',
      null,
      active_default_screen_ids,
      null
    );
    update public.screens screen
    set assigned_playlist_id = source_release.playlist_id,
        assigned_release_id = new_release_id,
        active_target_snapshot_id = new_target_snapshot_id
    where screen.tenant_id = p_tenant_id
      and screen.id = any(active_default_screen_ids)
      and screen.assigned_release_id = source_release.id
      and screen.active_assignment_source = 'default'
      and screen.active_schedule_id is null;
    update public.player_devices device
    set desired_release_id = new_release_id
    where device.tenant_id = p_tenant_id
      and device.screen_id = any(active_default_screen_ids)
      and device.status = 'paired'
      and device.desired_release_id = source_release.id;
    insert into public.release_screen_assignments(
      tenant_id, release_id, screen_id, assignment_kind,
      assigned_by, target_snapshot_id
    )
    select
      p_tenant_id,
      new_release_id,
      screen_id,
      'reassigned',
      null,
      new_target_snapshot_id
    from unnest(active_default_screen_ids) screen_id;
  end if;

  insert into private.tenant_theme_rollout_releases(
    tenant_id, rollout_id, release_id
  ) values (p_tenant_id, p_rollout_id, new_release_id)
  on conflict do nothing;

  insert into public.audit_events(tenant_id, action, target_type, target_id, result, metadata)
  values (
    p_tenant_id,
    'tenant.theme.release_cloned',
    'playlist_releases',
    new_release_id,
    'success',
    pg_catalog.jsonb_build_object(
      'systemExecuted', true,
      'rolloutId', p_rollout_id,
      'sourceReleaseId', source_release.id,
      'playlistId', source_release.playlist_id,
      'version', next_version,
      'replacedItemCount', replaced_item_count,
      'activeReleasePreserved', true
    )
  );
  return new_release_id;
end;
$$;


-- Render workers no longer invoke publication maintenance. The no-op private
-- adapters above protect in-flight old calls; there is no current caller.
CREATE OR REPLACE FUNCTION public.claim_dynamic_render_job_v1(p_worker_id text, p_lock_timeout_seconds integer DEFAULT 120, p_max_attempts integer DEFAULT 3)
 RETURNS TABLE(job_id uuid, tenant_id uuid, snapshot_id uuid, output_media_asset_id uuid, slide_name text, orientation text, markup text, css text, manifest_json jsonb, snapshot_data_json jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  expired_snapshot_ids uuid[];
begin
  -- A worker crash on the last allowed attempt must not leave a permanent
  -- `rendering` job. Preserve any existing
  -- ready snapshot while terminalizing only leases owned by this reaper pass.
  with expired as (
    update public.dynamic_render_jobs job
    set status = 'failed',
        finished_at = clock_timestamp(),
        locked_at = null,
        locked_by = null,
        error_code = 'render_lease_expired',
        error_detail = 'Render worker lease expired after the final attempt.'
    where job.status = 'rendering'
      and job.locked_at < clock_timestamp() - make_interval(
        secs => least(greatest(p_lock_timeout_seconds, 30), 600)
      )
      and job.attempt_count >= least(
        greatest(p_max_attempts, 1),
        job.max_attempts
      )
    returning job.snapshot_id
  )
  select array_agg(expired.snapshot_id order by expired.snapshot_id)
  into expired_snapshot_ids
  from expired;

  update public.dynamic_slide_snapshots snapshot
  set status = 'failed',
      error_code = 'render_lease_expired',
      error_detail = 'Render worker lease expired after the final attempt.'
  where snapshot.id = any(expired_snapshot_ids)
    and snapshot.status = 'rendering';

  update public.dynamic_slides slide
  set status = case
        when slide.current_snapshot_id is null then 'error'
        else 'ready'
      end,
      last_error_code = 'render_lease_expired'
  where exists (
    select 1
    from public.dynamic_slide_snapshots failed_snapshot
    where failed_snapshot.id = any(expired_snapshot_ids)
      and failed_snapshot.tenant_id = slide.tenant_id
      and failed_snapshot.dynamic_slide_id = slide.id
  );

  update public.dynamic_render_jobs job
  set status = 'queued',
      locked_at = null,
      locked_by = null
  where job.status = 'rendering'
    and job.locked_at < now() - make_interval(
      secs => least(greatest(p_lock_timeout_seconds, 30), 600)
    )
    and job.attempt_count < least(
      greatest(p_max_attempts, 1),
      job.max_attempts
    );

  return query
  with candidate as (
    select job.id
    from public.dynamic_render_jobs job
    where job.status = 'queued'
      and job.attempt_count < least(
        greatest(p_max_attempts, 1),
        job.max_attempts
      )
    order by job.created_at
    for update skip locked
    limit 1
  ), claimed as (
    update public.dynamic_render_jobs job
    set status = 'rendering',
        attempt_count = attempt_count + 1,
        locked_at = now(),
        locked_by = left(p_worker_id, 120),
        started_at = coalesce(started_at, now()),
        error_code = null,
        error_detail = null
    from candidate
    where job.id = candidate.id
    returning job.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    snapshot.id,
    claimed.output_media_asset_id,
    slide.name,
    slide.orientation,
    version.markup,
    version.css,
    version.manifest_json,
    snapshot.snapshot_data_json
  from claimed
  join public.dynamic_slide_snapshots snapshot
    on snapshot.id = claimed.snapshot_id
  join public.dynamic_slides slide
    on slide.id = snapshot.dynamic_slide_id
  join public.dynamic_template_versions version
    on version.id = snapshot.template_version_id;

  update public.dynamic_slide_snapshots snapshot
  set status = 'rendering'
  where snapshot.id in (
    select job.snapshot_id
    from public.dynamic_render_jobs job
    where job.status = 'rendering'
      and job.locked_by = left(p_worker_id, 120)
  )
    and snapshot.status = 'queued';
end;
$function$;
