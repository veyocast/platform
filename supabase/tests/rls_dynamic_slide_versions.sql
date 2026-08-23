begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-4000-8000-000000001221', 'authenticated', 'authenticated', 'versions-a@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001222', 'authenticated', 'authenticated', 'versions-b@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000001221', 'Version owner A'),
  ('00000000-0000-4000-8000-000000001222', 'Version owner B');
insert into public.tenants(id, name, slug) values
  ('10000000-0000-4000-8000-000000001221', 'Version tenant A', 'version-tenant-a'),
  ('10000000-0000-4000-8000-000000001222', 'Version tenant B', 'version-tenant-b');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001221'),
  ('10000000-0000-4000-8000-000000001222');
insert into public.tenant_memberships(tenant_id, user_id, role) values
  ('10000000-0000-4000-8000-000000001221', '00000000-0000-4000-8000-000000001221', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000001222', '00000000-0000-4000-8000-000000001222', 'tenant_owner');

insert into public.dynamic_data_sources(
  id, tenant_id, name, kind, status, provider_status, config_json
) values
  ('20000000-0000-4000-8000-000000001221', '10000000-0000-4000-8000-000000001221', 'Sportlink A', 'sportlink', 'active', 'ready', '{}'::jsonb),
  ('20000000-0000-4000-8000-000000001222', '10000000-0000-4000-8000-000000001222', 'Sportlink B', 'sportlink', 'active', 'ready', '{}'::jsonb);

create temporary table version_test_state(name text primary key, id uuid, value jsonb);
grant select, insert, update on version_test_state to authenticated;

insert into public.dynamic_slides(
  id, tenant_id, name, slide_type, orientation, template_id,
  template_version_id, data_source_id, selection_mode, status,
  configuration_json
)
select
  '30000000-0000-4000-8000-000000001221',
  '10000000-0000-4000-8000-000000001221',
  'JO17 stand', 'sport_standing', 'landscape', template.id, version.id,
  '20000000-0000-4000-8000-000000001221', 'latest', 'draft',
  '{"schemaVersion":1,"blueprintKey":"sportlink.pool_standings","title":"Poulestand","context":{"competitionId":null,"competitionSelectionMode":"auto_current","phaseId":null,"poolId":null,"providerTeamId":"jo17","seasonId":null},"display":{"columns":"two","showDressingRoom":false,"showField":true,"showHomeAway":true,"showReferee":false},"editorial":{"schemaVersion":2,"themeSelection":{"ref":{"catalog":"v2","id":"editorial","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}},"maxItems":40}'::jsonb
from public.dynamic_templates template
join public.dynamic_template_versions version
  on version.id = template.current_published_version_id
where template.slide_type = 'sport_standing'
  and template.orientation = 'landscape'
  and template.status = 'published'
limit 1;

select is(
  (select count(*) from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'),
  1::bigint,
  'a logical slide starts with exactly one configuration version'
);
select is(
  (select status from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'),
  'draft',
  'the initial unrendered version is a draft'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class where oid = 'public.dynamic_slide_versions'::regclass),
  'configuration versions force RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.dynamic_slide_versions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.dynamic_slide_versions', 'INSERT'),
  'Data API grants expose read-only version history'
);

insert into public.dynamic_slide_snapshots(
  id, tenant_id, dynamic_slide_id, template_version_id, data_source_id,
  source_revision_hash, snapshot_data_json, status, completed_at
)
select
  '40000000-0000-4000-8000-000000001221', slide.tenant_id, slide.id,
  slide.template_version_id, slide.data_source_id, repeat('a', 64),
  '{"type":"sport_standing","sport":{"title":"Poulestand","items":[]}}'::jsonb,
  'ready', now()
from public.dynamic_slides slide where slide.id = '30000000-0000-4000-8000-000000001221';
update public.dynamic_slides
set current_snapshot_id = '40000000-0000-4000-8000-000000001221', status = 'ready'
where id = '30000000-0000-4000-8000-000000001221';

select is(
  (select status from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'),
  'published',
  'ready output atomically promotes the initial version'
);
select ok(
  (select current_published_version_id is not null and active_draft_version_id is null from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221'),
  'logical slide points only at the ready current version'
);
select throws_ok(
  $$update public.dynamic_slides
    set configuration_json = jsonb_set(configuration_json, '{title}', '"Unsafe edit"'::jsonb)
    where id = '30000000-0000-4000-8000-000000001221'$$,
  '55000',
  'published slide design requires an active draft version',
  'published design cannot be mutated outside a version draft'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001221', true);
insert into version_test_state(name, value)
values ('create-v2', public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221', null));

select is((select value ->> 'outcome' from version_test_state where name = 'create-v2'), 'created', 'owner creates a cloned v2 draft');
select is(public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001221', null) ->> 'outcome', 'resumed', 'repeated click resumes the one active draft');
select is((select count(*) from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221'), 2::bigint, 'idempotent draft creation prevents v3/v4 clutter');
select is((select version_number from public.dynamic_slide_versions where id = (select active_draft_version_id from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221')), 2, 'new draft has the next user-facing version number');
select is((select configuration_json #>> '{context,providerTeamId}' from public.dynamic_slide_versions where version_number = 2 and dynamic_slide_id = '30000000-0000-4000-8000-000000001221'), 'jo17', 'dynamic provider binding is cloned instead of frozen snapshot data');
select is((select theme_selection_json #>> '{ref,id}' from public.dynamic_slide_versions where version_number = 2 and dynamic_slide_id = '30000000-0000-4000-8000-000000001221'), 'editorial', 'theme is cloned as versioned configuration');
reset role;
select throws_ok(
  $$update public.dynamic_slide_versions set name = 'Tampered history' where dynamic_slide_id = '30000000-0000-4000-8000-000000001221' and version_number = 1$$,
  '55000', 'published dynamic slide versions are immutable',
  'historical published configuration cannot be mutated'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001221', true);
select throws_ok(
  $$select public.create_or_resume_dynamic_slide_version_v1('30000000-0000-4000-8000-000000001222', null)$$,
  'P0002', 'dynamic slide not found',
  'an unknown or cross-tenant logical slide cannot be versioned'
);
select is((select count(*) from public.dynamic_slide_versions), 2::bigint, 'only the own tenant versions are visible through RLS');

reset role;
update public.dynamic_slide_versions
set status = 'publishing'
where dynamic_slide_id = '30000000-0000-4000-8000-000000001221' and version_number = 2;
insert into public.dynamic_slide_snapshots(
  id, tenant_id, dynamic_slide_id, template_version_id, data_source_id,
  source_revision_hash, snapshot_data_json, status, completed_at
)
select
  '40000000-0000-4000-8000-000000001222', slide.tenant_id, slide.id,
  slide.template_version_id, slide.data_source_id, repeat('b', 64),
  '{"type":"sport_standing","sport":{"title":"Poulestand","items":[]}}'::jsonb,
  'ready', now()
from public.dynamic_slides slide where slide.id = '30000000-0000-4000-8000-000000001221';
update public.dynamic_slides
set current_snapshot_id = '40000000-0000-4000-8000-000000001222'
where id = '30000000-0000-4000-8000-000000001221';

select is((select version_number from public.dynamic_slide_versions where id = (select current_published_version_id from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221')), 2, 'ready v2 becomes the current version');
select is((select status from public.dynamic_slide_versions where dynamic_slide_id = '30000000-0000-4000-8000-000000001221' and version_number = 1), 'published', 'v1 remains immutable history after v2 publication');
select is((select dynamic_slide_version_id from public.dynamic_slide_snapshots where id = '40000000-0000-4000-8000-000000001222'), (select current_published_version_id from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221'), 'thumbnail/data snapshot retains concrete version provenance');
select is((select count(*) from public.dynamic_slides where id = '30000000-0000-4000-8000-000000001221'), 1::bigint, 'library keeps one logical slide after multiple versions');

select * from finish();
rollback;
