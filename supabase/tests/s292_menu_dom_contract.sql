begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.complete_menu_dom_job_v2(uuid,text,uuid,jsonb)','execute'),'anonymous clients cannot attest Menu readiness');
select ok(not has_function_privilege('authenticated','public.complete_menu_dom_job_v2(uuid,text,uuid,jsonb)','execute'),'a browser cannot attest Menu readiness');
select ok(has_function_privilege('service_role','public.complete_menu_dom_job_v2(uuid,text,uuid,jsonb)','execute'),'only the fenced worker completes Menu DOM');
select ok(not has_function_privilege('authenticated','public.complete_menu_binary_render_v2(uuid,uuid,text,uuid,jsonb)','execute'),'a browser cannot complete a Menu export');
select ok(has_function_privilege('service_role','public.complete_menu_binary_render_v2(uuid,uuid,text,uuid,jsonb)','execute'),'the existing export worker owns Menu binary completion');
select ok(not has_function_privilege('authenticated','private.assert_menu_dom_presentation_v2(public.dynamic_slide_snapshots,jsonb)','execute'),'the canonical Menu guard is not exposed');
select ok(not has_function_privilege('anon','private.assert_menu_dom_presentation_v2(public.dynamic_slide_snapshots,jsonb)','execute'),'anonymous callers cannot execute the private logo validator');
select ok(not has_function_privilege('service_role','private.assert_menu_dom_presentation_v2(public.dynamic_slide_snapshots,jsonb)','execute'),'the worker still uses only its guarded completion RPC');
insert into public.tenants(id,name,slug)values('29220000-0000-4000-8000-000000000001','Menu DOM A','s292-menu-a'),('29220000-0000-4000-8000-000000000101','Menu DOM B','s292-menu-b');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values('29220000-0000-4000-8000-000000000003','29220000-0000-4000-8000-000000000001','Menu A','manual_products');
insert into public.tenant_products(id,tenant_id,data_source_id,source,slug,name,category,price_cents)values('29220000-0000-4000-8000-000000000004','29220000-0000-4000-8000-000000000001','29220000-0000-4000-8000-000000000003','manual','coffee','Clubkoffie','Warme dranken',250);
create temp table menu_dom_fixture(snapshot public.dynamic_slide_snapshots,presentation jsonb);
insert into menu_dom_fixture select jsonb_populate_record(null::public.dynamic_slide_snapshots,jsonb_build_object('id','29220000-0000-4000-8000-000000000021','tenant_id','29220000-0000-4000-8000-000000000001','data_source_id','29220000-0000-4000-8000-000000000003','snapshot_data_json','{"type": "price_list", "brand": {"clubName": "Menu DOM fixture", "primaryColor": "#03438a"}, "menuDocument": {"id": "2ec45c6b-54b3-4b7b-aeca-753a92a8eec4", "pages": [{"id": "page-1", "order": 0, "blocks": [{"id": "drinks", "type": "category", "order": 0, "layout": {"portrait": {"h": 1380, "w": 452, "x": 72, "y": 348, "rotation": 0}, "landscape": {"h": 696, "w": 848, "x": 96, "y": 248, "rotation": 0}}, "source": {"source": "manual", "sourceName": "Warme dranken", "sourceCategoryId": "29220000-0000-4000-8000-000000000007"}, "widget": {"column": "left"}, "productNodes": [{"id": "coffee", "kind": "product", "order": 0, "productRef": {"source": "manual", "productId": "29220000-0000-4000-8000-000000000004", "sourceRevision": "0"}, "snapshotFallback": {"name": "Clubkoffie", "price": {"taxMode": "inclusive", "currency": "EUR", "amountMinor": 250}, "available": true, "capturedAt": "2026-10-25T18:15:18.710394+00:00"}}]}, {"id": "offer", "body": "Met een koekje", "type": "promo", "order": 1, "title": "Koffiedeal", "layout": {"portrait": {"h": 1380, "w": 452, "x": 556, "y": 348, "rotation": 0}, "landscape": {"h": 696, "w": 848, "x": 976, "y": 248, "rotation": 0}}, "widget": {"column": "right"}}], "durationMs": 6000, "portraitColumns": 1, "landscapeColumns": 2}, {"id": "page-2", "order": 1, "blocks": [{"id": "note", "text": "Welkom in de kantine", "type": "text", "order": 0, "layout": {"portrait": {"h": 1380, "w": 936, "x": 72, "y": 348, "rotation": 0}, "landscape": {"h": 696, "w": 1728, "x": 96, "y": 248, "rotation": 0}}}], "durationMs": 6000}], "theme": {"mode": "light", "brand": {"accent": "#03438a"}, "themeId": "onzetrots-tv", "themeVersion": "11.0.0"}, "title": "Onze kantine", "assets": [], "revision": 1, "tenantId": "29220000-0000-4000-8000-000000000001", "createdAt": "2026-10-25T18:15:18.710394+00:00", "updatedAt": "2026-10-25T18:15:18.710394+00:00", "publication": {"publishedAt": "2026-10-25T18:15:18.710394+00:00", "rendererVersion": "2.0.0", "documentRevision": 1, "contentFitVersion": "dom-measured-2.0.0", "assetManifestVersion": "1.0.0", "themeManifestVersion": "1.0.0"}, "schemaVersion": "menu-document.v2", "sitesConfiguration": {"body": "", "align": "left", "qrUrl": "https://veyocast.nl", "scale": 100, "title": "Onze kantine", "accent": "#03438a", "grunge": 55, "layout": "full", "ledSide": "unknown", "overlay": 0, "seconds": 6, "themeId": "onzetrots-tv", "currency": "EUR", "ledTheme": "blue", "provider": "menu", "safeArea": 6, "subtitle": "", "animation": "rise", "extraType": "periodestand", "ledMoment": "live", "logoScale": 100, "paintTone": "white", "rssLayout": "accordion", "showClock": true, "teamScale": 100, "menuLayout": "columns", "scoreScale": 100, "showPrices": true, "titleScale": 100, "ledTemplate": "match-center", "menuWidgets": true, "orientation": "landscape", "photoMotion": true, "rowsPerPage": 12, "unifiedKind": "kantine", "arrivalAfter": 120, "arrivalCards": 4, "showBranding": true, "showTimeline": true, "arrivalBefore": 180, "backgroundFit": "contain", "schemaVersion": 1, "timelineLimit": 3, "onzeTrotsStyle": "v10-barlow-light", "showCategories": true, "showSceneLabel": true, "sourceRevision": "6800bc858436ba0843eaea89b682cd5b43c3521d", "vacancyContact": "", "arrivalShowLogo": true, "rendererVersion": "sites-v17", "arrivalShowKickoff": true}}, "themePresentation": {"selection": {"ref": {"id": "onzetrots-tv", "catalog": "v2", "version": "11.0.0"}, "accent": "#2459ED", "support": null, "modePolicy": {"kind": "fixed", "mode": "light"}, "categoryOverrides": []}, "appearance": {"palette": {"primary": "#2459ED", "version": 1, "secondary": null, "background": "club"}, "surfaces": {"clubLogoBackground": "#FFFFFF", "homeLogoBackground": "#FFFFFF"}, "typography": {"baseScale": 1, "sportScale": 1, "bodyFontRef": "vc-roboto-v1", "displayFontRef": "vc-roboto-v1"}, "motionEnabled": true, "schemaVersion": 2, "designRevision": "royal-current-v8"}, "resolvedMode": {"mode": "light", "policy": {"kind": "fixed", "mode": "light"}, "timezone": "Europe/Amsterdam", "resolvedAt": "2026-10-25T18:15:18.775Z"}, "catalogVersion": "1.0.0", "snapshotVersion": 2, "settingsRevision": 0}, "sitesConfiguration": {"body": "", "align": "left", "qrUrl": "https://veyocast.nl", "scale": 100, "title": "Onze kantine", "accent": "#03438a", "grunge": 55, "layout": "full", "ledSide": "unknown", "overlay": 0, "seconds": 6, "themeId": "onzetrots-tv", "currency": "EUR", "ledTheme": "blue", "provider": "menu", "safeArea": 6, "subtitle": "", "animation": "rise", "extraType": "periodestand", "ledMoment": "live", "logoScale": 100, "paintTone": "white", "rssLayout": "accordion", "showClock": true, "teamScale": 100, "menuLayout": "columns", "scoreScale": 100, "showPrices": true, "titleScale": 100, "ledTemplate": "match-center", "menuWidgets": true, "orientation": "landscape", "photoMotion": true, "rowsPerPage": 12, "unifiedKind": "kantine", "arrivalAfter": 120, "arrivalCards": 4, "showBranding": true, "showTimeline": true, "arrivalBefore": 180, "backgroundFit": "contain", "schemaVersion": 1, "timelineLimit": 3, "onzeTrotsStyle": "v10-barlow-light", "showCategories": true, "showSceneLabel": true, "sourceRevision": "6800bc858436ba0843eaea89b682cd5b43c3521d", "vacancyContact": "", "arrivalShowLogo": true, "rendererVersion": "sites-v17", "arrivalShowKickoff": true}, "syncPlaybackProtocol": 2, "_veyocastThemeRuntime": {"version": 2}}'::jsonb)),'{"kind": "dynamic", "configuration": {"onzeTrotsStyle": "v10-barlow-light", "menuWidgets": true, "schemaVersion": 1, "rendererVersion": "sites-v17", "sourceRevision": "6800bc858436ba0843eaea89b682cd5b43c3521d", "themeId": "onzetrots-tv", "orientation": "landscape", "provider": "menu", "title": "Onze kantine", "subtitle": "", "overlay": 0, "accent": "#03438a", "layout": "full", "scale": 100, "align": "left", "safeArea": 6, "seconds": 6, "rowsPerPage": 12, "ledTemplate": "match-center", "ledTheme": "blue", "ledMoment": "live", "ledSide": "unknown", "titleScale": 100, "scoreScale": 100, "logoScale": 100, "teamScale": 100, "showBranding": true, "showSceneLabel": true, "showClock": true, "showTimeline": true, "timelineLimit": 3, "backgroundFit": "contain", "grunge": 55, "animation": "rise", "unifiedKind": "kantine", "paintTone": "white", "photoMotion": true, "rssLayout": "accordion", "menuLayout": "columns", "showPrices": true, "showCategories": true, "currency": "EUR", "extraType": "periodestand", "arrivalCards": 4, "arrivalBefore": 180, "arrivalAfter": 120, "arrivalShowLogo": true, "arrivalShowKickoff": true, "qrUrl": "https://veyocast.nl", "body": "", "vacancyContact": ""}, "content": {"menuPages": [{"id": "page-1:0:0", "columns": 2, "widgets": [{"id": "drinks", "type": "category", "column": "left", "columns": 1, "title": "Warme dranken", "subtitle": "", "rows": [{"id": "coffee", "primary": "Clubkoffie", "secondary": "", "value": "€ 2,50", "column": 1}]}, {"id": "offer", "type": "promo", "column": "right", "columns": 1, "title": "Koffiedeal", "subtitle": "Met een koekje", "rows": []}]}, {"id": "page-2:0:0", "columns": 2, "widgets": [{"id": "note", "type": "text", "column": "full", "columns": 1, "title": "Welkom in de kantine", "rows": []}]}], "kind": "kantine", "title": "Onze kantine", "subtitle": "", "clubName": "Menu DOM fixture", "rows": [{"id": "coffee", "primary": "Clubkoffie", "value": "€ 2,50", "tag": "Warme dranken"}]}}'::jsonb;
select is(private.assert_menu_dom_presentation_v2(snapshot,presentation),12000,'the actual wizard/RPC/worker fixture has two complete pages')from menu_dom_fixture;
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{configuration}','{}'))from menu_dom_fixture$$,'23514','invalid Menu DOM presentation','missing immutable configuration fails closed');
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{configuration,rendererVersion}','"unknown"'))from menu_dom_fixture$$,'23514','invalid Menu DOM presentation','an unknown renderer cannot become ready');
select throws_ok($$select private.assert_menu_dom_presentation_v2(jsonb_populate_record(snapshot,jsonb_build_object('snapshot_data_json',(snapshot).snapshot_data_json-'syncPlaybackProtocol')),presentation)from menu_dom_fixture$$,'23514','invalid Menu DOM presentation','historical Menu contracts cannot be silently reinterpreted');
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_bucket,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)values
 ('29220000-0000-4000-8000-000000000102','29220000-0000-4000-8000-000000000001','image','Other own image','other.png','image/png','ready','tenant-media','tenants/29220000-0000-4000-8000-000000000001/assets/29220000-0000-4000-8000-000000000102/original.png',1024,repeat('b',64),1920,1080,now()),
 ('29220000-0000-4000-8000-000000000103','29220000-0000-4000-8000-000000000101','image','Other tenant image','other.png','image/png','ready','tenant-media','tenants/29220000-0000-4000-8000-000000000101/assets/29220000-0000-4000-8000-000000000103/original.png',1024,repeat('b',64),1920,1080,now());
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)select tenant_id,id,'original',storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id in('29220000-0000-4000-8000-000000000102','29220000-0000-4000-8000-000000000103');
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000103','checksumSha256',repeat('b',64))))from menu_dom_fixture$$,'23514','Menu DOM asset authority mismatch','tenant A cannot attest a tenant B image');
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000102','checksumSha256',repeat('b',64))))from menu_dom_fixture$$,'23514','Menu DOM asset authority mismatch','even an own image requires a real immutable document/configuration reference');
insert into public.provider_asset_cache(id,provider,entity_type,external_entity_id,asset_role)
values('29220000-0000-4000-8000-000000000201','sportlink','club','s312-menu-logo','logo');
insert into public.provider_asset_versions(id,cache_id,checksum_sha256,storage_bucket,storage_path,mime_type,file_size_bytes,width,height)
values
 ('29220000-0000-4000-8000-000000000202','29220000-0000-4000-8000-000000000201',repeat('c',64),'provider-assets','s312/logo.webp','image/webp',1024,100,100),
 ('29220000-0000-4000-8000-000000000203','29220000-0000-4000-8000-000000000201',repeat('d',64),'provider-assets','s312/other-logo.webp','image/webp',1024,100,100);

