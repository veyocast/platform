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
create function pg_temp.drain()returns void language plpgsql as $$
declare claim jsonb;begin
 for i in 1..20 loop
  claim:=public.claim_published_data_refresh_v1('worker:s295-projection',60);exit when claim is null;
  if public.complete_published_data_refresh_v1((claim->>'tenantId')::uuid,(claim->>'snapshotId')::uuid,(claim->>'leaseToken')::uuid)->>'status'<>'completed'then raise exception 'S295 projection failed';end if;
 end loop;
end;$$;
select pg_temp.drain();
create function pg_temp.data()returns jsonb language sql stable as $$select data_json from public.published_dynamic_data where snapshot_id='e2950000-0000-4000-8000-000000000002'$$;
create temporary table before_chain as select data_revision,content_hash,public.get_player_effective_target_v1(repeat('d',64))->>'data_key'data_key,(select md5(row_to_json(release)::text)from public.playlist_releases release where id='e2950000-0000-4000-8000-000000000006')release_hash from public.published_dynamic_data where snapshot_id='e2950000-0000-4000-8000-000000000002';
select is((select count(*)from public.published_dynamic_data where snapshot_id='e2950000-0000-4000-8000-000000000002'),1::bigint,'an existing publication has a live data binding');
-- Actual 0-0 and the same normalized ID receiving an official correction.
create function pg_temp.result_record(score integer default 0)returns jsonb language sql stable as $$
 select jsonb_set(jsonb_set(jsonb_set(pg_temp.program_record(),'{0,status}','"finished"'),'{0,homeTeam,score}',to_jsonb(score)),'{0,awayTeam,score}','0'::jsonb)
