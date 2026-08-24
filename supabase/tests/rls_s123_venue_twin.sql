begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001241', 'authenticated', 'authenticated', 'venue-admin@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001242', 'authenticated', 'authenticated', 'venue-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001243', 'authenticated', 'authenticated', 'venue-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001244', 'authenticated', 'authenticated', 'venue-platform@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000001241', 'Venue admin'),
  ('00000000-0000-4000-8000-000000001242', 'Venue viewer'),
  ('00000000-0000-4000-8000-000000001243', 'Other venue admin'),
  ('00000000-0000-4000-8000-000000001244', 'Venue platform admin');

insert into public.tenants (id, name, slug, screen_limit) values
  ('10000000-0000-4000-8000-000000001241', 'Venue tenant', 'venue-tenant', 5),
  ('10000000-0000-4000-8000-000000001242', 'Other venue tenant', 'other-venue-tenant', 5);
insert into public.tenant_settings (tenant_id) values
  ('10000000-0000-4000-8000-000000001241'),
  ('10000000-0000-4000-8000-000000001242');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001241', '00000000-0000-4000-8000-000000001241', 'tenant_admin'),
  ('10000000-0000-4000-8000-000000001241', '00000000-0000-4000-8000-000000001242', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000001242', '00000000-0000-4000-8000-000000001243', 'tenant_admin');
insert into public.platform_memberships (user_id, role) values
  ('00000000-0000-4000-8000-000000001244', 'platform_admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001241', true);

select is(
  (select count(*) from public.tenant_feature_flags where flag_key = 'venue_twin'),
  0::bigint,
  'Venue Twin is disabled by default when no tenant rollout row exists'
);
select throws_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001241', 'venue_twin', true,
    'Tenant probeert zichzelf toe te voegen'
  )$$,
  '42501',
  'platform feature rollout permission required',
  'a tenant admin cannot self-enable a proposed product flag'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001244', true);
