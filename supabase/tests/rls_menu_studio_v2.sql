begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000001121', 'authenticated', 'authenticated', 'menu-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001122', 'authenticated', 'authenticated', 'menu-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000001123', 'authenticated', 'authenticated', 'menu-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000001121', 'Menu owner'),
  ('00000000-0000-4000-8000-000000001122', 'Menu viewer'),
  ('00000000-0000-4000-8000-000000001123', 'Other menu owner');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000001121', 'Menu tenant', 'menu-tenant'),
  ('10000000-0000-4000-8000-000000001122', 'Other menu tenant', 'other-menu-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000001121'),
  ('10000000-0000-4000-8000-000000001122');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000001121', '00000000-0000-4000-8000-000000001121', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000001121', '00000000-0000-4000-8000-000000001122', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000001122', '00000000-0000-4000-8000-000000001123', 'tenant_owner');

create temporary table menu_test_state (
  name text primary key,
  id uuid,
  value jsonb
);
grant select, insert, update on menu_test_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001121', true);

insert into menu_test_state(name, id)
values (
  'source',
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000001121',
    'Menu Studio bron',
    'manual_products',
    '{}'::jsonb
  )
);

select is(
  (select menu_document_v2_read_enabled from public.tenant_settings where tenant_id = '10000000-0000-4000-8000-000000001121'),
  false,
  'MenuDocument.v2 read defaults to disabled'
);

select throws_ok(
  $$select public.create_menu_studio_draft_v2(
    '10000000-0000-4000-8000-000000001121',
    'Verboden concept',
    (select version.id from public.dynamic_template_versions version join public.dynamic_templates template on template.id = version.template_id where template.slide_type = 'price_list' and version.status = 'published' limit 1),
    (select id from menu_test_state where name = 'source'),
    'latest',
    '{"schemaVersion":"menu-document.v2","id":"draft","tenantId":"draft","revision":1,"createdAt":"2026-08-21T12:00:00.000Z","updatedAt":"2026-08-21T12:00:00.000Z","title":"Lunch","theme":{"themeId":"editorial","themeVersion":"1.0.0","mode":"light","brand":{"accent":"#FF5C20"}},"assets":[],"pages":[{"id":"page-1","order":0,"blocks":[]}]}'::jsonb,
    '20000000-0000-4000-8000-000000001121'
  )$$,
  '42501',
  'Menu Studio v2 authoring is not enabled',
  'authoring RPC is disabled until both rollout flags are enabled'
);

reset role;
update public.tenant_settings
set menu_document_v2_read_enabled = true,
    menu_studio_v2_authoring_enabled = true,
    menu_studio_v2_linked_groups_enabled = true,
    menu_studio_v2_media_enabled = true,
    menu_studio_v2_publish_enabled = true,
    menu_studio_v2_player_enabled = true
where tenant_id = '10000000-0000-4000-8000-000000001121';

select throws_ok(
  $$select private.validate_menu_node_v2('{"kind":"free-text","label":"1234567890123456789012345","presentationOnly":true}'::jsonb)$$,
  '22023',
  'free menu line contains product semantics',
  'free menu labels are limited to 24 visible codepoints server-side'
);

select throws_ok(
  $$select private.validate_menu_node_v2('{"kind":"product-group","pricePolicy":"separate","display":{"maxLines":1,"separator":"dot"},"secondaryLineItems":[{"kind":"free-text","label":"Variant voor menu","presentationOnly":true},{"kind":"free-text","label":"Variant voor menu","presentationOnly":true},{"kind":"free-text","label":"Variant voor menu","presentationOnly":true},{"kind":"free-text","label":"Variant voor menu","presentationOnly":true}]}'::jsonb)$$,
  '23514',
  'menu product group secondary line does not fit safely',
  'server blocks a secondary line that cannot fit its configured line count'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001121', true);

insert into menu_test_state(name, value)
select 'created', public.create_menu_studio_draft_v2(
  '10000000-0000-4000-8000-000000001121',
  'Lunchmenu',
  version.id,
  (select id from menu_test_state where name = 'source'),
  'latest',
  '{"schemaVersion":"menu-document.v2","id":"draft","tenantId":"draft","revision":1,"createdAt":"2026-08-21T12:00:00.000Z","updatedAt":"2026-08-21T12:00:00.000Z","title":"Lunch","theme":{"themeId":"editorial","themeVersion":"1.0.0","mode":"light","brand":{"accent":"#FF5C20"}},"assets":[],"pages":[{"id":"page-1","order":0,"blocks":[]}]}'::jsonb,
  '20000000-0000-4000-8000-000000001122'
)
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slide_type = 'price_list'
  and version.status = 'published'
limit 1;

insert into menu_test_state(name, id)
select 'slide', (value ->> 'slideId')::uuid
from menu_test_state where name = 'created';

select is(
  (select value ->> 'outcome' from menu_test_state where name = 'created'),
  'applied',
  'authoring creates a draft after rollout activation'
);

select is(
  (select menu_document_revision from public.dynamic_slides where id = (select id from menu_test_state where name = 'slide')),
  1::bigint,
  'new Menu Studio drafts start at revision one'
);

select is(
  (select count(*) from public.dynamic_slide_snapshots where dynamic_slide_id = (select id from menu_test_state where name = 'slide')),
  0::bigint,
  'draft creation does not publish a snapshot'
);

select is(
  (select count(*) from public.menu_studio_operations where dynamic_slide_id = (select id from menu_test_state where name = 'slide')),
  1::bigint,
  'draft creation appends one immutable operation'
);

select throws_ok(
  $$update public.menu_studio_operations set command_json = '{"kind":"tamper"}'::jsonb where dynamic_slide_id = (select id from menu_test_state where name = 'slide')$$,
  '42501',
  'permission denied for table menu_studio_operations',
  'authenticated operation rows reject mutation at the grant boundary'
);

insert into menu_test_state(name, value)
select 'saved', public.save_menu_studio_document_v2(
  (select id from menu_test_state where name = 'slide'),
  1,
  '20000000-0000-4000-8000-000000001123',
  '{"kind":"set-title","title":"Avondmenu"}'::jsonb,
  jsonb_set(value -> 'document', '{title}', '"Avondmenu"'::jsonb)
)
from menu_test_state where name = 'created';

select is(
  (select value ->> 'outcome' from menu_test_state where name = 'saved'),
  'applied',
  'revision-aware save is applied'
);

select is(
  (select menu_document_revision from public.dynamic_slides where id = (select id from menu_test_state where name = 'slide')),
  2::bigint,
  'save increments the MenuDocument revision exactly once'
);

select is(
  public.save_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'),
    1,
    '20000000-0000-4000-8000-000000001123',
    '{"kind":"set-title","title":"Avondmenu"}'::jsonb,
    jsonb_set((select value -> 'document' from menu_test_state where name = 'created'), '{title}', '"Avondmenu"'::jsonb)
  ) ->> 'outcome',
  'already_applied',
  'repeating the same operation id and payload is idempotent'
);