create temp table menu_provider_logo_fixture as
select jsonb_populate_record(snapshot,jsonb_build_object('snapshot_data_json',
  jsonb_set((snapshot).snapshot_data_json,'{brand,logoMediaAssetId}','"29220000-0000-4000-8000-000000000202"'))) as snapshot,
  jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant',
    'mediaAssetId','29220000-0000-4000-8000-000000000202','checksumSha256',repeat('c',64))) as presentation
from menu_dom_fixture;

select lives_ok($$select private.assert_menu_dom_presentation_v2(snapshot,presentation)from menu_provider_logo_fixture$$,
  'a frozen provider logo is valid without copying it into tenant Media');
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{content,logo,checksumSha256}',to_jsonb(repeat('e',64))))from menu_provider_logo_fixture$$,
  '23514','Menu DOM asset authority mismatch','provider logo bytes must match the exact immutable checksum');
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000203','checksumSha256',repeat('d',64))))from menu_provider_logo_fixture$$,
  '23514','Menu DOM asset authority mismatch','a different valid provider logo cannot replace the frozen brand');
select throws_ok($$select private.assert_menu_dom_presentation_v2(snapshot,jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000202','checksumSha256',repeat('c',64))))from menu_dom_fixture$$,
  '23514','Menu DOM asset authority mismatch','a globally readable provider image still needs frozen snapshot authority');
select throws_ok($$select private.assert_menu_dom_presentation_v2(
  jsonb_populate_record(snapshot,jsonb_build_object('snapshot_data_json',jsonb_set((snapshot).snapshot_data_json,
    '{sitesConfiguration,background}',jsonb_build_object('mediaAssetId','29220000-0000-4000-8000-000000000202')))),
  jsonb_set(jsonb_set(presentation,'{configuration,background}',jsonb_build_object('mediaAssetId','29220000-0000-4000-8000-000000000202')),
    '{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000202','checksumSha256',repeat('c',64))))
  from menu_dom_fixture$$,'23514','Menu DOM asset authority mismatch',
  'a null brand never authorizes a provider image through another configuration field');
