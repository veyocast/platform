-- S296 uses the established isolated canonical publication fixture.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000000291','Source recovery A','consistency-a'),
 ('10000000-0000-4000-8000-000000000292','Source recovery B','consistency-b');
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('consistency-a','consistency-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000291','consistency-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000292','consistency-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000293','consistency-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000291','Owner A'),('00000000-0000-4000-8000-000000000292','Owner B'),('00000000-0000-4000-8000-000000000293','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000291','tenant_owner'),
 ('10000000-0000-4000-8000-000000000292','00000000-0000-4000-8000-000000000292','tenant_owner'),
 ('10000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000293','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000291','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000292',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000292','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000292');

create function pg_temp.seed() returns jsonb language sql immutable as $$select $seed${"schemaVersion":1,"rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","family":"matchday","orientation":"landscape","theme":"onzetrots-tv","name":"Onze wedstrijddag","club":{"name":"Eigen club","tagline":""},"title":"WEDSTRIJDDAG","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":6,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"rustig","background":"clubmuur","backgroundPosition":"center","font":"Brush","fontChanged":true,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true},"visual":{"schemaVersion":1,"mode":"light","scrollSpeed":"normal","panelOpacity":94},"authoring":{"schemaVersion":1,"visualRevision":"onzetrots-20261024","headerSubtitles":{},"headerTexts":{},"welcomeScalePercent":150}}$seed$::jsonb$$;
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name) select tenant_id,id,'own-club','Own club' from own_source;
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select tenant_id,id,team_id,name,'{"competitionOptions":[{"externalId":"league","poolExternalId":"701","poolName":"C","period":"phase","season":null},{"externalId":"cup","poolExternalId":"702","poolName":"B","period":"cup-phase","season":null}]}'from own_source cross join(values('own-team','Own team'),('own-team-2','Own team 2'))teams(team_id,name);
insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,scores_published,rows_json,metadata)
select tenant_id,id,competition,pool,'unknown',true,'[{"externalId":"own-team","teamName":"Own team","position":1,"played":1,"won":1,"drawn":0,"lost":0,"goalDifference":2,"points":3,"form":["W"]}]',jsonb_build_object('competition',jsonb_build_object('externalId',competition,'period',phase),'pool',jsonb_build_object('externalId',pool,'competitionExternalId',competition))from own_source cross join(values('league','701','phase'),('cup','702','cup-phase'))p(competition,pool,phase);
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,is_home_match)
select s.tenant_id,s.id,f.id,now()+make_interval(days=>f.days),f.status,
 jsonb_build_object('externalId',f.home,'name','Own team','score',2),jsonb_build_object('externalId',f.away,'name','Opponent','score',1),
 '{"externalId":"league","period":"phase","season":null}',jsonb_build_object('externalId',encode(extensions.digest(convert_to('pool-context','UTF8')||decode('00','hex')||convert_to('league|C','UTF8'),'sha256'),'hex'),'name','C','competitionExternalId','league'),true,false
