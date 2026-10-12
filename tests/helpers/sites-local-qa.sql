-- QA-01: apply ONLY to the disposable local Supabase stack with the helper.
-- These stable identities are test fixtures, never production tenant data.
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-0000-0000-000000000000','19170000-0000-4000-8000-000000000001','authenticated','authenticated','sites-qa@veyocast.test',extensions.crypt('veyocast-local',extensions.gen_salt('bf')),now(),'','','','',now(),now(),'{"provider":"email","providers":["email"]}','{"display_name":"QA beheerder"}')
on conflict(id)do nothing;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values('19170000-0000-4000-8000-000000000001','19170000-0000-4000-8000-000000000001','19170000-0000-4000-8000-000000000001','{"sub":"19170000-0000-4000-8000-000000000001","email":"sites-qa@veyocast.test"}','email',now(),now(),now())on conflict(provider_id,provider)do nothing;
insert into public.profiles(id,display_name)values('19170000-0000-4000-8000-000000000001','QA beheerder')on conflict(id)do nothing;
-- The same actual AAL2 identity can select either QA tenant Control or local platform Control.
insert into public.platform_memberships(user_id,role)values('19170000-0000-4000-8000-000000000001','platform_admin')on conflict(user_id,role)do nothing;
insert into public.platform_memberships(user_id,role)values('19170000-0000-4000-8000-000000000001','platform_owner')on conflict(user_id,role)do nothing;
insert into public.tenants(id,name,slug,screen_limit)values('19170000-0000-4000-8000-000000000010','Duindorp SV','duindorp-sites-local-qa',10)on conflict(id)do nothing;
insert into public.tenant_settings(tenant_id,timezone_name)values('19170000-0000-4000-8000-000000000010','Europe/Amsterdam')on conflict(tenant_id)do nothing;
insert into public.tenant_memberships(tenant_id,user_id,role)values('19170000-0000-4000-8000-000000000010','19170000-0000-4000-8000-000000000001','tenant_owner')on conflict(tenant_id,user_id)do nothing;
insert into public.screens(id,tenant_id,name,location,orientation,created_by,created_at,updated_at)
values('19170000-0000-4000-8000-000000000020','19170000-0000-4000-8000-000000000010','Clubhuis','Kantine','landscape','19170000-0000-4000-8000-000000000001','2026-10-11T10:00:00Z','2026-10-11T10:00:00Z'),
('19170000-0000-4000-8000-000000000021','19170000-0000-4000-8000-000000000010','Entree','Entree','portrait','19170000-0000-4000-8000-000000000001','2026-10-11T10:00:00Z','2026-10-11T10:00:00Z'),
('19170000-0000-4000-8000-000000000022','19170000-0000-4000-8000-000000000010','Hoofdveld','Hoofdveld','landscape','19170000-0000-4000-8000-000000000001','2026-10-11T10:00:00Z','2026-10-11T10:00:00Z')on conflict(id)do nothing;
insert into public.screen_groups(id,tenant_id,name,created_by,created_at,updated_at)values('19170000-0000-4000-8000-000000000030','19170000-0000-4000-8000-000000000010','Clubhuis en entree','19170000-0000-4000-8000-000000000001','2026-10-11T10:00:00Z','2026-10-11T10:00:00Z')on conflict(id)do nothing;
insert into public.screen_group_memberships(tenant_id,screen_group_id,screen_id,created_by)values
('19170000-0000-4000-8000-000000000010','19170000-0000-4000-8000-000000000030','19170000-0000-4000-8000-000000000020','19170000-0000-4000-8000-000000000001'),
('19170000-0000-4000-8000-000000000010','19170000-0000-4000-8000-000000000030','19170000-0000-4000-8000-000000000021','19170000-0000-4000-8000-000000000001')on conflict do nothing;
-- Create the real tenant/platform support detail through its guarded public command.
set local role authenticated;
select set_config('request.jwt.claim.sub','19170000-0000-4000-8000-000000000001',true);
do $$begin
  if not exists(select 1 from public.support_tickets where tenant_id='19170000-0000-4000-8000-000000000010' and subject='Sites QA routecontrole' and deleted_at is null)then
    perform public.create_support_ticket_v1(
      '19170000-0000-4000-8000-000000000010',
      (select id from public.support_departments where active order by name,id limit 1),
      'Sites QA routecontrole','Dit is uitsluitend een record in de wegwerpdatabase voor routeacceptatie.',false,'normal'
    );
  end if;
end $$;
reset role;
commit;