select throws_ok($$select private.assert_menu_dom_presentation_v2(jsonb_populate_record(snapshot,jsonb_build_object('snapshot_data_json',jsonb_set((snapshot).snapshot_data_json,'{brand,logoMediaAssetId}','"29220000-0000-4000-8000-000000000103"'))),jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000103','checksumSha256',repeat('b',64))))from menu_dom_fixture$$,
  '23514','Menu DOM asset authority mismatch','even a frozen brand cannot authorize another tenant image');
select lives_ok($$select private.assert_menu_dom_presentation_v2(jsonb_populate_record(snapshot,jsonb_build_object('snapshot_data_json',jsonb_set((snapshot).snapshot_data_json,'{brand,logoMediaAssetId}','"29220000-0000-4000-8000-000000000102"'))),jsonb_set(presentation,'{content,logo}',jsonb_build_object('kind','tenant','mediaAssetId','29220000-0000-4000-8000-000000000102','checksumSha256',repeat('b',64))))from menu_dom_fixture$$,
  'the existing ready tenant logo path remains valid');

insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,selection_mode,status,configuration_json,menu_document_revision)
select '29220000-0000-4000-8000-000000000210','29220000-0000-4000-8000-000000000001','Menu provider completion','price_list','landscape',
  template.id,version.id,'29220000-0000-4000-8000-000000000003','latest','draft',(fixture.snapshot).snapshot_data_json->'menuDocument',
  ((fixture.snapshot).snapshot_data_json#>>'{menuDocument,revision}')::bigint
from public.dynamic_templates template
join public.dynamic_template_versions version on version.id=template.current_published_version_id
cross join menu_provider_logo_fixture fixture
where template.slide_type='price_list' and template.orientation='landscape' and template.status='published'
limit 1;
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,dynamic_slide_version_id)
select (fixture.snapshot).id,slide.tenant_id,slide.id,slide.template_version_id,slide.data_source_id,repeat('a',64),
  (fixture.snapshot).snapshot_data_json,'rendering',slide.active_draft_version_id
