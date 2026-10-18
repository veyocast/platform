-- Explicit Source placement choices share the existing versions, immutable
-- snapshots and fenced render queue. This table contains provenance only.
alter table public.dynamic_slide_versions add column is_source_variant boolean not null default false;
drop index public.dynamic_slide_versions_one_open_draft_idx;
create unique index dynamic_slide_versions_one_open_draft_idx
 on public.dynamic_slide_versions(dynamic_slide_id)
 where status in('draft','publishing') and not is_source_variant;

create table private.sync_dynamic_placement_variants(
 tenant_id uuid not null,
 dynamic_slide_id uuid not null,
 base_snapshot_id uuid,
 version_id uuid not null,
 snapshot_id uuid primary key,
 theme text not null check(theme in('fieldflow','onzetrots-tv')),
 seconds_per_page integer not null check(seconds_per_page between 3 and 120),
 created_by uuid references public.profiles(id)on delete set null,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,dynamic_slide_id)references public.dynamic_slides(tenant_id,id)on delete restrict,
 foreign key(tenant_id,base_snapshot_id)references public.dynamic_slide_snapshots(tenant_id,id)on delete set null(base_snapshot_id),
 foreign key(tenant_id,version_id)references public.dynamic_slide_versions(tenant_id,id)on delete cascade,
 foreign key(tenant_id,snapshot_id)references public.dynamic_slide_snapshots(tenant_id,id)on delete cascade deferrable initially deferred,
 unique(tenant_id,base_snapshot_id,theme,seconds_per_page)
);
create index sync_dynamic_placement_variants_tenant_idx on private.sync_dynamic_placement_variants(tenant_id,dynamic_slide_id);
create index sync_dynamic_placement_variants_version_idx on private.sync_dynamic_placement_variants(tenant_id,version_id);
alter table private.sync_dynamic_placement_variants enable row level security;
alter table private.sync_dynamic_placement_variants force row level security;
revoke all on private.sync_dynamic_placement_variants from public,anon,authenticated,service_role;

-- Only the private association created by the authorized command can select a
-- non-runtime version. Ordinary Source and all historical inserts keep their
-- original assignment logic.
do $migration$
declare definition text;marker text:=E'begin\n  select * into slide_record';
begin
 select pg_get_functiondef('private.assign_dynamic_snapshot_version_v1()'::regprocedure)into definition;
 if position(marker in definition)=0 then raise exception 'Source variant assignment precondition failed';end if;
 execute replace(definition,marker,$branch$begin
  if exists(select 1 from private.sync_dynamic_placement_variants variant
    where variant.tenant_id=new.tenant_id and variant.dynamic_slide_id=new.dynamic_slide_id
     and variant.snapshot_id=new.id and variant.version_id=new.dynamic_slide_version_id)then
   return new;
  end if;
  select * into slide_record$branch$);
end;$migration$;

-- Pinning a Source placement variant freezes its design, not its authorized
-- source facts. Keep the historical pinned-snapshot policy for every ordinary
-- item; the private variant association is the only additional live binding.
do $migration$
declare definition text;marker text:='new.live_data_enabled := coalesce(new.live_data_enabled,false) and new.dynamic_snapshot_id is not null;';
begin
 select pg_get_functiondef('private.materialize_published_data_binding_v1()'::regprocedure)into definition;
 if position(marker in definition)=0 then raise exception 'Source variant live binding precondition failed';end if;
 execute replace(definition,marker,$branch$new.live_data_enabled := (coalesce(new.live_data_enabled,false) or exists(
      select 1 from private.sync_dynamic_placement_variants variant
      where variant.tenant_id=new.tenant_id and variant.snapshot_id=new.dynamic_snapshot_id
    )) and new.dynamic_snapshot_id is not null;$branch$);
end;$migration$;

create function private.finalize_sync_dynamic_variant_v1()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='ready'and old.status is distinct from 'ready'then
  update public.dynamic_slide_versions version set status='published',
   published_snapshot_id=new.id,published_by=version.created_by,published_at=now()
  where version.tenant_id=new.tenant_id and version.id=new.dynamic_slide_version_id
   and version.is_source_variant and version.status='publishing'
   and exists(select 1 from private.sync_dynamic_placement_variants variant
    where variant.tenant_id=new.tenant_id and variant.snapshot_id=new.id and variant.version_id=version.id);
 end if;
 return new;
end;$$;
revoke all on function private.finalize_sync_dynamic_variant_v1()from public,anon,authenticated,service_role;
create trigger dynamic_snapshots_finalize_source_variant after update of status on public.dynamic_slide_snapshots
for each row execute function private.finalize_sync_dynamic_variant_v1();

