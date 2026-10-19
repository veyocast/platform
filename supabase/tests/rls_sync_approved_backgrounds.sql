begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

-- Independent, byte-exact fixtures from the approved historical image set.
-- The test never extends the core renderer manifest or rewrites old content.
create temporary table gallery_assets(
 id integer primary key,scene text not null,orientation text not null,
 path text not null,sha text not null
);
insert into gallery_assets values
 (1,'Houtrust','landscape','/onzetrots/website-brush/houtrust-wide-1672.webp','4e654df31f432c922a44b1670f6bf8d64af3361d40645f410de0a4d696d46171'),
 (2,'Houtrust','portrait','/onzetrots/website-brush/houtrust-portrait-941.webp','e96a079d1a96f3ca75305329431065d2c61b7f3548735f48811bb57d34be4a14'),
 (3,'De wijk','landscape','/onzetrots/website-brush/de-wijk-wide-1672.webp','d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e'),
 (4,'De wijk','portrait','/onzetrots/website-brush/de-wijk-portrait-941.webp','a9aab1cb20cbd4abcf92ed90463d8e50a2a67c4cf1637bd2cdeb55dbd265ae70'),
 (5,'Aan zee','landscape','/onzetrots/website-brush/aan-zee-wide-1672.webp','ab1df0dd01e1f5ed768e099897377e12b92b85c2856eb80c48c7a06416ece3ae'),
 (6,'Aan zee','portrait','/onzetrots/website-brush/aan-zee-portrait-941.webp','446eeeaa84b0e032d34fa6aac10615716d4927917bf9258d245ddad0ebc347d6');

create function pg_temp.gallery_ref(p_id integer)returns jsonb language sql stable as $$
 select jsonb_build_object('kind','system','path',path,'checksumSha256',sha)
 from gallery_assets where id=p_id;
$$;
create function pg_temp.command_key(p_id integer)returns uuid language sql immutable as $$
 select ('40000000-0000-4000-8000-'||lpad(p_id::text,12,'0'))::uuid;
$$;
create function pg_temp.base_slide(p_orientation text default 'landscape')returns jsonb language sql immutable as $function$
 select $slide${"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"menu","orientation":"landscape","theme":"fieldflow","name":"Achtergrondproef","club":{"name":"Galerij A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}}$slide$::jsonb
 ||jsonb_build_object('orientation',p_orientation);
$function$;
create function pg_temp.gallery_slide(p_id integer)returns jsonb language sql stable as $$
 select jsonb_set(jsonb_set(pg_temp.base_slide(orientation),'{style,background}','"photo"'),
  '{style,backgroundAsset}',pg_temp.gallery_ref(p_id))from gallery_assets where id=p_id;
$$;
create function pg_temp.document(p_slide jsonb)returns jsonb language sql immutable as $$
 select jsonb_build_object('schemaVersion',1,'artboard',jsonb_build_object(
  'width',case when p_slide->>'orientation'='portrait'then 1080 else 1920 end,
  'height',case when p_slide->>'orientation'='portrait'then 1920 else 1080 end,
  'orientation',p_slide->>'orientation','background',jsonb_build_object('kind','solid','color','#FAFAF7'),
  'safeArea',jsonb_build_object('top',64,'right',64,'bottom',64,'left',64)),
  'motion',jsonb_build_object('enabled',false,'durationMs',12000,'fps',30),'elements','[]'::jsonb,
  'syncPresentation',p_slide,'metadata',jsonb_build_object('fontRegistryVersion','2026-09-09.1','tenantBrandApplied',false));
$$;
create function pg_temp.configuration(p_slide jsonb)returns jsonb language sql immutable as $$
 select jsonb_build_object('schemaVersion',1,'kind','dynamic','rendererVersion','sync-v1',
  'sourceRevision','8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a','slideType','menu','seed',p_slide,'secondsPerPage',3);
$$;
create function pg_temp.author_request(p_slide jsonb)returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',current_published_version_id,
  'dataSourceId','20000000-0000-4000-8000-000000238001',
  'configuration',jsonb_build_object('maxItems',200,'syncConfiguration',pg_temp.configuration(p_slide)))
 from public.dynamic_templates
 where slug='editorial-arena-menubord-dark-'||(p_slide->>'orientation')and status='published';
$$;
-- The complete-render guard receives a composite, not an untrusted RPC.
-- A substituted frozen seed isolates role/SHA/style admission from equality.
create function pg_temp.with_seed(p_snapshot public.dynamic_slide_snapshots,p_seed jsonb)
 returns public.dynamic_slide_snapshots language sql immutable as $$
 select jsonb_populate_record(p_snapshot,jsonb_build_object('snapshot_data_json',
  jsonb_set(p_snapshot.snapshot_data_json,'{syncConfiguration,seed}',p_seed)));
