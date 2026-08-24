begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(64);

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000001271','authenticated','authenticated','billing-owner@test.invalid','test',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001272','authenticated','authenticated','billing-viewer@test.invalid','test',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001273','authenticated','authenticated','billing-other@test.invalid','test',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001274','authenticated','authenticated','billing-platform@test.invalid','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000001271','Billing owner'),('00000000-0000-4000-8000-000000001272','Billing viewer'),('00000000-0000-4000-8000-000000001273','Other owner'),('00000000-0000-4000-8000-000000001274','Billing platform admin');
insert into public.platform_memberships(user_id,role) values('00000000-0000-4000-8000-000000001274','platform_admin');
insert into public.tenants(id,name,slug,screen_limit) values
('10000000-0000-4000-8000-000000001271','Billing tenant','billing-tenant',5),('10000000-0000-4000-8000-000000001273','Other billing tenant','billing-other',5);
insert into public.tenant_settings(tenant_id) values('10000000-0000-4000-8000-000000001271'),('10000000-0000-4000-8000-000000001273');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000001271','00000000-0000-4000-8000-000000001271','tenant_owner'),
('10000000-0000-4000-8000-000000001271','00000000-0000-4000-8000-000000001272','tenant_viewer'),
('10000000-0000-4000-8000-000000001273','00000000-0000-4000-8000-000000001273','tenant_owner');
insert into public.screens(id,tenant_id,name,created_by) values
('20000000-0000-4000-8000-000000001271','10000000-0000-4000-8000-000000001271','Entree','00000000-0000-4000-8000-000000001271');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001271',true);
select throws_ok($$select public.ensure_billing_account_v1('10000000-0000-4000-8000-000000001271','Billing tenant','factuur@test.invalid','NL','launch-2026-08-24',true)$$,'42501','aal2 required','billing setup requires recent AAL2');
select set_config('request.jwt.claim.aal','aal2',true);
select ok(public.ensure_billing_account_v1('10000000-0000-4000-8000-000000001271','Billing tenant','factuur@test.invalid','NL','launch-2026-08-24',true) is not null,'owner creates a billing account through the guarded command');
select is((select provider_mode from public.billing_accounts),'test','new billing accounts are hard-separated into provider test mode');
select is((select gross_unit_cents from public.billing_price_versions where version=1),595,'immutable price is stored in cents');
select is((select vat_basis_points from public.billing_price_versions where version=1),2100,'price version freezes inclusive VAT rate');
select is((select count(*) from public.billing_subscriptions),1::bigint,'account gets one draft commercial subscription');
select is((select count(*) from public.billing_outbox),1::bigint,'account creation and provider command are transactionally linked');
select is((select operation from public.billing_outbox),'create_mollie_customer','outbox records the provider operation without secrets');
select is(public.ensure_billing_account_v1('10000000-0000-4000-8000-000000001271','Ignored','ignored@test.invalid','NL','other',true),(select id from public.billing_accounts),'repeated setup resumes the existing billing account');
select throws_ok($$insert into public.billing_accounts(tenant_id,legal_name,invoice_email,terms_version,terms_accepted_at,terms_accepted_by) values('10000000-0000-4000-8000-000000001271','Direct','direct@test.invalid','x',now(),'00000000-0000-4000-8000-000000001271')$$,'42501','permission denied for table billing_accounts','browser cannot bypass billing commands');