-- A render becoming ready is not a playlist authoring command. The historical
-- latest-draft follower must not pick a private per-placement variant. Ordinary
-- Source snapshots follow with their full, checked duration rather than the
-- legacy news timer or the previous item's duration.
do $migration$
declare definition text;marker text:=E'begin\n  select case';
begin
 select pg_get_functiondef('private.follow_latest_dynamic_snapshot_in_drafts()'::regprocedure)into definition;
 if position(marker in definition)=0 then raise exception 'Source variant draft follower precondition failed';end if;
 definition:=replace(definition,marker,$branch$begin
  if exists(select 1 from private.sync_dynamic_placement_variants variant where variant.tenant_id=new.tenant_id and variant.snapshot_id=new.id)then return new;end if;
  select case$branch$);
 marker:='if new.snapshot_data_json ->> ''type'' = ''news'' then';
 if position(marker in definition)=0 then raise exception 'Source full duration follower precondition failed';end if;
 execute replace(definition,marker,$branch$if new.snapshot_data_json?'syncConfiguration'then
      resolved_duration := (new.sync_render_result_json->>'durationMs')::integer/1000;
    elsif new.snapshot_data_json ->> 'type' = 'news' then$branch$);
end;$migration$;

-- A placement render must never promote, fail or replace the main source, even
-- if its worker crashes. Keep the existing completion/failure/reaper bodies
-- and their lease fences, adding only the private variant exclusion.
do $migration$
declare definition text;marker text;signature text;
begin
 select pg_get_functiondef('public.complete_dynamic_render_job_v2(uuid,text,uuid,jsonb)'::regprocedure)into definition;
 marker:=E'where slide.id = slide_record.id\n    and (';
 if position(marker in definition)=0 then raise exception 'Source variant completion precondition failed';end if;
 execute replace(definition,marker,E'where slide.id = slide_record.id\n    and not exists(select 1 from private.sync_dynamic_placement_variants variant where variant.tenant_id=snapshot_record.tenant_id and variant.snapshot_id=snapshot_record.id)\n    and (');
 select pg_get_functiondef('private.fail_dynamic_render_before_sync_v1(uuid,text,text,text,boolean)'::regprocedure)into definition;
 marker:='and slide.id = snapshot.dynamic_slide_id;';
 if position(marker in definition)=0 then raise exception 'Source variant failure precondition failed';end if;
 execute replace(definition,marker,'and slide.id = snapshot.dynamic_slide_id and not exists(select 1 from private.sync_dynamic_placement_variants variant where variant.tenant_id=snapshot.tenant_id and variant.snapshot_id=snapshot.id);');
 foreach signature in array array['public.claim_dynamic_render_job_v1(text,integer,integer)','public.claim_dynamic_render_job_v2(text,integer,integer)']loop
  select pg_get_functiondef(signature::regprocedure)into definition;
  marker:='and failed_snapshot.dynamic_slide_id = slide.id';
  if position(marker in definition)=0 then raise exception 'Source variant reaper precondition failed: %',signature;end if;
  execute replace(definition,marker,marker||' and not exists(select 1 from private.sync_dynamic_placement_variants variant where variant.tenant_id=failed_snapshot.tenant_id and variant.snapshot_id=failed_snapshot.id)');
 end loop;
end;$migration$;