$$;
create function pg_temp.logo_ref(p_slide jsonb,p_role text,p_ref jsonb)returns jsonb language sql immutable as $$
 select case when p_role='club'then jsonb_set(p_slide,'{club,logo}',p_ref)
 else jsonb_set(p_slide,array[p_role],jsonb_build_object('name','Club','team','Team','logo',p_ref))end;
$$;

insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000238001','Galerij A','s238-gallery-a'),
 ('10000000-0000-4000-8000-000000238002','Galerij B','s238-gallery-b');
insert into public.tenant_settings(tenant_id)values
 ('10000000-0000-4000-8000-000000238001'),('10000000-0000-4000-8000-000000238002');
insert into auth.users(id,email)values
 ('00000000-0000-4000-8000-000000238001','s238-gallery-a@test.invalid'),
 ('00000000-0000-4000-8000-000000238002','s238-gallery-b@test.invalid'),
 ('00000000-0000-4000-8000-000000238003','s238-gallery-viewer@test.invalid');
insert into public.profiles(id,display_name)values
 ('00000000-0000-4000-8000-000000238001','Owner A'),
 ('00000000-0000-4000-8000-000000238002','Owner B'),
 ('00000000-0000-4000-8000-000000238003','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000238001','00000000-0000-4000-8000-000000238001','tenant_owner'),
 ('10000000-0000-4000-8000-000000238002','00000000-0000-4000-8000-000000238002','tenant_owner'),
 ('10000000-0000-4000-8000-000000238001','00000000-0000-4000-8000-000000238003','tenant_viewer');
insert into public.dynamic_data_sources(id,tenant_id,name,kind)values
 ('20000000-0000-4000-8000-000000238001','10000000-0000-4000-8000-000000238001','Eigen catalogus','manual_products'),
 ('20000000-0000-4000-8000-000000238002','10000000-0000-4000-8000-000000238002','Private catalogus','manual_products');
insert into public.tenant_products(tenant_id,data_source_id,source,slug,name,price_cents)
 select '10000000-0000-4000-8000-000000238001','20000000-0000-4000-8000-000000238001',
 'manual','gallery-product-'||i,'Eigen product '||i,250 from generate_series(1,5)i;

select is((select count(*)from public.dynamic_templates
 where slug in('editorial-arena-menubord-dark-landscape','editorial-arena-menubord-dark-portrait')
 and status='published'and current_published_version_id is not null),2::bigint,
 'the real canonical menu templates exist for both orientations');

select lives_ok(format('select private.assert_studio_document(%L,%L,%s,%s,%L::jsonb,%L::uuid[])',
 '10000000-0000-4000-8000-000000238001',orientation,
 case when orientation='portrait'then 1080 else 1920 end,
 case when orientation='portrait'then 1920 else 1080 end,
 pg_temp.document(pg_temp.gallery_slide(id)),'{}'),
 scene||' '||orientation||' passes the complete manual document validator')from gallery_assets order by id;
select lives_ok(format('select private.assert_sync_dynamic_configuration_v1(%L,%L,%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001','menu',orientation,
 pg_temp.configuration(pg_temp.gallery_slide(id))),
 scene||' '||orientation||' passes connected seed admission without authoring facts')from gallery_assets order by id;

select throws_ok(format('select private.assert_sync_slide_v1(%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001',pg_temp.logo_ref(pg_temp.gallery_slide(id),role,pg_temp.gallery_ref(id))),
 '23514','Sync system asset identity invalid',scene||' '||orientation||' cannot become a '||role||' logo')
 from gallery_assets cross join(values('club'),('home'),('away'))roles(role)order by id,role;
select throws_ok(format('select private.assert_sync_slide_v1(%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001',jsonb_set(pg_temp.gallery_slide(id),'{style,background}',to_jsonb(preset))),
 '23514','Sync system asset identity invalid',scene||' '||orientation||' cannot hide under preset '||preset)
 from gallery_assets cross join(values('stadium'),('gradient'),('stripes'),('clubmuur'),('light'))presets(preset)order by id,preset;
select throws_ok(format('select private.assert_sync_dynamic_configuration_v1(%L,%L,%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001','menu',orientation,
 pg_temp.configuration(jsonb_set(pg_temp.gallery_slide(id),'{style,backgroundAsset,checksumSha256}',to_jsonb(repeat('0',64))))),
 '23514','Sync system asset identity invalid',scene||' '||orientation||' rejects a changed checksum in connected admission')
 from gallery_assets order by id;