select set_config('request.jwt.claim.aal', 'aal1', true);
select throws_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001241', 'venue_twin', true,
    'Gecontroleerde interne Venue Twin pilot'
  )$$,
  '42501',
  'sensitive command requires aal2',
  'platform rollout requires AAL2'
);
select set_config('request.jwt.claim.aal', 'aal2', true);
select lives_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001241', 'venue_twin', true,
    'Gecontroleerde interne Venue Twin pilot'
  )$$,
  'an AAL2 platform admin can explicitly enroll one tenant'
);
select is(
  (select enabled from public.tenant_feature_flags
   where tenant_id = '10000000-0000-4000-8000-000000001241'
     and flag_key = 'venue_twin'),
  true,
  'the explicit tenant rollout state is stored'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001241', true);
select set_config('request.jwt.claim.aal', 'aal1', true);
select is(
  (select count(*) from public.tenant_feature_flags where flag_key = 'venue_twin'),
  1::bigint,
  'a tenant member can read rollout presentation state'
);
select ok(
  public.save_venue_v1(
    '10000000-0000-4000-8000-000000001241', null,
    'Sportpark De Horizon', 'Hoofdlocatie'
  ) is not null,
  'a screen manager can create a venue through the guarded command'
);
select ok(
  public.save_venue_floorplan_v1(
    '10000000-0000-4000-8000-000000001241',
    (select id from public.venues where name = 'Sportpark De Horizon'),
    null, null, 'Begane grond', 1600, 900
  ) is not null,
  'a code-native floorplan can be configured without a fake image'
);
select ok(
  public.save_venue_zone_v1(
    '10000000-0000-4000-8000-000000001241',
    (select id from public.venues where name = 'Sportpark De Horizon'),
    null,
    (select id from public.venue_floorplans where name = 'Begane grond'),
    'Kantine', 'Publieke ontvangstruimte'
  ) is not null,
  'a tenant-scoped venue zone can be configured'
);
select ok(
  public.create_screen_v1(
    '10000000-0000-4000-8000-000000001241', 'Kantinescherm', 'Kantine',
    'landscape', 1920, 1080, null
  ) is not null,
  'the existing screen command remains the source of screen identity'
);
select ok(
  public.save_venue_screen_placement_v1(
    '10000000-0000-4000-8000-000000001241',
    (select id from public.screens where name = 'Kantinescherm'),
    (select id from public.venues where name = 'Sportpark De Horizon'),
    (select id from public.venue_floorplans where name = 'Begane grond'),
    (select id from public.venue_zones where name = 'Kantine'),
    0.325, 0.675, 'landscape', 12.5
  ) is not null,
  'a normalized screen placement is saved through the guarded command'
);
select is(
  (select x_normalized from public.venue_screen_placements),
  0.3250000::numeric,
  'normalized placement coordinates remain deterministic'
);
select lives_ok(
  $$select public.save_venue_screen_placement_v1(
    '10000000-0000-4000-8000-000000001241',
    (select id from public.screens where name = 'Kantinescherm'),
    (select id from public.venues where name = 'Sportpark De Horizon'),
    (select id from public.venue_floorplans where name = 'Begane grond'),
    (select id from public.venue_zones where name = 'Kantine'),
    0.4, 0.7, 'landscape', null
  )$$,
  'a placement update is idempotent for the logical screen placement'
);
select is(
  (select revision from public.venue_screen_placements),
  2::bigint,
  'a placement update increments its revision'
);
select is(
  (select count(*) from public.audit_events
   where tenant_id = '10000000-0000-4000-8000-000000001241'
     and action like 'venue.%'),
  5::bigint,
  'venue and placement mutations are attributable in the audit log'
);
select throws_ok(
  $$select public.save_venue_screen_placement_v1(
    '10000000-0000-4000-8000-000000001241',
    (select id from public.screens where name = 'Kantinescherm'),
    (select id from public.venues where name = 'Sportpark De Horizon'),
    null, null, 1.1, 0.5, 'landscape', null
  )$$,
  '23514',
  'screen placement input is invalid',
  'coordinates outside the normalized range fail closed'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001242', true);
select throws_ok(
  $$select public.save_venue_v1(
    '10000000-0000-4000-8000-000000001241', null, 'Viewer venue', null
  )$$,
  '42501',
  'venue twin management capability and rollout required',
  'a tenant viewer cannot mutate Venue Twin data'
);
select is(
  (select count(*) from public.venues),
  1::bigint,
  'a tenant viewer has the same accessible read fallback as other members'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001243', true);
select is((select count(*) from public.venues), 0::bigint, 'another tenant cannot read venue records');
select is(
  (select count(*) from public.venue_screen_placements),
  0::bigint,
  'another tenant cannot read screen coordinates'
);
select throws_ok(
  $$insert into public.venues (tenant_id, name)
    values ('10000000-0000-4000-8000-000000001242', 'Direct venue')$$,
  '42501',
  'permission denied for table venues',
  'authenticated clients cannot bypass commands with direct writes'
);
select throws_ok(
  $$select public.save_venue_v1(
    '10000000-0000-4000-8000-000000001241', null, 'Cross tenant venue', null
  )$$,
  '42501',
  'venue twin management capability and rollout required',
  'another tenant cannot invoke a cross-tenant venue command'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001244', true);
select set_config('request.jwt.claim.aal', 'aal2', true);
select lives_ok(
  $$select public.set_tenant_feature_flag_v1(
    '10000000-0000-4000-8000-000000001241', 'venue_twin', false,
    'Pilot gecontroleerd uitgezet via kill switch'
  )$$,
  'the audited kill switch can disable discovery without deleting data'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001241', true);
select set_config('request.jwt.claim.aal', 'aal1', true);
select is((select count(*) from public.venues), 0::bigint, 'disabled Venue Twin data is hidden from tenant UI queries');
select throws_ok(
  $$select public.save_venue_v1(
    '10000000-0000-4000-8000-000000001241', null, 'Disabled venue', null
  )$$,
  '42501',
  'venue twin management capability and rollout required',
  'disabled rollout also blocks server-authoritative tenant mutations'
);

select * from finish();
rollback;
