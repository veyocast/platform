-- S231: logical raw-media designs over existing immutable verified bytes.
-- Forward-only. No existing asset, draft, release or Storage object is rewritten.
create table public.media_frames (
 id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete restrict,
 source_asset_id uuid not null, is_primary boolean not null default false,
 status text not null default 'active' check(status in('active','archived')),
 revision integer not null default 1 check(revision>0), current_version_id uuid not null,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,id),foreign key(tenant_id,source_asset_id) references public.media_assets(tenant_id,id) on delete restrict
);
create unique index media_frames_primary_asset_uq on public.media_frames(tenant_id,source_asset_id) where is_primary;
create index media_frames_tenant_updated_idx on public.media_frames(tenant_id,updated_at desc,id);
create table public.media_frame_versions (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,frame_id uuid not null,
 version_number integer not null check(version_number>0),settings_json jsonb not null,
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,frame_id,id),unique(tenant_id,frame_id,version_number),
 foreign key(tenant_id,frame_id) references public.media_frames(tenant_id,id) on delete restrict
);
alter table public.media_frames add constraint media_frames_current_version_fk foreign key(tenant_id,id,current_version_id)
 references public.media_frame_versions(tenant_id,frame_id,id) deferrable initially deferred;
alter table public.media_variants add constraint media_variants_tenant_asset_id_frame_uq unique(tenant_id,asset_id,id);
create table public.media_frame_version_assets (
 tenant_id uuid not null,version_id uuid not null,role text not null check(role in('media','background')),
 media_asset_id uuid not null,variant_id uuid not null,checksum_sha256 text not null check(checksum_sha256~'^[a-f0-9]{64}$'),
 byte_size bigint not null check(byte_size>0 and byte_size<=9007199254740991),
 storage_bucket text not null check(storage_bucket='tenant-media'),storage_path text not null,mime_type text not null,
 width integer,height integer,duration_seconds numeric,primary key(tenant_id,version_id,role),
 foreign key(tenant_id,version_id) references public.media_frame_versions(tenant_id,id) on delete restrict,
 foreign key(tenant_id,media_asset_id) references public.media_assets(tenant_id,id) on delete restrict,
 foreign key(tenant_id,media_asset_id,variant_id) references public.media_variants(tenant_id,asset_id,id) on delete restrict,
 check(storage_path like 'tenants/'||tenant_id::text||'/assets/'||media_asset_id::text||'/%' and position('..'in storage_path)=0)
);
create index media_frame_version_assets_asset_idx on public.media_frame_version_assets(tenant_id,media_asset_id);
create index media_frame_version_assets_variant_idx on public.media_frame_version_assets(tenant_id,variant_id);
alter table public.media_frames enable row level security;
alter table public.media_frame_versions enable row level security;
alter table public.media_frame_version_assets enable row level security;
create policy media_frames_read on public.media_frames for select to authenticated using(private.has_tenant_capability(tenant_id,'tenant.media.read'));
create policy media_frame_versions_read on public.media_frame_versions for select to authenticated using(private.has_tenant_capability(tenant_id,'tenant.media.read'));
create policy media_frame_version_assets_read on public.media_frame_version_assets for select to authenticated using(private.has_tenant_capability(tenant_id,'tenant.media.read'));
revoke all on public.media_frames,public.media_frame_versions,public.media_frame_version_assets from public,anon,authenticated,service_role;
grant select on public.media_frames,public.media_frame_versions,public.media_frame_version_assets to authenticated;