from menu_provider_logo_fixture fixture
cross join public.dynamic_slides slide where slide.id='29220000-0000-4000-8000-000000000210';
update public.dynamic_slide_versions set status='publishing'
where dynamic_slide_id='29220000-0000-4000-8000-000000000210';
insert into public.dynamic_render_jobs(id,tenant_id,snapshot_id,output_media_asset_id,status,locked_by,lease_token,locked_at)
values('29220000-0000-4000-8000-000000000211','29220000-0000-4000-8000-000000000001','29220000-0000-4000-8000-000000000021',
  '29220000-0000-4000-8000-000000000212','rendering','s312-menu-worker','29220000-0000-4000-8000-000000000213',now());
create temp table menu_provider_artifact as
select jsonb_build_object('schemaVersion',2,'mimeType','application/vnd.veyocast.sync-dom+json',
  'byteLength',1024,'checksumSha256',repeat('f',64),'width',1920,'height',1080,'durationMs',12000,
  'storagePath','tenants/29220000-0000-4000-8000-000000000001/assets/'||job.output_media_asset_id::text||'/sync-dom/'||repeat('f',64)||'.json',
  'presentation',presentation) as artifact from menu_provider_logo_fixture
cross join public.dynamic_render_jobs job where job.id='29220000-0000-4000-8000-000000000211';
grant select on menu_provider_artifact to service_role;
set local role service_role;
select lives_ok($$select public.complete_menu_dom_job_v2('29220000-0000-4000-8000-000000000211','s312-menu-worker',
  '29220000-0000-4000-8000-000000000213',artifact)from menu_provider_artifact$$,
  'the real fenced Menu completion accepts the provider logo');
