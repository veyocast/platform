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

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-4000-8000-000000215001','authenticated','authenticated','s215-owner@veyocast.test','test',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name)values('00000000-0000-4000-8000-000000215001','S215 owner');
insert into public.tenants(id,name,slug)values('10000000-0000-4000-8000-000000215001','S215 tenant','s215-tenant');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000215001');
insert into public.tenant_memberships(tenant_id,user_id,role)values('10000000-0000-4000-8000-000000215001','00000000-0000-4000-8000-000000215001','tenant_owner');


create temporary table state(key text primary key,value jsonb);
grant all on state to authenticated;
create function pg_temp.slides(p_key uuid,p_project uuid default null,p_revision bigint default null)returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('name','Poulestand','document',pg_temp.sites_v17_document(),'referencedAssetIds','[]'::jsonb,'commandKey',p_key,'projectId',p_project,'expectedDraftRevision',p_revision))
$$;
select ok(not has_function_privilege('authenticated','private.studio_series_child_key_v1(uuid,integer)','EXECUTE'),'child key helper is private');
select isnt(private.studio_series_child_key_v1('40000000-0000-4000-8000-000000215001',0),'40000000-0000-4000-8000-000000215001'::uuid,'child receipt differs from parent');
select isnt(private.studio_series_child_key_v1('40000000-0000-4000-8000-000000215001',0),private.studio_series_child_key_v1('40000000-0000-4000-8000-000000215001',1),'each slide has a distinct receipt');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000215001',true);
select lives_ok($$insert into state values('create',public.create_studio_series_v1('10000000-0000-4000-8000-000000215001','OnzeTrots ontwerp',pg_temp.slides('40000000-0000-4000-8000-000000215001'),'40000000-0000-4000-8000-000000215001'))$$,'real browser form using the same parent and child key creates successfully');
select is(public.create_studio_series_v1('10000000-0000-4000-8000-000000215001','OnzeTrots ontwerp',pg_temp.slides('40000000-0000-4000-8000-000000215001'),'40000000-0000-4000-8000-000000215001')->>'seriesId',(select value->>'seriesId'from state where key='create'),'retry returns the same series');
select is((select count(*)from studio_series where tenant_id='10000000-0000-4000-8000-000000215001'),1::bigint,'retry does not create another series');
select is((select count(*)from studio_projects where tenant_id='10000000-0000-4000-8000-000000215001'),1::bigint,'retry does not create another project');
select lives_ok($$insert into state values('save',public.save_studio_series_v1((select(value->>'seriesId')::uuid from state where key='create'),1,pg_temp.slides('40000000-0000-4000-8000-000000215002',(select(value#>>'{projectIds,0}')::uuid from state where key='create'),0),'40000000-0000-4000-8000-000000215002'))$$,'nested draft save uses its own receipt even if the form repeats the parent key');
select is((select value->>'revision'from state where key='save'),'2','series revision increments once');
select is(public.save_studio_series_v1((select(value->>'seriesId')::uuid from state where key='create'),1,pg_temp.slides('40000000-0000-4000-8000-000000215002',(select(value#>>'{projectIds,0}')::uuid from state where key='create'),0),'40000000-0000-4000-8000-000000215002')->>'revision','2','save replay does not increment revision');
select lives_ok($$select public.save_studio_series_v1((select(value->>'seriesId')::uuid from state where key='create'),2,pg_temp.slides('40000000-0000-4000-8000-000000215003',(select(value#>>'{projectIds,0}')::uuid from state where key='create'),1)||pg_temp.slides('40000000-0000-4000-8000-000000215003'),'40000000-0000-4000-8000-000000215003')$$,'adding another slide namespaces all receipts even with identical caller keys');
select is((select count(*)from studio_series_items where tenant_id='10000000-0000-4000-8000-000000215001'),2::bigint,'series contains both slides after saving');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000215002',true);
select is((select count(*)from studio_series),0::bigint,'another tenant cannot read the series');
select throws_ok($$select public.save_studio_series_v1((select(value->>'seriesId')::uuid from state where key='create'),3,pg_temp.slides('40000000-0000-4000-8000-000000215004'),'40000000-0000-4000-8000-000000215004')$$,'42501','actor cannot edit Studio series','another tenant cannot change the series');
reset role;
select *from finish();
rollback;
