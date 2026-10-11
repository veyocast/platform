-- Explicit source authoring is atomic and replayable. Provider sync changes
-- health/data only; it never creates authoring versions or changes this CAS.
alter table public.sportlink_connections add column authoring_revision bigint not null default 1 check(authoring_revision>0),
  add column selected_team_codes text[] not null default '{}';
grant select(authoring_revision,selected_team_codes)on public.sportlink_connections to authenticated;
create function private.sportlink_authoring_revision_v1()returns trigger language plpgsql security definer set search_path=''as $$
begin
  new.authoring_revision:=old.authoring_revision+case when row(new.encrypted_client_id,new.encryption_iv,new.encryption_tag,new.detected_club_name,new.selected_team_codes,new.privacy_birthdays_enabled,new.privacy_people_enabled,new.status)is distinct from row(old.encrypted_client_id,old.encryption_iv,old.encryption_tag,old.detected_club_name,old.selected_team_codes,old.privacy_birthdays_enabled,old.privacy_people_enabled,old.status)then 1 else 0 end;
  return new;
end $$;
revoke all on function private.sportlink_authoring_revision_v1()from public,anon,authenticated,service_role;
create trigger sportlink_authoring_revision before update on public.sportlink_connections for each row execute function private.sportlink_authoring_revision_v1();

create table private.source_connection_validations(
 id uuid primary key,tenant_id uuid not null references public.tenants(id)on delete cascade,
 actor_user_id uuid not null references public.profiles(id)on delete cascade,
 provider text not null check(provider in('sportlink','youtube-video')),metadata_json jsonb not null,
 expires_at timestamptz not null default now()+interval '10 minutes',unique(tenant_id,id)
);
create index source_connection_validations_scope_idx on private.source_connection_validations(tenant_id,actor_user_id,expires_at);
alter table private.source_connection_validations enable row level security;
alter table private.source_connection_validations force row level security;
revoke all on private.source_connection_validations from public,anon,authenticated,service_role;
create function public.register_source_connection_validation_v1(p_validation_id uuid,p_tenant_id uuid,p_actor_user_id uuid,p_provider text,p_metadata jsonb)returns void
language plpgsql security definer set search_path=''as $$
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if p_validation_id is null or p_actor_user_id is null or p_provider not in('sportlink','youtube-video')or jsonb_typeof(p_metadata)is distinct from'object'or octet_length(p_metadata::text)>65536 then raise exception 'invalid provider proof'using errcode='23514';end if;
 if not exists(select 1 from public.tenant_memberships where tenant_id=p_tenant_id and user_id=p_actor_user_id)then raise exception 'actor membership required'using errcode='42501';end if;
 if exists(select 1 from jsonb_each(p_metadata)f where f.key<>'teams'and jsonb_typeof(f.value)<>'string')then raise exception 'typed provider strings required'using errcode='23514';end if;
 if p_provider='sportlink'then
  if not(p_metadata?&array['clubName','clientSuffix','ciphertext','iv','tag','teams'])or exists(select 1 from jsonb_object_keys(p_metadata)k where k not in('clubName','clientSuffix','ciphertext','iv','tag','teams'))
   or length(coalesce(p_metadata->>'clubName',''))not between 1 and 200 or(p_metadata->>'clientSuffix')!~'^[A-Za-z0-9_-]{1,8}$'
   or length(coalesce(p_metadata->>'ciphertext',''))not between 8 and 2048 or length(coalesce(p_metadata->>'iv',''))not between 8 and 128 or length(coalesce(p_metadata->>'tag',''))not between 8 and 128
   or jsonb_typeof(p_metadata->'teams')is distinct from'array'or jsonb_array_length(p_metadata->'teams')not between 1 and 250 then raise exception 'invalid Sportlink proof'using errcode='23514';end if;
  if exists(select 1 from jsonb_array_elements(p_metadata->'teams')t where jsonb_typeof(t)is distinct from'object'or not(t?&array['code','name'])or exists(select 1 from jsonb_object_keys(t)k where k not in('code','name'))or jsonb_typeof(t->'code')is distinct from'string'or length(coalesce(t->>'code',''))not between 1 and 200 or jsonb_typeof(t->'name')is distinct from'string'or length(coalesce(t->>'name',''))not between 1 and 160)
    or exists(select 1 from jsonb_array_elements(p_metadata->'teams')t group by t->>'code'having count(*)>1)then raise exception 'invalid team proof'using errcode='23514';end if;
 else
  if not(p_metadata?&array['videoId','title','channelTitle'])or exists(select 1 from jsonb_object_keys(p_metadata)k where k not in('videoId','title','channelTitle'))or(p_metadata->>'videoId')!~'^[A-Za-z0-9_-]{11}$'or length(coalesce(p_metadata->>'title',''))not between 2 and 160 or length(coalesce(p_metadata->>'channelTitle',''))not between 1 and 240 then raise exception 'invalid video proof'using errcode='23514';end if;
 end if;
 delete from private.source_connection_validations where id in(select id from private.source_connection_validations where tenant_id=p_tenant_id and expires_at<now()order by expires_at limit 100);
 insert into private.source_connection_validations(id,tenant_id,actor_user_id,provider,metadata_json)values(p_validation_id,p_tenant_id,p_actor_user_id,p_provider,p_metadata);
