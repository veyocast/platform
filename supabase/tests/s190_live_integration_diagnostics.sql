begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select ok(has_function_privilege('service_role','public.get_live_integration_diagnostics_v1(uuid)','EXECUTE'),
  'deployed worker can obtain read-only integration evidence');
select ok(not has_function_privilege('anon','public.get_live_integration_diagnostics_v1(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.get_live_integration_diagnostics_v1(uuid)','EXECUTE'),
  'browser users and anonymous devices cannot obtain operational readback');
select ok(not has_function_privilege('service_role','private.live_integration_safe_code_v1(text)','EXECUTE'),
  'private formatting helper has no standalone worker/client access');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_catalog.pg_proc
  where oid='public.get_live_integration_diagnostics_v1(uuid)'::regprocedure),
  'service-only diagnostic function has an empty search path');
select is(private.live_integration_safe_code_v1('SPORTLINK_SYNC_COMPLETE_57014'),'SPORTLINK_SYNC_COMPLETE_57014',
  'known timeout SQLState remains useful evidence');
select is(private.live_integration_safe_code_v1('TOKEN_LOOKING_PRIVATE_SENTINEL'),'UNKNOWN_ERROR',
  'arbitrary token-like errors cannot escape through diagnostics');

insert into public.tenants(id,name,slug,status) values
  ('10000000-0000-4000-8000-000000001931','Private diagnostic tenant A','diagnostics-s190-a','active'),
  ('10000000-0000-4000-8000-000000001932','Private diagnostic tenant B','diagnostics-s190-b','active'),
  ('10000000-0000-4000-8000-000000001933','Private paused tenant','diagnostics-s190-paused','paused');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001931'),('10000000-0000-4000-8000-000000001932');
insert into public.dynamic_data_sources(id,tenant_id,name,kind,revision,last_error_code,last_error_detail,config_json) values
  ('20000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931',
   'PRIVATE_SENTINEL_SOURCE_NAME','sportlink',7,'private_sentinel_error','PRIVATE_SENTINEL_RAW_ERROR','{"providerNote":"PRIVATE_SENTINEL_PAYLOAD"}'),
  ('20000000-0000-4000-8000-000000001932','10000000-0000-4000-8000-000000001932',
   'PRIVATE_SENTINEL_OTHER_TENANT','sportlink',99,null,null,'{}');
insert into public.sportlink_connections(id,tenant_id,data_source_id,client_id_suffix,encrypted_client_id,encryption_iv,encryption_tag,
  detected_club_name,privacy_birthdays_enabled,last_success_at,last_error_code) values
  ('30000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931','20000000-0000-4000-8000-000000001931',
   'SECRET','PRIVATE_SENTINEL_CIPHERTEXT','PRIVATE_SENTINEL_IV','PRIVATE_SENTINEL_TAG','PRIVATE_SENTINEL_CLUB_NAME',true,now()-interval '1 day','SPORTLINK_SYNC_COMPLETE_57014'),
  ('30000000-0000-4000-8000-000000001932','10000000-0000-4000-8000-000000001932','20000000-0000-4000-8000-000000001932',
   'HIDDEN','PRIVATE_SENTINEL_OTHER_CIPHERTEXT','PRIVATE_SENTINEL_OTHER_IV','PRIVATE_SENTINEL_OTHER_TAG','PRIVATE_SENTINEL_OTHER_CLUB',false,null,null);
insert into public.sportlink_sync_policies(tenant_id,connection_id,dataset_group,frequency,next_sync_at,last_success_at)
  values('10000000-0000-4000-8000-000000001931','30000000-0000-4000-8000-000000001931','matches','five_minutes',now()-interval '2 minutes',now()-interval '1 day');
insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,started_at,finished_at,read_count,error_code,error_detail) values
  ('10000000-0000-4000-8000-000000001931','30000000-0000-4000-8000-000000001931','matches','succeeded',now()-interval '1 day',now()-interval '1 day',12,null,null),
  ('10000000-0000-4000-8000-000000001931','30000000-0000-4000-8000-000000001931','matches','failed',now()-interval '1 minute',now(),20,'SPORTLINK_SYNC_COMPLETE_57014','PRIVATE_SENTINEL_ERROR_DETAIL');
insert into public.ledscores_connections(id,tenant_id,name,club_slug,health_status,health_detail,last_source_message_at,reconnect_count,invalid_message_count)
  values('40000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931',
    'PRIVATE_SENTINEL_LED_NAME','private-sentinel-club','error','PRIVATE_SENTINEL_HEALTH_DETAIL',now()-interval '2 hours',15,22);
insert into public.ledscores_connector_events(tenant_id,connection_id,event_type,severity,detail) values
  ('10000000-0000-4000-8000-000000001931','40000000-0000-4000-8000-000000001931','invalid_message','error','{"raw":"PRIVATE_SENTINEL_MESSAGE"}');