select lives_ok($$select public.complete_menu_dom_job_v2('29220000-0000-4000-8000-000000000211','s312-menu-worker',
  '29220000-0000-4000-8000-000000000213',artifact)from menu_provider_artifact$$,
  'replaying the confirmed completion is idempotent');
reset role;
select is((select status from public.dynamic_render_jobs where id='29220000-0000-4000-8000-000000000211'),'completed',
  'the real queue job is completed, not merely relabelled in Control');
select is((select status from public.dynamic_slide_versions where dynamic_slide_id='29220000-0000-4000-8000-000000000210'),'published',
  'the same logical slide version becomes published');
select ok((select slide.current_published_version_id=version.id and version.published_snapshot_id=snapshot.id
  and snapshot.status='ready' and asset.status='ready' and variant.variant_type='original'
  from public.dynamic_slides slide
  join public.dynamic_slide_versions version on version.tenant_id=slide.tenant_id and version.dynamic_slide_id=slide.id
  join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=version.tenant_id and snapshot.id=version.published_snapshot_id
  join public.media_assets asset on asset.tenant_id=snapshot.tenant_id and asset.id=snapshot.output_media_asset_id
  join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
  where slide.id='29220000-0000-4000-8000-000000000210'),
  'active version, ready snapshot and usable original output all agree');
select is((select count(*)from public.dynamic_slide_versions where dynamic_slide_id='29220000-0000-4000-8000-000000000210'),1::bigint,
  'completion and replay never create a duplicate slide version');
select *from finish();
rollback;