select throws_ok(format('select private.assert_sync_slide_v1(%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001',
 jsonb_set(pg_temp.gallery_slide(id),'{style,backgroundAsset,checksumSha256}',to_jsonb(repeat('0',64)))),
 '23514','Sync system asset identity invalid',scene||' '||orientation||' rejects a changed checksum in manual admission')
 from gallery_assets order by id;
select throws_ok(format('select private.assert_sync_dynamic_configuration_v1(%L,%L,%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001','menu',orientation,
 pg_temp.configuration(jsonb_set(pg_temp.gallery_slide(id),'{style,background}','"gradient"'))),
 '23514','Sync system asset identity invalid',scene||' '||orientation||' rejects a non-photo connected seed')
 from gallery_assets order by id;

create temporary table rejected_refs(label text primary key,ref jsonb not null);
insert into rejected_refs values
 ('query suffix',jsonb_set(pg_temp.gallery_ref(1),'{path}','"/onzetrots/website-brush/houtrust-wide-1672.webp?v=1"')),
 ('path traversal',jsonb_set(pg_temp.gallery_ref(1),'{path}','"/onzetrots/website-brush/../website-brush/houtrust-wide-1672.webp"')),
 ('remote URL',jsonb_set(pg_temp.gallery_ref(1),'{path}','"https://example.invalid/onzetrots/website-brush/houtrust-wide-1672.webp"')),
 ('same bytes on an unapproved historical alias',jsonb_set(pg_temp.gallery_ref(1),'{path}','"/onzetrots/houtrust-brush.webp"')),
 ('foreground brush','{"kind":"system","path":"/onzetrots/readability-brush.svg","checksumSha256":"f42dba3e394f6c87a1381a55214c6998ba8e80ee17709702ab537e969a17dfbb"}'),
 ('historical club logo','{"kind":"system","path":"/onzetrots/duindorp-logo.png","checksumSha256":"832c642ea9735b87452a6508ae5525f4f87fe528408efc58ad0f86f1a456a930"}');
select throws_ok(format('select private.assert_sync_slide_v1(%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001',jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref)),
 '23514','Sync system asset identity invalid',label||' is not a gallery background')from rejected_refs order by label;
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000238001',
 pg_temp.gallery_slide(1)#-'{style,backgroundAsset}')$$,'23514','Sync photo background missing','photo still requires a verified image reference');
select lives_ok(format('select private.assert_sync_slide_v1(%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001',jsonb_set(pg_temp.base_slide(),'{style,background}',to_jsonb(preset))),
 'legacy preset '||preset||' remains valid without a gallery rewrite')
 from(values('stadium'),('gradient'),('stripes'),('clubmuur'),('light'))presets(preset);
select lives_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000238001',
 jsonb_set(pg_temp.base_slide(),'{club,logo}','{"kind":"system","path":"/assets/full-light.svg","checksumSha256":"877dac00409543e4699c39116b508ad5096e2f2fd3b361d32ae674044c9fef9e"}'))$$,
 'an existing approved core logo retains its old role');

-- Tenant photos retain ready/original/checksum and exact tenant boundaries.
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256)
 values
 ('80000000-0000-4000-8000-000000238001','10000000-0000-4000-8000-000000238001','image','Eigen foto','own.png','image/png','ready','tenants/10000000-0000-4000-8000-000000238001/assets/80000000-0000-4000-8000-000000238001/original/own.png',100,repeat('a',64)),
 ('80000000-0000-4000-8000-000000238002','10000000-0000-4000-8000-000000238002','image','Private foto','other.png','image/png','ready','tenants/10000000-0000-4000-8000-000000238002/assets/80000000-0000-4000-8000-000000238002/original/other.png',100,repeat('b',64)),
 ('80000000-0000-4000-8000-000000238003','10000000-0000-4000-8000-000000238001','image','Nog niet gereed','pending.png','image/png','processing','tenants/10000000-0000-4000-8000-000000238001/assets/80000000-0000-4000-8000-000000238003/original/pending.png',100,repeat('c',64)),
 ('80000000-0000-4000-8000-000000238004','10000000-0000-4000-8000-000000238001','image','Zonder origineel','missing.png','image/png','ready','tenants/10000000-0000-4000-8000-000000238001/assets/80000000-0000-4000-8000-000000238004/original/missing.png',100,repeat('f',64));