reset role;
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason) values
('10000000-0000-4000-8000-000000001271','billing_engine_enabled',true,'Billing shadow test'),
('10000000-0000-4000-8000-000000001271','billing_enforce_entitlements',true,'Entitlement test'),
('10000000-0000-4000-8000-000000001271','billing_dunning_worker',true,'Dunning test'),
('10000000-0000-4000-8000-000000001271','billing_player_warning_chip',true,'Warning cohort'),
('10000000-0000-4000-8000-000000001271','billing_player_restriction_splash',true,'Restriction cohort');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status) values
('30000000-0000-4000-8000-000000001271','10000000-0000-4000-8000-000000001271','20000000-0000-4000-8000-000000001271',repeat('a',64),'paired');
select is((select status from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),'trialing','first successful paired device starts trial');
select is((select extract(epoch from(trial_ends_at-trial_started_at))::bigint from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),1209600::bigint,'trial is exactly fourteen times twenty-four hours');
select is((select count(*) from public.screen_billing_intervals),1::bigint,'first Player activation opens one billable interval');
select is((select count(*) from public.tenant_entitlement_snapshots),1::bigint,'trial activation writes a monotonic entitlement snapshot');
update public.player_devices set status='revoked',revoked_at=now() where id='30000000-0000-4000-8000-000000001271';
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status) values('30000000-0000-4000-8000-000000001272','10000000-0000-4000-8000-000000001271','20000000-0000-4000-8000-000000001271',repeat('d',64),'paired');
select is((select count(*) from public.screen_billing_intervals),1::bigint,'hardware replacement on the same logical screen never opens a second charge');
select is((select trial_started_at from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),(select started_at from public.screen_billing_intervals),'replacement never restarts the one-time trial');

set local role anon;
select is((select playback_mode from public.get_player_entitlement_v1(repeat('d',64))),'tenant_content','anonymous Player receives only its bounded entitlement projection');
select is((select count(*) from public.get_player_entitlement_v1(repeat('b',64))),0::bigint,'unknown device token reveals no entitlement');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001272',true);
select is((select count(*) from public.billing_accounts),1::bigint,'tenant viewer can read its transparent billing account');
select is((select count(*) from public.billing_invoices),0::bigint,'tenant viewer can read its own invoice collection');
select throws_ok($$select public.ensure_billing_account_v1('10000000-0000-4000-8000-000000001273','Other','other@test.invalid','NL','x',true)$$,'42501','billing manage permission required','viewer cannot manage billing or cross tenant boundaries');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001273',true);
select set_config('request.jwt.claim.aal','aal2',true);
select is((select count(*) from public.billing_accounts),0::bigint,'another tenant cannot read billing accounts');
select is((select count(*) from public.screen_billing_intervals),0::bigint,'another tenant cannot read screen usage');
select is((select count(*) from public.tenant_entitlement_snapshots),0::bigint,'another tenant cannot read entitlement history');