create function private.media_frame_settings_valid_v1(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb;b jsonb;m jsonb;k text;
begin
 if jsonb_typeof(s)is distinct from 'object' or octet_length(s::text)>16384
 or (select count(*)from jsonb_object_keys(s))<>8 or not s?&array['schemaVersion','name','orientation','durationSeconds','fitMode','focus','appearance','sourceMetadata']
 or s->'schemaVersion'is distinct from '1'::jsonb or jsonb_typeof(s->'name')is distinct from 'string' or length(btrim(s->>'name'))not between 2 and 120
 or s->>'orientation'not in('landscape','portrait') or s->>'fitMode'not in('cover','contain')
 or s->>'focus'not in('center','top','bottom','left','right') or jsonb_typeof(s->'durationSeconds')is distinct from 'number'
 or (s->>'durationSeconds')::numeric not between 3 and 3600 or trunc((s->>'durationSeconds')::numeric)<>(s->>'durationSeconds')::numeric then return false;end if;
 for k in select unnest(array['orientation','fitMode','focus'])loop if jsonb_typeof(s->k)is distinct from 'string'then return false;end if;end loop;
 a:=s->'appearance';b:=a->'background';m:=s->'sourceMetadata';
 if jsonb_typeof(a)is distinct from 'object' or(select count(*)from jsonb_object_keys(a))<>3 or not a?&array['themeId','accentColor','background']
 or a->>'themeId'not in('fieldflow','onzetrots-tv') or jsonb_typeof(a->'accentColor')is distinct from 'string' or a->>'accentColor'!~'^#[a-fA-F0-9]{6}$'
 or jsonb_typeof(b)is distinct from 'object' then return false;end if;
 if jsonb_typeof(a->'themeId')is distinct from 'string'or jsonb_typeof(b->'kind')is distinct from 'string'then return false;end if;
 if b->>'kind'='preset'then
   if(select count(*)from jsonb_object_keys(b))<>2 or not b?&array['kind','preset'] or jsonb_typeof(b->'preset')is distinct from 'string'or b->>'preset'not in('stadium','dark','light','gradient','stripes','clubmuur')then return false;end if;
 elsif b->>'kind'='image'then
   if(select count(*)from jsonb_object_keys(b))<>3 or not b?&array['kind','mediaAssetId','position']or jsonb_typeof(b->'mediaAssetId')is distinct from 'string' or (b->>'mediaAssetId')::uuid is null
   or jsonb_typeof(b->'position')is distinct from 'string'or b->>'position'not in('center','top','bottom','left','right')then return false;end if;
 else return false;end if;
 if jsonb_typeof(m)is distinct from 'object' or(select count(*)from jsonb_object_keys(m))<>12
 or not m?&array['title','headline','subtitle','body','footer','font','scale','alignment','safeMargin','showLogo','showFooter','motion'] then return false;end if;
 for k in select unnest(array['title','headline','subtitle','body','footer'])loop
   if jsonb_typeof(m->k)is distinct from 'string' or length(m->>k)>(case k when 'headline'then 200 when 'body'then 4000 else 400 end) then return false;end if;
 end loop;
 for k in select unnest(array['font','alignment','motion'])loop if jsonb_typeof(m->k)is distinct from 'string'then return false;end if;end loop;
 if m->>'font'not in('Inter','Manrope','Arial','Condensed','Serif','Brush')or m->>'alignment'not in('left','center','right')or m->>'motion'not in('rustig','dynamisch','geen')
 or jsonb_typeof(m->'showLogo')is distinct from 'boolean'or jsonb_typeof(m->'showFooter')is distinct from 'boolean'
 or jsonb_typeof(m->'scale')is distinct from 'number'or(m->>'scale')::numeric not between 50 and 150 or trunc((m->>'scale')::numeric)<>(m->>'scale')::numeric
 or jsonb_typeof(m->'safeMargin')is distinct from 'number'or(m->>'safeMargin')::numeric not between 2 and 12 then return false;end if;
 return true;
exception when others then return false;
end $$;
revoke all on function private.media_frame_settings_valid_v1(jsonb)from public,anon,authenticated,service_role;
alter table public.media_frame_versions add constraint media_frame_versions_settings_check check(private.media_frame_settings_valid_v1(settings_json));

create function private.reject_media_frame_version_mutation_v1()returns trigger language plpgsql set search_path='' as $$
begin raise exception 'media frame versions and source references are immutable'using errcode='55000';end $$;
revoke all on function private.reject_media_frame_version_mutation_v1()from public,anon,authenticated,service_role;
create trigger media_frame_versions_immutable before update or delete on public.media_frame_versions for each row execute function private.reject_media_frame_version_mutation_v1();
create trigger media_frame_version_assets_immutable before update or delete on public.media_frame_version_assets for each row execute function private.reject_media_frame_version_mutation_v1();

create function private.media_frame_source_v1(p_tenant_id uuid,p_asset_id uuid)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('mediaAssetId',a.id,'kind',a.kind,'title',a.title,'fileName',a.original_file_name,
 'width',v.width,'height',v.height,'durationSeconds',v.duration_seconds,'maximumDurationSeconds',case when a.kind='video'then greatest(5,least(3600,ceil(a.duration_seconds)::integer))else 3600 end,
 'variant',jsonb_build_object('variantId',v.id,'checksumSha256',v.checksum_sha256,'byteSize',v.file_size_bytes,'storageBucket',v.storage_bucket,'storagePath',v.storage_path,'mimeType',v.mime_type),
 'poster',(select jsonb_build_object('variantId',p.id,'checksumSha256',p.checksum_sha256,'byteSize',p.file_size_bytes,'storageBucket',p.storage_bucket,'storagePath',p.storage_path,'mimeType',p.mime_type)
 from public.media_variants p where p.tenant_id=a.tenant_id and p.asset_id=a.id and p.variant_type='thumbnail'and p.file_size_bytes>0 and p.checksum_sha256~'^[a-f0-9]{64}$'limit 1))
 from public.media_assets a join public.media_variants v on v.tenant_id=a.tenant_id and v.asset_id=a.id and v.variant_type::text=case when a.kind='video'then 'player_1080p'else 'original'end
 where a.tenant_id=p_tenant_id and a.id=p_asset_id and a.kind in('image','video')and a.source_kind='user'and a.status='ready'and a.deleted_at is null
 and(a.kind<>'video'or(a.duration_seconds>0 and v.duration_seconds>0))
 and v.file_size_bytes>0 and v.checksum_sha256~'^[a-f0-9]{64}$' and v.storage_bucket='tenant-media'
 and v.storage_path like 'tenants/'||a.tenant_id::text||'/assets/'||a.id::text||'/%'and position('..'in v.storage_path)=0
 and exists(select 1 from storage.objects o where o.bucket_id=v.storage_bucket and o.name=v.storage_path);
$$;
revoke all on function private.media_frame_source_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function public.get_media_frame_source_v1(p_tenant_id uuid,p_asset_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.read')then raise exception 'media read permission required'using errcode='42501';end if;
 result:=private.media_frame_source_v1(p_tenant_id,p_asset_id);
 if result is null then raise exception 'verified tenant source unavailable'using errcode='P0002';end if;
 return result;
end $$;
revoke all on function public.get_media_frame_source_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_media_frame_source_v1(uuid,uuid)to authenticated;

create function private.assert_media_frame_sources_v1(p_tenant_id uuid,p_source_asset_id uuid,p_settings jsonb,p_sources jsonb)returns void language plpgsql security definer set search_path='' as $$
declare expected_source jsonb;actual jsonb;role_name text;
begin
 if not private.media_frame_settings_valid_v1(p_settings)or jsonb_typeof(p_sources)is distinct from 'array'or jsonb_array_length(p_sources)not between 1 and 2 then raise exception 'media frame settings or source list invalid'using errcode='23514';end if;
 if(select count(*)from jsonb_array_elements(p_sources)e where e->>'role'='media')<>1
 or(select count(distinct e->>'role')from jsonb_array_elements(p_sources)e)<>jsonb_array_length(p_sources)then raise exception 'media source roles invalid'using errcode='23514';end if;
 -- A source's kind and dimensions are release inputs too. Asset locks are
 -- acquired only by frame create/save, before any playlist row lock exists.
 perform a.id from public.media_assets a join jsonb_array_elements(p_sources)e on a.tenant_id=p_tenant_id and a.id=(e->>'mediaAssetId')::uuid order by a.id for share of a;
 -- Sorted variant row locks precede fingerprint reads and references. A
 -- concurrent non-key checksum update therefore cannot pass between them.
 perform v.id from public.media_variants v join jsonb_array_elements(p_sources)e on v.tenant_id=p_tenant_id and v.id=(e->>'variantId')::uuid order by v.id for share of v;
 for expected_source in select *from jsonb_array_elements(p_sources)loop
   role_name:=expected_source->>'role';
   if jsonb_typeof(expected_source)is distinct from 'object'or(select count(*)from jsonb_object_keys(expected_source))<>5 or not expected_source?&array['role','mediaAssetId','variantId','checksumSha256','byteSize']or role_name not in('media','background')
   or jsonb_typeof(expected_source->'mediaAssetId')is distinct from 'string'or jsonb_typeof(expected_source->'variantId')is distinct from 'string'or jsonb_typeof(expected_source->'checksumSha256')is distinct from 'string'or expected_source->>'checksumSha256'!~'^[a-f0-9]{64}$'
   or jsonb_typeof(expected_source->'byteSize')is distinct from 'number'or(expected_source->>'byteSize')::numeric not between 1 and 9007199254740991 or trunc((expected_source->>'byteSize')::numeric)<>(expected_source->>'byteSize')::numeric then raise exception 'source fingerprint invalid'using errcode='23514';end if;
   if(role_name='media'and(expected_source->>'mediaAssetId')::uuid<>p_source_asset_id)
   or(role_name='background'and(p_settings#>>'{appearance,background,kind}'<>'image'or(expected_source->>'mediaAssetId')::uuid<>(p_settings#>>'{appearance,background,mediaAssetId}')::uuid))then raise exception 'source does not match selected media'using errcode='23514';end if;
   actual:=private.media_frame_source_v1(p_tenant_id,(expected_source->>'mediaAssetId')::uuid);
   if actual is null or(role_name='background'and actual->>'kind'<>'image')or(actual#>>'{variant,variantId}')::uuid<>(expected_source->>'variantId')::uuid
   or actual#>>'{variant,checksumSha256}'<>expected_source->>'checksumSha256'or(actual#>>'{variant,byteSize}')::bigint<>(expected_source->>'byteSize')::bigint then raise exception 'verified source changed or unavailable'using errcode='23514';end if;
   -- Preserve the existing playlist source-duration invariant. Invalid authoring
   -- is rejected without clipping or changing playback/trim behavior.
   if role_name='media'and actual->>'kind'='video'and(p_settings->>'durationSeconds')::integer>(actual->>'maximumDurationSeconds')::integer then
     raise exception 'media frame duration exceeds available video source'using errcode='23514';
   end if;
 end loop;
 if(p_settings#>>'{appearance,background,kind}'='image')<>(exists(select 1 from jsonb_array_elements(p_sources)e where e->>'role'='background'))then raise exception 'background fingerprint missing or unexpected'using errcode='23514';end if;
end $$;
revoke all on function private.assert_media_frame_sources_v1(uuid,uuid,jsonb,jsonb)from public,anon,authenticated,service_role;

create function private.insert_media_frame_version_v1(p_tenant_id uuid,p_frame_id uuid,p_version_id uuid,p_number integer,p_settings jsonb,p_sources jsonb)returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.media_frame_versions(id,tenant_id,frame_id,version_number,settings_json,created_by)values(p_version_id,p_tenant_id,p_frame_id,p_number,p_settings,private.current_user_id());
 insert into public.media_frame_version_assets(tenant_id,version_id,role,media_asset_id,variant_id,checksum_sha256,byte_size,storage_bucket,storage_path,mime_type,width,height,duration_seconds)
 select p_tenant_id,p_version_id,e->>'role',v.asset_id,v.id,v.checksum_sha256,v.file_size_bytes,v.storage_bucket,v.storage_path,v.mime_type,v.width,v.height,v.duration_seconds
 from jsonb_array_elements(p_sources)e join public.media_variants v on v.tenant_id=p_tenant_id and v.id=(e->>'variantId')::uuid;
end $$;
revoke all on function private.insert_media_frame_version_v1(uuid,uuid,uuid,integer,jsonb,jsonb)from public,anon,authenticated,service_role;

create function public.create_media_frame_v1(p_tenant_id uuid,p_frame_id uuid,p_source_asset_id uuid,p_expected_sources jsonb,p_settings jsonb,p_idempotency_key uuid,p_is_primary boolean default true)returns jsonb language plpgsql security definer set search_path='' as $$
declare request jsonb;replay jsonb;result jsonb;version_id uuid:=gen_random_uuid();settings jsonb;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.write')then raise exception 'media write permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_frame_id is null or p_source_asset_id is null or p_idempotency_key is null or p_is_primary is null then raise exception 'media frame identity required'using errcode='22023';end if;
 perform private.lock_media_metadata_v1(p_tenant_id);
 request:=jsonb_build_object('frameId',p_frame_id,'sourceAssetId',p_source_asset_id,'expectedSources',p_expected_sources,'settings',p_settings,'isPrimary',p_is_primary);
 replay:=private.begin_publisher_command(p_tenant_id,'media.frame.create.v1',p_idempotency_key,request);if replay is not null then return replay;end if;
 if exists(select 1 from public.media_frames where id=p_frame_id or(p_is_primary and tenant_id=p_tenant_id and source_asset_id=p_source_asset_id and is_primary))then raise exception 'primary media frame already exists; reload current version'using errcode='PT409';end if;
 settings:=jsonb_set(p_settings,'{name}',to_jsonb(btrim(p_settings->>'name')));
 perform private.assert_media_frame_sources_v1(p_tenant_id,p_source_asset_id,settings,p_expected_sources);
 insert into public.media_frames(id,tenant_id,source_asset_id,is_primary,current_version_id,created_by)values(p_frame_id,p_tenant_id,p_source_asset_id,p_is_primary,version_id,private.current_user_id());
 perform private.insert_media_frame_version_v1(p_tenant_id,p_frame_id,version_id,1,settings,p_expected_sources);
 result:=jsonb_build_object('frameId',p_frame_id,'frameRevision',1,'versionId',version_id,'versionNumber',1,'outcome','created');
 return private.complete_publisher_command(p_tenant_id,'media.frame.create.v1',p_idempotency_key,request,'media_frames',p_frame_id,result,'publisher.media.frame.created','success');
end $$;
revoke all on function public.create_media_frame_v1(uuid,uuid,uuid,jsonb,jsonb,uuid,boolean)from public,anon,authenticated,service_role;
grant execute on function public.create_media_frame_v1(uuid,uuid,uuid,jsonb,jsonb,uuid,boolean)to authenticated;

create function public.mutate_media_frame_v1(p_tenant_id uuid,p_frame_id uuid,p_expected_revision integer,p_operation text,p_payload jsonb,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare request jsonb;replay jsonb;result jsonb;frame public.media_frames%rowtype;version public.media_frame_versions%rowtype;
 v_version_id uuid;target_id uuid;number integer;revision integer;outcome text;settings jsonb;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.write')then raise exception 'media write permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_frame_id is null or p_expected_revision is null or p_expected_revision<1 or p_idempotency_key is null or p_operation not in('save','duplicate','archive','restore')or p_operation is null
 or jsonb_typeof(p_payload)is distinct from 'object'or octet_length(p_payload::text)>32768
 or(p_operation='save'and((select count(*)from jsonb_object_keys(p_payload))<>2 or not p_payload?&array['settings','expectedSources']))
 or(p_operation='duplicate'and((select count(*)from jsonb_object_keys(p_payload))<>1 or not p_payload?'newFrameId'))
 or(p_operation in('archive','restore')and p_payload<>'{}'::jsonb)then raise exception 'media frame command invalid'using errcode='22023';end if;
 perform private.lock_media_metadata_v1(p_tenant_id);
 request:=jsonb_build_object('frameId',p_frame_id,'expectedRevision',p_expected_revision,'operation',p_operation,'payload',p_payload);
 replay:=private.begin_publisher_command(p_tenant_id,'media.frame.mutate.v1',p_idempotency_key,request);if replay is not null then return replay;end if;
 select *into frame from public.media_frames where tenant_id=p_tenant_id and id=p_frame_id for update;
 if not found then raise exception 'tenant media frame unavailable'using errcode='P0002';end if;
 if frame.revision<>p_expected_revision then raise exception 'media frame revision changed; reload before saving'using errcode='PT409';end if;
 select *into strict version from public.media_frame_versions where tenant_id=p_tenant_id and frame_id=frame.id and id=frame.current_version_id;
 target_id:=frame.id;v_version_id:=version.id;number:=version.version_number;revision:=frame.revision;outcome:='noop';
 if p_operation in('save','duplicate')and frame.status<>'active'then raise exception 'archived media frame cannot be edited'using errcode='55000';end if;
 if p_operation='save'then
   settings:=jsonb_set(p_payload->'settings','{name}',to_jsonb(btrim(p_payload#>>'{settings,name}')));
   perform private.assert_media_frame_sources_v1(p_tenant_id,frame.source_asset_id,settings,p_payload->'expectedSources');
   v_version_id:=gen_random_uuid();number:=number+1;revision:=revision+1;outcome:='saved';
   perform private.insert_media_frame_version_v1(p_tenant_id,frame.id,v_version_id,number,settings,p_payload->'expectedSources');
   update public.media_frames set current_version_id=v_version_id,revision=frame.revision+1,updated_at=clock_timestamp()where tenant_id=p_tenant_id and id=frame.id;
 elsif p_operation='duplicate'then
   target_id:=(p_payload->>'newFrameId')::uuid;
   if target_id is null then raise exception 'duplicate identity required'using errcode='22023';end if;
   if exists(select 1 from public.media_frames where id=target_id)then raise exception 'duplicate identity already exists'using errcode='PT409';end if;
   v_version_id:=gen_random_uuid();number:=1;revision:=1;outcome:='duplicated';
   insert into public.media_frames(id,tenant_id,source_asset_id,is_primary,current_version_id,created_by)values(target_id,p_tenant_id,frame.source_asset_id,false,v_version_id,private.current_user_id());
   insert into public.media_frame_versions(id,tenant_id,frame_id,version_number,settings_json,created_by)values(v_version_id,p_tenant_id,target_id,1,jsonb_set(version.settings_json,'{name}',to_jsonb(left(version.settings_json->>'name',112)||' (kopie)')),private.current_user_id());
   insert into public.media_frame_version_assets select tenant_id,v_version_id,role,media_asset_id,variant_id,checksum_sha256,byte_size,storage_bucket,storage_path,mime_type,width,height,duration_seconds from public.media_frame_version_assets where tenant_id=p_tenant_id and version_id=version.id;
 elsif(p_operation='archive'and frame.status='active')or(p_operation='restore'and frame.status='archived')then
   revision:=revision+1;outcome:=case when p_operation='archive'then 'archived'else 'restored'end;
   update public.media_frames set status=case when p_operation='archive'then 'archived'else 'active'end,revision=frame.revision+1,updated_at=clock_timestamp()where tenant_id=p_tenant_id and id=frame.id;
 end if;
 result:=jsonb_build_object('frameId',target_id,'frameRevision',revision,'versionId',v_version_id,'versionNumber',number,'outcome',outcome);
 return private.complete_publisher_command(p_tenant_id,'media.frame.mutate.v1',p_idempotency_key,request,'media_frames',target_id,result,'publisher.media.frame.'||p_operation,'success');
end $$;
revoke all on function public.mutate_media_frame_v1(uuid,uuid,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_media_frame_v1(uuid,uuid,integer,text,jsonb,uuid)to authenticated;

-- A pinned version remains usable independently of the frame's current version/status.
create function private.media_frame_version_ready_v1(p_tenant_id uuid,p_version_id uuid)returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media_frame_versions v where v.tenant_id=p_tenant_id and v.id=p_version_id)
 and exists(select 1 from public.media_frame_version_assets r where r.tenant_id=p_tenant_id and r.version_id=p_version_id and r.role='media')
 and not exists(select 1 from public.media_frame_versions f join public.media_frame_version_assets r on r.tenant_id=f.tenant_id and r.version_id=f.id and r.role='media'
 join public.media_assets a on a.tenant_id=r.tenant_id and a.id=r.media_asset_id
 where f.tenant_id=p_tenant_id and f.id=p_version_id and a.kind='video'and(a.duration_seconds is null or(f.settings_json->>'durationSeconds')::integer>greatest(5,least(3600,ceil(a.duration_seconds)::integer))))
 and not exists(select 1 from public.media_frame_version_assets r
 left join public.media_assets a on a.tenant_id=r.tenant_id and a.id=r.media_asset_id
 left join public.media_variants v on v.tenant_id=r.tenant_id and v.asset_id=r.media_asset_id and v.id=r.variant_id
 where r.tenant_id=p_tenant_id and r.version_id=p_version_id and(a.id is null or a.status<>'ready'or a.deleted_at is not null
 or(a.kind='video'and(a.duration_seconds is null or a.duration_seconds<=0 or v.duration_seconds is null or v.duration_seconds<=0))
 or v.id is null or(v.checksum_sha256,v.file_size_bytes,v.storage_bucket,v.storage_path,v.mime_type)is distinct from(r.checksum_sha256,r.byte_size,r.storage_bucket,r.storage_path,r.mime_type)
 or not exists(select 1 from storage.objects o where o.bucket_id=r.storage_bucket and o.name=r.storage_path)));
$$;
revoke all on function private.media_frame_version_ready_v1(uuid,uuid)from public,anon,authenticated,service_role;
create function private.readable_media_frame_version_ready_v1(p_tenant_id uuid,p_version_id uuid)returns boolean language sql stable security definer set search_path='' as $$
 select private.current_user_id()is not null and private.has_tenant_capability(p_tenant_id,'tenant.media.read')and private.media_frame_version_ready_v1(p_tenant_id,p_version_id);
$$;
revoke all on function private.readable_media_frame_version_ready_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function private.readable_media_frame_version_ready_v1(uuid,uuid)to authenticated;

alter table public.playlist_items add column media_frame_id uuid,add column media_frame_version_id uuid,
 add column media_frame_overrides jsonb not null default '{}'::jsonb;
alter table public.playlist_items add constraint playlist_items_media_frame_fk foreign key(tenant_id,media_frame_id,media_frame_version_id)
 references public.media_frame_versions(tenant_id,frame_id,id)on delete restrict,
 add constraint playlist_items_media_frame_consistency check((media_frame_id is null and media_frame_version_id is null and media_frame_overrides='{}'::jsonb)
 or(media_frame_id is not null and media_frame_version_id is not null and dynamic_slide_id is null and youtube_source_id is null and engage_campaign_id is null and sites_configuration_json is null)),
 add constraint playlist_items_media_frame_overrides_check check(jsonb_typeof(media_frame_overrides)='object'and media_frame_overrides<@'{"durationSeconds":true,"fitMode":true,"cropFocusX":true,"cropFocusY":true,"displayTitle":true,"accessibilityName":true,"backgroundColor":true}'::jsonb);
create index playlist_items_media_frame_idx on public.playlist_items(tenant_id,media_frame_id,media_frame_version_id)where media_frame_id is not null;
alter table public.playlist_release_items add column media_frame_provenance_json jsonb;

create function private.guard_media_frame_item_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE'and new.media_asset_id is distinct from old.media_asset_id and(new.media_frame_id,new.media_frame_version_id)is not distinct from(old.media_frame_id,old.media_frame_version_id)then
   new.media_frame_id:=null;new.media_frame_version_id:=null;new.media_frame_overrides:='{}';
 end if;
 if new.media_frame_id is not null then
   perform 1 from public.media_frame_version_assets r join public.media_frame_versions v on v.tenant_id=r.tenant_id and v.id=r.version_id
   where v.tenant_id=new.tenant_id and v.frame_id=new.media_frame_id and v.id=new.media_frame_version_id and r.role='media'and r.media_asset_id=new.media_asset_id;
   if not found then raise exception 'media frame binding does not match placement source'using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_media_frame_item_v1()from public,anon,authenticated,service_role;
create trigger zzzz_media_frame_item_guard before insert or update on public.playlist_items for each row execute function private.guard_media_frame_item_v1();

create function private.freeze_media_frame_release_v1()returns trigger language plpgsql security definer set search_path='' as $$
declare item public.playlist_items%rowtype;version public.media_frame_versions%rowtype;
begin
 -- Client provenance is never authoritative, including a missing source item.
 new.media_frame_provenance_json:=null;
 select *into item from public.playlist_items where tenant_id=new.tenant_id and playlist_id=new.playlist_id and id=new.source_item_id;
 if not found or item.media_frame_id is null then return new;end if;
 select *into strict version from public.media_frame_versions where tenant_id=item.tenant_id and frame_id=item.media_frame_id and id=item.media_frame_version_id;
 if not private.media_frame_version_ready_v1(item.tenant_id,version.id)or not exists(select 1 from public.media_frame_version_assets r
 where r.tenant_id=item.tenant_id and r.version_id=version.id and r.role='media'and r.media_asset_id=new.media_asset_id and r.variant_id=new.media_variant_id
 and(r.checksum_sha256,r.byte_size,r.storage_bucket,r.storage_path)is not distinct from(new.checksum_sha256,new.file_size_bytes,new.storage_bucket,new.storage_path))then raise exception 'pinned media frame source unavailable or changed'using errcode='23514';end if;
 new.media_frame_provenance_json:=jsonb_build_object('schemaVersion',1,'tenantId',item.tenant_id,'frameId',item.media_frame_id,'versionId',version.id,'versionNumber',version.version_number,
 'settings',version.settings_json,'overrides',item.media_frame_overrides,'sourceAssets',(select jsonb_agg(jsonb_build_object('role',r.role,'mediaAssetId',r.media_asset_id,'variantId',r.variant_id,
 'checksumSha256',r.checksum_sha256,'byteSize',r.byte_size,'storageBucket',r.storage_bucket,'storagePath',r.storage_path,'mimeType',r.mime_type,'width',r.width,'height',r.height,'durationSeconds',r.duration_seconds)order by r.role)
 from public.media_frame_version_assets r where r.tenant_id=item.tenant_id and r.version_id=version.id));
 return new;
end $$;
revoke all on function private.freeze_media_frame_release_v1()from public,anon,authenticated,service_role;
create trigger zzzzz_media_frame_release_freeze before insert on public.playlist_release_items for each row execute function private.freeze_media_frame_release_v1();

-- Existing batch protocol, with all previous branches retained.
CREATE OR REPLACE FUNCTION private.s226_conflict_base_mutate_playlist_batch_v1(p_playlist_id uuid, p_expected_revision bigint, p_operations jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  playlist public.playlists%rowtype; item public.playlist_items%rowtype;
  operation jsonb; patch jsonb; payload jsonb; request jsonb; replay jsonb; result jsonb;
  mapping jsonb:='{}'; child_ids jsonb; before_ids uuid[]; ordered_ids uuid[];
  actor uuid:=private.current_user_id(); item_id uuid; client_id uuid; child_key uuid;
  current_revision bigint; ordinal integer:=0; next_sort integer; next_position numeric;
  frame public.media_frames%rowtype;frame_version public.media_frame_versions%rowtype;frame_source public.media_frame_version_assets%rowtype;frame_settings jsonb;
  series_item record; exported record; series_revision bigint; duration integer;series_index integer;
begin
  if p_expected_revision is null or p_expected_revision<0 or p_idempotency_key is null
    or jsonb_typeof(p_operations) is distinct from 'array' or jsonb_array_length(p_operations) not between 1 and 200
    or octet_length(p_operations::text)>262144 then raise exception 'playlist batch exceeds limits' using errcode='22023';end if;
  select * into playlist from public.playlists where id=p_playlist_id for update;
  if not found or actor is null or not private.can_write_playlist(playlist.tenant_id) then raise exception 'actor cannot edit playlist' using errcode='42501';end if;
  perform private.require_active_tenant_command(playlist.tenant_id);
  if playlist.status='archived' then raise exception 'archived playlist cannot be edited' using errcode='23514';end if;
  request:=jsonb_build_object('playlistId',p_playlist_id,'expectedRevision',p_expected_revision,'operations',p_operations);
  replay:=private.begin_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request);
  if replay is not null then return replay;end if;
  if playlist.revision<>p_expected_revision then
    return private.complete_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request,'playlists',playlist.id,
      jsonb_build_object('outcome','conflict','actualRevision',playlist.revision),'publisher.playlist.conflict','failed');
  end if;
  current_revision:=playlist.revision;
  for operation in select * from jsonb_array_elements(p_operations) loop
    ordinal:=ordinal+1;
    child_key:=md5(p_idempotency_key::text||':playlist-batch:'||ordinal)::uuid;
    if operation?'clientId' then
      client_id:=(operation->>'clientId')::uuid;
      if mapping?client_id::text or exists(select 1 from public.playlist_items where id=client_id) then raise exception 'duplicate command-local item identity' using errcode='23514';end if;
    else client_id:=null;end if;
    result:=null;
    if operation->>'operation' in('add_media','add_dynamic','add_youtube','add_engage')then
      duration:=(operation->>'durationSeconds')::integer;
      if duration is null or duration not between 3 and 3600 then raise exception 'duration outside limits'using errcode='23514';end if;
      if client_id is null then raise exception 'new placement requires command identity'using errcode='23514';end if;
    end if;
    item_id:=coalesce(nullif(mapping->>(operation->>'itemId'),'')::uuid,nullif(operation->>'itemId','')::uuid);
    select coalesce(array_agg(id),'{}'::uuid[]) into before_ids from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;

    if operation->>'operation' in('add_media_frame','refresh_media_frame')then
      if operation->>'operation'='add_media_frame'then
        if client_id is null or(select count(*)from jsonb_object_keys(operation))<>4 or not operation?&array['operation','clientId','frameId','expectedVersionId']then raise exception 'media frame placement invalid'using errcode='23514';end if;
        select *into frame from public.media_frames where tenant_id=playlist.tenant_id and id=(operation->>'frameId')::uuid and status='active'for share;
        if not found or frame.current_version_id is distinct from(operation->>'expectedVersionId')::uuid then raise exception 'media frame selection changed; reload library'using errcode='40001';end if;
        select *into strict frame_version from public.media_frame_versions where tenant_id=playlist.tenant_id and frame_id=frame.id and id=frame.current_version_id;
      else
        if(select count(*)from jsonb_object_keys(operation))<>4 or not operation?&array['operation','itemId','expectedPinnedVersionId','versionId']then raise exception 'media frame refresh invalid'using errcode='23514';end if;
        select *into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
        if item.media_frame_id is null or item.media_frame_version_id is distinct from(operation->>'expectedPinnedVersionId')::uuid then raise exception 'pinned media frame placement changed'using errcode='40001';end if;
        select *into frame from public.media_frames where tenant_id=playlist.tenant_id and id=item.media_frame_id and status='active'for share;
        if not found or frame.current_version_id is distinct from(operation->>'versionId')::uuid then raise exception 'media frame refresh selection changed'using errcode='40001';end if;
        select *into strict frame_version from public.media_frame_versions where tenant_id=playlist.tenant_id and frame_id=frame.id and id=frame.current_version_id;
      end if;
      if not private.media_frame_version_ready_v1(playlist.tenant_id,frame_version.id)then raise exception 'media frame has no complete verified sources'using errcode='23514';end if;
      frame_settings:=frame_version.settings_json;
      select *into strict frame_source from public.media_frame_version_assets where tenant_id=playlist.tenant_id and version_id=frame_version.id and role='media';
      if operation->>'operation'='add_media_frame'then
        select coalesce(max(sort_order),-1)+1,coalesce(max(position_key),0)+1024 into next_sort,next_position from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
        insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds,fit_mode,muted,transition,background_color,
          crop_focus_x,crop_focus_y,display_title,accessibility_name,media_frame_id,media_frame_version_id,created_by)
        values(playlist.tenant_id,playlist.id,frame_source.media_asset_id,next_sort,next_position,(frame_settings->>'durationSeconds')::integer,frame_settings->>'fitMode',playlist.default_video_muted,playlist.default_transition,null,
          case frame_settings->>'focus'when 'left'then 0 when 'right'then 1 else 0.5 end,case frame_settings->>'focus'when 'top'then 0 when 'bottom'then 1 else 0.5 end,
          frame_settings->>'name',frame_settings->>'name',frame.id,frame_version.id,actor)returning id into item_id;
        mapping:=mapping||jsonb_build_object(client_id::text,item_id);
      else
        update public.playlist_items set media_frame_version_id=frame_version.id,
          duration_seconds=case when media_frame_overrides?'durationSeconds'then duration_seconds else(frame_settings->>'durationSeconds')::integer end,
          fit_mode=case when media_frame_overrides?'fitMode'then fit_mode else frame_settings->>'fitMode'end,
          crop_focus_x=case when media_frame_overrides?'cropFocusX'then crop_focus_x else case frame_settings->>'focus'when 'left'then 0 when 'right'then 1 else 0.5 end end,
          crop_focus_y=case when media_frame_overrides?'cropFocusY'then crop_focus_y else case frame_settings->>'focus'when 'top'then 0 when 'bottom'then 1 else 0.5 end end,
          display_title=case when media_frame_overrides?'displayTitle'then display_title else frame_settings->>'name'end,
          accessibility_name=case when media_frame_overrides?'accessibilityName'then accessibility_name else frame_settings->>'name'end,
          background_color=case when media_frame_overrides?'backgroundColor'then background_color else null end
        where tenant_id=playlist.tenant_id and id=item.id;
      end if;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now()where id=playlist.id;
    elsif operation->>'operation'='add_media' then
      duration:=(operation->>'durationSeconds')::integer;
      if duration not between 3 and 3600 then raise exception 'duration outside limits' using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
        where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready' and asset.deleted_at is null and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$';
      if not found then raise exception 'media has no verified playback variant' using errcode='23514';end if;
      select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'add_item',
        jsonb_build_object('mediaAssetId',operation->>'mediaAssetId','durationSeconds',greatest(5,duration),'fitMode',playlist.default_fit_mode,'muted',playlist.default_video_muted)) command;
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration,fit_mode=playlist.default_fit_mode,muted=playlist.default_video_muted,transition=playlist.default_transition,background_color=playlist.default_background_color where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_dynamic' then
      -- The library selection names the immutable snapshot the user reviewed.
      perform 1 from public.dynamic_slides where tenant_id=playlist.tenant_id and id=(operation->>'dynamicSlideId')::uuid and current_snapshot_id=(operation->>'expectedSnapshotId')::uuid for share;
      if not found then raise exception 'dynamic selection changed; reload library' using errcode='40001';end if;
      perform 1 from public.dynamic_slide_snapshots snapshot
        join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready' and asset.deleted_at is null
        join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original' and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
        where snapshot.tenant_id=playlist.tenant_id and snapshot.dynamic_slide_id=(operation->>'dynamicSlideId')::uuid and snapshot.id=(operation->>'expectedSnapshotId')::uuid and snapshot.status='ready';
      if not found then raise exception 'dynamic selection has no verified output; nothing added'using errcode='23514';end if;
      result:=public.add_dynamic_slide_to_playlist_v2(playlist.id,(operation->>'dynamicSlideId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_youtube' then
      result:=public.add_youtube_source_to_playlist_v1(playlist.id,(operation->>'sourceId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_engage' then
      result:=public.add_engage_campaign_to_playlist_v1(playlist.id,(operation->>'campaignId')::uuid,(operation->>'fallbackAssetId')::uuid,current_revision,greatest(5,duration),child_key);
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      update public.playlist_items set duration_seconds=duration where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='add_studio_series' then
      select revision into series_revision from public.studio_series where tenant_id=playlist.tenant_id and id=(operation->>'seriesId')::uuid and status='active' for share;
      if series_revision is distinct from (operation->>'expectedSeriesRevision')::bigint then raise exception 'Studio series changed; reload library' using errcode='40001';end if;
      perform project.id from public.studio_series_items member join public.studio_projects project on project.tenant_id=member.tenant_id and project.id=member.project_id join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id where member.tenant_id=playlist.tenant_id and member.series_id=(operation->>'seriesId')::uuid order by project.id for share of project,draft;
      child_ids:='[]';series_index:=0;
      if jsonb_typeof(operation->'clientItemIds')is distinct from 'array' or jsonb_array_length(operation->'clientItemIds')not between 1 and 20 or(select count(distinct value)from jsonb_array_elements_text(operation->'clientItemIds'))<>jsonb_array_length(operation->'clientItemIds') then raise exception 'invalid series command identities'using errcode='23514';end if;
      for series_item in select project_id from public.studio_series_items where tenant_id=playlist.tenant_id and series_id=(operation->>'seriesId')::uuid order by sort_order loop
        select export.media_asset_id,coalesce(export.duration_seconds,project.duration_ms/1000.0) as duration_seconds into exported
          from public.studio_projects project join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
          join public.studio_revisions revision on revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.draft_revision=draft.draft_revision
          join public.studio_exports export on export.tenant_id=revision.tenant_id and export.project_id=revision.project_id and export.revision_id=revision.id
          join public.media_assets asset on asset.tenant_id=export.tenant_id and asset.id=export.media_asset_id
          join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=export.checksum_sha256
          where project.tenant_id=playlist.tenant_id and project.id=series_item.project_id and project.status='active' and asset.status='ready' and asset.deleted_at is null
          order by export.created_at desc limit 1;
        if not found then raise exception 'Studio series has an incomplete current export; nothing added' using errcode='23514';end if;
        select coalesce(array_agg(id),'{}'::uuid[]) into before_ids from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
        select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'add_item',jsonb_build_object('mediaAssetId',exported.media_asset_id,'durationSeconds',greatest(5,ceil(exported.duration_seconds)::integer),'fitMode','contain','muted',true)) command;
        select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
        update public.playlist_items set duration_seconds=greatest(3,ceil(exported.duration_seconds)::integer),fit_mode='contain',muted=true,transition=playlist.default_transition,background_color=playlist.default_background_color where id=item_id;
        client_id:=(operation#>>array['clientItemIds',series_index::text])::uuid;
        if client_id is null or mapping?client_id::text or exists(select 1 from public.playlist_items where id=client_id)then raise exception 'duplicate series command identity'using errcode='23514';end if;
        mapping:=mapping||jsonb_build_object(client_id::text,item_id);series_index:=series_index+1;
        child_ids:=child_ids||jsonb_build_array(item_id);
        select revision into current_revision from public.playlists where id=playlist.id;
      end loop;
      if jsonb_array_length(child_ids)=0 or series_index<>jsonb_array_length(operation->'clientItemIds') then raise exception 'Studio series count changed' using errcode='40001';end if;
    elsif operation->>'operation'='duplicate' then
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'duplicate_item',jsonb_build_object('itemId',item_id),child_key);
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id;
      select id into strict item_id from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and not(id=any(before_ids));
      -- The established command copies presentation; retain the later source contracts too.
      update public.playlist_items set sites_configuration_json=item.sites_configuration_json,
        dynamic_slide_id=item.dynamic_slide_id,dynamic_snapshot_id=item.dynamic_snapshot_id,dynamic_selection_mode=item.dynamic_selection_mode,
        youtube_source_id=item.youtube_source_id,engage_campaign_id=item.engage_campaign_id,
        media_frame_id=item.media_frame_id,media_frame_version_id=item.media_frame_version_id,media_frame_overrides=item.media_frame_overrides where id=item_id;
      mapping:=mapping||jsonb_build_object(client_id::text,item_id);
    elsif operation->>'operation'='replace_media' then
      -- The established guarded replacement preserves every presentation field.
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if item.dynamic_slide_id is not null or item.youtube_source_id is not null or item.engage_campaign_id is not null then raise exception 'a live binding cannot be replaced by a static render' using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
        where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready' and asset.deleted_at is null and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$';
      if not found then raise exception 'replacement has no verified playback variant' using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'replace_item',jsonb_build_object('itemId',item_id,'mediaAssetId',operation->>'mediaAssetId'),child_key);
      update public.playlist_items set media_frame_id=null,media_frame_version_id=null,media_frame_overrides='{}'where tenant_id=playlist.tenant_id and id=item_id;
    elsif operation->>'operation'='replace_fallback' then
      select *into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      if ((operation->>'sourceKind'='youtube'and item.youtube_source_id=(operation->>'sourceId')::uuid)or(operation->>'sourceKind'='engage'and item.engage_campaign_id=(operation->>'sourceId')::uuid))is distinct from true or item.dynamic_slide_id is not null then raise exception 'fallback source binding changed'using errcode='23514';end if;
      perform 1 from public.media_assets asset join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
       and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
       and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
      where asset.tenant_id=playlist.tenant_id and asset.id=(operation->>'mediaAssetId')::uuid and asset.status='ready'and asset.deleted_at is null
       and(asset.kind='image'or(asset.kind='video'and exists(
        select 1 from public.studio_exports source_export join public.studio_revisions revision on revision.tenant_id=source_export.tenant_id and revision.id=source_export.revision_id
        where source_export.tenant_id=asset.tenant_id and source_export.media_asset_id=asset.id and source_export.output_kind='mp4'
         and source_export.checksum_sha256=variant.checksum_sha256 and revision.document_json#>>'{syncPresentation,family}'='youtube'
         and revision.document_json#>>'{syncPresentation,rendererVersion}'='sync-v1')))
       and not exists(select 1 from public.dynamic_slide_snapshots snapshot where snapshot.tenant_id=asset.tenant_id and snapshot.output_media_asset_id=asset.id and snapshot.status='ready');
      if not found then raise exception 'fallback image has no verified playback variant'using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'replace_item',jsonb_build_object('itemId',item_id,'mediaAssetId',operation->>'mediaAssetId'),child_key);
    elsif operation->>'operation'='add_sync_dynamic' then
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
    elsif operation->>'operation'='refresh_dynamic' then
      -- This is an explicit authoring choice. Background data refresh never calls it.
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      perform 1 from public.dynamic_slides slide join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=slide.tenant_id and snapshot.dynamic_slide_id=slide.id and snapshot.id=slide.current_snapshot_id
        join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id and asset.status='ready' and asset.deleted_at is null
        join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type='original' and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$'
        where slide.tenant_id=playlist.tenant_id and slide.id=item.dynamic_slide_id and slide.status='ready' and snapshot.status='ready' and snapshot.id=(operation->>'expectedSnapshotId')::uuid for share of slide,snapshot;
      if not found then raise exception 'dynamic selection changed; reload library' using errcode='40001';end if;
      update public.playlist_items target set dynamic_snapshot_id=snapshot.id,media_asset_id=snapshot.output_media_asset_id from public.dynamic_slide_snapshots snapshot where target.id=item.id and snapshot.tenant_id=playlist.tenant_id and snapshot.id=(operation->>'expectedSnapshotId')::uuid;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    elsif operation->>'operation'='remove' then
      select to_jsonb(command) into result from public.mutate_playlist_draft_v1(playlist.id,current_revision,'remove_item',jsonb_build_object('itemId',item_id)) command;
    elsif operation->>'operation'='patch' then
      select * into strict item from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id and id=item_id for update;
      patch:=operation->'patch';
      if jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb or exists(select 1 from jsonb_object_keys(patch) key where key not in('durationSeconds','displayTitle','accessibilityName','enabled','muted','fitMode','transition','cropFocusX','cropFocusY','backgroundColor','volumePercent','trimStartSeconds','trimEndSeconds','visibleFrom','visibleUntil','sitesConfiguration')) then raise exception 'unsupported partial item patch' using errcode='22023';end if;
      payload:=jsonb_build_object('itemId',item.id,'durationSeconds',item.duration_seconds,'displayTitle',item.display_title,'accessibilityName',item.accessibility_name,'enabled',item.enabled,'muted',item.muted,'fitMode',item.fit_mode,'transition',item.transition,'cropFocusX',item.crop_focus_x,'cropFocusY',item.crop_focus_y,'backgroundColor',item.background_color,'volumePercent',item.volume_percent,'trimStartSeconds',item.trim_start_seconds,'trimEndSeconds',item.trim_end_seconds,'visibleFrom',item.visible_from,'visibleUntil',item.visible_until)||(patch-'sitesConfiguration');
      duration:=(payload->>'durationSeconds')::integer;
      if duration not between 3 and 3600 then raise exception 'duration outside limits' using errcode='23514';end if;
      result:=public.mutate_playlist_draft_v2(playlist.id,current_revision,'update_item_presentation',jsonb_set(payload,'{durationSeconds}',to_jsonb(greatest(5,duration))),child_key);
      if patch?'sitesConfiguration' and patch->'sitesConfiguration'<>'null'::jsonb then
        if not private.sites_configuration_is_valid_v1(patch->'sitesConfiguration') then raise exception 'placement configuration invalid'using errcode='23514';end if;
        if patch#>>'{sitesConfiguration,schemaVersion}' is distinct from '1' or not private.sites_presentation_identity_is_valid_v2(patch#>>'{sitesConfiguration,rendererVersion}',patch#>>'{sitesConfiguration,sourceRevision}') or patch#>>'{sitesConfiguration,themeId}' not in('fieldflow','onzetrots-tv') then raise exception 'placement configuration identity invalid' using errcode='23514';end if;
        perform private.assert_sites_assets_v1(playlist.tenant_id,patch->'sitesConfiguration');
      end if;
      update public.playlist_items set duration_seconds=duration,
        sites_configuration_json=case when patch?'sitesConfiguration' then nullif(patch->'sitesConfiguration','null'::jsonb) else sites_configuration_json end,
        media_frame_overrides=case when media_frame_id is null then '{}'::jsonb else item.media_frame_overrides||coalesce((select jsonb_object_agg(key,true)from jsonb_object_keys(patch)key where key in('durationSeconds','fitMode','cropFocusX','cropFocusY','displayTitle','accessibilityName','backgroundColor')),'{}'::jsonb)end where id=item.id;
    elsif operation->>'operation'='reorder' then
      select coalesce(array_agg(coalesce(nullif(mapping->>value,'')::uuid,value::uuid) order by ordinality),'{}'::uuid[]) into ordered_ids from jsonb_array_elements_text(operation->'itemIds') with ordinality;
      if cardinality(ordered_ids)<>cardinality(before_ids) or cardinality(ordered_ids)<>(select count(distinct id) from unnest(ordered_ids) id) or not(ordered_ids @> before_ids and ordered_ids <@ before_ids) then raise exception 'order must contain each current item exactly once' using errcode='23514';end if;
      select coalesce(max(sort_order),0)+cardinality(ordered_ids)+1 into next_sort from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      update public.playlist_items set sort_order=sort_order+next_sort where tenant_id=playlist.tenant_id and playlist_id=playlist.id;
      update public.playlist_items target set sort_order=ordering.ordinality-1,position_key=ordering.ordinality*1024 from unnest(ordered_ids) with ordinality ordering(id,ordinality) where target.tenant_id=playlist.tenant_id and target.playlist_id=playlist.id and target.id=ordering.id;
      update public.playlists set status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    elsif operation->>'operation'='details' then
      if length(btrim(operation->>'name')) not between 2 and 120 or length(coalesce(operation->>'description',''))>500 then raise exception 'playlist details outside limits' using errcode='23514';end if;
      update public.playlists set name=btrim(operation->>'name'),description=nullif(btrim(operation->>'description'),''),status='draft',revision=revision+1,updated_by=actor,updated_at=now() where id=playlist.id;
    else raise exception 'unsupported playlist batch operation' using errcode='22023';end if;
    if result->>'outcome'='conflict' then raise exception 'playlist batch revision changed; all changes rolled back' using errcode='40001';end if;
    select revision into current_revision from public.playlists where id=playlist.id;
    if (select count(*) from public.playlist_items where tenant_id=playlist.tenant_id and playlist_id=playlist.id)>1000 then raise exception 'playlist item limit exceeded' using errcode='23514';end if;
  end loop;
  return private.complete_publisher_command(playlist.tenant_id,'playlist.batch.v1',p_idempotency_key,request,'playlists',playlist.id,jsonb_build_object('outcome','applied','actualRevision',current_revision,'itemIds',mapping),'publisher.playlist.batch.saved','success');
end $function$;

-- Authenticate and scope before the shared tenant mutex and playlist row lock.
create or replace function public.mutate_playlist_batch_v1(p_playlist_id uuid,p_expected_revision bigint,p_operations jsonb,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 select tenant_id into tenant from public.playlists where id=p_playlist_id;
 if tenant is null or private.current_user_id()is null or not private.can_write_playlist(tenant)then raise exception 'actor cannot edit playlist'using errcode='42501';end if;
 perform private.require_active_tenant_command(tenant);
 perform private.lock_media_metadata_v1(tenant);
 return private.s226_conflict_base_mutate_playlist_batch_v1(p_playlist_id,p_expected_revision,p_operations,p_idempotency_key);
exception when serialization_failure then raise exception using errcode='PT409',message='De versie is intussen gewijzigd. Herlaad de actuele gegevens en bevestig je keuze opnieuw.';
end $$;
revoke all on function private.s226_conflict_base_mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid)from public,anon,authenticated,service_role;
revoke all on function public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid)from public,anon,service_role;
grant execute on function public.mutate_playlist_batch_v1(uuid,bigint,jsonb,uuid)to authenticated;

-- Serialize a first reference with variant mutation. Referenced variants cannot
-- change even through a worker/service role; unrelated variants remain writable.
create function private.protect_media_frame_variant_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.media_frame_version_assets r where r.tenant_id=old.tenant_id and r.variant_id=old.id)then
   raise exception 'immutable media frame source is retained'using errcode='55000';
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
revoke all on function private.protect_media_frame_variant_v1()from public,anon,authenticated,service_role;
create trigger media_variants_retain_frame_source before update or delete on public.media_variants for each row execute function private.protect_media_frame_variant_v1();

-- Preserve the prior upload-session authority for exactly its current owner,
-- tenant, asset, bucket/path and unexpired pending session. This does not grant
-- any new Storage operation; the existing permissive policies still apply.
create function private.media_frame_storage_actor_allowed_v1(p_tenant_id uuid,p_bucket text,p_name text)returns boolean language sql stable security definer set search_path='' as $$
 select private.current_user_id()is not null and(private.has_tenant_capability(p_tenant_id,'tenant.media.write')or exists(
 select 1 from public.media_upload_sessions s where s.tenant_id=p_tenant_id and s.asset_id=private.storage_object_asset_id(p_name)
 and s.storage_bucket=p_bucket and s.storage_path=p_name and s.created_by=private.current_user_id()and s.status='pending'and s.expires_at>now()));
$$;
revoke all on function private.media_frame_storage_actor_allowed_v1(uuid,text,text)from public,anon,authenticated,service_role;

create function private.media_frame_storage_write_allowed_v1(p_bucket text,p_name text)returns boolean language plpgsql volatile security definer set search_path='' as $$
declare tenant uuid;
begin
 if p_bucket<>'tenant-media'then return true;end if;
 tenant:=private.storage_object_tenant_id(p_name);
 if tenant is null then return true;end if;
 -- No foreign tenant mutex can be acquired through a browser policy probe.
 if not private.media_frame_storage_actor_allowed_v1(tenant,p_bucket,p_name)then return false;end if;
 perform private.lock_media_metadata_v1(tenant);
 return not exists(select 1 from public.media_frame_version_assets r where r.tenant_id=tenant and r.storage_bucket=p_bucket and r.media_asset_id=private.storage_object_asset_id(p_name));
end $$;
revoke all on function private.media_frame_storage_write_allowed_v1(text,text)from public,anon,authenticated,service_role;
grant execute on function private.media_frame_storage_write_allowed_v1(text,text)to authenticated;
create policy media_frame_storage_retention_delete on storage.objects as restrictive for delete to authenticated using(private.media_frame_storage_write_allowed_v1(bucket_id,name));
create policy media_frame_storage_retention_update on storage.objects as restrictive for update to authenticated using(private.media_frame_storage_write_allowed_v1(bucket_id,name))with check(private.media_frame_storage_write_allowed_v1(bucket_id,name));

-- Storage's trusted service role bypasses RLS, so the reference guard is also a
-- trigger. Existing non-frame buckets and object semantics are untouched.
create function private.protect_media_frame_storage_v1()returns trigger language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 if old.bucket_id='tenant-media'then
   tenant:=private.storage_object_tenant_id(old.name);
   if tenant is not null then
     if(private.current_user_id()is not null and not private.media_frame_storage_actor_allowed_v1(tenant,old.bucket_id,old.name))or(current_setting('role',true)='authenticated'and private.current_user_id()is null)then raise exception 'media write permission required'using errcode='42501';end if;
     perform private.lock_media_metadata_v1(tenant);
     if exists(select 1 from public.media_frame_version_assets r where r.tenant_id=tenant and r.storage_bucket=old.bucket_id and r.media_asset_id=private.storage_object_asset_id(old.name))then
       raise exception 'immutable media frame source object is retained'using errcode='55000';
     end if;
   end if;
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
revoke all on function private.protect_media_frame_storage_v1()from public,anon,authenticated,service_role;
create trigger media_frame_storage_retain_source before update or delete on storage.objects for each row execute function private.protect_media_frame_storage_v1();

-- Extend the established rich authoring snapshot, preserving every prior key.
alter function private.build_playlist_authoring_snapshot(uuid)rename to build_playlist_authoring_snapshot_before_media_frames;
create function private.build_playlist_authoring_snapshot(p_playlist_id uuid)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_set(snapshot,'{items}',coalesce((select jsonb_agg(document||jsonb_build_object('mediaFrameId',i.media_frame_id,'mediaFrameVersionId',i.media_frame_version_id,'mediaFrameOverrides',i.media_frame_overrides)order by ordinality)
 from jsonb_array_elements(snapshot->'items')with ordinality d(document,ordinality)join public.playlist_items i on i.playlist_id=p_playlist_id and i.id=(document->>'sourceItemId')::uuid),'[]'::jsonb))
 from(select private.build_playlist_authoring_snapshot_before_media_frames(p_playlist_id)as snapshot)s;
$$;
revoke all on function private.build_playlist_authoring_snapshot(uuid),private.build_playlist_authoring_snapshot_before_media_frames(uuid)from public,anon,authenticated,service_role;

-- Preserve bindings through existing authoring copy and restore paths.
CREATE OR REPLACE FUNCTION public.duplicate_playlist_draft_v1(p_source_playlist_id uuid, p_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare copied uuid;source_tenant uuid;
begin
 select tenant_id into source_tenant from public.playlists where id=p_source_playlist_id;
 if not found or not private.can_write_playlist(source_tenant)then raise exception 'actor cannot duplicate this playlist'using errcode='42501';end if;
 perform private.require_active_tenant_command(source_tenant);
 perform private.lock_media_metadata_v1(source_tenant);
 perform 1 from public.playlists where id=p_source_playlist_id for share;
 copied:=public.duplicate_playlist_draft_before_sites_v11(p_source_playlist_id,p_name);
 update public.playlists target set default_image_duration_seconds=source.default_image_duration_seconds,default_transition=source.default_transition,
   default_fit_mode=source.default_fit_mode,default_background_color=source.default_background_color,default_video_muted=source.default_video_muted,loop_enabled=source.loop_enabled
 from public.playlists source where target.id=copied and source.id=p_source_playlist_id and source.tenant_id=target.tenant_id;
 insert into public.playlist_sections(tenant_id,playlist_id,name,position_key,enabled,default_duration_seconds,default_transition,created_by,updated_by)
 select tenant_id,copied,name,position_key,enabled,default_duration_seconds,default_transition,private.current_user_id(),private.current_user_id()
 from public.playlist_sections where tenant_id=source_tenant and playlist_id=p_source_playlist_id order by position_key;
 update public.playlist_items set position_key=position_key+(select coalesce(max(abs(position_key)),0)+1024 from public.playlist_items where playlist_id in(copied,p_source_playlist_id))where tenant_id=source_tenant and playlist_id=copied;
 update public.playlist_items target set position_key=source.position_key,section_id=target_section.id,display_title=source.display_title,transition=source.transition,
   crop_focus_x=source.crop_focus_x,crop_focus_y=source.crop_focus_y,background_color=source.background_color,volume_percent=source.volume_percent,
   trim_start_seconds=source.trim_start_seconds,trim_end_seconds=source.trim_end_seconds,visible_from=source.visible_from,visible_until=source.visible_until,
   enabled=source.enabled,accessibility_name=source.accessibility_name,sites_configuration_json=source.sites_configuration_json,
   dynamic_slide_id=source.dynamic_slide_id,dynamic_snapshot_id=source.dynamic_snapshot_id,dynamic_selection_mode=source.dynamic_selection_mode,
   youtube_source_id=source.youtube_source_id,engage_campaign_id=source.engage_campaign_id,media_frame_id=source.media_frame_id,media_frame_version_id=source.media_frame_version_id,media_frame_overrides=source.media_frame_overrides
 from public.playlist_items source
 left join public.playlist_sections source_section on source_section.tenant_id=source.tenant_id and source_section.playlist_id=source.playlist_id and source_section.id=source.section_id
 left join public.playlist_sections target_section on target_section.tenant_id=source.tenant_id and target_section.playlist_id=copied and target_section.position_key=source_section.position_key
 where source.playlist_id=p_source_playlist_id and target.playlist_id=copied and source.tenant_id=target.tenant_id and source.sort_order=target.sort_order;
 return copied;
end $function$;
CREATE OR REPLACE FUNCTION public.instantiate_tenant_playlist_template_v1(p_template_id uuid, p_name text, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare template public.tenant_playlist_templates%rowtype;result jsonb;request jsonb;replay jsonb;copied uuid;
begin
 select *into template from public.tenant_playlist_templates where id=p_template_id and status='active';
 if not found or not private.can_write_playlist(template.tenant_id)then raise exception 'actor cannot instantiate tenant templates'using errcode='42501';end if;
 perform private.require_active_tenant_command(template.tenant_id);
 perform private.lock_media_metadata_v1(template.tenant_id);
 request:=jsonb_build_object('templateId',p_template_id,'name',p_name);
 replay:=private.begin_publisher_command(template.tenant_id,'tenant_template.instantiate_sites_v1',p_idempotency_key,request);if replay is not null then return replay;end if;
 result:=public.instantiate_tenant_playlist_template_before_sites_v11(p_template_id,p_name,md5(p_idempotency_key::text||':legacy-template')::uuid);
 if result->>'outcome'='created'then
   copied:=(result->>'playlistId')::uuid;
   update public.playlist_items target set sites_configuration_json=nullif(document->'sitesConfiguration','null'::jsonb),
     dynamic_slide_id=nullif(document->>'dynamicSlideId','')::uuid,dynamic_snapshot_id=nullif(document->>'dynamicSnapshotId','')::uuid,
     dynamic_selection_mode=nullif(document->>'dynamicSelectionMode',''),
     youtube_source_id=nullif(document->>'youtubeSourceId','')::uuid,engage_campaign_id=nullif(document->>'engageCampaignId','')::uuid,media_frame_id=nullif(document->>'mediaFrameId','')::uuid,media_frame_version_id=nullif(document->>'mediaFrameVersionId','')::uuid,media_frame_overrides=coalesce(nullif(document->'mediaFrameOverrides','null'::jsonb),'{}'::jsonb)
   from jsonb_array_elements(template.snapshot_json->'items')document
   where target.tenant_id=template.tenant_id and target.playlist_id=copied and target.position_key=(document->>'positionKey')::numeric;
 end if;
 return private.complete_publisher_command(template.tenant_id,'tenant_template.instantiate_sites_v1',p_idempotency_key,request,'playlists',copied,result,'publisher.template.sites_instantiated','success');
end $function$;
CREATE OR REPLACE FUNCTION public.restore_playlist_release_to_draft_v1(p_release_id uuid, p_expected_revision bigint, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tenant uuid; playlist uuid; result jsonb;
begin
 select release.tenant_id,release.playlist_id into tenant,playlist from public.playlist_releases release
 where release.id=p_release_id and private.current_user_id() is not null and private.can_publish_playlist(release.tenant_id);
 if tenant is null then raise exception 'actor cannot restore this release' using errcode='42501';end if;
 perform private.lock_media_metadata_v1(tenant);
 perform 1 from public.tenants where id=tenant for share;
 insert into private.sites_immutable_restore_contexts values(tenant,'playlist',playlist,p_release_id,private.current_user_id(),pg_catalog.pg_backend_pid(),pg_catalog.txid_current());
 result:=public.restore_playlist_release_to_draft_before_sites_pause_v1(p_release_id,p_expected_revision,p_idempotency_key);
 if result->>'outcome'='restored'then
   update public.playlist_items target set media_frame_id=nullif(document->>'mediaFrameId','')::uuid,
     media_frame_version_id=nullif(document->>'mediaFrameVersionId','')::uuid,
     media_frame_overrides=coalesce(nullif(document->'mediaFrameOverrides','null'::jsonb),'{}'::jsonb)
   from public.playlist_release_authoring_snapshots snapshot cross join lateral jsonb_array_elements(snapshot.snapshot_json->'items')document
   where snapshot.tenant_id=tenant and snapshot.release_id=p_release_id and target.tenant_id=tenant and target.playlist_id=playlist and target.position_key=(document->>'positionKey')::numeric;
 end if;
 delete from private.sites_immutable_restore_contexts where tenant_id=tenant and resource_kind='playlist' and resource_id=playlist and source_id=p_release_id and backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.txid_current();
 return result;
end $function$;

alter view public.sync_content_library_v1 rename to sync_content_library_before_media_frames_v1;
create view public.sync_content_library_v1 with(security_invoker=true)as
 select old.*,null::uuid as media_frame_id,null::uuid as media_frame_version_id
 from public.sync_content_library_before_media_frames_v1 old
 where old.kind<>'media'or not exists(select 1 from public.media_frames f where f.tenant_id=old.tenant_id and f.source_asset_id=old.id and f.is_primary)
 union all
 select f.tenant_id,case when f.is_primary then f.source_asset_id else f.id end,
 case when f.is_primary then 'media:'||f.source_asset_id::text else 'media-frame:'||f.id::text end,
 v.settings_json->>'name','media',a.kind::text,
 case when private.readable_media_frame_version_ready_v1(f.tenant_id,v.id)then 'ready'else 'draft'end,f.status='archived',
 v.settings_json->>'orientation',(v.settings_json->>'durationSeconds')::numeric,f.revision::bigint,f.updated_at,a.width,a.height,f.source_asset_id,
 case when f.status='active'and private.readable_media_frame_version_ready_v1(f.tenant_id,v.id)then jsonb_build_object('kind','media_frame','frameId',f.id,'versionId',v.id)end,
 f.id,v.id
 from public.media_frames f join public.media_frame_versions v on v.tenant_id=f.tenant_id and v.frame_id=f.id and v.id=f.current_version_id
 join public.media_assets a on a.tenant_id=f.tenant_id and a.id=f.source_asset_id;
revoke all on public.sync_content_library_v1 from public,anon,authenticated,service_role;
grant select on public.sync_content_library_v1 to authenticated;
comment on view public.sync_content_library_v1 is 'Tenant-RLS invoker library; logical media frame copies retain explicit immutable version identity.';

create function public.get_media_frame_usage_v1(p_tenant_id uuid,p_frame_id uuid)
returns table(usage_type text,resource_id uuid,resource_name text,playlist_id uuid,release_version integer,screen_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.read')then raise exception 'media read permission required'using errcode='42501';end if;
 if not exists(select 1 from public.media_frames f where f.tenant_id=p_tenant_id and f.id=p_frame_id)then raise exception 'tenant media frame unavailable'using errcode='P0002';end if;
 return query
 select 'draft'::text,p.id,p.name,p.id,null::integer,0::bigint from public.playlist_items i join public.playlists p on p.tenant_id=i.tenant_id and p.id=i.playlist_id where i.tenant_id=p_tenant_id and i.media_frame_id=p_frame_id group by p.id,p.name
 union all
 select 'release'::text,r.id,p.name,r.playlist_id,r.version,count(distinct s.id)::bigint
 from public.playlist_release_items i join public.playlist_releases r on r.tenant_id=i.tenant_id and r.id=i.release_id join public.playlists p on p.tenant_id=r.tenant_id and p.id=r.playlist_id
 left join public.screens s on s.tenant_id=r.tenant_id and s.assigned_release_id=r.id
 where i.tenant_id=p_tenant_id and i.media_frame_provenance_json->>'frameId'=p_frame_id::text group by r.id,p.name,r.playlist_id,r.version
 union all
 select 'screen'::text,s.id,s.name,r.playlist_id,r.version,1::bigint
 from public.playlist_release_items i join public.playlist_releases r on r.tenant_id=i.tenant_id and r.id=i.release_id join public.screens s on s.tenant_id=r.tenant_id and s.assigned_release_id=r.id
 where i.tenant_id=p_tenant_id and i.media_frame_provenance_json->>'frameId'=p_frame_id::text group by s.id,s.name,r.playlist_id,r.version order by 1,3;
end $$;
revoke all on function public.get_media_frame_usage_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_media_frame_usage_v1(uuid,uuid)to authenticated;

-- Existing physical-asset archive semantics are retained, with the shared
-- tenant mutex acquired before its asset->playlist row lock sequence.
alter function public.mutate_media_asset_v1(uuid,uuid,text,jsonb,uuid)rename to mutate_media_asset_before_media_frames_v1;
revoke all on function public.mutate_media_asset_before_media_frames_v1(uuid,uuid,text,jsonb,uuid)from public,anon,authenticated,service_role;
create function public.mutate_media_asset_v1(p_tenant_id uuid,p_asset_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.current_user_id()is null or not private.can_write_playlist(p_tenant_id)then raise exception 'actor cannot manage media for this tenant'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 perform private.lock_media_metadata_v1(p_tenant_id);
 return public.mutate_media_asset_before_media_frames_v1(p_tenant_id,p_asset_id,p_operation,p_payload,p_idempotency_key);
end $$;
revoke all on function public.mutate_media_asset_v1(uuid,uuid,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_media_asset_v1(uuid,uuid,text,jsonb,uuid)to authenticated;

-- Preserve all established v2/mobile operations and add binding intent only.
CREATE OR REPLACE FUNCTION public.mutate_playlist_draft_v2(p_playlist_id uuid, p_expected_revision bigint, p_operation text, p_payload jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := private.current_user_id();
  playlist_record public.playlists%rowtype;
  item_record public.playlist_items%rowtype;
  section_record public.playlist_sections%rowtype;
  media_record public.media_assets%rowtype;
  normalized_operation text := btrim(coalesce(p_operation, ''));
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  item_id uuid;
  media_asset_id uuid;
  target_section_id uuid;
  target_position integer;
  item_count integer;
  offset_value integer;
  new_position_key numeric(30, 10);
  previous_position_key numeric(30, 10);
  next_position_key numeric(30, 10);
  actual_revision bigint;
  trim_start numeric(10, 3);
  trim_end numeric(10, 3);
  desired_visible_from timestamptz;
  desired_visible_until timestamptz;
begin
  if p_expected_revision is null or p_expected_revision < 0
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or normalized_operation not in (
      'update_playlist_defaults',
      'update_item_presentation',
      'duplicate_item',
      'replace_item',
      'move_item',
      'create_section',
      'update_section',
      'move_section',
      'delete_section',
      'assign_item_section'
    )
  then
    raise exception 'publisher draft mutation is invalid' using errcode = '22023';
  end if;

  select playlist.* into playlist_record
  from public.playlists playlist
  where playlist.id = p_playlist_id;
  if not found then
    raise exception 'playlist not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not private.can_write_playlist(playlist_record.tenant_id) then
    raise exception 'actor cannot mutate this playlist' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(playlist_record.tenant_id);
  perform private.lock_media_metadata_v1(playlist_record.tenant_id);
  select playlist.* into playlist_record from public.playlists playlist where playlist.id=p_playlist_id for update;
  if playlist_record.status = 'archived'::public.playlist_status then
    raise exception 'archived playlists cannot be changed' using errcode = '23514';
  end if;

  request_json := jsonb_build_object(
    'playlistId', p_playlist_id,
    'expectedRevision', p_expected_revision,
    'operation', normalized_operation,
    'payload', p_payload
  );
  replay := private.begin_publisher_command(
    playlist_record.tenant_id,
    'playlist.draft.v2.' || normalized_operation,
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
      'playlist.draft.v2.' || normalized_operation,
      p_idempotency_key,
      request_json,
      'playlists',
      playlist_record.id,
      outcome,
      'publisher.playlist.conflict',
      'failed'
    );
  end if;

  if normalized_operation = 'update_playlist_defaults' then
    if (p_payload ->> 'defaultImageDurationSeconds')::integer not between 5 and 3600
      or p_payload ->> 'defaultTransition' not in ('cut', 'crossfade', 'wipe')
      or p_payload ->> 'defaultFitMode' not in ('contain', 'cover')
      or (
        nullif(p_payload ->> 'defaultBackgroundColor', '') is not null
        and p_payload ->> 'defaultBackgroundColor' !~ '^#[0-9A-Fa-f]{6}$'
      )
    then
      raise exception 'playlist defaults are invalid' using errcode = '23514';
    end if;

    update public.playlists
    set default_image_duration_seconds = (p_payload ->> 'defaultImageDurationSeconds')::integer,
        default_transition = p_payload ->> 'defaultTransition',
        default_fit_mode = p_payload ->> 'defaultFitMode',
        default_background_color = nullif(p_payload ->> 'defaultBackgroundColor', ''),
        default_video_muted = coalesce((p_payload ->> 'defaultVideoMuted')::boolean, true),
        loop_enabled = coalesce((p_payload ->> 'loopEnabled')::boolean, true)
    where id = playlist_record.id;

  elsif normalized_operation = 'update_item_presentation' then
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      trim_start := coalesce((p_payload ->> 'trimStartSeconds')::numeric, 0);
      trim_end := nullif(p_payload ->> 'trimEndSeconds', '')::numeric;
      desired_visible_from := nullif(p_payload ->> 'visibleFrom', '')::timestamptz;
      desired_visible_until := nullif(p_payload ->> 'visibleUntil', '')::timestamptz;
    exception when invalid_text_representation then
      raise exception 'playlist item presentation is invalid' using errcode = '23514';
    end;

    select item.*
    into item_record
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id
    for update of item;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;
    select asset.* into media_record
    from public.media_assets asset
    where asset.tenant_id = item_record.tenant_id
      and asset.id = item_record.media_asset_id;

    if (p_payload ->> 'durationSeconds')::integer not between 5 and 3600
      or p_payload ->> 'fitMode' not in ('contain', 'cover')
      or p_payload ->> 'transition' not in ('cut', 'crossfade', 'wipe')
      or (p_payload ->> 'cropFocusX')::numeric not between 0 and 1
      or (p_payload ->> 'cropFocusY')::numeric not between 0 and 1
      or (p_payload ->> 'volumePercent')::integer not between 0 and 100
      or trim_start < 0
      or (trim_end is not null and trim_end <= trim_start)
      or (
        media_record.kind = 'video'::public.media_asset_kind
        and media_record.duration_seconds is not null
        and trim_end is not null
        and trim_end > media_record.duration_seconds
      )
      or (
        desired_visible_until is not null
        and desired_visible_from is not null
        and desired_visible_until <= desired_visible_from
      )
      or (
        nullif(p_payload ->> 'displayTitle', '') is not null
        and length(btrim(p_payload ->> 'displayTitle')) not between 2 and 120
      )
      or (
        nullif(p_payload ->> 'backgroundColor', '') is not null
        and p_payload ->> 'backgroundColor' !~ '^#[0-9A-Fa-f]{6}$'
      )
    then
      raise exception 'playlist item presentation is invalid' using errcode = '23514';
    end if;

    update public.playlist_items item
    set duration_seconds = (p_payload ->> 'durationSeconds')::integer,
        fit_mode = p_payload ->> 'fitMode',
        muted = coalesce((p_payload ->> 'muted')::boolean, true),
        display_title = nullif(btrim(p_payload ->> 'displayTitle'), ''),
        transition = p_payload ->> 'transition',
        crop_focus_x = (p_payload ->> 'cropFocusX')::numeric,
        crop_focus_y = (p_payload ->> 'cropFocusY')::numeric,
        background_color = nullif(p_payload ->> 'backgroundColor', ''),
        volume_percent = (p_payload ->> 'volumePercent')::smallint,
        trim_start_seconds = trim_start,
        trim_end_seconds = trim_end,
        visible_from = desired_visible_from,
        visible_until = desired_visible_until,
        enabled = coalesce((p_payload ->> 'enabled')::boolean, true),
        accessibility_name = nullif(btrim(p_payload ->> 'accessibilityName'), '')
    where item.id = item_record.id;

  elsif normalized_operation in ('duplicate_item', 'replace_item') then
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      media_asset_id := nullif(p_payload ->> 'mediaAssetId', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist item command is invalid' using errcode = '23514';
    end;

    select item.* into item_record
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id
    for update;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;

    if normalized_operation = 'replace_item' then
      select asset.* into media_record
      from public.media_assets asset
      where asset.tenant_id = playlist_record.tenant_id
        and asset.id = media_asset_id
        and asset.status = 'ready'::public.media_asset_status
        and asset.deleted_at is null;
      if not found then
        raise exception 'replacement media is not ready in this tenant'
          using errcode = '23514';
      end if;

      update public.playlist_items
      set media_asset_id = media_record.id
      where id = item_record.id;
    else
      select min(item.position_key) into next_position_key
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
        and item.position_key > item_record.position_key;
      new_position_key := case
        when next_position_key is null then item_record.position_key + 1024
        else (item_record.position_key + next_position_key) / 2
      end;

      select count(*)::integer into item_count
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id;
      offset_value := item_count + 1;
      update public.playlist_items item
      set sort_order = item.sort_order + offset_value
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id;

      insert into public.playlist_items (
        tenant_id,
        playlist_id,
        section_id,
        media_asset_id,
        sort_order,
        position_key,
        duration_seconds,
        fit_mode,
        muted,
        display_title,
        transition,
        crop_focus_x,
        crop_focus_y,
        background_color,
        volume_percent,
        trim_start_seconds,
        trim_end_seconds,
        visible_from,
        visible_until,
        enabled,
        accessibility_name,
        created_by
      )
      values (
        item_record.tenant_id,
        item_record.playlist_id,
        item_record.section_id,
        item_record.media_asset_id,
        item_record.sort_order + 1,
        new_position_key,
        item_record.duration_seconds,
        item_record.fit_mode,
        item_record.muted,
        item_record.display_title,
        item_record.transition,
        item_record.crop_focus_x,
        item_record.crop_focus_y,
        item_record.background_color,
        item_record.volume_percent,
        item_record.trim_start_seconds,
        item_record.trim_end_seconds,
        item_record.visible_from,
        item_record.visible_until,
        item_record.enabled,
        item_record.accessibility_name,
        actor_id
      )
      returning id into item_id;

      with ordered as (
        select
          item.id,
          row_number() over (order by item.position_key, item.id) - 1 as new_order
        from public.playlist_items item
        where item.tenant_id = playlist_record.tenant_id
          and item.playlist_id = playlist_record.id
      )
      update public.playlist_items item
      set sort_order = ordered.new_order
      from ordered
      where item.id = ordered.id;
    end if;

  elsif normalized_operation = 'move_item' then
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      target_position := (p_payload ->> 'targetPosition')::integer;
    exception when invalid_text_representation then
      raise exception 'playlist target position is invalid' using errcode = '23514';
    end;

    select item.* into item_record
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id
    for update;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;

    select count(*)::integer into item_count
    from public.playlist_items item
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;
    if target_position < 0 or target_position >= item_count then
      raise exception 'playlist target position is invalid' using errcode = '23514';
    end if;

    select ordered.position_key into previous_position_key
    from (
      select item.position_key,
             row_number() over (order by item.position_key, item.id) - 1 as position
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
        and item.id <> item_record.id
    ) ordered
    where ordered.position = target_position - 1;

    select ordered.position_key into next_position_key
    from (
      select item.position_key,
             row_number() over (order by item.position_key, item.id) - 1 as position
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
        and item.id <> item_record.id
    ) ordered
    where ordered.position = target_position;

    new_position_key := case
      when previous_position_key is null and next_position_key is null then 1024
      when previous_position_key is null then next_position_key / 2
      when next_position_key is null then previous_position_key + 1024
      else (previous_position_key + next_position_key) / 2
    end;

    set constraints public.playlist_items_tenant_playlist_position_key_uq deferred;
    update public.playlist_items
    set position_key = new_position_key
    where id = item_record.id;

    offset_value := item_count + 1;
    update public.playlist_items item
    set sort_order = item.sort_order + offset_value
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id;
    with ordered as (
      select item.id, row_number() over (order by item.position_key, item.id) - 1 as new_order
      from public.playlist_items item
      where item.tenant_id = playlist_record.tenant_id
        and item.playlist_id = playlist_record.id
    )
    update public.playlist_items item
    set sort_order = ordered.new_order
    from ordered
    where item.id = ordered.id;
    set constraints public.playlist_items_tenant_playlist_position_key_uq immediate;

  elsif normalized_operation = 'create_section' then
    if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120 then
      raise exception 'playlist section name is invalid' using errcode = '23514';
    end if;
    select coalesce(max(section.position_key) + 1024, 1024)
    into new_position_key
    from public.playlist_sections section
    where section.tenant_id = playlist_record.tenant_id
      and section.playlist_id = playlist_record.id;
    insert into public.playlist_sections (
      tenant_id, playlist_id, name, position_key, enabled,
      default_duration_seconds, default_transition, created_by, updated_by
    )
    values (
      playlist_record.tenant_id,
      playlist_record.id,
      btrim(p_payload ->> 'name'),
      new_position_key,
      coalesce((p_payload ->> 'enabled')::boolean, true),
      nullif(p_payload ->> 'defaultDurationSeconds', '')::integer,
      nullif(p_payload ->> 'defaultTransition', ''),
      actor_id,
      actor_id
    )
    returning id into target_section_id;

  elsif normalized_operation in ('update_section', 'move_section', 'delete_section') then
    begin
      target_section_id := (p_payload ->> 'sectionId')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist section id is invalid' using errcode = '23514';
    end;
    select section.* into section_record
    from public.playlist_sections section
    where section.tenant_id = playlist_record.tenant_id
      and section.playlist_id = playlist_record.id
      and section.id = target_section_id
    for update;
    if not found then
      raise exception 'playlist section not found' using errcode = 'P0002';
    end if;

    if normalized_operation = 'update_section' then
      if length(btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120
        or (
          nullif(p_payload ->> 'defaultDurationSeconds', '') is not null
          and (p_payload ->> 'defaultDurationSeconds')::integer not between 5 and 3600
        )
        or (
          nullif(p_payload ->> 'defaultTransition', '') is not null
          and p_payload ->> 'defaultTransition' not in ('cut', 'crossfade', 'wipe')
        )
      then
        raise exception 'playlist section settings are invalid' using errcode = '23514';
      end if;
      update public.playlist_sections
      set name = btrim(p_payload ->> 'name'),
          enabled = coalesce((p_payload ->> 'enabled')::boolean, true),
          default_duration_seconds = nullif(p_payload ->> 'defaultDurationSeconds', '')::integer,
          default_transition = nullif(p_payload ->> 'defaultTransition', ''),
          updated_by = actor_id
      where id = section_record.id;
    elsif normalized_operation = 'move_section' then
      target_position := (p_payload ->> 'targetPosition')::integer;
      select count(*)::integer into item_count
      from public.playlist_sections section
      where section.tenant_id = playlist_record.tenant_id
        and section.playlist_id = playlist_record.id;
      if target_position < 0 or target_position >= item_count then
        raise exception 'playlist section target position is invalid' using errcode = '23514';
      end if;
      select ordered.position_key into previous_position_key
      from (
        select section.position_key,
               row_number() over (order by section.position_key, section.id) - 1 as position
        from public.playlist_sections section
        where section.tenant_id = playlist_record.tenant_id
          and section.playlist_id = playlist_record.id
          and section.id <> section_record.id
      ) ordered
      where ordered.position = target_position - 1;
      select ordered.position_key into next_position_key
      from (
        select section.position_key,
               row_number() over (order by section.position_key, section.id) - 1 as position
        from public.playlist_sections section
        where section.tenant_id = playlist_record.tenant_id
          and section.playlist_id = playlist_record.id
          and section.id <> section_record.id
      ) ordered
      where ordered.position = target_position;
      new_position_key := case
        when previous_position_key is null and next_position_key is null then 1024
        when previous_position_key is null then next_position_key / 2
        when next_position_key is null then previous_position_key + 1024
        else (previous_position_key + next_position_key) / 2
      end;
      set constraints all deferred;
      update public.playlist_sections
      set position_key = new_position_key, updated_by = actor_id
      where id = section_record.id;
      set constraints all immediate;
    else
      delete from public.playlist_sections where id = section_record.id;
    end if;

  else
    begin
      item_id := (p_payload ->> 'itemId')::uuid;
      target_section_id := nullif(p_payload ->> 'sectionId', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'playlist item section assignment is invalid' using errcode = '23514';
    end;
    if target_section_id is not null and not exists (
      select 1 from public.playlist_sections section
      where section.tenant_id = playlist_record.tenant_id
        and section.playlist_id = playlist_record.id
        and section.id = target_section_id
    ) then
      raise exception 'playlist section not found' using errcode = 'P0002';
    end if;
    update public.playlist_items item
    set section_id = target_section_id
    where item.tenant_id = playlist_record.tenant_id
      and item.playlist_id = playlist_record.id
      and item.id = item_id;
    if not found then
      raise exception 'playlist item not found' using errcode = 'P0002';
    end if;
  end if;

  update public.playlists
  set revision = revision + 1,
      status = 'draft'::public.playlist_status,
      updated_by = actor_id,
      updated_at = now()
  where id = playlist_record.id
  returning revision into actual_revision;

  -- Legacy v2 and mobile callers retain the same new immutable binding.
  if normalized_operation='duplicate_item'and item_record.media_frame_id is not null then
    update public.playlist_items set media_frame_id=item_record.media_frame_id,media_frame_version_id=item_record.media_frame_version_id,media_frame_overrides=item_record.media_frame_overrides where id=item_id;
  elsif normalized_operation='replace_item'then
    update public.playlist_items set media_frame_id=null,media_frame_version_id=null,media_frame_overrides='{}'where id=item_id;
  elsif normalized_operation='update_item_presentation'and item_record.media_frame_id is not null then
    update public.playlist_items set media_frame_overrides=media_frame_overrides||coalesce((select jsonb_object_agg(key,true)from jsonb_object_keys(p_payload)key where key in('durationSeconds','fitMode','cropFocusX','cropFocusY','displayTitle','accessibilityName','backgroundColor')),'{}'::jsonb)where id=item_id;
  end if;
  outcome := jsonb_strip_nulls(jsonb_build_object(
    'outcome', 'applied',
    'actualRevision', actual_revision,
    'itemId', item_id,
    'sectionId', target_section_id
  ));
  return private.complete_publisher_command(
    playlist_record.tenant_id,
    'playlist.draft.v2.' || normalized_operation,
    p_idempotency_key,
    request_json,
    'playlists',
    playlist_record.id,
    outcome,
    'publisher.playlist.' || normalized_operation
  );
end;
$function$;

-- A frame is bound to existing source facts. Operational labels/lifecycle remain
-- editable; replacing the material source facts of a retained asset does not.
create function private.protect_media_frame_asset_v1()returns trigger language plpgsql security definer set search_path='' as $$
begin
 if(new.kind,new.mime_type,new.storage_bucket,new.storage_path,new.file_size_bytes,new.checksum_sha256,new.width,new.height,new.duration_seconds)
 is distinct from(old.kind,old.mime_type,old.storage_bucket,old.storage_path,old.file_size_bytes,old.checksum_sha256,old.width,old.height,old.duration_seconds)
 and exists(select 1 from public.media_frame_version_assets r where r.tenant_id=old.tenant_id and r.media_asset_id=old.id)then
   raise exception 'immutable media frame source facts are retained'using errcode='55000';
 end if;
 return new;
end $$;
revoke all on function private.protect_media_frame_asset_v1()from public,anon,authenticated,service_role;
create trigger media_assets_retain_frame_source before update on public.media_assets for each row execute function private.protect_media_frame_asset_v1();

-- The playlist picker reads the same logical media library as Content. Source
-- metadata supplies folders/tags/collections/favorites, never logical identity.
create function public.list_publisher_media_frame_library_v1(
 p_tenant_id uuid,p_page_size integer default 50,p_offset integer default 0,p_search text default null,
 p_folder_id uuid default null,p_collection_id uuid default null,p_favorites_only boolean default false)
returns table(asset_id uuid,source_asset_id uuid,media_frame_id uuid,media_frame_version_id uuid,title text,kind public.media_asset_kind,
 file_size_bytes bigint,folder_id uuid,is_favorite boolean,tags jsonb,collections jsonb,total_count bigint,status public.media_asset_status,deleted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.current_user_id();normalized_search text:=nullif(btrim(p_search),'');
begin
 if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.read')then raise exception 'media read permission required'using errcode='42501';end if;
 if p_page_size is null or p_page_size not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 or p_favorites_only is null or length(coalesce(normalized_search,''))>160 then raise exception 'media frame library filters outside limits'using errcode='22023';end if;
 return query
 with filtered as(
 select library.id as logical_id,asset.id as physical_id,library.media_frame_id as frame_id,library.media_frame_version_id as version_id,
 library.title as logical_title,asset.kind as asset_kind,asset.file_size_bytes as source_bytes,asset.folder_id as source_folder,library.updated_at,library.content_key,
 exists(select 1 from public.media_asset_favorites favorite where favorite.tenant_id=asset.tenant_id and favorite.media_asset_id=asset.id and favorite.user_id=actor)as favorite
 from public.sync_content_library_v1 library join public.media_assets asset on asset.tenant_id=library.tenant_id and asset.id=library.preview_asset_id
 where library.tenant_id=p_tenant_id and library.kind='media'and not library.archived and library.status='ready'
 and asset.status='ready'and asset.deleted_at is null and asset.source_kind='user'
 and(library.media_frame_id is not null or private.media_frame_source_v1(p_tenant_id,asset.id)is not null)
 and(p_folder_id is null or asset.folder_id=p_folder_id)
 and(p_collection_id is null or exists(select 1 from public.media_collection_items item join public.media_collections collection on collection.tenant_id=item.tenant_id and collection.id=item.collection_id and collection.status='active'
 where item.tenant_id=asset.tenant_id and item.media_asset_id=asset.id and item.collection_id=p_collection_id))
 and(not p_favorites_only or exists(select 1 from public.media_asset_favorites favorite where favorite.tenant_id=asset.tenant_id and favorite.media_asset_id=asset.id and favorite.user_id=actor))
 and(normalized_search is null or position(lower(normalized_search)in lower(library.title))>0 or position(lower(normalized_search)in lower(asset.original_file_name))>0
 or exists(select 1 from public.media_asset_tags membership join public.media_tags tag on tag.tenant_id=membership.tenant_id and tag.id=membership.tag_id where membership.tenant_id=asset.tenant_id and membership.media_asset_id=asset.id and position(lower(normalized_search)in lower(tag.name))>0)
 or exists(select 1 from public.media_collection_items membership join public.media_collections collection on collection.tenant_id=membership.tenant_id and collection.id=membership.collection_id and collection.status='active'
 where membership.tenant_id=asset.tenant_id and membership.media_asset_id=asset.id and position(lower(normalized_search)in lower(collection.name))>0))),
 counted as(select filtered.*,count(*)over()as matching_count from filtered),
 page as(select *from counted order by updated_at desc,content_key,logical_id limit p_page_size offset p_offset)
 select page.logical_id,page.physical_id,page.frame_id,page.version_id,page.logical_title,page.asset_kind,page.source_bytes,page.source_folder,page.favorite,
 coalesce((select jsonb_agg(jsonb_build_object('name',tag.name)order by lower(tag.name),tag.id)from public.media_asset_tags membership join public.media_tags tag on tag.tenant_id=membership.tenant_id and tag.id=membership.tag_id where membership.tenant_id=p_tenant_id and membership.media_asset_id=page.physical_id),'[]'::jsonb),
 coalesce((select jsonb_agg(jsonb_build_object('name',collection.name)order by lower(collection.name),collection.id)from public.media_collection_items membership join public.media_collections collection on collection.tenant_id=membership.tenant_id and collection.id=membership.collection_id and collection.status='active'where membership.tenant_id=p_tenant_id and membership.media_asset_id=page.physical_id),'[]'::jsonb),
 page.matching_count,'ready'::public.media_asset_status,null::timestamptz from page order by page.updated_at desc,page.content_key,page.logical_id;
end $$;
revoke all on function public.list_publisher_media_frame_library_v1(uuid,integer,integer,text,uuid,uuid,boolean)from public,anon,authenticated,service_role;
grant execute on function public.list_publisher_media_frame_library_v1(uuid,integer,integer,text,uuid,uuid,boolean)to authenticated;
