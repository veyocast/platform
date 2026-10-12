-- S191: official, server-validated playlist order and immutable local fallback.
alter table public.youtube_sources drop constraint youtube_sources_tenant_id_video_id_key,
  add column playlist_id text check(playlist_id is null or playlist_id~'^[A-Za-z0-9_-]{12,160}$'),
  add column playlist_video_ids jsonb check(playlist_video_ids is null or(jsonb_typeof(playlist_video_ids)='array'and jsonb_array_length(playlist_video_ids)between 1 and 200)),
  add column playlist_repeat boolean,add column playlist_unavailable_count integer not null default 0 check(playlist_unavailable_count between 0 and 200),
  add column revision bigint not null default 0 check(revision>=0),
  add constraint youtube_sources_playlist_pair_check check((playlist_id is null and playlist_video_ids is null and playlist_repeat is null)or(playlist_id is not null and playlist_video_ids is not null and playlist_repeat is not null and playlist_video_ids->>0=video_id));
create unique index youtube_sources_single_video_unique on public.youtube_sources(tenant_id,video_id)where playlist_id is null;
create unique index youtube_sources_playlist_unique on public.youtube_sources(tenant_id,playlist_id)where playlist_id is not null;
alter table public.playlist_release_items add column youtube_playlist_id text,
  add column youtube_playlist_video_ids jsonb,add column youtube_playlist_repeat boolean;

create table private.youtube_playlist_validations(
  id uuid primary key,tenant_id uuid not null references public.tenants(id)on delete cascade,
  actor_user_id uuid not null references public.profiles(id)on delete cascade,metadata_json jsonb not null,
  created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',
  unique(tenant_id,id)
);
create index youtube_playlist_validations_tenant_actor_idx on private.youtube_playlist_validations(tenant_id,actor_user_id,expires_at);
alter table private.youtube_playlist_validations enable row level security;alter table private.youtube_playlist_validations force row level security;
revoke all on private.youtube_playlist_validations from public,anon,authenticated,service_role;
create function public.register_youtube_playlist_validation_v1(p_validation_id uuid,p_tenant_id uuid,p_actor_user_id uuid,p_metadata jsonb)returns void
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
  if p_validation_id is null or p_actor_user_id is null or jsonb_typeof(p_metadata)is distinct from 'object' or not(p_metadata?&array['playlistId','videoIds','title','channelTitle','unavailableItems']) or octet_length(p_metadata::text)>32768 or p_metadata->>'playlistId'!~'^[A-Za-z0-9_-]{12,160}$'
    or jsonb_typeof(p_metadata->'videoIds')is distinct from 'array'or jsonb_array_length(p_metadata->'videoIds')not between 1 and 200
    or exists(select 1 from jsonb_array_elements_text(p_metadata->'videoIds')value where value!~'^[A-Za-z0-9_-]{11}$')
    or length(btrim(p_metadata->>'title'))not between 2 and 160 or length(btrim(p_metadata->>'channelTitle'))not between 1 and 240
    or(p_metadata->>'unavailableItems')::integer not between 0 and 200 then raise exception 'provider playlist metadata invalid'using errcode='23514';end if;
  delete from private.youtube_playlist_validations where id in(select id from private.youtube_playlist_validations where tenant_id=p_tenant_id and expires_at<now()order by expires_at limit 100);
  insert into private.youtube_playlist_validations(id,tenant_id,actor_user_id,metadata_json)values(p_validation_id,p_tenant_id,p_actor_user_id,p_metadata);