reset role;
select throws_ok($$update public.billing_price_versions set gross_unit_cents=1 where version=1$$,'55000','billing history is append-only','used price history cannot be edited');
select throws_ok($$delete from public.tenant_entitlement_snapshots$$,'55000','billing history is append-only','entitlement history cannot be deleted');
select throws_ok($$insert into public.billing_payment_attempts(tenant_id,billing_account_id,invoice_id,attempt_no,semantic_key,provider_mode,expected_amount_cents,expected_customer_id,sequence_type) values('10000000-0000-4000-8000-000000001271',(select id from public.billing_accounts where tenant_id='10000000-0000-4000-8000-000000001271'),'ffffffff-ffff-4fff-8fff-ffffffffffff',1,'bad','test',595,'cst_test','recurring')$$,'23503',null,'payment attempts cannot cross an absent tenant invoice');
update public.billing_accounts set mollie_customer_id='cst_BillingTest' where tenant_id='10000000-0000-4000-8000-000000001271';
insert into public.billing_mandates(tenant_id,billing_account_id,provider_mode,mollie_mandate_id,method,status,is_primary)
select tenant_id,id,'test','mdt_BillingTest','directdebit','valid',true from public.billing_accounts where tenant_id='10000000-0000-4000-8000-000000001271';
update public.tenant_feature_flags set enabled=true where tenant_id='10000000-0000-4000-8000-000000001271' and flag_key='billing_collect_recurring';
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason) values('10000000-0000-4000-8000-000000001271','billing_collect_recurring',true,'Collection test') on conflict(tenant_id,flag_key) do update set enabled=excluded.enabled;
update public.screen_billing_intervals set started_at='2026-01-15T00:00:00Z';
update public.billing_subscriptions set trial_started_at='2026-01-01T00:00:00Z',trial_ends_at='2026-01-15T00:00:00Z';
select ok(public.generate_billing_cycle_v1((select id from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),'2026-01-15T00:00:00Z','2026-02-15T00:00:00Z') is not null,'cycle worker creates one immutable invoice snapshot');
select is((select gross_cents from public.billing_invoices),595::bigint,'full screen month is charged as 595 integer cents');
select is((select net_cents from public.billing_invoices),492::bigint,'inclusive VAT net amount rounds from aggregate gross');
select is((select vat_cents from public.billing_invoices),103::bigint,'inclusive VAT remainder is exact');
select is((select count(*) from public.billing_payment_attempts where sequence_type='recurring'),1::bigint,'collection cohort creates one recurring attempt');
select is((select count(*) from public.billing_outbox where operation='create_recurring_payment'),1::bigint,'invoice and provider command commit together');
select is(public.generate_billing_cycle_v1((select id from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),'2026-01-15T00:00:00Z','2026-02-15T00:00:00Z'),(select id from public.billing_invoices),'cycle replay returns the same invoice');
select is(public.apply_verified_billing_payment_v1((select id from public.billing_payment_attempts where sequence_type='recurring'),'test','tr_BillingTest','paid',595,'EUR','cst_BillingTest','mdt_BillingTest',repeat('c',64),'request-1','reconcile'),'paid','verified provider state settles the local attempt');
select is((select status from public.billing_invoices),'paid','verified payment settles the immutable invoice amount');
select is((select status from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),'active','first paid cycle promotes trial to active');
select is(public.apply_verified_billing_payment_v1((select id from public.billing_payment_attempts where sequence_type='recurring'),'test','tr_BillingTest','charged_back',595,'EUR','cst_BillingTest','mdt_BillingTest',repeat('d',64),'request-2','reconcile'),'charged_back','a later chargeback on the same payment ID is not deduplicated away');
select is(public.apply_verified_billing_payment_v1((select id from public.billing_payment_attempts where sequence_type='recurring'),'test','tr_BillingTest','charged_back',595,'EUR','cst_BillingTest','mdt_BillingTest',repeat('e',64),'request-3','classic'),'charged_back','duplicate out-of-order delivery is accepted without a second financial effect');
select is((select status from public.billing_invoices),'payment_reversed','chargeback moves the invoice into payment reversed state');
select is((select status from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),'grace','chargeback starts a bounded recovery period');
select is((select count(*) from public.billing_credit_ledger where semantic_key='payment:tr_BillingTest:chargeback'),1::bigint,'chargeback has exactly one append-only financial effect');
select is((select count(*) from public.billing_notifications where stage='d0'),2::bigint,'payment reversal schedules one in-app and one email D0 notice');
select is(public.schedule_billing_dunning_v1((select grace_started_at+interval '6 days' from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271')),6,'D1 D3 and D6 each schedule both notification channels');
select is((select count(*) from public.billing_notifications),10::bigint,'paid and dunning milestones are all persisted with semantic keys');
select is(public.schedule_billing_dunning_v1((select grace_started_at+interval '6 days' from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271')),0,'dunning scheduling is replay safe');
update public.billing_subscriptions set grace_started_at=expired.at-interval '8 days',grace_ends_at=expired.at-interval '1 day' from(select clock_timestamp() at) expired where tenant_id='10000000-0000-4000-8000-000000001271';
select is(public.advance_billing_entitlements_v1(clock_timestamp()),1,'expired grace advances exactly one tenant entitlement');
select is((select status from public.billing_subscriptions where tenant_id='10000000-0000-4000-8000-000000001271'),'restricted','expired grace becomes restricted');
update public.tenant_feature_flags set enabled=false where tenant_id='10000000-0000-4000-8000-000000001271' and flag_key='billing_enforce_entitlements';
set local role anon;
select is((select playback_mode from public.get_player_entitlement_v1(repeat('d',64))),'tenant_content','enforcement kill switch restores LKG playback without mutating the entitlement ledger');
reset role;
update public.tenant_feature_flags set enabled=true where tenant_id='10000000-0000-4000-8000-000000001271' and flag_key='billing_enforce_entitlements';
insert into public.screens(id,tenant_id,name,created_by) values('20000000-0000-4000-8000-000000001272','10000000-0000-4000-8000-000000001271','Net nieuw','00000000-0000-4000-8000-000000001271');
select throws_ok($$insert into public.player_devices(id,tenant_id,screen_id,token_hash,status) values('30000000-0000-4000-8000-000000001273','10000000-0000-4000-8000-000000001271','20000000-0000-4000-8000-000000001272',repeat('e',64),'paired')$$,'55000','billing entitlement blocks activation of a new screen','restricted billing blocks a net-new billable activation');
update public.screens set status='disabled' where id='20000000-0000-4000-8000-000000001271';
select ok((select ended_at is not null and end_reason='screen_disabled' from public.screen_billing_intervals where screen_id='20000000-0000-4000-8000-000000001271'),'screen deactivation closes its billable interval');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001274',true);
select set_config('request.jwt.claim.aal','aal1',true);
select throws_ok($$select public.create_billing_override_v1('10000000-0000-4000-8000-000000001271','temporary_entitlement',24,'Bevestigd herstel voor deze tenant','support-request-1274')$$,'42501','aal2 required','platform billing override requires recent AAL2');
select set_config('request.jwt.claim.aal','aal2',true);
select ok(public.create_billing_override_v1('10000000-0000-4000-8000-000000001271','temporary_entitlement',24,'Bevestigd herstel voor deze tenant','support-request-1274') is not null,'platform admin creates a bounded audited override');
select is((select count(*) from public.billing_overrides where tenant_id='10000000-0000-4000-8000-000000001271'),1::bigint,'override is stored once with tenant scope');
select is((select playback_mode from public.tenant_entitlement_snapshots where tenant_id='10000000-0000-4000-8000-000000001271' order by revision desc limit 1),'tenant_content','temporary override creates a new playback entitlement without changing the subscription');
reset role;
update public.billing_overrides set starts_at=expired.at-interval '2 hours',expires_at=expired.at-interval '1 hour' from(select clock_timestamp() at) expired where tenant_id='10000000-0000-4000-8000-000000001271';
select is(public.expire_billing_overrides_v1(clock_timestamp()),1,'override expiry is processed once');
select is((select playback_mode from public.tenant_entitlement_snapshots where tenant_id='10000000-0000-4000-8000-000000001271' order by revision desc limit 1),'veyocast_billing_splash','expiry publishes a fresh restricted entitlement without mutating history');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001274',true);
select set_config('request.jwt.claim.aal','aal2',true);
select throws_ok($$select public.promote_billing_account_live_v1('10000000-0000-4000-8000-000000001271','Live provider gecontroleerd','support-live-1274')$$,'42501','platform owner billing promotion required','platform admin cannot promote billing to live');
reset role;
update public.platform_memberships set role='platform_owner' where user_id='00000000-0000-4000-8000-000000001274';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001274',true);
select set_config('request.jwt.claim.aal','aal2',true);
select ok(public.promote_billing_account_live_v1('10000000-0000-4000-8000-000000001271','Live provider gecontroleerd','support-live-1274') is not null,'platform owner can explicitly promote after external provider review');
select is((select provider_mode from public.billing_accounts where tenant_id='10000000-0000-4000-8000-000000001271'),'live','live promotion separates the account from test provider IDs');
select is((select payload_json->>'providerMode' from public.billing_outbox where semantic_key like '%customer:live:v1'),'live','live promotion enqueues a distinct live Customer command');
reset role;
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.billing_accounts'::regclass),'billing account RLS is active');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.tenant_entitlement_snapshots'::regclass),'entitlement RLS is active');
select ok(not exists(select 1 from (values('billing_accounts'),('billing_mandates'),('billing_subscriptions'),('screen_billing_intervals'),('billing_usage_snapshots'),('billing_usage_snapshot_lines'),('billing_invoices'),('billing_invoice_lines'),('billing_credit_ledger'),('billing_payment_attempts'),('billing_provider_events'),('billing_outbox'),('billing_notifications'),('billing_reconciliation_items'),('billing_overrides'),('billing_audit_log'),('tenant_entitlement_snapshots')) as expected(name) join pg_class relation on relation.oid=('public.'||expected.name)::regclass where not relation.relrowsecurity or not relation.relforcerowsecurity),'every tenant billing table is RLS-enabled and forced');

select * from finish();
rollback;
