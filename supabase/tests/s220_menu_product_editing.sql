begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000220121', 'authenticated', 'authenticated', 's220-menu-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000220122', 'authenticated', 'authenticated', 's220-menu-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000220123', 'authenticated', 'authenticated', 's220-menu-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000220121', 'Menu owner'),
  ('00000000-0000-4000-8000-000000220122', 'Menu viewer'),
  ('00000000-0000-4000-8000-000000220123', 'Other menu owner');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000220121', 'Menu tenant', 's220-menu-tenant'),
  ('10000000-0000-4000-8000-000000220122', 'Other menu tenant', 'other-s220-menu-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000220121'),
  ('10000000-0000-4000-8000-000000220122');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000220121', '00000000-0000-4000-8000-000000220121', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000220121', '00000000-0000-4000-8000-000000220122', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000220122', '00000000-0000-4000-8000-000000220123', 'tenant_owner');

create function pg_temp.sites_v17_configuration(
  p_renderer text default 'sites-v17',
  p_source text default '6800bc858436ba0843eaea89b682cd5b43c3521d',
  p_family text default 'kantine'
) returns jsonb language sql immutable as $$
 select jsonb_build_object(
  'schemaVersion',1,'rendererVersion',p_renderer,'sourceRevision',p_source,'themeId','onzetrots-tv','orientation','landscape','provider','menu','title','Onze kantine','subtitle','',
  'overlay',25,'accent','#03438a','layout','full','scale',100,'align','left','safeArea',4,'seconds',15,'rowsPerPage',8,
  'ledTemplate','match-center','ledTheme','blue','ledMoment','live','ledSide','unknown','titleScale',100,'scoreScale',100,'logoScale',100,'teamScale',100,
  'showBranding',true,'showSceneLabel',true,'showClock',true,'showTimeline',true,'timelineLimit',3,'backgroundFit','contain','grunge',55,'animation','rise',
  'unifiedKind',p_family,'paintTone','white','photoMotion',true,'rssLayout','accordion','menuLayout','columns','showPrices',true,'showCategories',true,'currency','EUR',
  'extraType','periodestand','arrivalCards',4,'arrivalBefore',180,'arrivalAfter',120,'arrivalShowLogo',true,'arrivalShowKickoff',true,'qrUrl','https://veyocast.nl','body','','vacancyContact','',
  'welcomeImage',jsonb_build_object('kind','system','path','/onzetrots/website-brush/de-wijk-wide-1672.webp','checksumSha256','d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e')
 )
$$;

select ok(private.sites_configuration_is_valid_v1(pg_temp.sites_v17_configuration()||'{"menuWidgets":true}'::jsonb),'complete real v17 menu configuration accepts its typed widget marker');
select ok(not private.sites_configuration_is_valid_v1(pg_temp.sites_v17_configuration()||'{"menuWidgets":"true"}'::jsonb),'untyped widget marker is rejected at the configuration boundary');
create temporary table menu_test_state (
  name text primary key,
  id uuid,
  value jsonb
);
grant select, insert, update on menu_test_state to authenticated;

create temporary table menu_theme_palette (value jsonb not null);
insert into menu_theme_palette(value)
select jsonb_build_object(
  'fieldflow',
  jsonb_build_object('dark', tokens, 'light', tokens, 'mode', 'light')
)
from (
  select jsonb_object_agg(token, '#123456') as tokens
  from unnest(array[
    'accent', 'accentSoft', 'border', 'borderSoft', 'canvas', 'danger',
    'divider', 'imageOverlayEnd', 'imageOverlayMid', 'imageOverlayStart',
    'neutral', 'panel', 'qrInk', 'qrSurface', 'row', 'rowSelected',
    'shadow', 'success', 'surface', 'surfaceRaised', 'text', 'textFaint',
    'textMuted', 'textOnAccent', 'textOnSelected', 'warning'
  ]::text[]) token
) palette;
grant select on menu_theme_palette to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000220121', true);

insert into menu_test_state(name, id)
values (
  'source',
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000220121',
    'Menu Studio bron',
    'manual_products',
    '{}'::jsonb
  )
);