select throws_ok(
  $$select public.save_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'), 2,
    '20000000-0000-4000-8000-000000001123',
    '{"kind":"set-title","title":"Anders"}'::jsonb,
    jsonb_set((select value -> 'document' from menu_test_state where name = 'saved'), '{title}', '"Anders"'::jsonb)
  )$$,
  '23505',
  'operation id was already used for different input',
  'an operation id cannot be reused for different input'
);

select throws_ok(
  $$select public.save_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'), 1,
    '20000000-0000-4000-8000-000000001124',
    '{"kind":"set-title","title":"Stale"}'::jsonb,
    jsonb_set((select value -> 'document' from menu_test_state where name = 'saved'), '{title}', '"Stale"'::jsonb)
  )$$,
  '40001',
  'Menu Studio revision conflict',
  'stale revision writes are rejected'
);

select throws_ok(
  $$update public.dynamic_slides set configuration_json = '{}'::jsonb where id = (select id from menu_test_state where name = 'slide')$$,
  '42501',
  null,
  'browser roles cannot bypass the command RPC with a direct slide update'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001123', true);

select is(
  (select count(*) from public.menu_studio_operations),
  0::bigint,
  'another tenant cannot read Menu Studio operations'
);

select throws_ok(
  $$select public.save_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'), 2,
    '20000000-0000-4000-8000-000000001125',
    '{"kind":"set-title","title":"Cross tenant"}'::jsonb,
    (select value -> 'document' from menu_test_state where name = 'saved')
  )$$,
  '42501',
  'actor cannot save Menu Studio drafts',
  'another tenant cannot save the draft'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001122', true);

select is(
  (select count(*) from public.menu_studio_operations),
  2::bigint,
  'a same-tenant viewer can read the append-only audit trail'
);

select throws_ok(
  $$select public.save_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'), 2,
    '20000000-0000-4000-8000-000000001126',
    '{"kind":"set-title","title":"Viewer"}'::jsonb,
    (select value -> 'document' from menu_test_state where name = 'saved')
  )$$,
  '42501',
  'actor cannot save Menu Studio drafts',
  'a viewer cannot mutate the draft'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001121', true);

insert into menu_test_state(name, value)
values (
  'published',
  public.publish_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'),
    2,
    '20000000-0000-4000-8000-000000001127'
  )
);

select is(
  (select value ->> 'outcome' from menu_test_state where name = 'published'),
  'applied',
  'explicit publish is applied'
);

select is(
  (select menu_last_published_revision from public.dynamic_slides where id = (select id from menu_test_state where name = 'slide')),
  2::bigint,
  'published revision is recorded separately from the draft revision'
);

select is(
  (select count(*) from public.dynamic_slide_snapshots where dynamic_slide_id = (select id from menu_test_state where name = 'slide')),
  1::bigint,
  'publish creates exactly one immutable snapshot'
);

select is(
  (select snapshot_data_json #>> '{menuDocument,schemaVersion}' from public.dynamic_slide_snapshots where dynamic_slide_id = (select id from menu_test_state where name = 'slide')),
  'menu-document.v2',
  'immutable snapshot embeds the canonical MenuDocument.v2'
);

select is(
  public.publish_menu_studio_document_v2(
    (select id from menu_test_state where name = 'slide'),
    2,
    '20000000-0000-4000-8000-000000001127'
  ) ->> 'outcome',
  'already_applied',
  'publish is idempotent for the same operation id'
);

select is(
  (select count(*) from public.dynamic_slide_snapshots where dynamic_slide_id = (select id from menu_test_state where name = 'slide')),
  1::bigint,
  'idempotent publish does not duplicate immutable snapshots'
);

select throws_ok(
  $$delete from public.menu_studio_operations where dynamic_slide_id = (select id from menu_test_state where name = 'slide')$$,
  '42501',
  'permission denied for table menu_studio_operations',
  'authenticated operation rows reject deletion at the grant boundary'
);

reset role;
select hasnt_function('public', 'resolve_menu_document_v2', array['uuid', 'uuid', 'jsonb'], 'private resolver is not exposed through the Data API');

select * from finish();
rollback;