from own_source s cross join(values('home',1,'scheduled','own-team','other'),('away',2,'scheduled','other','own-team'),('internal',3,'scheduled','own-team','own-team-2'),('neutral',2,'scheduled','own-team','other'),('lookalike',1,'scheduled','other','external'),('far',8,'scheduled','own-team','other'),('result-home',-1,'finished','own-team','other'),('result-away',-1,'finished','other','own-team'),('result-internal',-2,'finished','own-team','own-team-2'))f(id,days,status,home,away);
create function pg_temp.context() returns jsonb language sql immutable as $$select '{"providerTeamId":"own-team","competitionSelectionMode":"auto_current","competitionId":null,"phaseId":null,"poolId":null,"seasonId":null}'::jsonb$$;
create function pg_temp.config(family text,kind text,direction text default 'both',days integer default 7)returns jsonb language sql stable as $$
 select jsonb_build_object('schemaVersion',1,'maxItems',200,'context',pg_temp.context(),
 'teamSelection',jsonb_build_object('mode','selected','teamContexts',jsonb_build_array(pg_temp.context()),'matchLocation',direction),
 'syncConfiguration',jsonb_build_object('schemaVersion',1,'kind','dynamic','rendererVersion','sync-onzetrots-v9','sourceRevision','5ba52a657d6d16ad103ba2fb43b8db18aa83715a','slideType',kind,'secondsPerPage',5,'seed',jsonb_set(pg_temp.seed(),'{family}',to_jsonb(family))))
 ||case when kind='sport_program'then jsonb_build_object('blueprintKey',case when family='pool-program'then'sportlink.pool_schedule_next_7_days'else'sportlink.club_schedule_next_7_days'end)
 when kind='sport_results'then jsonb_build_object('blueprintKey',case when family='pool-results'then'sportlink.pool_results_previous_7_days'else'sportlink.club_results_previous_7_days'end)
 when kind='sport_visitor_arrivals'then jsonb_build_object('blueprintKey','sportlink.visitor_arrivals','teamContexts',jsonb_build_array(pg_temp.context()),'arrival',jsonb_build_object('minutesBefore',days*1440,'minutesAfter',0,'emptyBehavior','skip')) else '{}'::jsonb end
$$;
create function pg_temp.dynamic(family text,kind text,direction text default 'both',days integer default 7)returns public.dynamic_slides language sql stable as $$
 select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id','60000000-0000-4000-8000-000000000291','tenant_id',tenant_id,'name','Controlled source','slide_type',kind,'orientation','landscape','data_source_id',data_source_id,'configuration_json',pg_temp.config(family,kind,direction,days)))from own_source where tenant_id='10000000-0000-4000-8000-000000000291'
$$;


create function pg_temp.complete_matches(kind text,records jsonb,observation jsonb default '{}'::jsonb)returns jsonb language plpgsql as $$
declare run_id uuid;source record;result jsonb;
begin
 select *into source from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
 insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
 values(source.tenant_id,source.id,kind,'running','worker:s295',now())returning id into run_id;
 result:=public.complete_sportlink_sync_v5(run_id,'worker:s295','{}','{}','[]','[]',records,'[]','[]',observation);
 return result;
end;$$;
create function pg_temp.scope(complete boolean default true)returns jsonb language sql stable as $$
 select jsonb_build_object('schemaVersion',1,'kind','full','scopes',jsonb_build_array(jsonb_build_object(
 'scope','pool','poolExternalId','701','competitionExternalId','league','phase','phase',
 'fromDate',(now()at time zone'Europe/Amsterdam')::date-7,'throughDate',(now()at time zone'Europe/Amsterdam')::date+7,
 'complete',complete,'resultExternalIds','[]'::jsonb,'programExternalIds','[]'::jsonb)))
$$;
create function pg_temp.program_record()returns jsonb language sql stable as $$
 select jsonb_build_array(jsonb_build_object('externalId','pool-other','startsAt',now()-interval '1 hour','status','scheduled',
 'homeTeam',jsonb_build_object('externalId','foreign-a','name','Foreign A','score',null),
 'awayTeam',jsonb_build_object('externalId','foreign-b','name','Foreign B','score',null),
 'competition',jsonb_build_object('externalId','league','period','phase'),'pool',jsonb_build_object('externalId','701','competitionExternalId','league')))
$$;

create or replace function pg_temp.context()returns jsonb language sql immutable as $$select '{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"league","phaseId":"phase","poolId":"701","seasonId":null}'::jsonb$$;
select set_config('request.jwt.claim.role','service_role',true);
select public.set_sync_dom_rollout_v2('10000000-0000-4000-8000-000000000291',true,repeat('a',40));
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
select 'e2950000-0000-4000-8000-000000000001',source.tenant_id,'Published matchday','sport_match_of_the_day','landscape',template.id,template.current_published_version_id,source.data_source_id,
 pg_temp.config('matchday','sport_match_of_the_day')||'{"syncPlaybackProtocol":2}'::jsonb