create function public.prepare_sync_dynamic_variant_v1(
 p_tenant_id uuid,p_base_snapshot_id uuid,p_theme text,p_seconds_per_page integer,p_idempotency_key uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=private.current_user_id();request jsonb;result jsonb;cfg jsonb;data jsonb;
 base public.dynamic_slide_snapshots%rowtype;slide public.dynamic_slides%rowtype;
 basis public.dynamic_slide_versions%rowtype;variant private.sync_dynamic_placement_variants%rowtype;
 new_version uuid:=gen_random_uuid();new_snapshot uuid:=gen_random_uuid();job_id uuid;next_number integer;pages integer;
begin
 if actor is null or not private.can_write_playlist(p_tenant_id)
  or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')then
  raise exception 'Source placement permission required'using errcode='42501';
 end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_base_snapshot_id is null or p_theme is null or p_theme not in('fieldflow','onzetrots-tv')
  or p_seconds_per_page is null or p_seconds_per_page not between 3 and 120 or p_idempotency_key is null then
  raise exception 'invalid Source variant command'using errcode='22023';
 end if;
 request:=jsonb_build_object('baseSnapshotId',p_base_snapshot_id,'theme',p_theme,'secondsPerPage',p_seconds_per_page);
 result:=private.begin_publisher_command(p_tenant_id,'sync.dynamic.variant',p_idempotency_key,request);
 if result is not null then return result;end if;
 select *into base from public.dynamic_slide_snapshots where tenant_id=p_tenant_id and id=p_base_snapshot_id and status='ready'and output_media_asset_id is not null;
 if base.id is null or not(base.snapshot_data_json?'syncConfiguration')or base.sync_render_result_json is null then
  raise exception 'ready Source snapshot required'using errcode='42501';
 end if;
 select *into slide from public.dynamic_slides where tenant_id=p_tenant_id and id=base.dynamic_slide_id for update;
 select *into basis from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=base.dynamic_slide_version_id;
 if basis.id is null then raise exception 'Source version unavailable'using errcode='23514';end if;
 pages:=(base.sync_render_result_json->>'durationMs')::integer/1000/(base.snapshot_data_json#>>'{syncConfiguration,secondsPerPage}')::integer;
 if pages<1 or pages*p_seconds_per_page>120 then raise exception 'Source variant exceeds full playback duration'using errcode='23514';end if;
 select *into variant from private.sync_dynamic_placement_variants where tenant_id=p_tenant_id
  and base_snapshot_id=p_base_snapshot_id and theme=p_theme and seconds_per_page=p_seconds_per_page;
 if variant.snapshot_id is null then
  cfg:=jsonb_set(jsonb_set(base.snapshot_data_json->'syncConfiguration','{seed,theme}',to_jsonb(p_theme)),'{secondsPerPage}',to_jsonb(p_seconds_per_page));
  perform private.assert_sync_dynamic_configuration_v1(p_tenant_id,basis.slide_type,basis.orientation,cfg);
  data:=jsonb_set(base.snapshot_data_json,'{syncConfiguration}',cfg);
  select coalesce(max(version_number),0)+1 into next_number from public.dynamic_slide_versions where dynamic_slide_id=slide.id;
  insert into public.dynamic_slide_versions(id,tenant_id,dynamic_slide_id,version_number,status,name,slide_type,orientation,
   template_id,template_version_id,data_source_id,selection_mode,configuration_json,theme_selection_json,based_on_version_id,created_by,is_source_variant)
  values(new_version,p_tenant_id,slide.id,next_number,'publishing',basis.name,basis.slide_type,basis.orientation,
   basis.template_id,base.template_version_id,base.data_source_id,'pinned',jsonb_set(basis.configuration_json,'{syncConfiguration}',cfg),basis.theme_selection_json,basis.id,actor,true);
  insert into private.sync_dynamic_placement_variants(tenant_id,dynamic_slide_id,base_snapshot_id,version_id,snapshot_id,theme,seconds_per_page,created_by)
  values(p_tenant_id,slide.id,base.id,new_version,new_snapshot,p_theme,p_seconds_per_page,actor)returning *into variant;
  slide.configuration_json:=jsonb_set(basis.configuration_json,'{syncConfiguration}',cfg);
  slide.template_version_id:=base.template_version_id;slide.data_source_id:=base.data_source_id;
  insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,dynamic_slide_version_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,created_by)
  values(new_snapshot,p_tenant_id,slide.id,new_version,base.template_version_id,base.data_source_id,private.dynamic_snapshot_content_hash_v1(slide,data),data,actor);
  insert into public.dynamic_render_jobs(tenant_id,snapshot_id)values(p_tenant_id,new_snapshot)returning id into job_id;
 else
  select id into job_id from public.dynamic_render_jobs where tenant_id=p_tenant_id and snapshot_id=variant.snapshot_id;
 end if;
 result:=jsonb_build_object('outcome','prepared','slideId',slide.id,'baseSnapshotId',base.id,'snapshotId',variant.snapshot_id,'versionId',variant.version_id,'jobId',job_id);
 return private.complete_publisher_command(p_tenant_id,'sync.dynamic.variant',p_idempotency_key,request,'dynamic_slide_snapshots',variant.snapshot_id,result,'sync.dynamic.variant.prepared','success');
end;$$;
revoke all on function public.prepare_sync_dynamic_variant_v1(uuid,uuid,text,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function public.prepare_sync_dynamic_variant_v1(uuid,uuid,text,integer,uuid)to authenticated;

-- Bind the verified variant inside the existing atomic playlist batch and
-- receipt. The item snapshot is a second CAS alongside the playlist revision.
do $migration$
declare definition text;marker text:='elsif operation->>''operation''=''refresh_dynamic'' then';
begin
 select pg_get_functiondef('public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid)'::regprocedure)into definition;
 if position(marker in definition)=0 then raise exception 'Source variant batch precondition failed';end if;
 execute replace(definition,marker,$branch$elsif operation->>'operation'='add_sync_dynamic' then
      duration:=(operation->>'durationSeconds')::integer;
      if client_id is null or duration is null or duration not between 3 and 120 then raise exception 'invalid complete Source placement'using errcode='23514';end if;
      if not private.has_tenant_capability(playlist.tenant_id,'tenant.dynamic_slide.read')then raise exception 'Source read permission required'using errcode='42501';end if;
      perform 1 from public.dynamic_slides source where source.tenant_id=playlist.tenant_id
       and source.id=(operation->>'dynamicSlideId')::uuid and source.status<>'archived'
       and source.current_snapshot_id=(operation->>'expectedSnapshotId')::uuid for share;
      if not found then raise exception 'Source selection changed; reload library'using errcode='40001';end if;
      select jsonb_build_object('assetId',asset.id,'durationSeconds',(snapshot.sync_render_result_json->>'durationMs')::integer/1000)into payload
      from public.dynamic_slide_snapshots snapshot
      join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready'and asset.deleted_at is null
      join public.media_variants media on media.tenant_id=asset.tenant_id and media.asset_id=asset.id and media.variant_type='original'
       and media.checksum_sha256=snapshot.sync_render_result_json->>'checksumSha256'
       and media.file_size_bytes=(snapshot.sync_render_result_json->>'byteLength')::bigint
      where snapshot.tenant_id=playlist.tenant_id and snapshot.dynamic_slide_id=(operation->>'dynamicSlideId')::uuid
       and snapshot.id=(operation->>'snapshotId')::uuid and snapshot.status='ready'and snapshot.snapshot_data_json?'syncConfiguration'
       and(snapshot.id=(operation->>'expectedSnapshotId')::uuid or exists(select 1 from private.sync_dynamic_placement_variants variant
        where variant.tenant_id=snapshot.tenant_id and variant.dynamic_slide_id=snapshot.dynamic_slide_id
         and variant.base_snapshot_id=(operation->>'expectedSnapshotId')::uuid and variant.snapshot_id=snapshot.id));
      if payload is null or duration is distinct from (payload->>'durationSeconds')::integer then raise exception 'Source selection has no matching complete output'using errcode='23514';end if;
      select coalesce(max(sort_order),-1)+1,coalesce(max(position_key),0)+1024 into next_sort,next_position from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds,
       fit_mode,muted,transition,background_color,created_by,dynamic_slide_id,dynamic_snapshot_id,dynamic_selection_mode)
      select playlist.tenant_id,playlist.id,(payload->>'assetId')::uuid,next_sort,next_position,duration,
       playlist.default_fit_mode,playlist.default_video_muted,playlist.default_transition,playlist.default_background_color,actor,
       source.id,(operation->>'snapshotId')::uuid,case when (operation->>'snapshotId')::uuid is distinct from (operation->>'expectedSnapshotId')::uuid then 'pinned'else source.selection_mode end from public.dynamic_slides source where source.id=(operation->>'dynamicSlideId')::uuid returning id into item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now()where id=playlist.id;
    elsif operation->>'operation'='use_sync_dynamic_variant' then
      select *into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if item.dynamic_snapshot_id is distinct from (operation->>'expectedSnapshotId')::uuid then raise exception 'Source placement changed; reload playlist'using errcode='40001';end if;
      select jsonb_build_object('snapshotId',snapshot.id,'assetId',asset.id,'durationSeconds',(snapshot.sync_render_result_json->>'durationMs')::integer/1000)into payload
      from private.sync_dynamic_placement_variants variant
      join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=variant.tenant_id and snapshot.id=variant.snapshot_id and snapshot.status='ready'
      join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready'and asset.deleted_at is null
      join public.media_variants media on media.tenant_id=asset.tenant_id and media.asset_id=asset.id and media.variant_type='original'
       and media.checksum_sha256=snapshot.sync_render_result_json->>'checksumSha256'
       and media.file_size_bytes=(snapshot.sync_render_result_json->>'byteLength')::bigint
      where variant.tenant_id=playlist.tenant_id and variant.dynamic_slide_id=item.dynamic_slide_id
       and variant.base_snapshot_id=item.dynamic_snapshot_id and variant.snapshot_id=(operation->>'snapshotId')::uuid;
      if payload is null or (operation->>'durationSeconds')::integer is distinct from (payload->>'durationSeconds')::integer then raise exception 'Source variant has no matching complete output'using errcode='23514';end if;
      update public.playlist_items set dynamic_snapshot_id=(payload->>'snapshotId')::uuid,
       media_asset_id=(payload->>'assetId')::uuid,duration_seconds=(payload->>'durationSeconds')::integer,
       dynamic_selection_mode='pinned',sites_configuration_json=null,trim_start_seconds=0,trim_end_seconds=null where id=item.id;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now()where id=playlist.id;
    elsif operation->>'operation'='refresh_dynamic' then$branch$);
end;$migration$;
notify pgrst,'reload schema';