$$;
select pg_temp.complete_matches('matches',pg_temp.result_record());
select is((select count(*)from private.published_data_refresh_queue where snapshot_id='e2950000-0000-4000-8000-000000000002'),1::bigint,'successful leased source completion queues the frozen live binding');
select pg_temp.drain();
select is((select item->>'homeScore'from jsonb_array_elements(pg_temp.data()#>'{sport,matchday,poolResults,items}')item where item->>'id'='pool-other'),'0','published pool projection carries a real 0-0');
select isnt(public.get_player_effective_target_v1(repeat('d',64))->>'data_key',(select data_key from before_chain),'new result changes the device-authorized data key in the same release');
select pg_temp.complete_matches('matches',pg_temp.result_record(4));select pg_temp.drain();
select is((select item->>'homeScore'from jsonb_array_elements(pg_temp.data()#>'{sport,matchday,poolResults,items}')item where item->>'id'='pool-other'),'4','official correction reaches the same published match ID');
select is((select count(*)from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='pool-other'),1::bigint,'score correction never creates a second match ID');
create temporary table before_unchanged as select data_revision,content_hash from public.published_dynamic_data where snapshot_id='e2950000-0000-4000-8000-000000000002';
select pg_temp.complete_matches('matches',pg_temp.result_record(4));select pg_temp.drain();
select is((select data_revision from public.published_dynamic_data where snapshot_id='e2950000-0000-4000-8000-000000000002'),(select data_revision from before_unchanged),'unchanged observation keeps the data revision stable');
-- A valid empty results source applies immediately; history uses its 3-run guard.
select pg_temp.complete_matches('matches','[]',pg_temp.scope()||jsonb_build_object('scopes',jsonb_build_array((pg_temp.scope()->'scopes'->0)||'{"complete":false,"resultsComplete":true,"programComplete":false}'::jsonb)));select pg_temp.drain();
select is(jsonb_array_length(pg_temp.data()#>'{sport,matchday,results,items}'),0,'one authoritative empty scope clears visible own results immediately');
select is(jsonb_array_length(pg_temp.data()#>'{sport,matchday,poolResults,items}'),0,'one authoritative empty scope clears visible pool results immediately');
select ok(jsonb_array_length(pg_temp.data()#>'{sport,matchday,fixtures,items}')>0,'failed programme coverage preserves its valid block while result block updates');
select ok((select active from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='pool-other'),'visible empty does not bypass the historical deactivation guard');
select pg_temp.complete_matches('matches',pg_temp.result_record(5),jsonb_set(pg_temp.scope(),'{scopes,0,resultExternalIds}','["pool-other"]'));select pg_temp.drain();
create temporary table before_partial as select data_json,data_revision from public.published_dynamic_data where snapshot_id='e2950000-0000-4000-8000-000000000002';
select pg_temp.complete_matches('matches','[]',pg_temp.scope(false));select pg_temp.drain();
select is(pg_temp.data()#>'{sport,matchday,poolResults}',(select data_json#>'{sport,matchday,poolResults}'from before_partial),'partial empty source preserves the valid pool block');
-- A separately observed official stand uses the same leased completion route.
create function pg_temp.complete_standing()returns jsonb language plpgsql as $$
declare run_id uuid;source record;standing jsonb;
begin
 select *into source from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
 select jsonb_build_array(jsonb_build_object('externalId',row.external_id,'competition',row.metadata->'competition','pool',row.metadata->'pool','scoresPublished',true,
  'rows',jsonb_set(jsonb_set(row.rows_json,'{0,points}','9'),'{0,goalDifference}','7')))into standing
 from public.sports_standings row where row.tenant_id=source.tenant_id and row.source_connection_id=source.id and row.pool_external_id='701';
 insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
 values(source.tenant_id,source.id,'competitions','running','worker:s295',now())returning id into run_id;
 return public.complete_sportlink_sync_v4(run_id,'worker:s295','{}','{}','[]','[]','[]','[]',standing);
end;$$;
select pg_temp.complete_standing();select pg_temp.drain();
select is(pg_temp.data()#>>'{sport,matchday,standings,items,0,points}','9','standings-only change reaches the published projection independently');
select is(pg_temp.data()#>'{sport,matchday,poolResults}',(select data_json#>'{sport,matchday,poolResults}'from before_partial),'standings-only change keeps pool results intact');
-- The same stored result leaves the real builder at local midnight, with
-- no new provider completion. Only this transaction's clock is instrumented.
select pg_temp.complete_matches('matches',jsonb_build_array(jsonb_build_object('externalId','old-window',
 'startsAt',(((now()at time zone'Europe/Amsterdam')::date-7)+time '12:00:00')at time zone'Europe/Amsterdam','status','finished',
 'homeTeam',jsonb_build_object('externalId','own-team','name','Own team','score',2),'awayTeam',jsonb_build_object('externalId','guest','name','Guest','score',0),
 'competition',jsonb_build_object('externalId','league','period','phase'),'pool',jsonb_build_object('externalId','701','competitionExternalId','league')),
 jsonb_build_object('externalId','today-window',
 'startsAt',(((now()at time zone'Europe/Amsterdam')::date)+time '12:00:00')at time zone'Europe/Amsterdam','status','finished',
 'homeTeam',jsonb_build_object('externalId','own-team','name','Own team','score',0),'awayTeam',jsonb_build_object('externalId','guest','name','Guest','score',0),
 'competition',jsonb_build_object('externalId','league','period','phase'),'pool',jsonb_build_object('externalId','701','competitionExternalId','league'))),
 jsonb_set(pg_temp.scope(),'{scopes,0,resultExternalIds}','["pool-other","old-window","today-window"]'));
do $clock$
declare definition text;builder regprocedure;
begin
 foreach builder in array array[
  'private.build_sync_sport_snapshot_s291_v1(public.dynamic_slides)'::regprocedure,
  'private.build_dynamic_snapshot_data_before_s159_theme_runtime_v2(public.dynamic_slides)'::regprocedure,
  'private.sportlink_match_phase_v1(text,timestamptz,timestamptz)'::regprocedure
 ]loop
  definition:=pg_get_functiondef(builder);
  execute replace(definition,'now()',$m$(current_setting('test.s295_clock')::timestamptz) $m$);
 end loop;
end;$clock$;
select set_config('test.s295_clock',(((now()at time zone'Europe/Amsterdam')::date+time '23:59:59')at time zone'Europe/Amsterdam')::text,true);
select pg_temp.drain();
select is((select count(*)from jsonb_array_elements(pg_temp.data()#>'{sport,matchday,results,items}')item where item->>'id'='old-window'),1::bigint,'the oldest eligible result remains before local midnight');
select is((select count(*)from jsonb_array_elements(private.build_dynamic_snapshot_data(pg_temp.dynamic('club-results','sport_results'))#>'{sport,items}')item where item->>'id'='old-window'),1::bigint,'ordinary previous seven days includes an authorized own result on local today minus seven before midnight');
select is((select count(*)from jsonb_array_elements(private.build_dynamic_snapshot_data(pg_temp.dynamic('club-results','sport_results'))#>'{sport,items}')item where item->>'id'='today-window'),0::bigint,'ordinary previous seven days excludes the current local day before midnight');
select set_config('test.s295_clock',((((now()at time zone'Europe/Amsterdam')::date+1)+time '00:00:01')at time zone'Europe/Amsterdam')::text,true);
select private.refresh_published_data_v1('10000000-0000-4000-8000-000000000291',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));select pg_temp.drain();
select is((select count(*)from jsonb_array_elements(pg_temp.data()#>'{sport,matchday,results,items}')item where item->>'id'='old-window'),0::bigint,'old result leaves the published projection across local midnight with unchanged provider content');
select is((select count(*)from jsonb_array_elements(private.build_dynamic_snapshot_data(pg_temp.dynamic('club-results','sport_results'))#>'{sport,items}')item where item->>'id'='old-window'),0::bigint,'ordinary previous seven days drops the old local boundary with unchanged provider content');
select is((select count(*)from jsonb_array_elements(private.build_dynamic_snapshot_data(pg_temp.dynamic('club-results','sport_results'))#>'{sport,items}')item where item->>'id'='today-window'),1::bigint,'ordinary previous seven days includes the prior current-day own result after local midnight without a new observation');
-- Central stale-stand catch-up respects the existing operational policy gates.
update public.sportlink_sync_policies set last_success_at=now()-interval '2 hours',last_attempt_at=now()-interval '2 hours',next_sync_at=now()+interval '1 day',enabled=false
 where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions';
select is(private.request_due_published_sportlink_s295_v1(),0,'published catch-up respects explicitly disabled competitions policy');
update public.sportlink_sync_policies set enabled=true,manual_cooldown_until=now()+interval '1 hour'where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions';
select is(private.request_due_published_sportlink_s295_v1(),0,'published catch-up respects manual cooldown');
update public.sportlink_sync_policies set manual_cooldown_until=null where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions';
update public.sportlink_sync_policies set live_max_staleness_seconds=null where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions';
select is(private.request_due_published_sportlink_s295_v1(),0,'NULL live bound respects only the stored regular cadence');
update public.sportlink_sync_policies set live_max_staleness_seconds=3600 where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions';
insert into public.sportlink_sync_runs(id,tenant_id,connection_id,dataset_group,status,worker_id,locked_at)
 select 'e2950000-0000-4000-8000-000000000009',tenant_id,id,'competitions','running','worker:s295-catchup',now()from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
select is(private.request_due_published_sportlink_s295_v1(),0,'an owned provider lease is never duplicated by publication catch-up');
update public.sportlink_sync_runs set status='failed',finished_at=now()where id='e2950000-0000-4000-8000-000000000009';
select is(private.request_due_published_sportlink_s295_v1(),1,'one shared stale official standings scope becomes due without changing frequency');
select is(private.request_due_published_sportlink_s295_v1(),0,'simultaneous screens cannot multiply a due catch-up');
select is((select frequency from public.sportlink_sync_policies where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions'),'daily','stored configurable cadence remains intact');
update public.sportlink_sync_policies set next_sync_at=now()+interval '15 minutes',last_attempt_at=now()where tenant_id='10000000-0000-4000-8000-000000000291'and dataset_group='competitions';
select is(private.request_due_published_sportlink_s295_v1(),0,'a recent failed attempt keeps its existing retry backoff');
-- No provider change is needed to queue the next local date selection.
update public.published_dynamic_data set checked_at='2026-10-31T22:59:59Z'where snapshot_id='e2950000-0000-4000-8000-000000000002';
select ok((public.get_worker_queue_hint_v3(3)&8)=8,'the real read-only worker hint wakes the date-window lane');
select is(private.enqueue_due_sportlink_windows_s295_v1('2026-10-31T23:00:01Z'),1,'Amsterdam midnight queues date-window recalculation without a provider observation');
select is(private.enqueue_due_sportlink_windows_s295_v1('2026-10-31T23:00:02Z'),0,'same midnight work coalesces instead of multiplying per screen');select pg_temp.drain();
select is((select md5(row_to_json(release)::text)from public.playlist_releases release where id='e2950000-0000-4000-8000-000000000006'),(select release_hash from before_chain),'all data refreshes preserve the immutable published release bytes');
select is((select count(*)from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000000291'),1::bigint,'data refreshes never republish the playlist');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select lives_ok($$select public.update_sportlink_live_sync_policy_v1((select id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'),'competitions',900)$$,'authorized tenant manager can configure the publication freshness bound');
select throws_ok($$select public.update_sportlink_live_sync_policy_v1((select id from own_source where tenant_id='10000000-0000-4000-8000-000000000292'),'competitions',900)$$,'42501','sportlink_policy_manage_required','tenant A cannot alter tenant B live policy');
select throws_ok($$select public.update_sportlink_live_sync_policy_v1((select id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'),'competitions',1)$$,'22023','sportlink_live_policy_invalid','live policy bounds prevent request bursts');
select ok(not has_function_privilege('anon','public.update_sportlink_live_sync_policy_v1(uuid,text,integer)','execute'),'anonymous devices cannot change source cadence');
-- Historical protocol-1 bytes/hashes stay immutable. Only the live PDD core
-- may recognize an observation-only projection as equal to its prior facts.
create function pg_temp.publish_legacy(family text,configuration jsonb,token text)returns jsonb language plpgsql as $$
declare source record;template record;slide_id uuid:=gen_random_uuid();snapshot_id uuid:=gen_random_uuid();playlist_id uuid:=gen_random_uuid();release_id uuid:=gen_random_uuid();screen_id uuid:=gen_random_uuid();slide_kind text;
begin
 select *into source from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
 slide_kind:=case when family='birthday'then 'sport_birthdays'else 'sport_match_of_the_day'end;
 select *into strict template from public.dynamic_templates where slide_type=slide_kind and orientation='landscape'and status='published'limit 1;
 insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
 values(slide_id,source.tenant_id,'Historical live fixture',slide_kind,'landscape',template.id,template.current_published_version_id,source.data_source_id,configuration);
 insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,completed_at)
 select snapshot_id,tenant_id,id,template_version_id,data_source_id,repeat('a',64),private.build_dynamic_snapshot_data(slide),'ready',now()from public.dynamic_slides slide where id=slide_id;
 update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id=snapshot_id where dynamic_slide_id=slide_id;
 insert into public.playlists(id,tenant_id,name)values(playlist_id,source.tenant_id,'Historical live canary');
 insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
 values(release_id,source.tenant_id,playlist_id,1,repeat('c',64),'{}',1,10,100);
 insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
 select tenant_id,playlist_id,release_id,id,'e2950000-0000-4000-8000-000000000004',0,10,'contain',true,kind,title,storage_path,mime_type,file_size_bytes,checksum_sha256,snapshot_id,true from public.media_assets where id='e2950000-0000-4000-8000-000000000003';
 insert into public.screens(id,tenant_id,name,orientation,status,assigned_playlist_id,assigned_release_id)
 values(screen_id,source.tenant_id,'Historical canary','landscape','active',playlist_id,release_id);
 insert into public.player_devices(tenant_id,screen_id,token_hash,status)values(source.tenant_id,screen_id,token,'paired');
 return jsonb_build_object('snapshotId',snapshot_id,'releaseId',release_id,'token',token);
end;$$;
-- Exercise the actual leased PDD write before the existing binary-preparation
-- wrapper; binary rendering is independent of this observation-identity rule.
create function pg_temp.drain_legacy()returns void language plpgsql as $$
declare claim jsonb;begin
 for i in 1..20 loop
  claim:=public.claim_published_data_refresh_v1('worker:s295-legacy',60);exit when claim is null;
  if private.complete_published_data_before_binary_v1((claim->>'tenantId')::uuid,(claim->>'snapshotId')::uuid,(claim->>'leaseToken')::uuid)->>'status'<>'completed'then raise exception 'S295 legacy projection failed';end if;
 end loop;
end;$$;
update public.tenants set screen_limit=3 where id='10000000-0000-4000-8000-000000000291';
update public.sportlink_connections set privacy_birthdays_enabled=true where tenant_id='10000000-0000-4000-8000-000000000291';
insert into public.sportlink_birthdays(tenant_id,connection_id,external_id,display_name,normalized_name,birth_month,birth_day,next_occurrence,source_fetched_at)
select tenant_id,id,repeat('a',40),'Same birthday','same birthday',extract(month from current_date+1)::integer,extract(day from current_date+1)::integer,current_date+1,now()from own_source where tenant_id='10000000-0000-4000-8000-000000000291';
-- The existing rollback clock is tomorrow: this result is exactly its oldest
-- included local date, ready to prove a later clock-only real fact change.
update public.sports_matches set starts_at=starts_at+interval '1 day'where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='old-window';
create temporary table legacy_bindings(family text primary key,binding jsonb);
insert into legacy_bindings values('matchday',pg_temp.publish_legacy('matchday',pg_temp.config('matchday','sport_match_of_the_day'),repeat('e',64)));
insert into legacy_bindings values('birthday',pg_temp.publish_legacy('birthday',jsonb_build_object('blueprintKey','sportlink.birthdays','birthday',
 '{"schemaVersion":1,"title":"Verjaardagen","emptyBehavior":"skip","period":{"mode":"next_7_days","days":7},"selection":{"emphasizeToday":true,"includeUnknownRoles":true,"nameMode":"full","roleFilter":"all","selectedRoles":[],"selectedTeamIds":[],"showAge":true,"showDate":true,"showDayOfWeek":true,"showPhoto":true,"showRole":true,"showTeam":true},"presentation":{"backgroundColor":"#111827","backgroundMediaAssetId":null,"cardStyle":"glass","confetti":true,"gradientOverlay":true,"layout":"auto","logoPosition":"top_left","maxPerLandscapePage":4,"maxPerPortraitPage":4,"motion":true,"pageDurationSeconds":8,"radius":"lg","textAlign":"left","themeMode":"dark","useTenantTheme":true}}'::jsonb),repeat('f',64)));
select pg_temp.drain_legacy();
create temporary table legacy_before as
 select family,binding,data.*,public.get_player_effective_target_v1(binding->>'token')->>'data_key'data_key,
 (select md5(row_to_json(snapshot)::text)from public.dynamic_slide_snapshots snapshot where snapshot.id=data.snapshot_id)frozen_hash,
 (select md5(row_to_json(release)::text)from public.playlist_releases release where release.id=(binding->>'releaseId')::uuid)release_hash
 from legacy_bindings join public.published_dynamic_data data on data.snapshot_id=(binding->>'snapshotId')::uuid;
select ok(data_json->'syncPlaybackProtocol'is distinct from'2'::jsonb,'real historical protocol-1 binding: '||family)from legacy_before order by family;
-- A later successful observation changes these source timestamps/revision,
-- while every match, standing and birthday fact remains byte-identical.
update public.sports_matches set last_synced_at=last_synced_at+interval '5 minutes'where tenant_id='10000000-0000-4000-8000-000000000291';
update public.sportlink_birthdays set source_fetched_at=source_fetched_at+interval '5 minutes'where tenant_id='10000000-0000-4000-8000-000000000291';
update public.dynamic_data_sources set revision=revision+1 where id=(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291');
select private.refresh_published_data_v1('10000000-0000-4000-8000-000000000291',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));select pg_temp.drain_legacy();
select is(data.data_revision,before.data_revision,'legacy observation keeps the live revision: '||family)from legacy_before before join public.published_dynamic_data data using(snapshot_id)order by family;
select is(data.content_hash,before.content_hash,'legacy observation keeps the historical live hash: '||family)from legacy_before before join public.published_dynamic_data data using(snapshot_id)order by family;
select is(data.data_json::text,before.data_json::text,'legacy observation preserves the exact installed raw payload bytes: '||family)from legacy_before before join public.published_dynamic_data data using(snapshot_id)order by family;
select is(public.get_player_effective_target_v1(binding->>'token')->>'data_key',data_key,'legacy observation keeps the authorized data key: '||family)from legacy_before order by family;
select ok(data.checked_at>before.checked_at and data.source_revision>before.source_revision and data.changed_at=before.changed_at,'legacy observation still records checked/source progress without a fact change: '||family)from legacy_before before join public.published_dynamic_data data using(snapshot_id)order by family;
create temporary table legacy_observed as select data.*from public.published_dynamic_data data join legacy_bindings on data.snapshot_id=(binding->>'snapshotId')::uuid;
update public.sports_matches set home_team=jsonb_set(home_team,'{score}','1')where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='today-window';
select private.refresh_published_data_v1('10000000-0000-4000-8000-000000000291',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));select pg_temp.drain_legacy();
select ok(data.data_revision=before.data_revision+1 and data.content_hash<>before.content_hash and exists(select 1 from jsonb_array_elements(data.data_json#>'{sport,matchday,results,items}')item where item->>'id'='today-window'and item->>'homeScore'='1'),'a real score correction advances the legacy live revision')from public.published_dynamic_data data join legacy_observed before using(snapshot_id)where data.snapshot_id=(select(binding->>'snapshotId')::uuid from legacy_bindings where family='matchday');
create temporary table legacy_scored as select data.*from public.published_dynamic_data data join legacy_bindings on data.snapshot_id=(binding->>'snapshotId')::uuid;
update public.sports_standings set rows_json=jsonb_set(rows_json,'{0,points}','10')where tenant_id='10000000-0000-4000-8000-000000000291'and pool_external_id='701';
select private.refresh_published_data_v1('10000000-0000-4000-8000-000000000291',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));select pg_temp.drain_legacy();
select ok(data.data_revision=before.data_revision+1 and data.data_json#>>'{sport,matchday,standings,items,0,points}'='10','an independent real official stand advances the legacy live revision')from public.published_dynamic_data data join legacy_scored before using(snapshot_id)where data.snapshot_id=(select(binding->>'snapshotId')::uuid from legacy_bindings where family='matchday');
update public.sportlink_birthdays set next_occurrence=next_occurrence+1,birth_month=extract(month from next_occurrence+1)::integer,birth_day=extract(day from next_occurrence+1)::integer where tenant_id='10000000-0000-4000-8000-000000000291';
select private.refresh_published_data_v1('10000000-0000-4000-8000-000000000291',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));select pg_temp.drain_legacy();
select ok(data.data_revision=before.data_revision+1 and data.data_json#>>'{sport,birthdays,0,displayDate}'=(current_date+2)::text,'a real birthday occurrence correction advances the legacy live revision')from public.published_dynamic_data data join legacy_observed before using(snapshot_id)where data.snapshot_id=(select(binding->>'snapshotId')::uuid from legacy_bindings where family='birthday');
create temporary table legacy_before_clock as select data.*from public.published_dynamic_data data join legacy_bindings on data.snapshot_id=(binding->>'snapshotId')::uuid;
select set_config('test.s295_clock',((((now()at time zone'Europe/Amsterdam')::date+2)+time '00:00:01')at time zone'Europe/Amsterdam')::text,true);
select private.refresh_published_data_v1('10000000-0000-4000-8000-000000000291',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'));select pg_temp.drain_legacy();
select ok(data.data_revision=before.data_revision+1 and not exists(select 1 from jsonb_array_elements(data.data_json#>'{sport,matchday,results,items}')item where item->>'id'='old-window'),'a real local window expiry still advances the historical live projection')from public.published_dynamic_data data join legacy_before_clock before using(snapshot_id)where data.snapshot_id=(select(binding->>'snapshotId')::uuid from legacy_bindings where family='matchday');
create temporary table legacy_before_empty as select data.*from public.published_dynamic_data data join legacy_bindings on data.snapshot_id=(binding->>'snapshotId')::uuid;
select pg_temp.complete_matches('matches','[]',pg_temp.scope()||jsonb_build_object('scopes',jsonb_build_array((pg_temp.scope()->'scopes'->0)||'{"complete":false,"resultsComplete":true,"programComplete":false}'::jsonb)));select pg_temp.drain_legacy();
select ok(data.data_revision=before.data_revision+1 and jsonb_array_length(data.data_json#>'{sport,matchday,results,items}')=0 and jsonb_array_length(data.data_json#>'{sport,matchday,poolResults,items}')=0 and jsonb_array_length(data.data_json#>'{sport,matchday,standings,items}')=1,'a confirmed empty legacy result set remains authoritative and keeps the stand')from public.published_dynamic_data data join legacy_before_empty before using(snapshot_id)where data.snapshot_id=(select(binding->>'snapshotId')::uuid from legacy_bindings where family='matchday');
select is((select md5(row_to_json(snapshot)::text)from public.dynamic_slide_snapshots snapshot where snapshot.id=before.snapshot_id),frozen_hash,'all legacy live refreshes preserve the exact frozen snapshot: '||family)from legacy_before before order by family;
select is((select md5(row_to_json(release)::text)from public.playlist_releases release where release.id=(binding->>'releaseId')::uuid),release_hash,'all legacy live refreshes preserve the immutable release: '||family)from legacy_before order by family;
select *from finish();rollback;