from own_source source cross join lateral(select *from public.dynamic_templates where slide_type='sport_match_of_the_day'and orientation='landscape'and status='published'limit 1)template where source.tenant_id='10000000-0000-4000-8000-000000000291';
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,completed_at)
select 'e2950000-0000-4000-8000-000000000002',tenant_id,id,template_version_id,data_source_id,repeat('a',64),private.build_dynamic_snapshot_data(slide),'ready',now()from public.dynamic_slides slide where id='e2950000-0000-4000-8000-000000000001';
update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id='e2950000-0000-4000-8000-000000000002'where dynamic_slide_id='e2950000-0000-4000-8000-000000000001';
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values('e2950000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000291','image','SQL fixture fallback','fixture.png','image/png','ready','tenants/10000000-0000-4000-8000-000000000291/assets/e2950000-0000-4000-8000-000000000003/original.png',100,repeat('b',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select 'e2950000-0000-4000-8000-000000000004',tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id='e2950000-0000-4000-8000-000000000003';
insert into public.playlists(id,tenant_id,name)values('e2950000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000291','Published canary SQL fixture');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e2950000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000291','e2950000-0000-4000-8000-000000000005',1,repeat('c',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select tenant_id,'e2950000-0000-4000-8000-000000000005','e2950000-0000-4000-8000-000000000006',id,'e2950000-0000-4000-8000-000000000004',0,10,'contain',true,kind,title,storage_path,mime_type,file_size_bytes,checksum_sha256,'e2950000-0000-4000-8000-000000000002',true from public.media_assets where id='e2950000-0000-4000-8000-000000000003';
insert into public.screens(id,tenant_id,name,orientation,status,assigned_playlist_id,assigned_release_id)
values('e2950000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000291','SQL canary screen','landscape','active','e2950000-0000-4000-8000-000000000005','e2950000-0000-4000-8000-000000000006');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status)values('e2950000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000291','e2950000-0000-4000-8000-000000000007',repeat('d',64),'paired');

-- Only immutable publication pointers are relevant; no source projection sync
-- is requested or acknowledged by the metadata RPC.
update public.tenants set screen_limit=3 where id='10000000-0000-4000-8000-000000000291';
update public.sportlink_sync_policies set last_success_at=case dataset_group when 'matches' then now()-interval '10 minutes' when 'competitions' then now()-interval '1 day' else null end,last_attempt_at=case dataset_group when 'matches' then now()-interval '9 minutes' when 'competitions' then now()-interval '23 hours' else null end where tenant_id='10000000-0000-4000-8000-000000000291';
update public.published_dynamic_data set checked_at=now()-interval '1 minute',data_revision=7,content_hash=repeat('f',64) where snapshot_id='e2950000-0000-4000-8000-000000000002';
create function pg_temp.s296_rows()returns jsonb language sql stable as $$select public.get_screen_source_status_s296_v1('10000000-0000-4000-8000-000000000291','e2950000-0000-4000-8000-000000000007')$$;
create temporary table s296_before as select
 (select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,''))from public.playlist_releases r) releases,
 (select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,''))from public.screens s) screens,
 (select md5(coalesce(jsonb_agg(to_jsonb(d) order by id)::text,''))from public.player_devices d) devices,
 (select count(*) from private.published_data_refresh_queue) queue_count;