insert into public.ledscores_goal_events(tenant_id,connection_id,canonical_key,match_identity,home_team,away_team,
  previous_home_score,previous_away_score,home_score,away_score,scoreboard_side,scoring_team_key,scoring_side,scorer_name,source_observed_at,dispatch_status)
  values('10000000-0000-4000-8000-000000001931','40000000-0000-4000-8000-000000001931',repeat('a',64),'PRIVATE_SENTINEL_MATCH',
    'PRIVATE_SENTINEL_HOME','PRIVATE_SENTINEL_AWAY',0,0,1,0,'home','PRIVATE_SENTINEL_TEAM','own','PRIVATE_SENTINEL_MEMBER',now(),'no_targets');

insert into public.dynamic_templates(id,slug,name,category,slide_type,orientation) values
  ('50000000-0000-4000-8000-000000001931','s190-diagnostics-template','PRIVATE_SENTINEL_TEMPLATE','menu','menu','landscape');
insert into public.dynamic_template_versions(id,template_id,version,markup,manifest_json,sample_data_json,source_checksum_sha256) values
  ('51000000-0000-4000-8000-000000001931','50000000-0000-4000-8000-000000001931',1,'<div></div>','{}','{}',repeat('b',64));
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id) values
  ('52000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931','PRIVATE_SENTINEL_SLIDE','menu','landscape',
   '50000000-0000-4000-8000-000000001931','51000000-0000-4000-8000-000000001931','20000000-0000-4000-8000-000000001931');
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json) values
  ('53000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931','52000000-0000-4000-8000-000000001931',
   '51000000-0000-4000-8000-000000001931','20000000-0000-4000-8000-000000001931',repeat('c',64),'{}');
insert into public.published_dynamic_data(tenant_id,snapshot_id,data_source_id,data_revision,source_revision,content_hash,data_json) values
  ('10000000-0000-4000-8000-000000001931','53000000-0000-4000-8000-000000001931','20000000-0000-4000-8000-000000001931',3,7,repeat('d',64),
   '{"sport":{"items":[{"displayName":"PRIVATE_SENTINEL_MEMBER","dateOfBirth":"PRIVATE_SENTINEL_BIRTHDATE"},{"raw":"PRIVATE_SENTINEL_PAYLOAD"}]}}');
insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id,next_attempt_at,lease_token,lease_until,locked_by,attempt_count,last_error_code) values
  ('10000000-0000-4000-8000-000000001931','53000000-0000-4000-8000-000000001931','20000000-0000-4000-8000-000000001931',now()-interval '1 minute',
   '54000000-0000-4000-8000-000000001931',now()+interval '1 minute','PRIVATE_SENTINEL_WORKER_OWNER',2,'PRIVATE_SENTINEL_QUEUE_ERROR');
insert into private.publication_version_prune_queue(tenant_id,pending,not_before)
  values('10000000-0000-4000-8000-000000001931',true,now()-interval '1 minute')
  on conflict(tenant_id) do update set pending=true,not_before=excluded.not_before;
insert into public.dynamic_render_jobs(tenant_id,snapshot_id,status,error_detail) values
  ('10000000-0000-4000-8000-000000001931','53000000-0000-4000-8000-000000001931','failed','PRIVATE_SENTINEL_RENDER_ERROR');
insert into public.screens(id,tenant_id,name) values
  ('60000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931','PRIVATE_SENTINEL_SCREEN_NAME');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,device_name,current_sync_detail) values
  ('61000000-0000-4000-8000-000000001931','10000000-0000-4000-8000-000000001931','60000000-0000-4000-8000-000000001931',repeat('e',64),
   'PRIVATE_SENTINEL_DEVICE_NAME','{"publicationTrace":{"targetRevision":"4","configRevision":"3","correlationId":"PRIVATE_SENTINEL_TRACE"},"raw":"PRIVATE_SENTINEL_PLAYER_DETAIL"}');

select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$select public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001931')$$,
  '42501','service role required','function owner cannot bypass the explicit service-role guard');
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$select public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001933')$$,
  '42501','active tenant required','paused tenants cannot be probed');
select throws_ok($$select public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001934')$$,
  '42501','active tenant required','unknown tenants receive the same bounded scope failure');
create temp table s190_diag_before as select
  (select count(*) from private.published_data_refresh_queue) refresh_count,
  (select count(*) from public.dynamic_slide_snapshots) snapshot_count,
  (select count(*) from public.dynamic_render_jobs) render_count,
  (select sum(data_revision) from public.published_dynamic_data) data_revisions;
create temp table s190_diag_result(payload jsonb);
insert into s190_diag_result select public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001931');
select is((select payload->>'tenantId' from s190_diag_result),'10000000-0000-4000-8000-000000001931','diagnostic scope identifies only the requested active tenant');
select ok((select payload::text not like '%000000001932%' from s190_diag_result),'another tenant source or connection never appears in tenant A readback');
select ok((select payload::text not like '%PRIVATE_SENTINEL%' and payload::text not like '%private-sentinel%' from s190_diag_result),
  'names, payloads, birth dates, encrypted fields, lease owners and arbitrary error strings stay private');
