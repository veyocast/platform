-- S232: explicit, per-member raw-media series. No existing frame/version,
-- source bytes, playlist identity, placement or immutable release is rewritten.
create function private.media_series_utf16_length_v1(p_value text)
returns integer language sql immutable strict security invoker set search_path='' as $$
 select coalesce(sum(case when ascii(c)>65535 then 2 else 1 end),0)::integer
 from regexp_split_to_table(p_value,'') c where c<>'';
$$;
create function private.media_series_utf16_prefix_v1(p_value text,p_units integer)
returns text language plpgsql immutable strict security invoker set search_path='' as $$
declare result text:='';c text;units integer:=0;n integer;
begin
 for c in select regexp_split_to_table(p_value,'')loop
  n:=case when ascii(c)>65535 then 2 else 1 end;
  if units+n>p_units then exit;end if;
  result:=result||c;units:=units+n;
 end loop;
 return result;
end $$;
-- ECMAScript String.trim whitespace/line terminators, including NBSP and BOM.
-- Not locale-dependent POSIX whitespace (which differs for e.g. U+0085).
create function private.media_series_trim_v1(p_value text)
returns text language sql immutable strict security invoker set search_path='' as $$
 select btrim(p_value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function private.media_series_utf16_length_v1(text),private.media_series_utf16_prefix_v1(text,integer),private.media_series_trim_v1(text) from public,anon,authenticated,service_role;

create table public.media_frame_series(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 revision bigint not null default 1 check(revision between 1 and 9007199254740991),
 member_count bigint not null check(member_count between 1 and 2147483648),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create table public.media_frame_series_items(
 tenant_id uuid not null,frame_id uuid not null,series_id uuid not null,
 series_title text not null default '' check(private.media_series_utf16_length_v1(series_title)<=120),
 position integer not null check(position>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(tenant_id,frame_id),unique(tenant_id,series_id,position),
 foreign key(tenant_id,series_id)references public.media_frame_series(tenant_id,id)on delete restrict,
 foreign key(tenant_id,frame_id)references public.media_frames(tenant_id,id)on delete restrict
);
alter table public.media_frame_series enable row level security;
alter table public.media_frame_series_items enable row level security;
create policy media_frame_series_read on public.media_frame_series for select to authenticated
 using(private.has_tenant_capability(tenant_id,'tenant.media.read'));
create policy media_frame_series_items_read on public.media_frame_series_items for select to authenticated
 using(private.has_tenant_capability(tenant_id,'tenant.media.read'));
revoke all on public.media_frame_series,public.media_frame_series_items from public,anon,authenticated,service_role;
grant select on public.media_frame_series,public.media_frame_series_items to authenticated;

create function public.get_media_frame_series_v1(p_tenant_id uuid,p_frame_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.read')then
  raise exception 'media read permission required'using errcode='42501';end if;
 -- One statement snapshot; archived frames keep their historical binding.
 select jsonb_build_object('frameId',f.id,'frameRevision',f.revision,'versionId',v.id,'versionNumber',v.version_number,
  'series',case when i.frame_id is null then null else jsonb_build_object('seriesId',s.id,'seriesRevision',s.revision,
   'seriesTitle',i.series_title,'position',i.position,'memberCount',s.member_count)end)
 into result from public.media_frames f
 join public.media_frame_versions v on v.tenant_id=f.tenant_id and v.frame_id=f.id and v.id=f.current_version_id
 left join public.media_frame_series_items i on i.tenant_id=f.tenant_id and i.frame_id=f.id
 left join public.media_frame_series s on s.tenant_id=i.tenant_id and s.id=i.series_id
 where f.tenant_id=p_tenant_id and f.id=p_frame_id;
 if result is null then raise exception 'tenant media frame unavailable'using errcode='P0002';end if;
 return result;
end $$;
revoke all on function public.get_media_frame_series_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_media_frame_series_v1(uuid,uuid)to authenticated;

create function public.mutate_media_frame_series_v1(
 p_tenant_id uuid,p_frame_id uuid,p_expected_revision integer,p_series_id uuid,
 p_expected_series_revision bigint,p_operation text,p_payload jsonb,p_idempotency_key uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare
 request jsonb;replay jsonb;result jsonb;current_result jsonb;new_result jsonb:=null;
 frame public.media_frames%rowtype;membership public.media_frame_series_items%rowtype;
 header public.media_frame_series%rowtype;bound boolean;was_bound boolean;
 source_id uuid;new_id uuid;settings jsonb;saved_settings jsonb;title text;label text;name_suffix text;copy_name text;
 current_nonce uuid;copy_nonce uuid;position_next integer;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.media.write')then
  raise exception 'media write permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_frame_id is null or p_expected_revision is null or p_expected_revision<0 or p_idempotency_key is null
 or p_operation is null or p_operation not in('save_series','append_series')
 or(p_series_id is null)<>(p_expected_series_revision is null)
 or(p_expected_series_revision is not null and p_expected_series_revision not between 1 and 9007199254740991)
 or jsonb_typeof(p_payload)is distinct from 'object'or octet_length(p_payload::text)>32768 then
  raise exception 'media series command invalid'using errcode='22023';end if;
 if(select count(*)from jsonb_object_keys(p_payload))<>(case when p_operation='append_series'then 5 else 4 end)
 or not p_payload?&array['sourceAssetId','settings','expectedSources','seriesTitle']
 or(p_operation='append_series'and not p_payload?'newFrameId')
 or jsonb_typeof(p_payload->'sourceAssetId')is distinct from 'string'
 or jsonb_typeof(p_payload->'seriesTitle')is distinct from 'string'
 or private.media_series_utf16_length_v1(p_payload->>'seriesTitle')>120
 or jsonb_typeof(p_payload->'settings')is distinct from 'object'
 or jsonb_typeof(p_payload->'expectedSources')is distinct from 'array' then
  raise exception 'media series payload invalid'using errcode='22023';end if;
 begin
  source_id:=(p_payload->>'sourceAssetId')::uuid;
  if p_operation='append_series'then
   if jsonb_typeof(p_payload->'newFrameId')is distinct from 'string'then raise invalid_text_representation;end if;
   new_id:=(p_payload->>'newFrameId')::uuid;
  end if;
 exception when invalid_text_representation then raise exception 'media series identity invalid'using errcode='22023';end;
 if source_id is null or(p_operation='append_series'and(new_id is null or new_id=p_frame_id))then
  raise exception 'media series identity invalid'using errcode='22023';end if;
 settings:=p_payload->'settings';title:=p_payload->>'seriesTitle';
 if not private.media_frame_settings_valid_v1(settings)
 or private.media_series_utf16_length_v1(btrim(settings->>'name'))not between 2 and 120 then
  raise exception 'media frame settings invalid'using errcode='23514';end if;
 perform private.lock_media_metadata_v1(p_tenant_id);
 request:=jsonb_build_object('tenantId',p_tenant_id,'frameId',p_frame_id,'expectedRevision',p_expected_revision,
  'seriesId',p_series_id,'expectedSeriesRevision',p_expected_series_revision,'operation',p_operation,'payload',p_payload);
 replay:=private.begin_publisher_command(p_tenant_id,'media.frame.series.v1',p_idempotency_key,request);
 if replay is not null then return replay;end if;
 -- The same tenant mutex is held by all nested S231 frame commands. The
 -- original parent receipt precedes every mutable binding/status/CAS check.
 select *into frame from public.media_frames where tenant_id=p_tenant_id and id=p_frame_id for update;
 if p_expected_revision=0 then
  if found or exists(select 1 from public.media_frames where id=p_frame_id)then
   raise exception 'media frame identity already exists'using errcode='PT409';end if;
 else
  if not found then raise exception 'tenant media frame unavailable'using errcode='P0002';end if;
  if frame.revision<>p_expected_revision or frame.source_asset_id<>source_id then
   raise exception 'media frame revision or source changed'using errcode='PT409';end if;
 end if;
 select *into membership from public.media_frame_series_items where tenant_id=p_tenant_id and frame_id=p_frame_id for update;
 was_bound:=found;bound:=was_bound;
 if membership.series_id is distinct from p_series_id then
  raise exception 'media series binding changed'using errcode='PT409';end if;
 if bound then
  select *into strict header from public.media_frame_series where tenant_id=p_tenant_id and id=membership.series_id for update;
  if header.revision<>p_expected_series_revision then raise exception 'media series revision changed'using errcode='PT409';end if;
  if header.revision=9007199254740991 then raise exception 'media series revision range exhausted'using errcode='23514';end if;
 end if;
 if p_operation='append_series'and exists(select 1 from public.media_frames where id=new_id)then
  raise exception 'new media frame identity already exists'using errcode='PT409';end if;
 if p_operation='append_series'and bound and header.member_count>=2147483648 then
  raise exception 'media series position range exhausted'using errcode='23514';end if;
 if p_expected_revision=2147483647 then raise exception 'media frame revision range exhausted'using errcode='23514';end if;
 -- Domain-separated deterministic inner keys retain the audited public S231
 -- writer and all its source, bytes/path/hash/duration guards in this same TX.
 current_nonce:=substr(encode(extensions.digest('veyocast:media-series:save:'||p_idempotency_key::text,'sha256'),'hex'),1,32)::uuid;
 copy_nonce:=substr(encode(extensions.digest('veyocast:media-series:copy:'||p_idempotency_key::text,'sha256'),'hex'),1,32)::uuid;
 if p_expected_revision=0 then
  current_result:=public.create_media_frame_v1(p_tenant_id,p_frame_id,source_id,p_payload->'expectedSources',settings,current_nonce,true);
 else
  current_result:=public.mutate_media_frame_v1(p_tenant_id,p_frame_id,p_expected_revision,'save',
   jsonb_build_object('settings',settings,'expectedSources',p_payload->'expectedSources'),current_nonce);
 end if;
 select settings_json into strict saved_settings from public.media_frame_versions
 where tenant_id=p_tenant_id and frame_id=p_frame_id and id=(current_result->>'versionId')::uuid;
 if p_operation='append_series'then
  label:=private.media_series_trim_v1(title);
  if label=''then label:=saved_settings->>'name';end if;
 else label:=title;end if;
 if not bound and(p_operation='append_series'or private.media_series_trim_v1(title)<>'')then
  insert into public.media_frame_series(tenant_id,member_count,created_by)values(p_tenant_id,1,private.current_user_id())returning *into header;
  insert into public.media_frame_series_items(tenant_id,frame_id,series_id,series_title,position)
   values(p_tenant_id,p_frame_id,header.id,label,0)returning *into membership;
  bound:=true;
 elsif bound then
  update public.media_frame_series_items set series_title=label,updated_at=clock_timestamp()
   where tenant_id=p_tenant_id and frame_id=p_frame_id returning *into membership;
 end if;
 if p_operation='append_series'then
  position_next:=header.member_count::integer;
  name_suffix:=' · slide '||(header.member_count+1)::text;
  copy_name:=private.media_series_utf16_prefix_v1(label,120-private.media_series_utf16_length_v1(name_suffix))||name_suffix;
  new_result:=public.create_media_frame_v1(p_tenant_id,new_id,source_id,p_payload->'expectedSources',
   jsonb_set(saved_settings,'{name}',to_jsonb(copy_name)),copy_nonce,false);
  insert into public.media_frame_series_items(tenant_id,frame_id,series_id,series_title,position)
   values(p_tenant_id,new_id,header.id,label,position_next);
  update public.media_frame_series set member_count=member_count+1 where tenant_id=p_tenant_id and id=header.id returning *into header;
 end if;
 if bound and was_bound then
  update public.media_frame_series set revision=revision+1,updated_at=clock_timestamp()
   where tenant_id=p_tenant_id and id=header.id returning *into header;
 end if;
 result:=jsonb_build_object('outcome',case when p_operation='append_series'then 'appended'else 'saved'end,
  'frameId',current_result->'frameId','frameRevision',current_result->'frameRevision','versionId',current_result->'versionId','versionNumber',current_result->'versionNumber',
  'series',case when bound then jsonb_build_object('seriesId',header.id,'seriesRevision',header.revision,
   'seriesTitle',membership.series_title,'position',membership.position,'memberCount',header.member_count)else null end,
  'newFrame',case when new_result is not null then new_result-'outcome'else null end);
 return private.complete_publisher_command(p_tenant_id,'media.frame.series.v1',p_idempotency_key,request,
  'media_frames',p_frame_id,result,'publisher.media.frame.series.'||p_operation,'success');
end $$;
revoke all on function public.mutate_media_frame_series_v1(uuid,uuid,integer,uuid,bigint,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_media_frame_series_v1(uuid,uuid,integer,uuid,bigint,text,jsonb,uuid)to authenticated;