end $$;
revoke all on function public.register_youtube_playlist_validation_v1(uuid,uuid,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.register_youtube_playlist_validation_v1(uuid,uuid,uuid,jsonb)to service_role;

create function public.save_youtube_playlist_source_v1(p_tenant_id uuid,p_source_id uuid,p_expected_revision bigint,p_validation_id uuid,p_fallback_media_asset_id uuid,p_repeat boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare validation private.youtube_playlist_validations%rowtype;source public.youtube_sources%rowtype;actor uuid:=private.current_user_id();request jsonb;replay jsonb;saved_id uuid:=coalesce(p_source_id,gen_random_uuid());actual_revision bigint;
begin
  if actor is null or not private.tenant_feature_enabled_v1(p_tenant_id,'youtube_integration')or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.manage')then raise exception 'YouTube rollout and source management required'using errcode='42501';end if;
  perform private.require_active_tenant_command(p_tenant_id);
  request:=jsonb_build_object('sourceId',p_source_id,'expectedRevision',p_expected_revision,'validationId',p_validation_id,'fallbackAssetId',p_fallback_media_asset_id,'repeat',p_repeat);
  replay:=private.begin_publisher_command(p_tenant_id,'youtube.playlist.save',p_idempotency_key,request);if replay is not null then return replay;end if;
  select * into validation from private.youtube_playlist_validations where tenant_id=p_tenant_id and id=p_validation_id and actor_user_id=actor and expires_at>now()for update;
  if not found then raise exception 'current server provider validation required'using errcode='23514';end if;
  if p_source_id is not null then
    select * into source from public.youtube_sources where tenant_id=p_tenant_id and id=p_source_id for update;
    if not found then raise exception 'source unavailable in tenant'using errcode='42501';end if;
  end if;
  if p_expected_revision is null or coalesce(source.revision,0)<>p_expected_revision then return private.complete_publisher_command(p_tenant_id,'youtube.playlist.save',p_idempotency_key,request,'youtube_sources',saved_id,jsonb_build_object('outcome','conflict','actualRevision',coalesce(source.revision,0)),'youtube.playlist.conflict','failed');end if;
  if p_repeat is null or not exists(select 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
    where asset.tenant_id=p_tenant_id and asset.id=p_fallback_media_asset_id and asset.status='ready'and asset.deleted_at is null
    and variant.variant_type::text=case when asset.kind='video'then 'player_1080p'else 'original'end and variant.file_size_bytes>0 and variant.checksum_sha256~'^[a-f0-9]{64}$')then raise exception 'verified tenant fallback required'using errcode='23514';end if;
  insert into public.youtube_sources(id,tenant_id,video_id,title,channel_title,fallback_media_asset_id,validation_status,embeddable,playlist_id,playlist_video_ids,playlist_repeat,playlist_unavailable_count,revision,created_by,updated_by)
  values(saved_id,p_tenant_id,validation.metadata_json#>>'{videoIds,0}',validation.metadata_json->>'title',validation.metadata_json->>'channelTitle',p_fallback_media_asset_id,'verified',true,validation.metadata_json->>'playlistId',validation.metadata_json->'videoIds',p_repeat,(validation.metadata_json->>'unavailableItems')::integer,1,actor,actor)
    on conflict(id)do update set video_id=excluded.video_id,title=excluded.title,channel_title=excluded.channel_title,fallback_media_asset_id=excluded.fallback_media_asset_id,validation_status='verified',validation_error_code=null,embeddable=true,playlist_id=excluded.playlist_id,playlist_video_ids=excluded.playlist_video_ids,playlist_repeat=excluded.playlist_repeat,playlist_unavailable_count=excluded.playlist_unavailable_count,revision=youtube_sources.revision+1,updated_by=actor returning revision into actual_revision;
  delete from private.youtube_playlist_validations where id=validation.id;
  return private.complete_publisher_command(p_tenant_id,'youtube.playlist.save',p_idempotency_key,request,'youtube_sources',saved_id,jsonb_build_object('outcome','saved','sourceId',saved_id,'actualRevision',actual_revision,'videoCount',jsonb_array_length(validation.metadata_json->'videoIds'),'unavailableItems',validation.metadata_json->'unavailableItems'),'youtube.playlist.saved','success');
end $$;
revoke all on function public.save_youtube_playlist_source_v1(uuid,uuid,bigint,uuid,uuid,boolean,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_youtube_playlist_source_v1(uuid,uuid,bigint,uuid,uuid,boolean,uuid)to authenticated;

alter table public.youtube_sources drop constraint youtube_sources_status_check;
alter table public.youtube_sources add constraint youtube_sources_status_check check(status in('active','paused','archived'));
create function public.manage_youtube_source_v1(p_tenant_id uuid,p_source_id uuid,p_expected_revision bigint,p_action text,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare source public.youtube_sources%rowtype;request jsonb;replay jsonb;actual_revision bigint;outcome text;
begin
 if private.current_user_id()is null or not private.tenant_feature_enabled_v1(p_tenant_id,'youtube_integration')or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.manage')then raise exception 'YouTube rollout and source management required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_action not in('pause','resume','delete')or p_expected_revision is null or p_expected_revision<0 or p_idempotency_key is null then raise exception 'invalid source command'using errcode='22023';end if;
 request:=jsonb_build_object('sourceId',p_source_id,'expectedRevision',p_expected_revision,'action',p_action);
 replay:=private.begin_publisher_command(p_tenant_id,'youtube.source.manage',p_idempotency_key,request);if replay is not null then return replay;end if;
 select * into source from public.youtube_sources where tenant_id=p_tenant_id and id=p_source_id for update;
 if not found then raise exception 'source unavailable in tenant'using errcode='42501';end if;
 if source.revision<>p_expected_revision then return private.complete_publisher_command(p_tenant_id,'youtube.source.manage',p_idempotency_key,request,'youtube_sources',source.id,jsonb_build_object('outcome','conflict','actualRevision',source.revision),'youtube.source.conflict','failed');end if;
 if p_action='resume'and(source.validation_status<>'verified'or source.embeddable is distinct from true)then raise exception 'source requires current validation'using errcode='23514';end if;
 if p_action='delete'then
   if not exists(select 1 from public.playlist_items where tenant_id=p_tenant_id and youtube_source_id=source.id)
     and not exists(select 1 from public.playlist_release_items where tenant_id=p_tenant_id and youtube_source_id=source.id)then
     begin delete from public.youtube_sources where tenant_id=p_tenant_id and id=source.id;outcome:='deleted';
     exception when foreign_key_violation then outcome:=null;end;
   end if;
   if outcome is null then update public.youtube_sources set status='archived',revision=revision+1,updated_by=private.current_user_id()where id=source.id returning revision into actual_revision;outcome:='archived';end if;
 else
   update public.youtube_sources set status=case when p_action='pause'then 'paused'else 'active'end,revision=revision+1,updated_by=private.current_user_id()where id=source.id returning revision into actual_revision;outcome:=case when p_action='pause'then 'paused'else 'active'end;
 end if;
 return private.complete_publisher_command(p_tenant_id,'youtube.source.manage',p_idempotency_key,request,'youtube_sources',source.id,jsonb_build_object('outcome',outcome,'actualRevision',coalesce(actual_revision,source.revision),'frozenPublicationsPreserved',true),'youtube.source.managed','success');
end $$;
revoke all on function public.manage_youtube_source_v1(uuid,uuid,bigint,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.manage_youtube_source_v1(uuid,uuid,bigint,text,uuid)to authenticated;

create function private.freeze_youtube_playlist_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.youtube_source_id is not null and new.source_item_id is not null then
    select playlist_id,playlist_video_ids,playlist_repeat into new.youtube_playlist_id,new.youtube_playlist_video_ids,new.youtube_playlist_repeat
      from public.youtube_sources where tenant_id=new.tenant_id and id=new.youtube_source_id and status='active'and validation_status='verified'and embeddable;
  end if;return new;
end $$;
revoke all on function private.freeze_youtube_playlist_v1()from public,anon,authenticated,service_role;
create trigger zz_release_item_youtube_playlist before insert on public.playlist_release_items for each row execute function private.freeze_youtube_playlist_v1();
select pg_catalog.pg_notify('pgrst','reload schema');