insert into public.media_variants(tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256)
 select tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256
 from public.media_assets where id in('80000000-0000-4000-8000-000000238001','80000000-0000-4000-8000-000000238002','80000000-0000-4000-8000-000000238003');
create temporary table tenant_photo_cases(label text primary key,ref jsonb not null,accepted boolean not null);
insert into tenant_photo_cases values
 ('own ready original',jsonb_build_object('kind','tenant','mediaAssetId','80000000-0000-4000-8000-000000238001','checksumSha256',repeat('a',64)),true),
 ('foreign ready original',jsonb_build_object('kind','tenant','mediaAssetId','80000000-0000-4000-8000-000000238002','checksumSha256',repeat('b',64)),false),
 ('own changed checksum',jsonb_build_object('kind','tenant','mediaAssetId','80000000-0000-4000-8000-000000238001','checksumSha256',repeat('b',64)),false),
 ('own processing original',jsonb_build_object('kind','tenant','mediaAssetId','80000000-0000-4000-8000-000000238003','checksumSha256',repeat('c',64)),false),
 ('own missing original',jsonb_build_object('kind','tenant','mediaAssetId','80000000-0000-4000-8000-000000238004','checksumSha256',repeat('f',64)),false);
select lives_ok(format('select private.assert_studio_document(%L,%L,1920,1080,%L::jsonb,%L::uuid[])',
 '10000000-0000-4000-8000-000000238001','landscape',
 pg_temp.document(jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref)),
 '{80000000-0000-4000-8000-000000238001}'),'own tenant photo remains admissible in a manual manifest')
 from tenant_photo_cases where accepted;
select throws_ok(format('select private.assert_sync_slide_v1(%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001',jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref)),
 '23514','Sites media unavailable in this tenant',label||' still fails manual photo admission')
 from tenant_photo_cases where not accepted order by label;
select throws_ok(format('select private.assert_sync_dynamic_configuration_v1(%L,%L,%L,%L::jsonb)',
 '10000000-0000-4000-8000-000000238001','menu','landscape',
 pg_temp.configuration(jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref))),
 '23514','Sites media unavailable in this tenant',label||' still fails connected photo admission')
 from tenant_photo_cases where not accepted order by label;

create temporary table gallery_results(kind text not null,id integer not null,value jsonb not null,primary key(kind,id));
grant select on gallery_assets,tenant_photo_cases to authenticated,service_role;
grant select,insert on gallery_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000238001',true);

-- Freeze an ordinary old-preset revision before introducing gallery documents.
insert into gallery_results values('legacy',0,public.create_studio_project_v1(
 '10000000-0000-4000-8000-000000238001','Oud stadion','landscape',
 pg_temp.document(pg_temp.base_slide()),'{}','design',pg_temp.command_key(238000)));
select lives_ok($$select public.request_studio_render_v1(
 (select(value->>'projectId')::uuid from gallery_results where kind='legacy'),
 (select draft_revision from public.studio_project_drafts where project_id=(select(value->>'projectId')::uuid from gallery_results where kind='legacy')),
 'png',pg_temp.command_key(238001))$$,'the old preset freezes through the existing immutable Studio revision command');
reset role;
create temporary table legacy_revision_hashes as
 select id,encode(extensions.digest(to_jsonb(revision)::text,'sha256'),'hex')hash
 from public.studio_revisions revision
 where project_id=(select(value->>'projectId')::uuid from gallery_results where kind='legacy');
select ok((select count(*)>0 from legacy_revision_hashes),'the old-data hash assertion covers a real immutable revision');

set local role authenticated;
insert into gallery_results
 select 'manual',id,public.create_studio_project_v1('10000000-0000-4000-8000-000000238001',
 scene||' '||orientation,orientation,pg_temp.document(pg_temp.gallery_slide(id)),'{}','design',pg_temp.command_key(238010+id))
 from gallery_assets order by id;
select is(public.create_studio_project_v1('10000000-0000-4000-8000-000000238001',
 'Houtrust landscape','landscape',pg_temp.document(pg_temp.gallery_slide(1)),'{}','design',pg_temp.command_key(238011)),
 (select value from gallery_results where kind='manual'and id=1),'manual create retry returns exactly its committed receipt');
select throws_ok($$select public.create_studio_project_v1('10000000-0000-4000-8000-000000238001',
 'Changed command','landscape',pg_temp.document(pg_temp.gallery_slide(3)),'{}','design',pg_temp.command_key(238011))$$,
 '23505',null,'one manual nonce cannot select another background');
