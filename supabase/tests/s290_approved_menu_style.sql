begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
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

create function pg_temp.approved_menu() returns jsonb language sql immutable as $$select pg_temp.sites_v17_configuration()||'{"menuWidgets":true,"onzeTrotsStyle":"v9-marker-light"}'::jsonb$$;
select ok(private.sites_configuration_is_valid_v1(pg_temp.sites_v17_configuration()),'historical full v17 remains valid');
select ok(private.sites_configuration_is_valid_v1(pg_temp.approved_menu()),'light approved menu passes the existing exact validator');
select ok(private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{onzeTrotsStyle}','"v9-marker-dark"')),'dark approved menu is admitted');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{onzeTrotsStyle}','null')),'reject null style');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{onzeTrotsStyle}','1')),'reject number style');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{onzeTrotsStyle}','"custom-html"')),'reject script style');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{onzeTrotsStyle}','{}')),'reject object style');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{onzeTrotsStyle}','true')),'reject boolean style');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{menuWidgets}','false')),'retain existing menuWidgets guard');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{provider}','"sportlink"')),'retain existing provider guard');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{sourceRevision}','"untrusted"')),'retain existing sourceRevision guard');
select ok(not private.sites_configuration_is_valid_v1(jsonb_set(pg_temp.approved_menu(),'{injected}','true')),'retain existing injected guard');
select ok(not has_function_privilege('anon','private.sites_configuration_is_valid_v1(jsonb)','EXECUTE'),'no anon access to private validation');
select ok(not has_function_privilege('authenticated','private.sites_configuration_is_valid_v1(jsonb)','EXECUTE'),'no authenticated access to private validation');
select ok(not has_function_privilege('service_role','private.sites_configuration_is_valid_v1(jsonb)','EXECUTE'),'no service_role access to private validation');
select is((select proconfig::text from pg_proc where oid='private.sites_configuration_is_valid_v1(jsonb)'::regprocedure),'{"search_path=\"\""}','explicit empty search_path');
select * from finish();
rollback;