select is((select payload#>>'{ledScores,0,reconnectCount}' from s190_diag_result),'15','LED reconnect history is visible without raw events');
select is((select payload#>>'{ledScores,0,invalidMessageCount}' from s190_diag_result),'22','LED invalid message count preserves failure evidence');
select is((select payload#>>'{ledScores,0,persistedMessageEventCount24h}' from s190_diag_result),'1','persisted message event counter has explicit limited semantics');
select is((select payload#>>'{ledScores,0,goalCount24h}' from s190_diag_result),'1','real goal counters require no scorer identity');
select is((select payload#>>'{sportlink,0,datasets,0,latestRunStatus}' from s190_diag_result),'failed','latest attempt status is not hidden by last good synchronization');
select is((select payload#>>'{sportlink,0,datasets,0,errorCode}' from s190_diag_result),'SPORTLINK_SYNC_COMPLETE_57014','known database timeout identifies the failed Sportlink attempt');
select is((select payload#>>'{sportlink,0,datasets,0,freshness}' from s190_diag_result),'due','policy freshness distinguishes overdue work');
select is((select payload#>>'{sportlink,0,birthdayProbeAllowed}' from s190_diag_result),'false',
  'privacy enabled without an enabled public_people policy cannot authorize provider probing');
insert into public.sportlink_sync_policies(tenant_id,connection_id,dataset_group,frequency,enabled)
  values('10000000-0000-4000-8000-000000001931','30000000-0000-4000-8000-000000001931','public_people','daily',false);
select is(public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001931')#>>'{sportlink,0,birthdayProbeAllowed}','false',
  'a paused public_people dataset cannot authorize a provider probe');
update public.sportlink_sync_policies set enabled=true where tenant_id='10000000-0000-4000-8000-000000001931' and dataset_group='public_people';
select is(public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001931')#>>'{sportlink,0,birthdayProbeAllowed}','true',
  'active privacy, feature and dataset policy together authorize only the read-only probe');
update public.tenant_feature_flags set enabled=false where tenant_id='10000000-0000-4000-8000-000000001931' and flag_key='sportlink_birthdays';
select is(public.get_live_integration_diagnostics_v1('10000000-0000-4000-8000-000000001931')#>>'{sportlink,0,birthdayProbeAllowed}','false',
  'disabled birthday feature blocks credential selection even if the dataset remains enabled');
select is((select payload#>>'{publishedBindings,0,dataRevision}' from s190_diag_result),'3','published data revision is available per binding');
select is((select payload#>>'{publishedBindings,0,liveItemCount}' from s190_diag_result),'2','only the live item count leaves the stored member payload');
select is((select payload#>>'{publishedBindings,0,refreshErrorCode}' from s190_diag_result),'UNKNOWN_ERROR','queued raw provider strings are redacted');
select is((select payload#>>'{queues,publishedData,leasedCount}' from s190_diag_result),'1','leases are counted without exposing their tokens');
select is((select payload#>>'{queues,publishedData,dueCount}' from s190_diag_result),'1','due queue work remains visible during a valid lease');
select is((select payload#>>'{queues,versionPrune,dueCount}' from s190_diag_result),'1','deferred retention backlog is visible read-only');
select is((select payload#>>'{counts,snapshots}' from s190_diag_result),'1','snapshot count supports before/after history-growth checks');
select is((select payload#>>'{counts,renderJobs}' from s190_diag_result),'1','render count supports source-refresh history-growth checks');
select is((select payload#>>'{players,reports,0,targetRevision}' from s190_diag_result),'4','numeric Player assignment revision survives safe projection');
select is((select payload#>>'{players,dataRevisionReportingAvailable}' from s190_diag_result),'false','database revisions are never claimed to be acknowledged Player frames');
select ok((select row(refresh_count,snapshot_count,render_count,data_revisions)=row(
  (select count(*) from private.published_data_refresh_queue),(select count(*) from public.dynamic_slide_snapshots),
  (select count(*) from public.dynamic_render_jobs),(select sum(data_revision) from public.published_dynamic_data)) from s190_diag_before),
  'operational readback neither consumes queue work nor creates rendering/version work');
with recursive values_tree(value) as (
  select payload from s190_diag_result
  union all
  select child.value from values_tree cross join lateral (
    select value from jsonb_each(case when jsonb_typeof(values_tree.value)='object' then values_tree.value else '{}'::jsonb end)
    union all select value from jsonb_array_elements(case when jsonb_typeof(values_tree.value)='array' then values_tree.value else '[]'::jsonb end)
  ) child
)
select ok(not exists(select 1 from values_tree cross join lateral jsonb_object_keys(
  case when jsonb_typeof(value)='object' then value else '{}'::jsonb end) key
  where key in ('name','displayName','dateOfBirth','client_id_suffix','encrypted_client_id','encryption_iv','encryption_tag',
    'config_json','payload','state_json','snapshot_data_json','data_json','error_detail','health_detail','lease_token','lease_owner','token_hash','url')),
  'nested diagnostic structure has no provider payload, secret or member fields');
select * from finish();
rollback;