reset role;
update public.tenant_settings
set menu_document_v2_read_enabled = true,
    menu_studio_v2_authoring_enabled = true,
    menu_studio_v2_linked_groups_enabled = true,
    menu_studio_v2_media_enabled = true,
    menu_studio_v2_publish_enabled = true,
    menu_studio_v2_player_enabled = true
where tenant_id = '10000000-0000-4000-8000-000000220121';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000220121', true);

insert into menu_test_state(name, value)
select 'created', public.create_menu_studio_draft_v2(
  '10000000-0000-4000-8000-000000220121',
  'Lunchmenu',
  version.id,
  (select id from menu_test_state where name = 'source'),
  'latest',
  jsonb_set('{"schemaVersion":"menu-document.v2","id":"draft","tenantId":"draft","revision":1,"createdAt":"2026-08-21T12:00:00.000Z","updatedAt":"2026-08-21T12:00:00.000Z","title":"Lunch","theme":{"themeId":"onzetrots-tv","themeVersion":"11.0.0","mode":"light","brand":{"accent":"#FF5C20"}},"assets":[],"pages":[{"id":"page-1","order":0,"landscapeColumns":2,"portraitColumns":1,"blocks":[]}]}'::jsonb,'{sitesConfiguration}',pg_temp.sites_v17_configuration()||'{"menuWidgets":true}'::jsonb,true),
  '20000000-0000-4000-8000-000000220122'
)
from public.dynamic_template_versions version
join public.dynamic_templates template on template.id = version.template_id
where template.slide_type = 'price_list'
  and template.orientation = 'landscape'
  and template.current_published_version_id = version.id
  and version.status = 'published'
limit 1;

insert into menu_test_state(name, id)
select 'slide', (value ->> 'slideId')::uuid
from menu_test_state where name = 'created';



reset role;
insert into public.tenant_products(id,tenant_id,data_source_id,source,slug,name,price_cents,currency,active,available,revision)
select '30000000-0000-4000-8000-000000220121','10000000-0000-4000-8000-000000220121',id,'manual','s220-coffee','Bronkoffie',250,'EUR',true,true,7 from menu_test_state where name='source';
create temporary table edited_menu(value jsonb);
grant select on edited_menu to authenticated;
insert into edited_menu(value)
select jsonb_set(value->'document','{pages,0,blocks}',jsonb_build_array(jsonb_build_object(
 'id','category','type','category','order',0,'columns',2,'source',jsonb_build_object('source','manual','sourceCategoryId','drinks','sourceName','Dranken'),
 'layout','{"landscape":{"x":96,"y":248,"w":1728,"h":600,"rotation":0},"portrait":{"x":72,"y":348,"w":936,"h":600,"rotation":0}}'::jsonb,
 'productNodes',jsonb_build_array(jsonb_build_object(
  'id','coffee','kind','product','order',0,'nameOverride','Clubkoffie','priceOverrideMinor',375,
  'productRef',jsonb_build_object('productId','30000000-0000-4000-8000-000000220121','source','manual','sourceRevision','tampered'),
  'snapshotFallback','{"name":"Forged","available":true,"price":{"amountMinor":1,"currency":"USD","taxMode":"exclusive"}}'::jsonb,
  'secondaryLineItems',jsonb_build_array(jsonb_build_object('id','free','kind','free-text','order',0,'presentationOnly',true,'label',repeat('Een lange vrije toelichting. ',80)))
 ))
))) from menu_test_state where name='created';