insert into gallery_results
 select 'connected',id,public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001',
 'create',null,null,0,pg_temp.author_request(pg_temp.gallery_slide(id)),pg_temp.command_key(238020+id))
 from gallery_assets order by id;
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 pg_temp.author_request(pg_temp.gallery_slide(1)),pg_temp.command_key(238021)),
 (select value from gallery_results where kind='connected'and id=1),'connected create retry returns exactly its canonical snapshot receipt');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 pg_temp.author_request(pg_temp.gallery_slide(3)),pg_temp.command_key(238021))$$,
 '23505',null,'one connected nonce cannot select another background');
select is((select count(*)from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000238001'),7::bigint,
 'six gallery drafts plus the old preset exist without retry duplicates');
select is((select count(*)from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000238001'),6::bigint,
 'six connected designs exist without retry duplicates');
select is(draft.document_json,pg_temp.document(pg_temp.gallery_slide(asset.id)),
 asset.scene||' '||asset.orientation||' persists the manual v1 document byte-for-byte')
 from gallery_assets asset join gallery_results result on result.kind='manual'and result.id=asset.id
 join public.studio_project_drafts draft on draft.project_id=(result.value->>'projectId')::uuid order by asset.id;
select is(snapshot.snapshot_data_json#>'{syncConfiguration,seed,style,backgroundAsset}',pg_temp.gallery_ref(asset.id),
 asset.scene||' '||asset.orientation||' freezes the connected background in the real canonical snapshot')
 from gallery_assets asset join gallery_results result on result.kind='connected'and result.id=asset.id
 join public.dynamic_slide_snapshots snapshot on snapshot.id=(result.value->>'snapshotId')::uuid order by asset.id;
reset role;

create temporary table gallery_snapshot_hashes as
 select snapshot.id,encode(extensions.digest(snapshot.snapshot_data_json::text,'sha256'),'hex')hash
 from public.dynamic_slide_snapshots snapshot join gallery_results result
 on result.kind='connected'and snapshot.id=(result.value->>'snapshotId')::uuid;
-- Created designs are publishing until their first full artifact completes.
-- Use an ordinary existing draft, as the production editor does, for CAS.
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,configuration_json)
 select '30000000-0000-4000-8000-000000238007','10000000-0000-4000-8000-000000238001',
 'Bestaand galerijontwerp','menu','landscape',template.id,template.current_published_version_id,
 '20000000-0000-4000-8000-000000238001',pg_temp.author_request(pg_temp.gallery_slide(1))->'configuration'
 from public.dynamic_templates template where template.slug='editorial-arena-menubord-dark-landscape';
create temporary table gallery_edit as
 select 1 id,slide.id slide_id,version.id version_id,version.edit_revision
 from public.dynamic_slides slide
 join public.dynamic_slide_versions version on version.id=slide.active_draft_version_id
 where slide.id='30000000-0000-4000-8000-000000238007';
grant select on gallery_edit to authenticated;
select is((select count(*)from gallery_edit),1::bigint,'an existing canonical draft is available for the real save command');
set local role authenticated;
insert into gallery_results
 select 'save',1,public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','save',
 slide_id,version_id,edit_revision,pg_temp.author_request(pg_temp.gallery_slide(3)),pg_temp.command_key(238030))
 from gallery_edit where id=1;
select is((select value->>'outcome'from gallery_results where kind='save'),'applied','an authorised save can select another approved background');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','save',
 (select slide_id from gallery_edit where id=1),(select version_id from gallery_edit where id=1),
 (select edit_revision from gallery_edit where id=1),pg_temp.author_request(pg_temp.gallery_slide(3)),pg_temp.command_key(238030)),
 (select value from gallery_results where kind='save'),'the committed save receipt recovers before stale CAS');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','save',
 (select slide_id from gallery_edit where id=1),(select version_id from gallery_edit where id=1),
 (select edit_revision from gallery_edit where id=1),pg_temp.author_request(pg_temp.gallery_slide(5)),pg_temp.command_key(238031))->>'outcome',
 'conflict','a new stale background save cannot overwrite the canonical draft');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 jsonb_set(pg_temp.author_request(pg_temp.gallery_slide(1)),'{dataSourceId}','"20000000-0000-4000-8000-000000238002"'),pg_temp.command_key(238032))$$,
 null,null,'an approved background grants no access to the other tenant source');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000238002',true);