grant select on s296_before to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select is(jsonb_array_length(pg_temp.s296_rows()),2,'one desired matchday exposes separate matches and competitions metadata');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.s296_rows()) r where r->>'datasetKey'='matches'and(r->>'lastSuccessAt')::timestamptz=now()-interval '10 minutes'),'matches use their own last successful policy observation');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.s296_rows()) r where r->>'datasetKey'='competitions'and(r->>'lastSuccessAt')::timestamptz=now()-interval '1 day'),'standings use their own independently older successful observation');
select ok((select bool_and((r->>'dataRevision')::integer=7 and r->>'contentHash'=repeat('f',64) and(r->>'checkedAt')::timestamptz=now()-interval '1 minute')from jsonb_array_elements(pg_temp.s296_rows()) r),'current PDD projection metadata stays separate from source sync times');
select ok((select bool_and(r->>'sourceName'='Source A'and r->>'sourceKind'='sportlink')from jsonb_array_elements(pg_temp.s296_rows()) r),'only the exact published source identity is returned');
select throws_ok($$select public.get_screen_source_status_s296_v1('10000000-0000-4000-8000-000000000292','e2950000-0000-4000-8000-000000000007')$$,'42501','screen source metadata is not authorized','tenant A cannot select tenant B scope');
select throws_ok($$select public.get_screen_source_status_s296_v1('10000000-0000-4000-8000-000000000291','e2960000-0000-4000-8000-000000000099')$$,'42501','screen source metadata is not authorized','unbound screen ID fails closed');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000292',true);
select throws_ok($$select pg_temp.s296_rows()$$,'42501','screen source metadata is not authorized','tenant B cannot read tenant A screen source rows');
reset role;
insert into public.tenant_custom_roles(id,tenant_id,name,capabilities)values('92960000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000291','No screen access',array['tenant.sponsor.read']);
update public.tenant_memberships set custom_role_id='92960000-0000-4000-8000-000000000001' where tenant_id='10000000-0000-4000-8000-000000000291'and user_id='00000000-0000-4000-8000-000000000293';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000293',true);
select throws_ok($$select pg_temp.s296_rows()$$,'42501','screen source metadata is not authorized','membership without screen.read does not authorize metadata');
reset role; set local role anon;
select throws_ok($$select pg_temp.s296_rows()$$,'42501','permission denied for function get_screen_source_status_s296_v1','anonymous cannot call the metadata API');
reset role;
select ok(not has_function_privilege('service_role','public.get_screen_source_status_s296_v1(uuid,uuid)','execute'),'new human read RPC is not a service/device API');
select is((select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,''))from public.playlist_releases r),(select releases from s296_before),'metadata reads preserve all immutable releases');
select is((select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,''))from public.screens s),(select screens from s296_before),'metadata reads change no screen assignment');
select is((select md5(coalesce(jsonb_agg(to_jsonb(d) order by id)::text,''))from public.player_devices d),(select devices from s296_before),'metadata reads change no device evidence');
select is((select count(*)from private.published_data_refresh_queue),(select queue_count from s296_before),'metadata reads enqueue no refresh');

insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,error_code,started_at,finished_at)
select tenant_id,id,'matches','failed','SPORTLINK_TIMEOUT',now()-interval '2 minutes',now()-interval '1 minute'from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select is((select r->>'lastErrorCode'from jsonb_array_elements(pg_temp.s296_rows())r where r->>'datasetKey'='matches'),'SPORTLINK_TIMEOUT','source-only match failure is explicit despite healthy screen metadata');
select is((select r->>'lastErrorCode'from jsonb_array_elements(pg_temp.s296_rows())r where r->>'datasetKey'='competitions'),null,'match failure does not become a fictional standing failure');
select is((select(r->>'lastSuccessAt')::timestamptz from jsonb_array_elements(pg_temp.s296_rows())r where r->>'datasetKey'='matches'),now()-interval '10 minutes','failed attempt preserves the last successful source time');
reset role;

create function pg_temp.s296_slide(n integer,kind text,family text,source_id uuid,live boolean default true)returns void language plpgsql as $$
declare slide_id uuid:=('d2960000-0000-4000-8000-'||lpad((n*10+1)::text,12,'0'))::uuid;
 snapshot_id uuid:=('d2960000-0000-4000-8000-'||lpad((n*10+2)::text,12,'0'))::uuid;
 release_id uuid:=('d2960000-0000-4000-8000-'||lpad((n*10+6)::text,12,'0'))::uuid;