end $$;
revoke all on function public.register_source_connection_validation_v1(uuid,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.register_source_connection_validation_v1(uuid,uuid,uuid,text,jsonb)to service_role;

create function public.save_sportlink_connection_v2(p_tenant_id uuid,p_connection_id uuid,p_expected_revision bigint,p_validation_id uuid,p_selected_team_codes jsonb,p_birthdays_enabled boolean,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=private.current_user_id();proof private.source_connection_validations%rowtype;connection public.sportlink_connections%rowtype;request jsonb;result jsonb;saved_id uuid;codes text[];
begin
 if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.manage')then raise exception 'source management required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_expected_revision is null or p_expected_revision<0 or p_birthdays_enabled is null or jsonb_typeof(p_selected_team_codes)is distinct from'array'or jsonb_array_length(p_selected_team_codes)not between 1 and 250 or octet_length(p_selected_team_codes::text)>60000 or exists(select 1 from jsonb_array_elements(p_selected_team_codes)v where jsonb_typeof(v)<>'string'or length(v#>>'{}')not between 1 and 200)or exists(select 1 from jsonb_array_elements_text(p_selected_team_codes)v group by v having count(*)>1)then raise exception 'invalid connection command'using errcode='23514';end if;
 request:=jsonb_build_object('connectionId',p_connection_id,'expectedRevision',p_expected_revision,'validationId',p_validation_id,'teamCodes',p_selected_team_codes,'birthdays',p_birthdays_enabled);
 result:=private.begin_publisher_command(p_tenant_id,'sportlink.connection.save',p_idempotency_key,request);if result is not null then return result;end if;
 select *into proof from private.source_connection_validations where tenant_id=p_tenant_id and id=p_validation_id and actor_user_id=actor and provider='sportlink'and expires_at>now()for update;
 if not found then raise exception 'current provider proof required'using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements_text(p_selected_team_codes)c where not exists(select 1 from jsonb_array_elements(proof.metadata_json->'teams')t where t->>'code'=c))then raise exception 'selected team is not provider verified'using errcode='23514';end if;
 -- Serialize both create and update for the real provider club/source identity.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||':sportlink:'||(proof.metadata_json->>'clubName'),33));
 if p_connection_id is not null then select *into connection from public.sportlink_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'tenant connection unavailable'using errcode='42501';end if;
  if connection.detected_club_name is distinct from proof.metadata_json->>'clubName'then raise exception 'connection club cannot change'using errcode='23514';end if;
 else select c.*into connection from public.sportlink_connections c join public.dynamic_data_sources s on s.tenant_id=c.tenant_id and s.id=c.data_source_id where c.tenant_id=p_tenant_id and s.name='Sportlink · '||(proof.metadata_json->>'clubName')for update of c;end if;
 if coalesce(connection.authoring_revision,0)<>p_expected_revision then
  result:=jsonb_build_object('outcome','conflict','connectionId',connection.id,'actualRevision',coalesce(connection.authoring_revision,0));
  return private.complete_publisher_command(p_tenant_id,'sportlink.connection.save',p_idempotency_key,request,'sportlink_connections',connection.id,result,'sportlink.connection.conflict','failed');end if;
 saved_id:=public.upsert_sportlink_connection_v1(p_tenant_id,'Sportlink · '||(proof.metadata_json->>'clubName'),proof.metadata_json->>'clubName',proof.metadata_json->>'clientSuffix',proof.metadata_json->>'ciphertext',proof.metadata_json->>'iv',proof.metadata_json->>'tag');
 select array_agg(value order by ord)into codes from jsonb_array_elements_text(p_selected_team_codes)with ordinality t(value,ord);
 update public.sportlink_connections set selected_team_codes=codes where tenant_id=p_tenant_id and id=saved_id;
 if p_birthdays_enabled or coalesce(connection.privacy_birthdays_enabled,false)then perform public.activate_sportlink_birthdays_v1(saved_id,p_birthdays_enabled);end if;
 select *into connection from public.sportlink_connections where tenant_id=p_tenant_id and id=saved_id;
 delete from private.source_connection_validations where id=proof.id;
 result:=jsonb_build_object('outcome','saved','connectionId',saved_id,'actualRevision',connection.authoring_revision,'selectedTeamCodes',to_jsonb(connection.selected_team_codes),'birthdaysEnabled',connection.privacy_birthdays_enabled);
 return private.complete_publisher_command(p_tenant_id,'sportlink.connection.save',p_idempotency_key,request,'sportlink_connections',saved_id,result,'sportlink.connection.wizard.saved');
end $$;

alter table public.ledscores_connections add column scoreboard_label text not null default 'Hoofdveld'check(length(scoreboard_label)between 1 and 80);
create function public.save_ledscores_connection_v2(p_tenant_id uuid,p_connection_id uuid,p_expected_revision integer,p_values jsonb,p_mappings jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare request jsonb;result jsonb;saved_id uuid;revision integer;count_value integer;club_id uuid;
begin
 perform private.require_ledscores_capability(p_tenant_id,'tenant.data_source.manage');perform private.require_active_tenant_command(p_tenant_id);
 if jsonb_typeof(p_values)is distinct from'object'or not(p_values?&array['name','clubSlug','status','sportsClubId','scoreboardLabel'])or exists(select 1 from jsonb_object_keys(p_values)k where k not in('name','clubSlug','status','sportsClubId','scoreboardLabel'))or octet_length(p_values::text)>1024 or jsonb_typeof(p_mappings)is distinct from'array'or jsonb_array_length(p_mappings)not between 1 and 50 or octet_length(p_mappings::text)>32768 or p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid LED command'using errcode='23514';end if;
 if exists(select 1 from jsonb_each(p_values)f where(f.key='sportsClubId'and jsonb_typeof(f.value)not in('string','null'))or(f.key<>'sportsClubId'and jsonb_typeof(f.value)<>'string'))or exists(select 1 from jsonb_array_elements(p_mappings)m where jsonb_typeof(m)is distinct from'object'or not(m?&array['teamKey','teamName','side','sportsTeamId'])or exists(select 1 from jsonb_object_keys(m)k where k not in('teamKey','teamName','side','sportsTeamId'))or exists(select 1 from jsonb_each(m)f where(f.key='sportsTeamId'and jsonb_typeof(f.value)not in('string','null'))or(f.key<>'sportsTeamId'and jsonb_typeof(f.value)<>'string')))then raise exception 'invalid typed LED fields'using errcode='23514';end if;
 club_id:=nullif(p_values->>'sportsClubId','')::uuid;
 if club_id is not null and not exists(select 1 from public.sports_clubs where tenant_id=p_tenant_id and id=club_id)then raise exception 'tenant club unavailable'using errcode='23514';end if;
 request:=jsonb_build_object('connectionId',p_connection_id,'expectedRevision',p_expected_revision,'values',p_values,'mappings',p_mappings);
 result:=private.begin_publisher_command(p_tenant_id,'ledscores.connection.save',p_idempotency_key,request);if result is not null then return result;end if;
 result:=public.save_ledscores_connection_v1(p_tenant_id,p_connection_id,p_values->>'name',p_values->>'clubSlug',p_values->>'status',p_expected_revision);
 if result->>'outcome'='conflict'then return private.complete_publisher_command(p_tenant_id,'ledscores.connection.save',p_idempotency_key,request,'ledscores_connections',p_connection_id,result,'ledscores.connection.conflict','failed');end if;
 saved_id:=(result->>'connectionId')::uuid;
 if length(coalesce(p_values->>'scoreboardLabel',''))not between 1 and 80 then raise exception 'invalid scoreboard label'using errcode='23514';end if;
 update public.ledscores_connections set scoreboard_label=p_values->>'scoreboardLabel'where tenant_id=p_tenant_id and id=saved_id;
 count_value:=public.save_ledscores_team_mappings_v1(p_tenant_id,saved_id,p_mappings);
 select c.revision into revision from public.ledscores_connections c where tenant_id=p_tenant_id and id=saved_id;
 result:=public.link_ledscores_club_v2(p_tenant_id,saved_id,club_id,revision);
 if result->>'outcome'='conflict'then raise exception 'atomic club update conflict'using errcode='40001';end if;
 select c.revision into revision from public.ledscores_connections c where tenant_id=p_tenant_id and id=saved_id;
 result:=jsonb_build_object('outcome','saved','connectionId',saved_id,'actualRevision',revision,'mappingCount',count_value);
 return private.complete_publisher_command(p_tenant_id,'ledscores.connection.save',p_idempotency_key,request,'ledscores_connections',saved_id,result,'ledscores.connection.wizard.saved');
end $$;

create function public.save_youtube_video_source_v2(p_tenant_id uuid,p_source_id uuid,p_expected_revision bigint,p_validation_id uuid,p_fallback_media_asset_id uuid,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=private.current_user_id();proof private.source_connection_validations%rowtype;source public.youtube_sources%rowtype;request jsonb;result jsonb;saved_id uuid;actual_revision bigint;
begin
 if actor is null or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.manage')or not private.tenant_feature_enabled_v1(p_tenant_id,'youtube_integration')then raise exception 'YouTube source permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid source revision'using errcode='23514';end if;
 request:=jsonb_build_object('sourceId',p_source_id,'expectedRevision',p_expected_revision,'validationId',p_validation_id,'fallbackAssetId',p_fallback_media_asset_id);
 result:=private.begin_publisher_command(p_tenant_id,'youtube.video.save',p_idempotency_key,request);if result is not null then return result;end if;
 select *into proof from private.source_connection_validations where tenant_id=p_tenant_id and id=p_validation_id and actor_user_id=actor and provider='youtube-video'and expires_at>now()for update;
 if not found then raise exception 'current video provider proof required'using errcode='23514';end if;
 if p_source_id is not null then select *into source from public.youtube_sources where tenant_id=p_tenant_id and id=p_source_id for update;
  if not found then raise exception 'tenant source unavailable'using errcode='42501';end if;
  if source.playlist_id is not null then raise exception 'source kind cannot change'using errcode='23514';end if;
 end if;
 if coalesce(source.revision,0)<>p_expected_revision then return private.complete_publisher_command(p_tenant_id,'youtube.video.save',p_idempotency_key,request,'youtube_sources',source.id,jsonb_build_object('outcome','conflict','actualRevision',coalesce(source.revision,0)),'youtube.video.conflict','failed');end if;
 if not exists(select 1 from public.media_assets a join public.media_variants v on v.tenant_id=a.tenant_id and v.asset_id=a.id where a.tenant_id=p_tenant_id and a.id=p_fallback_media_asset_id and a.status='ready'and a.deleted_at is null and v.variant_type::text=case when a.kind='video'then 'player_1080p'else 'original'end and v.file_size_bytes>0 and v.checksum_sha256~'^[a-f0-9]{64}$')then raise exception 'verified local fallback required'using errcode='23514';end if;
 saved_id:=public.save_youtube_source_v1(p_tenant_id,p_source_id,proof.metadata_json->>'videoId',proof.metadata_json->>'title',proof.metadata_json->>'channelTitle',p_fallback_media_asset_id,true,'verified',null);
 update public.youtube_sources set revision=revision+1 where tenant_id=p_tenant_id and id=saved_id returning revision into actual_revision;
 delete from private.source_connection_validations where id=proof.id;
 result:=jsonb_build_object('outcome','saved','sourceId',saved_id,'actualRevision',actual_revision,'videoCount',1,'unavailableItems',0);
 return private.complete_publisher_command(p_tenant_id,'youtube.video.save',p_idempotency_key,request,'youtube_sources',saved_id,result,'youtube.video.saved');
end $$;
revoke all on function public.save_sportlink_connection_v2(uuid,uuid,bigint,uuid,jsonb,boolean,uuid),public.save_ledscores_connection_v2(uuid,uuid,integer,jsonb,jsonb,uuid),public.save_youtube_video_source_v2(uuid,uuid,bigint,uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_sportlink_connection_v2(uuid,uuid,bigint,uuid,jsonb,boolean,uuid),public.save_ledscores_connection_v2(uuid,uuid,integer,jsonb,jsonb,uuid),public.save_youtube_video_source_v2(uuid,uuid,bigint,uuid,uuid,uuid)to authenticated;
-- One command-owned group per alert. Concepts keep pending screen IDs; only
-- publication changes live routing, following the existing group semantics.
alter table public.screen_groups add column is_internal boolean not null default false;
create table private.ledscores_authoring_target_groups(
 tenant_id uuid not null,alert_id uuid not null,screen_group_id uuid not null,draft_screen_ids uuid[]not null default '{}',
 primary key(tenant_id,alert_id),unique(tenant_id,screen_group_id),
 foreign key(tenant_id,alert_id)references public.ledscores_goal_alerts(tenant_id,id)on delete cascade,
 foreign key(tenant_id,screen_group_id)references public.screen_groups(tenant_id,id)on delete restrict
);
create table private.ledscores_target_write_context(
 backend_pid integer not null,transaction_id bigint not null,tenant_id uuid not null,
 primary key(backend_pid,transaction_id,tenant_id)
);
alter table private.ledscores_authoring_target_groups enable row level security;
alter table private.ledscores_authoring_target_groups force row level security;
alter table private.ledscores_target_write_context enable row level security;
alter table private.ledscores_target_write_context force row level security;
revoke all on private.ledscores_authoring_target_groups,private.ledscores_target_write_context from public,anon,authenticated,service_role;
create function private.guard_ledscores_internal_target_v1()returns trigger language plpgsql security definer set search_path=''as $$
begin
 -- Check both stored and requested rows: a writer in two tenants must not be
 -- able to move a protected membership into an ordinary group in the other.
 if tg_table_name='screen_groups'then
  if tg_op<>'INSERT'and old.is_internal and not exists(select 1 from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=old.tenant_id)then raise exception 'internal LED target is command owned'using errcode='42501';end if;
  if tg_op<>'DELETE'and new.is_internal and not exists(select 1 from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=new.tenant_id)then raise exception 'internal LED target is command owned'using errcode='42501';end if;
 else
  if tg_op<>'INSERT'and exists(select 1 from public.screen_groups where tenant_id=old.tenant_id and id=old.screen_group_id and is_internal)and not exists(select 1 from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=old.tenant_id)then raise exception 'internal LED target is command owned'using errcode='42501';end if;
  if tg_op<>'DELETE'and exists(select 1 from public.screen_groups where tenant_id=new.tenant_id and id=new.screen_group_id and is_internal)and not exists(select 1 from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=new.tenant_id)then raise exception 'internal LED target is command owned'using errcode='42501';end if;
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
revoke all on function private.guard_ledscores_internal_target_v1()from public,anon,authenticated,service_role;
create trigger screen_groups_guard_internal_led_target before insert or update or delete on public.screen_groups for each row execute function private.guard_ledscores_internal_target_v1();
create trigger screen_memberships_guard_internal_led_target before insert or update or delete on public.screen_group_memberships for each row execute function private.guard_ledscores_internal_target_v1();
create function public.save_ledscores_moment_design_v2(p_tenant_id uuid,p_alert_id uuid,p_expected_revision integer,p_values jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');request jsonb;result jsonb;alert public.ledscores_goal_alerts%rowtype;group_id uuid;groups uuid[];screens uuid[];assets uuid[];saved_id uuid;
begin
 perform private.require_active_tenant_command(p_tenant_id);
 if p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_values)is distinct from'object'or octet_length(p_values::text)>100000
  or not(p_values?&array['connectionId','name','priority','durationMs','underlayPolicy','config','groupIds','screenIds','assetIds'])
  or exists(select 1 from jsonb_object_keys(p_values)k where k not in('connectionId','name','priority','durationMs','underlayPolicy','config','groupIds','screenIds','assetIds'))
  or jsonb_typeof(p_values->'config')is distinct from'object'or jsonb_typeof(p_values->'groupIds')is distinct from'array'or jsonb_typeof(p_values->'screenIds')is distinct from'array'or jsonb_typeof(p_values->'assetIds')is distinct from'array'
  or jsonb_array_length(p_values->'groupIds')>49 or jsonb_array_length(p_values->'screenIds')>100 or jsonb_array_length(p_values->'assetIds')>24
  or exists(select 1 from jsonb_each(p_values)f where f.key in('name','connectionId','underlayPolicy')and jsonb_typeof(f.value)<>'string')
  or exists(select 1 from jsonb_each(p_values)f where f.key in('priority','durationMs')and(jsonb_typeof(f.value)<>'number'or(f.value#>>'{}')!~'^[0-9]+$'))then raise exception 'invalid moment command'using errcode='23514';end if;
 request:=jsonb_build_object('alertId',p_alert_id,'expectedRevision',p_expected_revision,'values',p_values);
 result:=private.begin_publisher_command(p_tenant_id,'ledscores.moment.save',p_idempotency_key,request);if result is not null then return result;end if;
 if p_alert_id is not null then
  select *into alert from public.ledscores_goal_alerts where tenant_id=p_tenant_id and id=p_alert_id for update;
  if not found then raise exception 'tenant alert unavailable'using errcode='42501';end if;
  if alert.revision<>p_expected_revision then return private.complete_publisher_command(p_tenant_id,'ledscores.moment.save',p_idempotency_key,request,'ledscores_goal_alerts',p_alert_id,jsonb_build_object('outcome','conflict','actualRevision',alert.revision),'ledscores.moment.conflict','failed');end if;
 end if;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[])into groups from jsonb_array_elements_text(p_values->'groupIds')value;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[])into screens from jsonb_array_elements_text(p_values->'screenIds')value;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[])into assets from jsonb_array_elements_text(p_values->'assetIds')value;
 if exists(select 1 from unnest(groups)g where not exists(select 1 from public.screen_groups where tenant_id=p_tenant_id and id=g and status='active'and not is_internal))or exists(select 1 from unnest(screens)s where not exists(select 1 from public.screens where tenant_id=p_tenant_id and id=s and deleted_at is null and status<>'disabled'))then raise exception 'tenant targets unavailable'using errcode='23514';end if;
 select screen_group_id into group_id from private.ledscores_authoring_target_groups where tenant_id=p_tenant_id and alert_id=p_alert_id for update;
 insert into private.ledscores_target_write_context(backend_pid,transaction_id,tenant_id)values(pg_catalog.pg_backend_pid(),pg_catalog.txid_current(),p_tenant_id)on conflict do nothing;
 if cardinality(screens)>0 then
  if group_id is null then
   group_id:=gen_random_uuid();insert into public.screen_groups(id,tenant_id,name,is_internal,created_by,updated_by)values(group_id,p_tenant_id,'LED direct · '||group_id::text,true,actor,actor);
  end if;groups:=array_append(groups,group_id);
 end if;
 result:=public.save_ledscores_goal_alert_v1(p_tenant_id,p_alert_id,(p_values->>'connectionId')::uuid,p_values->>'name',(p_values->>'priority')::integer,(p_values->>'durationMs')::integer,p_values->>'underlayPolicy',p_values->'config',groups,assets,p_expected_revision);
 if result->>'outcome'<>'saved'then raise exception 'moment save not confirmed'using errcode='40001';end if;
 saved_id:=(result->>'alertId')::uuid;
 if group_id is not null then insert into private.ledscores_authoring_target_groups(tenant_id,alert_id,screen_group_id,draft_screen_ids)values(p_tenant_id,saved_id,group_id,screens)on conflict(tenant_id,alert_id)do update set draft_screen_ids=excluded.draft_screen_ids;end if;
 delete from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=p_tenant_id;
 return private.complete_publisher_command(p_tenant_id,'ledscores.moment.save',p_idempotency_key,request,'ledscores_goal_alerts',saved_id,result||jsonb_build_object('directScreenIds',to_jsonb(screens),'selectedGroupIds',p_values->'groupIds'),'ledscores.moment.wizard.saved');
end $$;
revoke all on function public.save_ledscores_moment_design_v2(uuid,uuid,integer,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_ledscores_moment_design_v2(uuid,uuid,integer,jsonb,uuid)to authenticated;
alter function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid)rename to publish_ledscores_goal_alert_v1_s191_source_base;
revoke all on function public.publish_ledscores_goal_alert_v1_s191_source_base(uuid,uuid,integer,uuid)from public,anon,authenticated,service_role;
create function public.publish_ledscores_goal_alert_v1(p_tenant_id uuid,p_alert_id uuid,p_expected_revision integer,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare target private.ledscores_authoring_target_groups%rowtype;result jsonb;alert_revision integer;
begin
 perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');perform private.require_active_tenant_command(p_tenant_id);
 if not private.has_tenant_capability(p_tenant_id,'tenant.playlist.publish')then raise exception 'publication permission required'using errcode='42501';end if;
 select revision into alert_revision from public.ledscores_goal_alerts where tenant_id=p_tenant_id and id=p_alert_id for update;
 if alert_revision=p_expected_revision then
  select *into target from private.ledscores_authoring_target_groups where tenant_id=p_tenant_id and alert_id=p_alert_id for update;
  if found then
   if exists(select 1 from unnest(target.draft_screen_ids)s where not exists(select 1 from public.screens where tenant_id=p_tenant_id and id=s and deleted_at is null and status<>'disabled'))then raise exception 'direct target unavailable'using errcode='23514';end if;
   insert into private.ledscores_target_write_context(backend_pid,transaction_id,tenant_id)values(pg_catalog.pg_backend_pid(),pg_catalog.txid_current(),p_tenant_id)on conflict do nothing;
   delete from public.screen_group_memberships where tenant_id=p_tenant_id and screen_group_id=target.screen_group_id;
   insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id,created_by)select p_tenant_id,target.screen_group_id,s,private.current_user_id()from unnest(target.draft_screen_ids)s;
  end if;
 end if;
 result:=public.publish_ledscores_goal_alert_v1_s191_source_base(p_tenant_id,p_alert_id,p_expected_revision,p_idempotency_key);
 if result->>'outcome'='conflict'and target.alert_id is not null then raise exception 'atomic publication conflict'using errcode='40001';end if;
 delete from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=p_tenant_id;
 return result;
end $$;
revoke all on function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid)to authenticated;
create function public.get_ledscores_moment_targets_v1(p_tenant_id uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.read')then raise exception 'tenant read permission required'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('alertId',alert_id,'screenIds',to_jsonb(draft_screen_ids)))from private.ledscores_authoring_target_groups where tenant_id=p_tenant_id),'[]'::jsonb);
end $$;
revoke all on function public.get_ledscores_moment_targets_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_ledscores_moment_targets_v1(uuid)to authenticated;
create function public.create_ledscores_sites_live_slide_v2(p_tenant_id uuid,p_connection_id uuid,p_name text,p_configuration jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare connection public.ledscores_connections%rowtype;version_id uuid;request jsonb;result jsonb;requested_orientation text:=p_configuration#>>'{sitesConfiguration,orientation}';
begin
 perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');perform private.require_active_tenant_command(p_tenant_id);
 if jsonb_typeof(p_configuration)is distinct from'object'or octet_length(p_configuration::text)>32768 or exists(select 1 from jsonb_object_keys(p_configuration)k where k not in('liveMatch','sitesConfiguration'))or not private.sites_configuration_is_valid_v1(p_configuration->'sitesConfiguration')or p_configuration#>>'{sitesConfiguration,provider}'is distinct from'led-scores'or p_configuration#>>'{sitesConfiguration,ledMoment}'is distinct from'live'or length(btrim(coalesce(p_name,'')))not between 2 and 120 then raise exception 'invalid live design'using errcode='23514';end if;
 request:=jsonb_build_object('connectionId',p_connection_id,'name',p_name,'configuration',p_configuration);
 result:=private.begin_publisher_command(p_tenant_id,'ledscores.sites.live.create',p_idempotency_key,request);if result is not null then return result;end if;
 select *into connection from public.ledscores_connections where tenant_id=p_tenant_id and id=p_connection_id and status='active';if not found then raise exception 'tenant live connection unavailable'using errcode='23514';end if;
 select current_published_version_id into version_id from public.dynamic_templates where slug='ledscores-live-match-'||requested_orientation and status='published';if version_id is null then raise exception 'canonical live template unavailable'using errcode='23514';end if;
 result:=public.create_dynamic_slide_v1(p_tenant_id,p_name,version_id,connection.data_source_id,'latest',p_configuration);
 result:=result||jsonb_build_object('outcome','created','connectionId',connection.id,'orientation',requested_orientation);
 return private.complete_publisher_command(p_tenant_id,'ledscores.sites.live.create',p_idempotency_key,request,'dynamic_slides',(result->>'slideId')::uuid,result,'ledscores.sites.live.created');
end $$;
revoke all on function public.create_ledscores_sites_live_slide_v2(uuid,uuid,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.create_ledscores_sites_live_slide_v2(uuid,uuid,text,jsonb,uuid)to authenticated;
alter table private.ledscores_target_write_context add column cleanup_group_id uuid;
create function private.archive_ledscores_internal_target_v1()returns trigger language plpgsql security definer set search_path=''as $$
declare group_id uuid;tenant uuid:=case when tg_op='DELETE'then old.tenant_id else new.tenant_id end;
begin
 if tg_op='DELETE'and tg_when='AFTER'then
  select cleanup_group_id into group_id from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=tenant;
  if group_id is not null then
   begin delete from public.screen_groups where tenant_id=tenant and id=group_id and is_internal;exception when foreign_key_violation then null;end;
  end if;
  delete from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=tenant;return old;
 end if;
 if tg_op='UPDATE'and(new.status<>'archived'or old.status='archived')then return new;end if;
 select screen_group_id into group_id from private.ledscores_authoring_target_groups where tenant_id=tenant and alert_id=old.id;
 if group_id is not null then
  insert into private.ledscores_target_write_context(backend_pid,transaction_id,tenant_id,cleanup_group_id)values(pg_catalog.pg_backend_pid(),pg_catalog.txid_current(),tenant,group_id)on conflict(backend_pid,transaction_id,tenant_id)do update set cleanup_group_id=excluded.cleanup_group_id;
  update public.screen_groups set status='archived',archived_at=clock_timestamp()where tenant_id=tenant and id=group_id and is_internal;
  if tg_op='UPDATE'then delete from private.ledscores_target_write_context where backend_pid=pg_catalog.pg_backend_pid()and transaction_id=pg_catalog.txid_current()and tenant_id=tenant;end if;
 end if;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
revoke all on function private.archive_ledscores_internal_target_v1()from public,anon,authenticated,service_role;
create trigger ledscores_archive_internal_target after update of status on public.ledscores_goal_alerts for each row execute function private.archive_ledscores_internal_target_v1();
create trigger ledscores_prepare_internal_target_gc before delete on public.ledscores_goal_alerts for each row execute function private.archive_ledscores_internal_target_v1();
create trigger zz_ledscores_complete_internal_target_gc after delete on public.ledscores_goal_alerts for each row execute function private.archive_ledscores_internal_target_v1();
notify pgrst,'reload schema';