select is((select count(*)from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000238001'),0::bigint,'B cannot read A gallery drafts');
select is((select count(*)from public.dynamic_slide_snapshots where tenant_id='10000000-0000-4000-8000-000000238001'),0::bigint,'B cannot read A gallery snapshots');
select throws_ok($$select public.save_studio_draft_v1((select(value->>'projectId')::uuid from gallery_results where kind='manual'and id=1),
 1,pg_temp.document(pg_temp.gallery_slide(3)),'{}',pg_temp.command_key(238033))$$,
 '42501',null,'B cannot replace A manual background through a guarded command');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238002','save',
 (select slide_id from gallery_edit where id=1),(select version_id from gallery_edit where id=1),0,
 pg_temp.author_request(pg_temp.gallery_slide(1)),pg_temp.command_key(238034))$$,
 '42501',null,'B cannot replace A connected background through a guarded command');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000238003',true);
select throws_ok($$select public.create_studio_project_v1('10000000-0000-4000-8000-000000238001','Viewer gallery','landscape',
 pg_temp.document(pg_temp.gallery_slide(1)),'{}','design',pg_temp.command_key(238035))$$,
 '42501',null,'viewer cannot create a manual gallery design');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 pg_temp.author_request(pg_temp.gallery_slide(1)),pg_temp.command_key(238036))$$,
 '42501',null,'viewer cannot create a connected gallery design');
reset role;

-- Negative authoring flag and tenant lifecycle apply to both original writers.
update private.tenant_feature_flag_definitions set kill_switch_active=true where flag_key='sites_authoring_paused';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000238001',true);
select throws_ok($$select public.create_studio_project_v1('10000000-0000-4000-8000-000000238001','Paused gallery','landscape',
 pg_temp.document(pg_temp.gallery_slide(1)),'{}','design',pg_temp.command_key(238037))$$,
 '55000','Sites authoring is paused','the global authoring kill flag blocks manual gallery creates');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 pg_temp.author_request(pg_temp.gallery_slide(1)),pg_temp.command_key(238038))$$,
 '55000','Sites authoring is paused','the global authoring kill flag blocks connected gallery creates');
reset role;
update private.tenant_feature_flag_definitions set kill_switch_active=false where flag_key='sites_authoring_paused';
-- Fixture lifecycle setup runs as the database owner without a human JWT.
-- Restore the real owner before checking each guarded client command.
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='paused'where id='10000000-0000-4000-8000-000000238001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000238001',true);
select throws_ok($$select public.create_studio_project_v1('10000000-0000-4000-8000-000000238001','Paused gallery','landscape',
 pg_temp.document(pg_temp.gallery_slide(1)),'{}','design',pg_temp.command_key(238039))$$,
 '42501',null,'a paused tenant cannot create manual gallery content');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 pg_temp.author_request(pg_temp.gallery_slide(1)),pg_temp.command_key(238040))$$,
 '42501',null,'a paused tenant cannot create connected gallery content');
select is((select count(*)from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000238001'),7::bigint,
 'paused gallery content remains readable for recovery');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='archived'where id='10000000-0000-4000-8000-000000238001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000238001',true);
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000238001','create',null,null,0,
 pg_temp.author_request(pg_temp.gallery_slide(1)),pg_temp.command_key(238041))$$,
 '42501',null,'an archived tenant cannot author an approved gallery either');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='active'where id='10000000-0000-4000-8000-000000238001';

