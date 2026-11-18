begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('31700000-0000-4000-8000-000000000001','authenticated','authenticated','s317-admin@veyocast.test','test',now(),now(),now(),'{}','{}'),
('31700000-0000-4000-8000-000000000002','authenticated','authenticated','s317-viewer@veyocast.test','test',now(),now(),now(),'{}','{}'),
('31700000-0000-4000-8000-000000000003','authenticated','authenticated','s317-other@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('31700000-0000-4000-8000-000000000001','Agent admin'),('31700000-0000-4000-8000-000000000002','Agent viewer'),('31700000-0000-4000-8000-000000000003','Other admin');
insert into public.tenants(id,name,slug) values
('31700000-0000-4000-8000-000000000011','Agent A','s317-agent-a'),('31700000-0000-4000-8000-000000000012','Agent B','s317-agent-b');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000001','tenant_admin'),
('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000002','tenant_viewer'),
('31700000-0000-4000-8000-000000000012','31700000-0000-4000-8000-000000000003','tenant_admin');
insert into public.platform_memberships(user_id,role) values('31700000-0000-4000-8000-000000000001','platform_admin');
insert into public.playlists(id,tenant_id,name,created_by,updated_by) values
('31700000-0000-4000-8000-000000000021','31700000-0000-4000-8000-000000000011','Original A','31700000-0000-4000-8000-000000000001','31700000-0000-4000-8000-000000000001'),
('31700000-0000-4000-8000-000000000022','31700000-0000-4000-8000-000000000012','Original B','31700000-0000-4000-8000-000000000003','31700000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub','31700000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"31700000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
select is(public.get_ai_agent_state_v1('31700000-0000-4000-8000-000000000011'),false,'new tenant defaults off without an activation');
select throws_ok($$insert into public.ai_conversations(tenant_id,user_id) values('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000001')$$,'42501',null,'disabled agent cannot open a conversation');
select throws_ok($$select public.read_ai_provider_config_v1('staging')$$,'42501',null,'authenticated clients cannot obtain encrypted provider material');
reset role;
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason,changed_by) values('31700000-0000-4000-8000-000000000011','control_ai_agent',true,'Explicit isolated test activation','31700000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.get_ai_agent_state_v1('31700000-0000-4000-8000-000000000011'),true,'explicit activation enables only tenant A');
select is(public.get_ai_agent_state_v1('31700000-0000-4000-8000-000000000012'),false,'tenant B remains off and inaccessible');
insert into public.ai_conversations(id,tenant_id,user_id) values('31700000-0000-4000-8000-000000000031','31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000001');
select throws_ok($$select public.begin_ai_provider_request_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000090','31700000-0000-4000-8000-000000000091','staging','chat','test-model',1)$$,'55000',null,'missing key cannot admit a paid provider call');
select set_config('s317.proposal',(public.create_ai_proposal_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000031','{"steps":[{"domain":"playlist","operation":"update_details","commandKey":"31700000-0000-4000-8000-000000000041","args":{"id":"31700000-0000-4000-8000-000000000021","revision":0,"payload":{"name":"First confirmed","description":"preserved"}}},{"domain":"playlist","operation":"update_details","commandKey":"31700000-0000-4000-8000-000000000042","args":{"id":"31700000-0000-4000-8000-000000000021","revision":1,"payload":{"name":"Second confirmed","description":"preserved"}}}]}')->>'id'),true);
select set_config('s317.hash',(select plan_hash from public.ai_proposals where id=current_setting('s317.proposal')::uuid),true);
select is((select name from public.playlists where id='31700000-0000-4000-8000-000000000021'),'Original A','a persisted proposal cannot mutate a playlist');
select throws_ok($$select public.execute_ai_proposal_step_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),0)$$,'42501',null,'proposal without exact approval cannot execute');
select throws_ok($$select public.decide_ai_proposal_v1(current_setting('s317.proposal')::uuid,repeat('f',64),true)$$,'40001',null,'approval is tied to the immutable displayed hash');
select is(public.decide_ai_proposal_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),true)->>'status','approved','exact approval is durably acknowledged');
select is(public.execute_ai_proposal_step_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),0)->>'status','running','first domain mutation and receipt commit together');
select is((select name from public.playlists where id='31700000-0000-4000-8000-000000000021'),'First confirmed','first step actually uses the existing playlist writer');
select is(public.execute_ai_proposal_step_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),0)->>'next_step','1','a delayed caller cannot execute the next step without checking it');
select is(public.execute_ai_proposal_step_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),1)->>'status','completed','second step completes the same approved plan');
select is((select revision from public.playlists where id='31700000-0000-4000-8000-000000000021'),2::bigint,'exactly two approved writes increment the draft twice');
select is(jsonb_array_length(public.execute_ai_proposal_step_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),1)->'receipts'),2,'double confirmation returns the original two receipts');
select is((select revision from public.playlists where id='31700000-0000-4000-8000-000000000021'),2::bigint,'network replay never repeats a committed mutation');
select throws_ok($$update public.ai_proposals set plan='{}' where id=current_setting('s317.proposal')::uuid$$,'42501',null,'browser cannot edit an immutable proposal or forge approval state');
select set_config('s317.stale',(public.create_ai_proposal_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000031','{"steps":[{"domain":"playlist","operation":"update_details","commandKey":"31700000-0000-4000-8000-000000000043","args":{"id":"31700000-0000-4000-8000-000000000021","revision":0,"payload":{"name":"Stale write","description":""}}}]}')->>'id'),true);
select set_config('s317.stale_hash',(select plan_hash from public.ai_proposals where id=current_setting('s317.stale')::uuid),true);
select public.decide_ai_proposal_v1(current_setting('s317.stale')::uuid,current_setting('s317.stale_hash'),true);
select is(public.execute_ai_proposal_step_v1(current_setting('s317.stale')::uuid,current_setting('s317.stale_hash'),0)->>'status','review_required','stale object revision requires a new displayed proposal');
select is((select name from public.playlists where id='31700000-0000-4000-8000-000000000021'),'Second confirmed','a stale response cannot overwrite newer data');
select set_config('s317.partial',(public.create_ai_proposal_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000031','{"steps":[{"domain":"playlist","operation":"update_details","commandKey":"31700000-0000-4000-8000-000000000044","args":{"id":"31700000-0000-4000-8000-000000000021","revision":2,"payload":{"name":"Partial confirmed","description":""}}},{"domain":"playlist","operation":"invalid_operation","commandKey":"31700000-0000-4000-8000-000000000045","args":{"id":"31700000-0000-4000-8000-000000000021","revision":3,"payload":{}}}]}')->>'id'),true);
select set_config('s317.partial_hash',(select plan_hash from public.ai_proposals where id=current_setting('s317.partial')::uuid),true);
select public.decide_ai_proposal_v1(current_setting('s317.partial')::uuid,current_setting('s317.partial_hash'),true);
select public.execute_ai_proposal_step_v1(current_setting('s317.partial')::uuid,current_setting('s317.partial_hash'),0);
select is(public.execute_ai_proposal_step_v1(current_setting('s317.partial')::uuid,current_setting('s317.partial_hash'),1)->>'status','failed','a partial failure is durable and resumable');
select is(jsonb_array_length((select receipts from public.ai_proposals where id=current_setting('s317.partial')::uuid)),1,'only actually completed steps are receipts');
select public.execute_ai_proposal_step_v1(current_setting('s317.partial')::uuid,current_setting('s317.partial_hash'),1);
select is((select revision from public.playlists where id='31700000-0000-4000-8000-000000000021'),3::bigint,'retrying the failed step does not repeat an earlier successful step');
select set_config('s317.cancel',(public.create_ai_proposal_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000031','{"steps":[{"domain":"playlist","operation":"archive","commandKey":"31700000-0000-4000-8000-000000000046","args":{"id":"31700000-0000-4000-8000-000000000021","revision":3,"payload":{}}}]}')->>'id'),true);
select set_config('s317.cancel_hash',(select plan_hash from public.ai_proposals where id=current_setting('s317.cancel')::uuid),true);
select is(public.decide_ai_proposal_v1(current_setting('s317.cancel')::uuid,current_setting('s317.cancel_hash'),false)->>'status','cancelled','cancellation never mutates the target');
select throws_ok($$select public.execute_ai_proposal_step_v1(current_setting('s317.cancel')::uuid,current_setting('s317.cancel_hash'),0)$$,'42501',null,'a cancelled unapproved plan cannot execute');
select set_config('request.jwt.claim.sub','31700000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"31700000-0000-4000-8000-000000000002","aal":"aal2","role":"authenticated"}',true);
select is((select count(*) from public.ai_proposals),0::bigint,'other users in the same tenant cannot read private proposals');
select throws_ok($$select public.decide_ai_proposal_v1(current_setting('s317.proposal')::uuid,current_setting('s317.hash'),true)$$,'42501',null,'another user cannot approve or resume the owner proposal');
insert into public.ai_conversations(id,tenant_id,user_id) values('31700000-0000-4000-8000-000000000032','31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000002');
select set_config('s317.viewer',(public.create_ai_proposal_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000032','{"steps":[{"domain":"playlist","operation":"publish","commandKey":"31700000-0000-4000-8000-000000000047","args":{"id":"31700000-0000-4000-8000-000000000021","revision":3,"screenIds":[]}}]}')->>'id'),true);
select set_config('s317.viewer_hash',(select plan_hash from public.ai_proposals where id=current_setting('s317.viewer')::uuid),true);
select public.decide_ai_proposal_v1(current_setting('s317.viewer')::uuid,current_setting('s317.viewer_hash'),true);
reset role;
set local role service_role;
select ok(public.register_ai_execution_check_v1(current_setting('s317.viewer')::uuid,current_setting('s317.viewer_hash'),0,'31700000-0000-4000-8000-000000000002','31700000-0000-4000-8000-000000000011'),'even a trusted proof cannot grant an additional publication capability');
reset role;
set local role authenticated;
select is(public.execute_ai_proposal_step_v1(current_setting('s317.viewer')::uuid,current_setting('s317.viewer_hash'),0)->>'last_error_code','42501','viewer publication is denied by the current SQL action capability despite approval and proof');
select is((select count(*) from public.playlist_releases where playlist_id='31700000-0000-4000-8000-000000000021'),0::bigint,'insufficient publication rights produce no release or target write');
select set_config('request.jwt.claim.sub','31700000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"31700000-0000-4000-8000-000000000003","aal":"aal2","role":"authenticated"}',true);
select is((select count(*) from public.ai_conversations),0::bigint,'tenant B cannot read tenant A conversations');
select throws_ok($$select public.create_ai_proposal_v1('31700000-0000-4000-8000-000000000011','31700000-0000-4000-8000-000000000031','{"steps":[{}]}')$$,'42501',null,'cross-tenant proposal creation is denied');
reset role;
update public.tenant_feature_flags set enabled=false where tenant_id='31700000-0000-4000-8000-000000000011' and flag_key='control_ai_agent';
set local role authenticated;
select set_config('request.jwt.claim.sub','31700000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"31700000-0000-4000-8000-000000000001","aal":"aal2","role":"authenticated"}',true);
select throws_ok($$select public.execute_ai_proposal_step_v1(current_setting('s317.partial')::uuid,current_setting('s317.partial_hash'),1)$$,'42501',null,'disabling blocks new background/write steps of an approved proposal');
select is((select name from public.playlists where id='31700000-0000-4000-8000-000000000021'),'Partial confirmed','disabling preserves all ordinary playlist data');
select ok(not has_function_privilege('anon','public.execute_ai_proposal_step_v1(uuid,text,integer)','execute'),'anonymous execution is denied');
select ok(not has_function_privilege('authenticated','public.register_ai_execution_check_v1(uuid,text,integer,uuid,uuid)','execute'),'browser cannot fabricate a publication preflight proof');
select ok(not has_table_privilege('authenticated','public.ai_provider_requests','insert'),'provider usage cannot be forged by direct browser inserts');
select ok(not has_table_privilege('authenticated','public.ai_proposals','update'),'approval and immutable plan columns have no browser update grant');
select * from finish();
rollback;