begin
 insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
 select slide_id,'10000000-0000-4000-8000-000000000291','Source metadata fixture '||n,kind,'landscape',id,current_published_version_id,source_id,
  (case when kind='news' then pg_temp.config(family,kind)-'context'-'teamSelection' else pg_temp.config(family,kind) end)
  ||case when live then '{"syncPlaybackProtocol":2}'::jsonb else '{}'::jsonb end
 from public.dynamic_templates where slide_type=kind and orientation='landscape'and status='published'limit 1;
 insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,completed_at)
 select snapshot_id,tenant_id,id,template_version_id,data_source_id,repeat('a',64),private.build_dynamic_snapshot_data(slide),'ready',now()from public.dynamic_slides slide where id=slide_id;
 update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id=snapshot_id where dynamic_slide_id=slide_id;
 insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
 values(release_id,'10000000-0000-4000-8000-000000000291','e2950000-0000-4000-8000-000000000005',n+1,repeat('c',64),'{}',1,10,100);
 insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
 select asset.tenant_id,'e2950000-0000-4000-8000-000000000005',release_id,asset.id,'e2950000-0000-4000-8000-000000000004',0,10,'contain',true,asset.kind,asset.title,asset.storage_path,asset.mime_type,asset.file_size_bytes,asset.checksum_sha256,snapshot_id,live from public.media_assets asset where asset.id='e2950000-0000-4000-8000-000000000003';
end;$$;
select pg_temp.s296_slide(1,'sport_results','results',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));
insert into public.dynamic_data_sources(id,tenant_id,name,kind,last_successful_sync_at,last_attempt_at)
values('d2960000-0000-4000-8000-000000000100','10000000-0000-4000-8000-000000000291','Authorized RSS','rss',now()-interval '3 hours',now()-interval '2 hours');
select pg_temp.s296_slide(2,'news','rss','d2960000-0000-4000-8000-000000000100');
insert into public.screens(id,tenant_id,name,orientation,status,assigned_playlist_id,assigned_release_id)
values('d2960000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000291','Different own screen','landscape','active','e2950000-0000-4000-8000-000000000005','d2960000-0000-4000-8000-000000000026');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status,active_release_id,last_seen_at,current_sync_detail)
values('d2960000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000291','d2960000-0000-4000-8000-000000000070',repeat('e',64),'paired','d2960000-0000-4000-8000-000000000026',now(),jsonb_build_object('publicationTrace',jsonb_build_object('releaseId','d2960000-0000-4000-8000-000000000026','firstFrameAt',now()-interval '1 minute')));
update public.player_devices set desired_release_id='d2960000-0000-4000-8000-000000000016',active_release_id='d2960000-0000-4000-8000-000000000016',last_seen_at=now(),current_sync_detail='{}' where id='e2950000-0000-4000-8000-000000000008';
set local role authenticated;
select is(jsonb_array_length(pg_temp.s296_rows()),2,'stale device desired pointer and unconfirmed active pointer do not broaden exact assigned publication');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.s296_rows())r where r->>'sourceKind'='rss'),'another own screen device cannot lend its valid frame/source to this screen');
reset role;
update public.player_devices set current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',active_release_id,'firstFrameAt',now()-interval '1 minute')),last_error_code='LATER_PLAYER_FAILURE'where id='e2950000-0000-4000-8000-000000000008';
set local role authenticated;
select is(jsonb_array_length(pg_temp.s296_rows()),3,'valid historical first frame includes its immutable last-known-good source');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.s296_rows())r where r->>'snapshotId'='d2960000-0000-4000-8000-000000000012'),'later playback error does not erase valid historical publication evidence');
reset role;
update public.player_devices set current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',active_release_id,'firstFrameAt','2026-02-30T12:00:00Z'))where id='e2950000-0000-4000-8000-000000000008';
set local role authenticated;
select is(jsonb_array_length(pg_temp.s296_rows()),2,'invalid calendar date is unknown and cannot attach a stale active source');
reset role;
update public.player_devices set current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId',active_release_id,'firstFrameAt',now()+interval '1 minute'))where id='e2950000-0000-4000-8000-000000000008';
set local role authenticated;
select is(jsonb_array_length(pg_temp.s296_rows()),2,'future first-frame claims do not confirm another source');
reset role;
insert into public.screen_compositions(id,tenant_id,screen_id,revision,configuration_json)
values('c2960000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000291','e2950000-0000-4000-8000-000000000007',1,'{}');
insert into public.screen_composition_bindings(tenant_id,composition_id,zone_id,playlist_id,release_id,config_revision)values
('10000000-0000-4000-8000-000000000291','c2960000-0000-4000-8000-000000000001','main','e2950000-0000-4000-8000-000000000005','d2960000-0000-4000-8000-000000000016',2),
('10000000-0000-4000-8000-000000000291','c2960000-0000-4000-8000-000000000001','side','e2950000-0000-4000-8000-000000000005','d2960000-0000-4000-8000-000000000026',3);
update public.screens set composition_id='c2960000-0000-4000-8000-000000000001' where id='e2950000-0000-4000-8000-000000000007';
set local role authenticated;
select is(jsonb_array_length(pg_temp.s296_rows()),3,'desired composition side source is included beside the effective main source');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.s296_rows())r where r->>'sourceKind'='rss'and r->>'datasetKey'='rss'and(r->>'lastSuccessAt')::timestamptz=now()-interval '3 hours'),'RSS source freshness uses its own real source sync metadata');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.s296_rows())r where r->>'snapshotId'='d2960000-0000-4000-8000-000000000012'),'scheduled main is not confused with composition default main');
select ok(not(pg_temp.s296_rows()::text ~ '(encrypted|token_hash|secret_reference|data_json|context_json|storage_path|url)'),'metadata API exposes no payload, credential or signed URL');
reset role;

