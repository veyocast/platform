begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000226001','inquiry-tenant-a@veyocast.test'),
 ('00000000-0000-4000-8000-000000226002','inquiry-tenant-b@veyocast.test'),
 ('00000000-0000-4000-8000-000000226003','inquiry-platform@veyocast.test');
insert into public.profiles(id,display_name) select id,'Inquiry test' from auth.users where email like 'inquiry-%@veyocast.test';
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000226001','Inquiry A','inquiry-a'),
 ('10000000-0000-4000-8000-000000226002','Inquiry B','inquiry-b');
insert into public.tenant_memberships(tenant_id,user_id,role) values
 ('10000000-0000-4000-8000-000000226001','00000000-0000-4000-8000-000000226001','tenant_admin'),
 ('10000000-0000-4000-8000-000000226002','00000000-0000-4000-8000-000000226002','tenant_admin');
insert into public.platform_memberships(user_id,role) values ('00000000-0000-4000-8000-000000226003','platform_admin');
create temporary table fixture(payload jsonb, receipt jsonb);
insert into fixture(payload) values ('{"kind":"demo","name":"Test operator","email":"prospect@example.test","organization":"Test club","organizationType":"Sportvereniging","screens":"1–3","message":"Een scherm in de kantine","consent":"yes","setupIntent":{"screenCount":2}}');
grant all on fixture to anon,authenticated,service_role;

set local role anon;
select throws_ok($$select * from public.marketing_inquiries$$,'42501',null,'anonymous cannot read prospect data');
select throws_ok($$select public.submit_marketing_inquiry_v1('20000000-0000-4000-8000-000000226001',(select payload from fixture))$$,'42501',null,'anonymous cannot bypass the validated server intake');
reset role;
set local role service_role;
update fixture set receipt=public.submit_marketing_inquiry_v1('20000000-0000-4000-8000-000000226001',payload);
select is((select receipt->>'received' from fixture),'true','receipt follows durable insert');
select is(public.submit_marketing_inquiry_v1('20000000-0000-4000-8000-000000226001',(select payload from fixture)),(select receipt from fixture),'same request replays the same receipt');
select is((select count(*)::integer from public.marketing_inquiries where request_id='20000000-0000-4000-8000-000000226001'),1,'retry creates exactly one inquiry');
select is((select count(*)::integer from public.marketing_inquiry_delivery where inquiry_id=(select (receipt->>'id')::uuid from fixture)),1,'retry creates exactly one outbox item');
select is((select setup_intent->>'screenCount' from public.marketing_inquiries where request_id='20000000-0000-4000-8000-000000226001'),'2','verified setup survives storage');
select throws_ok($$select public.submit_marketing_inquiry_v1('20000000-0000-4000-8000-000000226001',(select payload||'{"name":"Changed operator"}'::jsonb from fixture))$$,'22023','inquiry_request_conflict','changed replay cannot overwrite an accepted request');
select throws_ok($$select public.submit_marketing_inquiry_v1('20000000-0000-4000-8000-000000226002',(select payload||'{"consent":"no"}'::jsonb from fixture))$$,'22023','invalid_inquiry','missing consent is rejected at the database');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226001',true);
select set_config('request.jwt.claim.aal','aal2',true);
select is((select count(*)::integer from public.marketing_inquiries),0,'tenant A cannot read platform prospects');
select is((select count(*)::integer from public.marketing_inquiry_delivery),0,'tenant A cannot read mail status');
select throws_ok($$select public.update_marketing_inquiry_v1((select (receipt->>'id')::uuid from fixture),1,'closed','')$$,'42501',null,'tenant A cannot update platform prospects');
select throws_ok($$delete from public.marketing_inquiries$$,'42501',null,'tenant A cannot delete prospects');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226002',true);
select is((select count(*)::integer from public.marketing_inquiries),0,'tenant B cannot read another organization inquiry');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226003',true);
select is((select count(*)::integer from public.marketing_inquiries where request_id='20000000-0000-4000-8000-000000226001'),1,'authorized platform inbox can read receipt');
select set_config('request.jwt.claim.aal','aal1',true);
select throws_ok($$select public.update_marketing_inquiry_v1((select (receipt->>'id')::uuid from fixture),1,'contacted','Called')$$,'42501',null,'AAL1 cannot mutate the inquiry');
select set_config('request.jwt.claim.aal','aal2',true);
select is(public.update_marketing_inquiry_v1((select (receipt->>'id')::uuid from fixture),1,'contacted','Called'),2,'authorized update increments revision');
select throws_ok($$select public.update_marketing_inquiry_v1((select (receipt->>'id')::uuid from fixture),1,'closed','Stale')$$,'PT409',null,'concurrent stale update is rejected');
select is((select notes from public.marketing_inquiries where request_id='20000000-0000-4000-8000-000000226001'),'Called','conflict preserves accepted notes');
reset role;
select ok(exists(select 1 from public.audit_events where action='marketing.inquiry.updated' and target_id=(select (receipt->>'id')::uuid from fixture)),'platform change has an atomic audit receipt');
alter table fixture add column mail_claim jsonb;
set local role service_role;
update fixture set mail_claim=public.claim_marketing_inquiry_mail_v1();
select is((select mail_claim->>'id' from fixture),(select receipt->>'id' from fixture),'worker claims the stored inquiry');
select is(public.claim_marketing_inquiry_mail_v1(),null::jsonb,'another worker cannot claim an in-flight send');
select is(public.complete_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),'30000000-0000-4000-8000-000000226099','accepted'),false,'stale sender cannot complete another lease');
select is(public.complete_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),(select (mail_claim->>'leaseId')::uuid from fixture),'accepted','sendgrid-receipt'),true,'exact sender records provider acceptance');
select is((select status from public.marketing_inquiry_delivery where inquiry_id=(select (receipt->>'id')::uuid from fixture)),'accepted','provider acceptance is separate from inbox receipt');
update fixture set receipt=public.submit_marketing_inquiry_v1('20000000-0000-4000-8000-000000226002',payload);
update fixture set mail_claim=public.claim_marketing_inquiry_mail_v1();
update public.marketing_inquiry_delivery set lease_until=now()-interval '1 second' where inquiry_id=(select (receipt->>'id')::uuid from fixture);
select is(public.claim_marketing_inquiry_mail_v1(),null::jsonb,'expired send is not automatically retried');
select is((select status from public.marketing_inquiry_delivery where inquiry_id=(select (receipt->>'id')::uuid from fixture)),'unknown','expired lease preserves delivery uncertainty');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226001',true);
select throws_ok($$select public.retry_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),1,true)$$,'42501',null,'tenant cannot trigger a platform mail retry');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226003',true);
select throws_ok($$select public.retry_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),1,false)$$,'22023',null,'unknown send requires explicit reconciliation');
select is(public.retry_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),1,true),2,'authorized reconciled retry keeps the same outbox identity');
select throws_ok($$select public.retry_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),1,true)$$,'PT409',null,'double retry is rejected by revision guard');
reset role;
set local role service_role;
select is(public.complete_marketing_inquiry_mail_v1((select (receipt->>'id')::uuid from fixture),(select (mail_claim->>'leaseId')::uuid from fixture),'accepted'),false,'old completion cannot erase a new retry');
update public.marketing_inquiry_delivery set status='failed',attempts=5,last_error_code='mail_provider_unavailable' where inquiry_id=(select (receipt->>'id')::uuid from fixture);
select is(public.claim_marketing_inquiry_mail_v1(),null::jsonb,'automatic retry stops after five attempts');
reset role;
select * from finish();
rollback;
