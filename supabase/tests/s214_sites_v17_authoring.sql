begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

create function pg_temp.sites_v17_document(
  p_renderer text default 'sites-v17',
  p_source text default '6800bc858436ba0843eaea89b682cd5b43c3521d',
  p_family text default 'competitie'
) returns jsonb language sql immutable as $$
 select jsonb_build_object(
  'schemaVersion',1,
  'artboard',jsonb_build_object('width',1920,'height',1080,'orientation','landscape','background',jsonb_build_object('kind','solid','color','#FAFAF7'),'safeArea',jsonb_build_object('top',64,'right',64,'bottom',64,'left',64)),
  'motion',jsonb_build_object('enabled',false,'durationMs',20000,'fps',30),
  'elements','[]'::jsonb,
  'metadata',jsonb_build_object('fontRegistryVersion','2026-07-24.1','tenantBrandApplied',false),
  'sitesPresentation',jsonb_build_object(
   'kind','studio','schemaVersion',1,'rendererVersion',p_renderer,'sourceRevision',p_source,
   'slide',jsonb_build_object(
    'id','sites-v17-competitie-landscape-hd','name','Poulestand','title','POULESTAND','time','','subtitle','4e klasse C','location','Sportpark Houtrust','duration',20,
    'color','#03438a','background','#03438a','bold',true,'italic',false,'align','left','size',58,'context',true,'showLocation',true,'animation','Flow in','transition','Rustig',
    'orientation','landscape','themeId','onzetrots-tv','unifiedKind',p_family,'paintTone','white','photoMotion',true,'rssLayout','accordion','menuLayout','columns',
    'showPrices',true,'showCategories',true,'currency','EUR','extraType','periodestand','arrivalCards',4,'arrivalBefore',180,'arrivalAfter',120,'arrivalShowLogo',true,'arrivalShowKickoff',true,
    'qrUrl','https://veyocast.nl','body','','vacancyContact','',
    'tv',jsonb_build_object('kind','stand','title','Poulestand','rows',(select jsonb_agg(jsonb_build_object('id','row-'||value,'primary','Team '||value,'rank',value,'points',(20-value)::text,'form',jsonb_build_array('W','G','V')))from generate_series(1,14)value))
   )
  )
 )
$$;

create function pg_temp.sites_v17_configuration(
  p_renderer text default 'sites-v17',
  p_source text default '6800bc858436ba0843eaea89b682cd5b43c3521d',
  p_family text default 'competitie'
) returns jsonb language sql immutable as $$
 select jsonb_build_object(
  'schemaVersion',1,'rendererVersion',p_renderer,'sourceRevision',p_source,'themeId','onzetrots-tv','orientation','landscape','provider','sportlink','title','Stand','subtitle','',
  'overlay',25,'accent','#03438a','layout','full','scale',100,'align','left','safeArea',4,'seconds',15,'rowsPerPage',8,
  'ledTemplate','match-center','ledTheme','blue','ledMoment','live','ledSide','unknown','titleScale',100,'scoreScale',100,'logoScale',100,'teamScale',100,
  'showBranding',true,'showSceneLabel',true,'showClock',true,'showTimeline',true,'timelineLimit',3,'backgroundFit','contain','grunge',55,'animation','rise',
  'unifiedKind',p_family,'paintTone','white','photoMotion',true,'rssLayout','accordion','menuLayout','columns','showPrices',true,'showCategories',true,'currency','EUR',
  'extraType','periodestand','arrivalCards',4,'arrivalBefore',180,'arrivalAfter',120,'arrivalShowLogo',true,'arrivalShowKickoff',true,'qrUrl','https://veyocast.nl','body','','vacancyContact','',
  'welcomeImage',jsonb_build_object('kind','system','path','/onzetrots/website-brush/de-wijk-wide-1672.webp','checksumSha256','d7198cf38780978b142c15c6cbc33f196afe1d77016582495438daf903c4234e')
 )
$$;

select lives_ok(
 $$select private.assert_sites_studio_v1('10000000-0000-4000-8000-000000214001',pg_temp.sites_v17_document())$$,
 'the exact Sites v17 Studio identity and unified single-canvas timing are accepted'
);
select throws_ok(
 $$select private.assert_sites_studio_v1('10000000-0000-4000-8000-000000214001',pg_temp.sites_v17_document('sites-v17','b1cae899af19fc39908217253094c5240d7359fc'))$$,
 '23514','Sites Studio identity invalid','mixed renderer and source identities remain rejected'
);
select throws_ok(
 $$select private.assert_sites_studio_v1('10000000-0000-4000-8000-000000214001',pg_temp.sites_v17_document('sites-v17','6800bc858436ba0843eaea89b682cd5b43c3521d','unknown'))$$,
 '23514','Sites Studio v17 family invalid','unknown v17 families remain rejected'
);
select ok(private.sites_configuration_is_valid_v1(pg_temp.sites_v17_configuration()),'v17 dynamic and placement configuration is accepted');
select ok(not private.sites_configuration_is_valid_v1(pg_temp.sites_v17_configuration('sites-v17','b1cae899af19fc39908217253094c5240d7359fc')),'mixed dynamic identity is rejected');
select ok(not private.sites_configuration_is_valid_v1(pg_temp.sites_v17_configuration('sites-v17','6800bc858436ba0843eaea89b682cd5b43c3521d','unknown')),'unknown dynamic family is rejected');
select lives_ok(
 $$select private.assert_sites_assets_v1('10000000-0000-4000-8000-000000214001',pg_temp.sites_v17_configuration())$$,
 'audited v17 website-brush assets pass the database checksum allowlist'
);
select ok(private.json_has_sites_authoring_v1(pg_temp.sites_v17_configuration()),'the pause guard recognizes root v17 authoring payloads');
select ok(
 position('sites-v17' in (select pg_get_constraintdef(oid)from pg_constraint where conrelid='public.playlist_release_items'::regclass and conname='playlist_release_items_sites_studio_presentation_check'))>0,
 'immutable release constraint recognizes exact v17 presentations'
);
select ok(not has_function_privilege('authenticated','private.sites_presentation_identity_is_valid_v2(text,text)','EXECUTE'),'browser roles cannot call the identity helper');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-4000-8000-000000214001','authenticated','authenticated','s214-owner@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000214001','S214 owner');
insert into public.tenants(id,name,slug)values('10000000-0000-4000-8000-000000214001','S214 tenant','s214-tenant');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000214001');
insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000214001','00000000-0000-4000-8000-000000214001','tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000214001',true);
select lives_ok(
 $$select public.create_studio_series_v1(
  '10000000-0000-4000-8000-000000214001','OnzeTrots v17 ontwerp',
  jsonb_build_array(jsonb_build_object('name','Poulestand','document',pg_temp.sites_v17_document(),'referencedAssetIds','[]'::jsonb,'commandKey','40000000-0000-4000-8000-000000214001')),
  '40000000-0000-4000-8000-000000214002'
 )$$,
 'the real authenticated Studio series command persists a v17 template'
);
reset role;
select is(
 (select draft.document_json#>>'{sitesPresentation,rendererVersion}'from public.studio_project_drafts draft where draft.tenant_id='10000000-0000-4000-8000-000000214001' limit 1),
 'sites-v17','the persisted Studio draft keeps its v17 provenance'
);

select *from finish();
rollback;