select lives_ok($$select private.validate_menu_node_v2(jsonb_build_object('kind','free-text','label',repeat('a',2000),'presentationOnly',true))$$,'free copy has no per-label character cap');
select throws_ok($$select private.validate_menu_node_v2('{"kind":"free-text","label":42}'::jsonb)$$,'22023','free menu line contains product semantics','free copy must remain a string');
select throws_ok($$select private.validate_menu_node_v2(jsonb_build_object('kind','free-text','label',E'bad\ncopy'))$$,'22023','free menu line contains product semantics','control characters remain invalid');
select throws_ok($$select private.validate_menu_node_v2('{"kind":"free-text","label":"copy","priceOverrideMinor":5}'::jsonb)$$,'22023','menu product price override is invalid','a free line cannot acquire product pricing');
select throws_ok($$select private.validate_menu_node_v2(jsonb_set(value,'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}','-1'))from edited_menu$$,'22023','menu product price override is invalid','negative amount is rejected');
select throws_ok($$select private.validate_menu_node_v2(jsonb_set(value,'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}','3.5'))from edited_menu$$,'22023','menu product price override is invalid','fractional cents are rejected');
select throws_ok($$select private.validate_menu_node_v2(jsonb_set(value,'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}','"375"'))from edited_menu$$,'22023','menu product price override is invalid','untyped amount is rejected');
select throws_ok($$select private.validate_menu_node_v2(jsonb_set(value,'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}','1000000000'))from edited_menu$$,'22023','menu product price override is invalid','overflow amount is rejected');
select lives_ok($$select private.validate_menu_node_v2(jsonb_set(value,'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}','0'))from edited_menu$$,'zero is a valid explicit amount');
select lives_ok($$select private.validate_menu_node_v2(jsonb_set(value,'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}','null'))from edited_menu$$,'null resets to the source amount');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000220121',true);
select lives_ok($$insert into menu_test_state(name,value)select 'saved',public.save_menu_studio_document_v2((select id from menu_test_state where name='slide'),1,'20000000-0000-4000-8000-000000220125','{"kind":"restore-content"}'::jsonb,value)from edited_menu$$,'edited product saves through the authenticated revision-aware RPC');
select is((select value->>'outcome'from menu_test_state where name='saved'),'applied','save is acknowledged');
select is((select configuration_json#>>'{pages,0,blocks,0,productNodes,0,nameOverride}'from dynamic_slides where id=(select id from menu_test_state where name='slide')),'Clubkoffie','reopen retains the display name');
select is((select configuration_json#>>'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}'from dynamic_slides where id=(select id from menu_test_state where name='slide')),'375','reopen retains the placement amount');
select is((select configuration_json#>>'{pages,0,blocks,0,productNodes,0,snapshotFallback,price,currency}'from dynamic_slides where id=(select id from menu_test_state where name='slide')),'EUR','server resolves currency from the catalog');
select is((select configuration_json#>>'{pages,0,blocks,0,productNodes,0,snapshotFallback,price,amountMinor}'from dynamic_slides where id=(select id from menu_test_state where name='slide')),'250','source snapshot remains canonical');
select is((select length(configuration_json#>>'{pages,0,blocks,0,productNodes,0,secondaryLineItems,0,label}')from dynamic_slides where id=(select id from menu_test_state where name='slide')),2320,'reopen retains the full long free subline');
select is((select price_cents from tenant_products where id='30000000-0000-4000-8000-000000220121'),250,'editing a placement does not change its catalog product');
select lives_ok($$select public.publish_dynamic_slide_version_v1((select id from menu_test_state where name='slide'),(select active_draft_version_id from dynamic_slides where id=(select id from menu_test_state where name='slide')),2)$$,'edited document can be prepared for immutable publication');
select is((select configuration_json#>>'{pages,0,blocks,0,productNodes,0,priceOverrideMinor}'from dynamic_slide_versions where dynamic_slide_id=(select id from menu_test_state where name='slide')order by version_number desc limit 1),'375','immutable publication retains the placement amount');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000220123',true);
select throws_ok($$select public.save_menu_studio_document_v2((select id from menu_test_state where name='slide'),2,'20000000-0000-4000-8000-000000220126','{"kind":"restore-content"}'::jsonb,(select value from edited_menu))$$,'42501',null,'another tenant cannot edit the menu');
reset role;
select ok(not has_function_privilege('authenticated','private.validate_menu_node_v2(jsonb)','EXECUTE'),'validator remains private');
select ok(not has_function_privilege('anon','private.validate_menu_node_v2(jsonb)','EXECUTE'),'anonymous clients cannot invoke the private validator');
select *from finish();
rollback;