-- The actual canonical snapshots now exercise the role-aware complete guard.
select lives_ok(format('select private.assert_sync_dynamic_render_presentation_v1((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb)',
 snapshot.id,snapshot.snapshot_data_json#>'{syncConfiguration,seed}'),
 asset.scene||' '||asset.orientation||' reaches complete-render as a background')
 from gallery_assets asset join gallery_results result on result.kind='connected'and result.id=asset.id
 join public.dynamic_slide_snapshots snapshot on snapshot.id=(result.value->>'snapshotId')::uuid order by asset.id;
select throws_ok(format('select private.assert_sync_dynamic_render_presentation_v1((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb)',
 snapshot.id,pg_temp.logo_ref(snapshot.snapshot_data_json#>'{syncConfiguration,seed}',role,pg_temp.gallery_ref(asset.id))),
 '23514','Sync system asset identity invalid',asset.scene||' '||asset.orientation||' is rejected as a complete-render '||role||' logo')
 from gallery_assets asset join gallery_results result on result.kind='connected'and result.id=asset.id
 join public.dynamic_slide_snapshots snapshot on snapshot.id=(result.value->>'snapshotId')::uuid
 cross join(values('club'),('home'),('away'))roles(role)order by asset.id,role;
select throws_ok(format('select private.assert_sync_dynamic_render_presentation_v1((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb)',
 snapshot.id,jsonb_set(snapshot.snapshot_data_json#>'{syncConfiguration,seed}','{style,background}','"gradient"')),
 '23514','Source render presentation invalid',asset.scene||' '||asset.orientation||' cannot change its frozen background style')
 from gallery_assets asset join gallery_results result on result.kind='connected'and result.id=asset.id
 join public.dynamic_slide_snapshots snapshot on snapshot.id=(result.value->>'snapshotId')::uuid order by asset.id;
select throws_ok(format('select private.assert_sync_dynamic_render_presentation_v1(pg_temp.with_seed((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb),%L::jsonb)',
 snapshot.id,jsonb_set(pg_temp.gallery_slide(asset.id),'{style,background}','"gradient"'),
 jsonb_set(pg_temp.gallery_slide(asset.id),'{style,background}','"gradient"')),
 '23514','Sync system asset identity invalid',asset.scene||' '||asset.orientation||' cannot exploit the old temporary-logo validation path with a non-photo seed')
 from gallery_assets asset join gallery_results result on result.kind='connected'and result.id=asset.id
 join public.dynamic_slide_snapshots snapshot on snapshot.id=(result.value->>'snapshotId')::uuid order by asset.id;
select throws_ok(format('select private.assert_sync_dynamic_render_presentation_v1(pg_temp.with_seed((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb),%L::jsonb)',
 snapshot.id,jsonb_set(pg_temp.gallery_slide(asset.id),'{style,backgroundAsset,checksumSha256}',to_jsonb(repeat('0',64))),
 jsonb_set(pg_temp.gallery_slide(asset.id),'{style,backgroundAsset,checksumSha256}',to_jsonb(repeat('0',64)))),
 '23514','Sync system asset identity invalid',asset.scene||' '||asset.orientation||' still requires its exact SHA at complete-render')
 from gallery_assets asset join gallery_results result on result.kind='connected'and result.id=asset.id
 join public.dynamic_slide_snapshots snapshot on snapshot.id=(result.value->>'snapshotId')::uuid order by asset.id;
select throws_ok(format('select private.assert_sync_dynamic_render_presentation_v1(pg_temp.with_seed((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb),%L::jsonb)',
 (select(value->>'snapshotId')::uuid from gallery_results where kind='connected'and id=1),
 jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref),jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref)),
 '23514','Sync system asset identity invalid',label||' fails even when copied into a complete-render seed')from rejected_refs order by label;
select lives_ok(format('select private.assert_sync_dynamic_render_presentation_v1(pg_temp.with_seed((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb),%L::jsonb)',
 (select(value->>'snapshotId')::uuid from gallery_results where kind='connected'and id=1),
 jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref),jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref)),
 'own ready tenant photo still completes with typed frozen image authority')from tenant_photo_cases where accepted;
select throws_ok(format('select private.assert_sync_dynamic_render_presentation_v1(pg_temp.with_seed((select snapshot from public.dynamic_slide_snapshots snapshot where id=%L),%L::jsonb),%L::jsonb)',
 (select(value->>'snapshotId')::uuid from gallery_results where kind='connected'and id=1),
 jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref),jsonb_set(pg_temp.gallery_slide(1),'{style,backgroundAsset}',ref)),
 '23514','Source render image authority invalid',label||' still fails the complete-render tenant image boundary')
 from tenant_photo_cases where not accepted order by label;

-- Complete both orientations through fenced service commands, including the
-- full two-page video and its separate verified PNG poster for old players.
update public.dynamic_render_jobs set created_at=now()-interval '2 hours'
 where tenant_id='10000000-0000-4000-8000-000000238001';
set local role service_role;
create temporary table gallery_claims as
 select i,'s238-gallery-'||i worker_id,claim.* from generate_series(1,6)i
 cross join lateral public.claim_dynamic_render_job_v2('s238-gallery-'||i,30,3)claim;
select is((select count(*)from gallery_claims where tenant_id='10000000-0000-4000-8000-000000238001'),6::bigint,
 'all six canonical gallery jobs cross the real worker lease boundary');
create function pg_temp.complete_artifact(p_snapshot_id uuid)returns jsonb language sql stable as $$
 select jsonb_build_object('mimeType','video/mp4','durationMs',6000,
 'width',case when claim.orientation='portrait'then 1080 else 1920 end,
 'height',case when claim.orientation='portrait'then 1920 else 1080 end,
 'byteLength',4096,'checksumSha256',repeat('d',64),
 'storagePath','tenants/'||claim.tenant_id::text||'/assets/'||claim.output_media_asset_id::text||'/sync-dynamic/'||repeat('d',64)||'.mp4',
 'presentation',jsonb_set(snapshot.snapshot_data_json#>'{syncConfiguration,seed}','{rows}',
 '[["Eigen product 1","2,50","",""],["Eigen product 2","2,50","",""],["Eigen product 3","2,50","",""],["Eigen product 4","2,50","",""],["Eigen product 5","2,50","",""]]'),
 'poster',jsonb_build_object('byteLength',1024,'checksumSha256',repeat('e',64),
 'storagePath','tenants/'||claim.tenant_id::text||'/assets/'||claim.output_media_asset_id::text||'/sync-dynamic/'||repeat('e',64)||'.png'))
 from gallery_claims claim join public.dynamic_slide_snapshots snapshot on snapshot.id=claim.snapshot_id
 where claim.snapshot_id=p_snapshot_id;