-- Same snapshot may have a frozen placement here and a live placement on a
-- different screen. That screen's PDD must never become this frozen frame.
select public.set_sync_dom_rollout_v2('10000000-0000-4000-8000-000000000291',false,repeat('a',40));
select pg_temp.s296_slide(3,'sport_results','results',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'),false);
select public.set_sync_dom_rollout_v2('10000000-0000-4000-8000-000000000291',true,repeat('a',40));
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('d2960000-0000-4000-8000-000000000046','10000000-0000-4000-8000-000000000291','e2950000-0000-4000-8000-000000000005',5,repeat('c',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select tenant_id,'e2950000-0000-4000-8000-000000000005','d2960000-0000-4000-8000-000000000046',id,'e2950000-0000-4000-8000-000000000004',0,10,'contain',true,kind,title,storage_path,mime_type,file_size_bytes,checksum_sha256,'d2960000-0000-4000-8000-000000000032',true from public.media_assets where id='e2950000-0000-4000-8000-000000000003';
insert into public.screen_composition_bindings(tenant_id,composition_id,zone_id,playlist_id,release_id,config_revision)
values('10000000-0000-4000-8000-000000000291','c2960000-0000-4000-8000-000000000001','bottom','e2950000-0000-4000-8000-000000000005','d2960000-0000-4000-8000-000000000036',4);
set local role authenticated;
select is(jsonb_array_length(pg_temp.s296_rows()),4,'independent bottom zone retains its own published source binding');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.s296_rows())r where r->>'snapshotId'='d2960000-0000-4000-8000-000000000032'and r->>'checkedAt'is null and r->>'dataRevision'is null and r->>'contentHash'is null),'frozen-only placement exposes no other screen live projection as its own');
select ok(not has_table_privilege('authenticated','public.published_dynamic_data','SELECT'),'narrow RPC grants no raw published data access');
reset role;

select *from finish();
rollback;
