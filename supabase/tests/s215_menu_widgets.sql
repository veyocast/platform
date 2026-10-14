begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-4000-8000-000000215121', 'authenticated', 'authenticated', 's215-menu-owner@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000215122', 'authenticated', 'authenticated', 's215-menu-viewer@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000215123', 'authenticated', 'authenticated', 's215-menu-other@veyocast.test', 'test', now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-000000215121', 'Menu owner'),
  ('00000000-0000-4000-8000-000000215122', 'Menu viewer'),
  ('00000000-0000-4000-8000-000000215123', 'Other menu owner');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-000000215121', 'Menu tenant', 's215-menu-tenant'),
  ('10000000-0000-4000-8000-000000215122', 'Other menu tenant', 'other-s215-menu-tenant');

insert into public.tenant_settings (tenant_id)
values
  ('10000000-0000-4000-8000-000000215121'),
  ('10000000-0000-4000-8000-000000215122');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000215121', '00000000-0000-4000-8000-000000215121', 'tenant_owner'),
  ('10000000-0000-4000-8000-000000215121', '00000000-0000-4000-8000-000000215122', 'tenant_viewer'),
  ('10000000-0000-4000-8000-000000215122', '00000000-0000-4000-8000-000000215123', 'tenant_owner');

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
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000215121', true);

insert into menu_test_state(name, id)
values (
  'source',
  public.create_dynamic_data_source_v1(
    '10000000-0000-4000-8000-000000215121',
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
where tenant_id = '10000000-0000-4000-8000-000000215121';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000215121', true);

insert into menu_test_state(name, value)
select 'created', public.create_menu_studio_draft_v2(
  '10000000-0000-4000-8000-000000215121',
  'Lunchmenu',
  version.id,
  (select id from menu_test_state where name = 'source'),
  'latest',
  jsonb_set('{"schemaVersion":"menu-document.v2","id":"draft","tenantId":"draft","revision":1,"createdAt":"2026-08-21T12:00:00.000Z","updatedAt":"2026-08-21T12:00:00.000Z","title":"Lunch","theme":{"themeId":"onzetrots-tv","themeVersion":"11.0.0","mode":"light","brand":{"accent":"#FF5C20"}},"assets":[],"pages":[{"id":"page-1","order":0,"landscapeColumns":2,"portraitColumns":1,"blocks":[]}]}'::jsonb,'{sitesConfiguration}',pg_temp.sites_v17_configuration()||'{"menuWidgets":true}'::jsonb,true),
  '20000000-0000-4000-8000-000000215122'
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


select lives_ok($$insert into menu_test_state(name,value)select 'saved',public.save_menu_studio_document_v2((select id from menu_test_state where name='slide'),1,'20000000-0000-4000-8000-000000215124','{"kind":"restore-content"}'::jsonb,jsonb_set(value->'document','{pages}','[{"id":"page-1","order":0,"landscapeColumns":2,"portraitColumns":1,"blocks":[{"id":"deal-1","order":0,"type":"promo","title":"Koffiedeal","body":"Met koekje","widget":{"column":"right"},"layout":{"landscape":{"x":96,"y":248,"w":800,"h":600,"rotation":0},"portrait":{"x":72,"y":348,"w":936,"h":600,"rotation":0}}}]},{"id":"page-2","order":1,"landscapeColumns":1,"portraitColumns":2,"blocks":[]}]'::jsonb))from menu_test_state where name='created'$$,'widget pages save through the real revision-aware RPC');
select is((select value->>'outcome'from menu_test_state where name='saved'),'applied','widget save is acknowledged');
select is((select configuration_json#>>'{pages,0,blocks,0,widget,column}'from dynamic_slides where id=(select id from menu_test_state where name='slide')),'right','reopened document retains widget column');
select is((select jsonb_array_length(configuration_json->'pages')from dynamic_slides where id=(select id from menu_test_state where name='slide')),2,'reopened document retains the additional page');
select lives_ok($$select public.publish_dynamic_slide_version_v1((select id from menu_test_state where name='slide'),(select active_draft_version_id from dynamic_slides where id=(select id from menu_test_state where name='slide')),2)$$,'the saved v17 widget document can be prepared for immutable publication');
select is((select configuration_json#>>'{pages,0,blocks,0,widget,column}'from dynamic_slide_versions where dynamic_slide_id=(select id from menu_test_state where name='slide')order by version_number desc limit 1),'right','immutable publication candidate retains its authored widget placement');
reset role;
select throws_ok($$select private.validate_menu_document_v2(slide.tenant_id,slide.data_source_id,jsonb_set(slide.configuration_json,'{pages,0,blocks,0,widget,column}','"outside"'))from dynamic_slides slide where slide.id=(select id from menu_test_state where name='slide')$$,'22023','menu widget placement invalid','untrusted widget positions are rejected server-side');
select throws_ok($$select private.validate_menu_document_v2(slide.tenant_id,slide.data_source_id,jsonb_set(slide.configuration_json,'{pages,0,landscapeColumns}','3'))from dynamic_slides slide where slide.id=(select id from menu_test_state where name='slide')$$,'22023','menu column count invalid','column counts outside 1/2 are rejected server-side');
select ok(not has_function_privilege('authenticated','private.validate_menu_document_before_widgets_v1(uuid,uuid,jsonb)','EXECUTE'),'original validator remains private');
select *from finish();
rollback;