$$;
select throws_ok(format('select public.complete_dynamic_render_job_v2(%L,%L,%L,%L::jsonb)',job_id,worker_id,gen_random_uuid(),pg_temp.complete_artifact(snapshot_id)),
 '55000','dynamic render lease lost','the gallery does not weaken completion attempt-token fencing')from gallery_claims where i=1;
select throws_ok(format('select public.complete_dynamic_render_job_v2(%L,%L,%L,%L::jsonb)',job_id,worker_id,lease_token,
 jsonb_set(pg_temp.complete_artifact(snapshot_id),'{durationMs}','3000')),
 '23514','incomplete or inconsistent Source artifact','the gallery cannot complete only the first page')from gallery_claims where i=1;
select throws_ok(format('select public.complete_dynamic_render_job_v2(%L,%L,%L,%L::jsonb)',job_id,worker_id,lease_token,
 jsonb_set(pg_temp.complete_artifact(snapshot_id),'{storagePath}','"tenants/foreign/assets/fallback.mp4"')),
 '23514','incomplete or inconsistent Source artifact','the gallery fallback retains its exact tenant content-addressed path')from gallery_claims where i=1;
select is(public.complete_dynamic_render_job_v2(job_id,worker_id,lease_token,pg_temp.complete_artifact(snapshot_id)),
 output_media_asset_id,'a complete '||orientation||' gallery artifact finalizes through the existing v2 service command')
 from gallery_claims order by i;
select is(snapshot.status,'ready','a full gallery artifact is ready only after completion')
 from gallery_claims claim join public.dynamic_slide_snapshots snapshot on snapshot.id=claim.snapshot_id order by claim.i;
select is(snapshot.sync_render_result_json#>'{presentation,style,backgroundAsset}',
 snapshot.snapshot_data_json#>'{syncConfiguration,seed,style,backgroundAsset}',
 'the complete compatible binary freezes precisely the selected background')
 from gallery_claims claim join public.dynamic_slide_snapshots snapshot on snapshot.id=claim.snapshot_id order by claim.i;
select is((select count(*)from public.media_variants variant where variant.asset_id=claim.output_media_asset_id),3::bigint,
 'gallery video has original, H264 playback and independent PNG poster together')from gallery_claims claim order by i;
reset role;

select is(encode(extensions.digest(to_jsonb(revision)::text,'sha256'),'hex'),old.hash,
 'gallery admission, saving and completion leave the old immutable preset revision unchanged')
 from legacy_revision_hashes old join public.studio_revisions revision on revision.id=old.id;
select is(encode(extensions.digest(snapshot.snapshot_data_json::text,'sha256'),'hex'),old.hash,
 'connected draft edits and render results never mutate canonical snapshot facts or its frozen background')
 from gallery_snapshot_hashes old join public.dynamic_slide_snapshots snapshot on snapshot.id=old.id order by old.id;
select is((select count(*)from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000238001'),0::bigint,
 'gallery authoring and completion create no synthetic playlist release');
select throws_ok($$update public.dynamic_slide_snapshots set sync_render_result_json='{}'
 where id=(select(value->>'snapshotId')::uuid from gallery_results where kind='connected'and id=1)$$,
 '55000',null,'the complete gallery result retains immutable ready-snapshot protection');
select is(has_function_privilege(role,signature,'EXECUTE'),false,role||' cannot invoke the private gallery guard '||signature)
 from(values('anon'),('authenticated'),('service_role'))roles(role)
 cross join(values('private.assert_sync_slide_before_youtube_v1(uuid,jsonb)'),
 ('private.assert_sync_dynamic_render_presentation_v1(public.dynamic_slide_snapshots,jsonb)'))helpers(signature);
select is(has_function_privilege('authenticated','public.complete_dynamic_render_job_v2(uuid,text,uuid,jsonb)','EXECUTE'),false,
 'Control cannot forge complete gallery render output');
select *from finish();
rollback;
