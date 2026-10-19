-- S235 SQL admission, preservation and atomic command tests.
-- Synthetic records, not decoded playback; transaction always rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.s235_id(p_suffix integer) returns uuid
language sql immutable set search_path = '' as $function$
  select ('23500000-0000-4000-8000-' || pg_catalog.lpad(p_suffix::text,12,'0'))::uuid;
$function$;
create function pg_temp.s235_defaults(p_version integer default 1) returns jsonb
language sql immutable set search_path = '' as $function$
  select case p_version
    when 1 then '{"accent":"#1268e8","font":"Manrope","mode":"dark","scale":100,"background":"clubkleur","motion":"rustig","showLogo":true}'::jsonb
    when 2 then '{"accent":"#006D83","font":"Georgia","mode":"light","scale":120,"background":"stadium","motion":"geen","showLogo":false}'::jsonb
    when 3 then '{"accent":"#234567","font":"Arial","mode":"auto","scale":90,"background":"gradient","motion":"dynamisch","showLogo":true}'::jsonb
    else null::jsonb end;
$function$;

-- Real current schema: custom-role capabilities, tenant memberships, profiles.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
select pg_temp.s235_id(n),'authenticated','authenticated','s235-fixture-'||n||'@veyocast.test','test',now(),now(),now(),'{}','{}'
from pg_catalog.generate_series(1,7) n;
insert into public.profiles(id,display_name)
select pg_temp.s235_id(n),'S235 synthetic actor '||n from pg_catalog.generate_series(1,7) n;
insert into public.tenants(id,name,slug)
select pg_temp.s235_id(n),'S235 synthetic tenant '||n,'s235-theme-defaults-'||n
from pg_catalog.generate_series(10,14) n;
insert into public.tenant_settings(tenant_id)
select pg_temp.s235_id(n) from pg_catalog.generate_series(10,14) n;
insert into public.tenant_custom_roles(id,tenant_id,name,capabilities,created_by,updated_by)
values
 (pg_temp.s235_id(20),pg_temp.s235_id(10),'S235 author',array['tenant.studio.create'],pg_temp.s235_id(1),pg_temp.s235_id(1)),
 (pg_temp.s235_id(21),pg_temp.s235_id(10),'S235 settings',array['tenant.settings.manage'],pg_temp.s235_id(1),pg_temp.s235_id(1)),
 (pg_temp.s235_id(22),pg_temp.s235_id(10),'S235 sponsor only',array['tenant.sponsor.read'],pg_temp.s235_id(1),pg_temp.s235_id(1));
insert into public.tenant_memberships(tenant_id,user_id,role,custom_role_id)
values
 (pg_temp.s235_id(10),pg_temp.s235_id(1),'tenant_owner',null),
 (pg_temp.s235_id(11),pg_temp.s235_id(2),'tenant_owner',null),
 (pg_temp.s235_id(10),pg_temp.s235_id(3),'tenant_viewer',null),
 (pg_temp.s235_id(10),pg_temp.s235_id(4),'tenant_viewer',pg_temp.s235_id(20)),
 (pg_temp.s235_id(10),pg_temp.s235_id(5),'tenant_viewer',pg_temp.s235_id(21)),
 (pg_temp.s235_id(10),pg_temp.s235_id(6),'tenant_viewer',pg_temp.s235_id(22)),
 (pg_temp.s235_id(12),pg_temp.s235_id(1),'tenant_owner',null),
 (pg_temp.s235_id(13),pg_temp.s235_id(1),'tenant_owner',null),
 (pg_temp.s235_id(14),pg_temp.s235_id(1),'tenant_owner',null);
update public.tenants set status='paused' where id=pg_temp.s235_id(12);
update public.tenants set status='archived' where id=pg_temp.s235_id(13);


-- Populated historical Studio, dynamic snapshot, placement and release fence.
-- Synthetic but schema-valid old authoring facts, not empty-table counts.
create temporary table s235_fixtures(name text primary key,value jsonb);
grant select on s235_fixtures to authenticated;
insert into s235_fixtures values('document','{"schemaVersion":1,"artboard":{"width":1920,"height":1080,"orientation":"landscape","background":{"kind":"solid","color":"#FAFAF7"},"safeArea":{"top":64,"right":64,"bottom":64,"left":64}},"motion":{"enabled":false,"durationMs":15000,"fps":30},"elements":[],"metadata":{"fontRegistryVersion":"2026-07-24.1","tenantBrandApplied":false},"sitesPresentation":{"kind":"studio","schemaVersion":1,"rendererVersion":"sites-v11","sourceRevision":"b1cae899af19fc39908217253094c5240d7359fc","slide":{"id":"s191-fixture","name":"Typed club update","title":"Onze club","time":"","subtitle":"","location":"","duration":15,"color":"#03438a","background":"#052a55","bold":true,"italic":false,"align":"left","size":58,"context":true,"showLocation":true,"animation":"Geen","transition":"Rustig","orientation":"landscape","themeId":"onzetrots-tv","tv":{"kind":"programma","title":"Onze club","rows":[{"id":"fixture-match","primary":"Team A","home":"Team A","away":"Team B","time":"14:00"}],"scale":100}}}}'::jsonb),('configuration','{"schemaVersion":1,"rendererVersion":"sites-v11","sourceRevision":"b1cae899af19fc39908217253094c5240d7359fc","themeId":"onzetrots-tv","orientation":"landscape","provider":"sportlink","title":"Stand","subtitle":"","overlay":25,"accent":"#03438a","layout":"full","scale":100,"align":"left","safeArea":4,"seconds":15,"rowsPerPage":8,"ledTheme":"blue","ledMoment":"live","ledSide":"unknown","titleScale":100,"scoreScale":100,"logoScale":100,"teamScale":100,"showBranding":true,"showSceneLabel":true,"showClock":true,"showTimeline":true,"timelineLimit":3,"backgroundFit":"contain","grunge":55,"animation":"rise"}'::jsonb);
insert into public.studio_projects(id,tenant_id,owner_user_id,name,orientation,width,height,motion_enabled,duration_ms)
values(pg_temp.s235_id(40),pg_temp.s235_id(10),pg_temp.s235_id(1),'Existing historical design','landscape',1920,1080,false,15000);
insert into public.studio_project_drafts(tenant_id,project_id,document_json,document_hash)
values(pg_temp.s235_id(10),pg_temp.s235_id(40),(select value from s235_fixtures where name='document'),repeat('a',64));
insert into public.studio_revisions(id,tenant_id,project_id,revision_number,draft_revision,document_json,document_hash)
values(pg_temp.s235_id(41),pg_temp.s235_id(10),pg_temp.s235_id(40),1,0,(select value from s235_fixtures where name='document'),repeat('a',64));
insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values(pg_temp.s235_id(30),pg_temp.s235_id(10),pg_temp.s235_id(1),'image','Historical ready source','s235-fixture.png','image/png','ready','tenants/'||pg_temp.s235_id(10)||'/assets/'||pg_temp.s235_id(30)||'/original/fixture.png',1024,repeat('c',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select pg_temp.s235_id(31),tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height from public.media_assets where id=pg_temp.s235_id(30);
insert into storage.objects(bucket_id,name)select storage_bucket,storage_path from public.media_variants where id=pg_temp.s235_id(31);
insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)
values(pg_temp.s235_id(50),pg_temp.s235_id(10),'Historical synthetic source','sportlink','active','ready','{}');
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,data_source_id,selection_mode,status,configuration_json)
select pg_temp.s235_id(51),pg_temp.s235_id(10),'Historical standings','sport_standing','landscape',template.id,version.id,pg_temp.s235_id(50),'latest','draft',
 '{"schemaVersion":1,"blueprintKey":"sportlink.pool_standings","title":"Poulestand","context":{"competitionId":null,"competitionSelectionMode":"auto_current","phaseId":null,"poolId":null,"providerTeamId":"jo17","seasonId":null},"display":{"columns":"two","showDressingRoom":false,"showField":true,"showHomeAway":true,"showReferee":false},"editorial":{"schemaVersion":2,"themeSelection":{"ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}},"maxItems":40}'::jsonb
from public.dynamic_templates template join public.dynamic_template_versions version on version.id=template.current_published_version_id
where template.slide_type='sport_standing'and template.orientation='landscape'and template.status='published'limit 1;
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,source_revision_hash,snapshot_data_json,status,output_media_asset_id,completed_at)
select pg_temp.s235_id(52),tenant_id,id,template_version_id,data_source_id,repeat('b',64),'{"type":"sport_standing","sport":{"title":"Historical standings","items":[]}}','ready',pg_temp.s235_id(30),now()from public.dynamic_slides where id=pg_temp.s235_id(51);
update public.dynamic_slides set current_snapshot_id=pg_temp.s235_id(52),status='ready'where id=pg_temp.s235_id(51);
insert into public.playlists(id,tenant_id,name,created_by,updated_by)
values(pg_temp.s235_id(60),pg_temp.s235_id(10),'Historical populated release',pg_temp.s235_id(1),pg_temp.s235_id(1));
insert into public.playlist_items(id,tenant_id,playlist_id,media_asset_id,sort_order,position_key,duration_seconds,fit_mode,muted,dynamic_slide_id,dynamic_snapshot_id,dynamic_selection_mode,sites_configuration_json)
values(pg_temp.s235_id(61),pg_temp.s235_id(10),pg_temp.s235_id(60),pg_temp.s235_id(30),0,1024,15,'contain',true,pg_temp.s235_id(51),pg_temp.s235_id(52),'latest',(select value from s235_fixtures where name='configuration'));
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
insert into s235_fixtures values('release',to_jsonb(private.materialize_playlist_configuration_s185(pg_temp.s235_id(60))));
select set_config('request.jwt.claim.sub','',true);

create temporary table s235_results(name text primary key,value jsonb not null);
grant select,insert,update on s235_results to authenticated;
-- The ordinary profile updated_at trigger may advance. All legacy authority and
-- actor metadata must stay exact; the independent two Source columns are excluded.
insert into s235_results values('legacy-profiles-before',(
 select jsonb_agg(to_jsonb(profile)-'sync_creation_defaults'-'sync_creation_defaults_revision'-'updated_at' order by theme_id)
 from public.tenant_theme_profiles profile where tenant_id=pg_temp.s235_id(10)
)),('settings-before',(select to_jsonb(settings) from public.tenant_settings settings where tenant_id=pg_temp.s235_id(10))),
('counts-before',jsonb_build_object(
 'rollouts',(select count(*) from public.tenant_theme_rollouts where tenant_id=pg_temp.s235_id(10)),
 'snapshots',(select count(*) from public.dynamic_slide_snapshots where tenant_id=pg_temp.s235_id(10)),
 'releases',(select count(*) from public.playlist_releases where tenant_id=pg_temp.s235_id(10)),
 'slides',(select count(*) from public.dynamic_slides where tenant_id=pg_temp.s235_id(10)),
 'projects',(select count(*) from public.studio_projects where tenant_id=pg_temp.s235_id(10))
));


create function pg_temp.s235_old_content()returns jsonb language sql stable as $$
select jsonb_build_object(
 'projects',(select jsonb_agg(to_jsonb(x)order by id)from public.studio_projects x where tenant_id=pg_temp.s235_id(10)),
 'drafts',(select jsonb_agg(to_jsonb(x)order by project_id)from public.studio_project_drafts x where tenant_id=pg_temp.s235_id(10)),
 'revisions',(select jsonb_agg(to_jsonb(x)order by id)from public.studio_revisions x where tenant_id=pg_temp.s235_id(10)),
 'slides',(select jsonb_agg(to_jsonb(x)order by id)from public.dynamic_slides x where tenant_id=pg_temp.s235_id(10)),
 'snapshots',(select jsonb_agg(to_jsonb(x)order by id)from public.dynamic_slide_snapshots x where tenant_id=pg_temp.s235_id(10)),
 'playlists',(select jsonb_agg(to_jsonb(x)order by id)from public.playlists x where tenant_id=pg_temp.s235_id(10)),
 'placements',(select jsonb_agg(to_jsonb(x)order by id)from public.playlist_items x where tenant_id=pg_temp.s235_id(10)),
 'releases',(select jsonb_agg(to_jsonb(x)order by id)from public.playlist_releases x where tenant_id=pg_temp.s235_id(10)),
 'releaseItems',(select jsonb_agg(to_jsonb(x)order by id)from public.playlist_release_items x where tenant_id=pg_temp.s235_id(10))
);$$;
insert into s235_results values('content-before',pg_temp.s235_old_content());
select ok((select jsonb_array_length(value->'projects')=1 and jsonb_array_length(value->'snapshots')=1 and jsonb_array_length(value->'releases')=1 and jsonb_array_length(value->'releaseItems')=1 from s235_results where name='content-before'),'preservation baseline contains actual populated designs snapshots and release items');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.tenant_theme_profiles'::regclass),'existing profile ENABLE/FORCE RLS remains');
select ok(not has_table_privilege('authenticated','public.tenant_theme_profiles','INSERT'),'authenticated cannot insert profile rows directly');
select ok(not has_table_privilege('authenticated','public.tenant_theme_profiles','UPDATE'),'authenticated cannot update profile/default columns directly');
select ok(not has_table_privilege('authenticated','public.tenant_theme_profiles','DELETE'),'authenticated cannot delete profiles directly');
select ok(not has_table_privilege('anon','public.tenant_theme_profiles','SELECT'),'anonymous cannot read full profiles');
select ok(has_function_privilege('authenticated','public.read_sync_theme_creation_defaults_v1(uuid)','EXECUTE'),'authenticated has only guarded read entry');
select ok(has_function_privilege('authenticated','public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)','EXECUTE'),'authenticated has guarded writer entry');
select ok(not has_function_privilege(role_name,signature,'EXECUTE'),role_name||' cannot call '||signature)
from (values ('anon'),('service_role')) roles(role_name)
cross join (values ('public.read_sync_theme_creation_defaults_v1(uuid)'),('public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)')) functions(signature);
select ok(not has_function_privilege(role_name,'private.sync_theme_creation_defaults_is_valid_v1(jsonb)','EXECUTE'),role_name||' cannot call private validator')
from (values ('anon'),('authenticated'),('service_role')) roles(role_name);
select ok(not exists(
 select 1 from pg_proc p cross join lateral aclexplode(p.proacl) acl
 where p.oid in ('public.read_sync_theme_creation_defaults_v1(uuid)'::regprocedure,
  'public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)'::regprocedure,
  'private.sync_theme_creation_defaults_is_valid_v1(jsonb)'::regprocedure)
  and acl.grantee=0 and acl.privilege_type='EXECUTE'
),'PUBLIC has no execute grant on any new function');
select ok(p.proconfig @> array['search_path=""'],p.proname||' has empty explicit search_path')
from pg_proc p where p.oid in ('public.read_sync_theme_creation_defaults_v1(uuid)'::regprocedure,
 'public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)'::regprocedure,
 'private.sync_theme_creation_defaults_is_valid_v1(jsonb)'::regprocedure);
select ok((select prosecdef from pg_proc where oid='public.save_sync_theme_creation_defaults_v1(uuid,text,bigint,jsonb,uuid)'::regprocedure),'writer is explicitly privileged guarded RPC');
select ok(not (select prosecdef from pg_proc where oid='private.sync_theme_creation_defaults_is_valid_v1(jsonb)'::regprocedure),'pure validator has no definer privilege');

-- Strict exact-seven-field admission: no URL, arbitrary font/CSS, unknown key,
-- null/missing field, coercion, fractional scale or bogus mode can be persisted.
select ok(private.sync_theme_creation_defaults_is_valid_v1(pg_temp.s235_defaults(n)),'valid seven-field payload '||n)
from generate_series(1,3) n;
select ok(not private.sync_theme_creation_defaults_is_valid_v1(pg_temp.s235_defaults()-key),'missing '||key||' rejected')
from unnest(array['accent','font','mode','scale','background','motion','showLogo']) key;
select ok(not private.sync_theme_creation_defaults_is_valid_v1(jsonb_set(pg_temp.s235_defaults(),array[key],'null')),'null '||key||' rejected')
from unnest(array['accent','font','mode','scale','background','motion','showLogo']) key;
select ok(not private.sync_theme_creation_defaults_is_valid_v1(payload),label)
from (values
 (null::jsonb,'SQL null rejected'),('null'::jsonb,'JSON null rejected'),('[]'::jsonb,'array rejected'),
 (pg_temp.s235_defaults()||'{"schemaVersion":1}','eighth schemaVersion field rejected'),
 (pg_temp.s235_defaults()||'{"url":"https://example.invalid"}','unknown URL metadata rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{accent}','"#abc"'),'short hex rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{accent}','"var(--accent)"'),'arbitrary CSS rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{accent}','123'),'numeric color rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{font}','"Remote Font"'),'unapproved font rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{mode}','"system"'),'non-Source system mode rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{scale}','"100"'),'numeric string rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{scale}','89'),'below Source scale rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{scale}','121'),'above Source scale rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{scale}','100.5'),'fractional scale rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{scale}','1e99999'),'extreme numeric magnitude rejected without throw'),
 (jsonb_set(pg_temp.s235_defaults(),'{background}','"photo"'),'unverified photo default rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{motion}','"spin"'),'unknown animation rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{showLogo}','"false"'),'boolean string rejected'),
 (jsonb_set(pg_temp.s235_defaults(),'{font}',to_jsonb(repeat('x',2100))),'oversized payload rejected')
) invalid(payload,label);
select ok(private.sync_theme_creation_defaults_is_valid_v1(jsonb_set(pg_temp.s235_defaults(),'{showLogo}','false')),'false is a real valid boolean');
select ok(private.sync_theme_creation_defaults_is_valid_v1(jsonb_set(pg_temp.s235_defaults(),'{font}','"Inter"')),'fourth approved font accepted');

select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
insert into s235_results select 'read-before',public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10));
select is((select value->>'schemaVersion' from s235_results where name='read-before'),'1','read envelope is explicitly versioned');
select is((select value->>'tenantId' from s235_results where name='read-before'),pg_temp.s235_id(10)::text,'read binds exact selected tenant');
select is((select jsonb_array_length(value->'profiles') from s235_results where name='read-before'),2,'read returns only the two supported profiles');
select is((select value#>>'{profiles,0,themeId}' from s235_results where name='read-before'),'fieldflow','bounded profile order is deterministic');
select is((select value#>>'{profiles,1,themeId}' from s235_results where name='read-before'),'onzetrots-tv','Source alias is existing onzetrots-tv identity');
select is((select value#>'{profiles,0,defaults}' from s235_results where name='read-before'),'null'::jsonb,'unconfigured is explicit null; never a pretend saved palette');
select is((select value#>>'{profiles,0,configured}' from s235_results where name='read-before'),'false','unconfigured profile is marked false');
select is((select value#>>'{profiles,0,revision}' from s235_results where name='read-before'),'0','unconfigured revision is independent zero');
select is((select count(*) from jsonb_object_keys((select value from s235_results where name='read-before'))),4::bigint,'read envelope exposes only four allowlisted fields');
select is((select count(*) from jsonb_object_keys((select value#>'{profiles,0}' from s235_results where name='read-before'))),5::bigint,'profile DTO excludes legacy appearance/palette/raw rows');
select throws_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(11))$$,'42501','actor cannot read Source theme creation defaults','tenant A cannot read tenant B via bounded RPC');
select is((select count(*) from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(11)),0::bigint,'original profile RLS still hides tenant B');
select throws_ok($$update public.tenant_theme_profiles set sync_creation_defaults=pg_temp.s235_defaults(),sync_creation_defaults_revision=1 where tenant_id=pg_temp.s235_id(10)$$,'42501','permission denied for table tenant_theme_profiles','browser cannot bypass guarded defaults RPC');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(11),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(90))$$,'42501','actor cannot update Source theme creation defaults','tenant A cannot write tenant B');

-- Simulate an ignored/lost acknowledgement by retaining the actual first result
-- only in the test table; no HTTP response-loss claim is made by this SQL test.
insert into s235_results select 'first',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(100));
select is((select value->>'outcome' from s235_results where name='first'),'applied','first save applies');
select is((select value->>'revision' from s235_results where name='first'),'1','first save advances only creation revision');
select is((select value->'defaults' from s235_results where name='first'),pg_temp.s235_defaults(),'first receipt contains exact defaults without normalizing body');
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(100)),(select value from s235_results where name='first'),'exact replay returns original first receipt');
insert into s235_results select 'second',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',1,pg_temp.s235_defaults(2),pg_temp.s235_id(101));
select is((select value->>'revision' from s235_results where name='second'),'2','second valid CAS advances independent revision');
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(100)),(select value from s235_results where name='first'),'committed replay is checked before a now-stale mutable revision');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(102))$$,'PT409','Source theme creation defaults changed; reload and confirm the current values','unknown nonce cannot impersonate earlier receipt or silently overwrite stale state');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(2),pg_temp.s235_id(100))$$,'23505','idempotency key belongs to another publisher command','same nonce changed defaults rejected');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(),pg_temp.s235_id(100))$$,'23505','idempotency key belongs to another publisher command','same nonce changed expected revision rejected');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'onzetrots-tv',0,pg_temp.s235_defaults(),pg_temp.s235_id(100))$$,'23505','idempotency key belongs to another publisher command','same nonce changed theme rejected');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(),null)$$,'22023','Source theme creation defaults command is invalid','null nonce rejected before mutation');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',-1,pg_temp.s235_defaults(),pg_temp.s235_id(106))$$,'22023','Source theme creation defaults command is invalid','negative revision rejected');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',9007199254740992,pg_temp.s235_defaults(),pg_temp.s235_id(106))$$,'22023','Source theme creation defaults command is invalid','unsafe expected JavaScript revision rejected');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'onzetrots',0,pg_temp.s235_defaults(),pg_temp.s235_id(106))$$,'22023','Source theme creation defaults command is invalid','prototype alias is not silently accepted as new theme ID');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults()||'{"rawUrl":"https://example.invalid"}',pg_temp.s235_id(106))$$,'22023','Source theme creation defaults command is invalid','invalid strict body rejected at real writer');
insert into s235_results select 'noop',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(2),pg_temp.s235_id(103));
select is((select value->>'outcome' from s235_results where name='noop'),'noop','identical current values complete a noop receipt');
select is((select value->>'revision' from s235_results where name='noop'),'2','noop does not advance creation revision');
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(2),pg_temp.s235_id(103)),(select value from s235_results where name='noop'),'noop is replayable with original receipt');
insert into s235_results select 'trots',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'onzetrots-tv',0,pg_temp.s235_defaults(),pg_temp.s235_id(104));
select is((select value->>'revision' from s235_results where name='trots'),'1','other supported theme has its own independent CAS revision');
select is((public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10))#>>'{profiles,0,revision}'),'2','saving other theme does not bump FieldFlow defaults');

-- Real custom roles: author can read defaults but only settings.manage writes.
select set_config('request.jwt.claim.sub',pg_temp.s235_id(4)::text,true);
select ok('tenant.studio.create'=any(public.get_my_tenant_capabilities_v1(pg_temp.s235_id(10))),'author fixture really has canonical create right');
select ok(not ('tenant.settings.manage'=any(public.get_my_tenant_capabilities_v1(pg_temp.s235_id(10)))),'author fixture has no settings manage right');
select lives_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10))$$,'custom new-design author can read actual defaults');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(3),pg_temp.s235_id(100))$$,'42501','actor cannot update Source theme creation defaults','different unprivileged actor cannot recover owner receipt or mutate');
select set_config('request.jwt.claim.sub',pg_temp.s235_id(3)::text,true);
select lives_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10))$$,'viewer with existing settings.read can inspect defaults');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(3),pg_temp.s235_id(105))$$,'42501','actor cannot update Source theme creation defaults','viewer cannot save defaults');
select set_config('request.jwt.claim.sub',pg_temp.s235_id(6)::text,true);
select throws_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10))$$,'42501','actor cannot read Source theme creation defaults','sponsor-only custom role has no implicit Source settings read');
select set_config('request.jwt.claim.sub',pg_temp.s235_id(7)::text,true);
select throws_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10))$$,'42501','actor cannot read Source theme creation defaults','authenticated nonmember cannot read defaults');
select set_config('request.jwt.claim.sub',pg_temp.s235_id(5)::text,true);
select ok('tenant.settings.manage'=any(public.get_my_tenant_capabilities_v1(pg_temp.s235_id(10))),'settings fixture uses actual custom settings.manage capability');
insert into s235_results select 'custom',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(3),pg_temp.s235_id(105));
select is((select value->>'revision' from s235_results where name='custom'),'3','custom settings manager can apply fresh CAS');
insert into s235_results select 'other-actor-same-nonce',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',3,pg_temp.s235_defaults(3),pg_temp.s235_id(100));
select is((select value->>'outcome' from s235_results where name='other-actor-same-nonce'),'noop','same UUID nonce under another authorized actor is not owner replay');
select is((select value->>'revision' from s235_results where name='other-actor-same-nonce'),'3','other actor receives own current acknowledgement');
reset role;
update public.tenant_custom_roles set capabilities='{}' where id=pg_temp.s235_id(21);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(5)::text,true);
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(3),pg_temp.s235_id(105))$$,'42501','actor cannot update Source theme creation defaults','committed receipt does not bypass freshly revoked settings capability');
reset role;
update public.tenant_custom_roles set capabilities=array['tenant.settings.manage'] where id=pg_temp.s235_id(21);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(5)::text,true);
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',2,pg_temp.s235_defaults(3),pg_temp.s235_id(105)),(select value from s235_results where name='custom'),'restored permission can replay exact retained command after original commit');
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select lives_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(12))$$,'paused tenant defaults remain read-only accessible');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(12),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(110))$$,'42501','tenant mutations require an active tenant','paused tenant cannot mutate');
select throws_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(13))$$,'42501','Source theme creation defaults are unavailable in this tenant','archived tenant is not normal Source context');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(13),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(111))$$,'42501','tenant mutations require an active tenant','archived tenant cannot mutate');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='paused' where id=pg_temp.s235_id(10);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(100))$$,'42501','tenant mutations require an active tenant','pause is checked before a committed replay; client must retain original pending body');
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.tenants set status='active' where id=pg_temp.s235_id(10);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(100)),(select value from s235_results where name='first'),'resume permits original exact replay without duplicate save');
reset role;

-- No ghost receipt for an unknown stale nonce; every applied/noop command is
-- actor scoped and binds tenant/theme/revision/payload in the shared receipt table.
select is((select count(*) from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(10) and actor_user_id=pg_temp.s235_id(1) and idempotency_key=pg_temp.s235_id(102)),0::bigint,'stale unknown nonce leaves no receipt');
select is((select count(*) from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(10) and actor_user_id=pg_temp.s235_id(1) and idempotency_key=pg_temp.s235_id(100)),1::bigint,'owner lost-answer replay has exactly one receipt');
select is((select count(*) from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(10) and idempotency_key=pg_temp.s235_id(100)),2::bigint,'same nonce is separately scoped to two actual actors');
select is((select request_hash from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(10) and actor_user_id=pg_temp.s235_id(1) and idempotency_key=pg_temp.s235_id(100)),encode(extensions.digest(convert_to(jsonb_build_object('tenantId',pg_temp.s235_id(10),'themeId','fieldflow','expectedRevision',0,'defaults',pg_temp.s235_defaults())::text,'UTF8'),'sha256'),'hex'),'receipt hash binds exact full canonical command');
select ok(exists(select 1 from public.publisher_command_receipts receipt join public.audit_events audit on audit.id=receipt.audit_event_id and audit.tenant_id=receipt.tenant_id where receipt.tenant_id=pg_temp.s235_id(10) and receipt.actor_user_id=pg_temp.s235_id(1) and receipt.idempotency_key=pg_temp.s235_id(100) and audit.action='sync.theme.creation_defaults.updated'),'receipt and corresponding audit are committed together');
select is((select jsonb_agg(to_jsonb(profile)-'sync_creation_defaults'-'sync_creation_defaults_revision'-'updated_at' order by theme_id) from public.tenant_theme_profiles profile where tenant_id=pg_temp.s235_id(10)),(select value from s235_results where name='legacy-profiles-before'),'defaults save/replay leaves legacy revision/identity/appearance/selection/color/actor metadata exact');
select is((select to_jsonb(settings) from public.tenant_settings settings where tenant_id=pg_temp.s235_id(10)),(select value from s235_results where name='settings-before'),'compatibility tenant_settings mirror is byte-equal after all defaults commands');
select is(jsonb_build_object(
 'rollouts',(select count(*) from public.tenant_theme_rollouts where tenant_id=pg_temp.s235_id(10)),
 'snapshots',(select count(*) from public.dynamic_slide_snapshots where tenant_id=pg_temp.s235_id(10)),
 'releases',(select count(*) from public.playlist_releases where tenant_id=pg_temp.s235_id(10)),
 'slides',(select count(*) from public.dynamic_slides where tenant_id=pg_temp.s235_id(10)),
 'projects',(select count(*) from public.studio_projects where tenant_id=pg_temp.s235_id(10))
),(select value from s235_results where name='counts-before'),'defaults commands create no rollout/snapshot/release/slide/project');

select is(pg_temp.s235_old_content(),(select value from s235_results where name='content-before'),'all populated old designs drafts revisions snapshots placements releases and items remain byte-equal after new defaults commands');

-- Failure after profile UPDATE and audit INSERT still rolls the whole command
-- back. This synthetic trigger exists only inside this rolled-back local test.
insert into s235_results values('atomic-before',jsonb_build_object(
 'defaults',(select sync_creation_defaults from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10) and theme_id='fieldflow'),
 'revision',(select sync_creation_defaults_revision from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10) and theme_id='fieldflow'),
 'audits',(select count(*) from public.audit_events where tenant_id=pg_temp.s235_id(10) and action='sync.theme.creation_defaults.updated')
));
create function pg_temp.reject_s235_receipt() returns trigger
language plpgsql security invoker set search_path = '' as $function$
begin
 if new.tenant_id=pg_temp.s235_id(10) and new.idempotency_key=pg_temp.s235_id(190) then
  raise exception 'S235 synthetic receipt write failure' using errcode='P0001';
 end if;
 return new;
end;
$function$;
create trigger s235_test_receipt_failure before insert on public.publisher_command_receipts
for each row execute function pg_temp.reject_s235_receipt();
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',3,pg_temp.s235_defaults(),pg_temp.s235_id(190))$$,'P0001','S235 synthetic receipt write failure','receipt insertion failure aborts the complete defaults command');
reset role;
drop trigger s235_test_receipt_failure on public.publisher_command_receipts;
select is(jsonb_build_object(
 'defaults',(select sync_creation_defaults from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10) and theme_id='fieldflow'),
 'revision',(select sync_creation_defaults_revision from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10) and theme_id='fieldflow'),
 'audits',(select count(*) from public.audit_events where tenant_id=pg_temp.s235_id(10) and action='sync.theme.creation_defaults.updated')
),(select value from s235_results where name='atomic-before'),'failed completion rolls back defaults/revision and the earlier audit together');
select is((select count(*) from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(10) and idempotency_key=pg_temp.s235_id(190)),0::bigint,'failed command leaves no partial receipt');

-- Tenant B owns an unrelated profile; same payload/nonce cannot alter A.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(2)::text,true);
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(11),'fieldflow',0,pg_temp.s235_defaults(2),pg_temp.s235_id(100))->>'revision','1','tenant B can save its own independently scoped defaults');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',3,pg_temp.s235_defaults(2),pg_temp.s235_id(120))$$,'42501','actor cannot update Source theme creation defaults','tenant B cannot mutate A');
reset role;
select is((select sync_creation_defaults from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10) and theme_id='fieldflow'),pg_temp.s235_defaults(3),'B save leaves A exact payload intact');


-- Existing profiles update only independent columns even while Source authoring
-- is paused. A genuinely missing profile insert retains the original guard.
select set_config('request.jwt.claim.sub','',true);
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,revision,rollout_reason,changed_by)
values(pg_temp.s235_id(14),'sites_authoring_paused',true,1,'S235 synthetic pause fixture',pg_temp.s235_id(1));
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'fieldflow',0,pg_temp.s235_defaults(),pg_temp.s235_id(122))->>'revision','1','existing FieldFlow defaults can save while Source authoring is paused');
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'onzetrots-tv',0,pg_temp.s235_defaults(2),pg_temp.s235_id(123))->>'revision','1','existing OnzeTrots defaults save skips needless ensure INSERT while paused');
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'onzetrots-tv',1,pg_temp.s235_defaults(2),pg_temp.s235_id(124))->>'outcome','noop','existing paused-profile noop also avoids ensure INSERT');
reset role;
delete from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(14)and theme_id='onzetrots-tv';
set local role authenticated;
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'fieldflow',1,pg_temp.s235_defaults(),pg_temp.s235_id(128))->>'outcome','noop','existing required profile does not provision a different missing profile under pause');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'onzetrots-tv',0,pg_temp.s235_defaults(),pg_temp.s235_id(125))$$,'55000','Sites authoring is paused','genuinely missing profile keeps original Source insert pause guard');
reset role;
select is((select count(*)from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(14)and theme_id='onzetrots-tv'),0::bigint,'blocked missing-profile save leaves no provisioned row');
select is((select count(*)from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(14)and idempotency_key=pg_temp.s235_id(125)),0::bigint,'blocked missing-profile save leaves no success receipt');
update public.tenant_feature_flags set enabled=false,revision=revision+1 where tenant_id=pg_temp.s235_id(14)and flag_key='sites_authoring_paused';

-- Missing profile read is pure; the first guarded save alone may provision it.
delete from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(14) and theme_id='onzetrots-tv';
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select is(public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(14))#>>'{profiles,1,configured}','false','missing supported row returns explicit unconfigured state');
reset role;
select is((select count(*) from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(14) and theme_id='onzetrots-tv'),0::bigint,'read RPC did not create a missing row');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'onzetrots-tv',0,pg_temp.s235_defaults(),pg_temp.s235_id(121))->>'revision','1','first guarded write provisions valid missing supported row');
reset role;
select is((select theme_version from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(14) and theme_id='onzetrots-tv'),'11.0.0','provisioning preserves canonical existing theme version');


-- Exact safe-integer endpoint. Fixture sets only the new isolated column.
update public.tenant_theme_profiles set sync_creation_defaults_revision=9007199254740991
where tenant_id=pg_temp.s235_id(14)and theme_id='fieldflow';
insert into s235_results values('max-before',(select to_jsonb(x)from public.tenant_theme_profiles x where tenant_id=pg_temp.s235_id(14)and theme_id='fieldflow'));
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
insert into s235_results values('max-noop',public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'fieldflow',9007199254740991,pg_temp.s235_defaults(),pg_temp.s235_id(126)));
select is((select value->>'outcome'from s235_results where name='max-noop'),'noop','noop at MAX_SAFE_INTEGER is a valid command');
select is((select value->>'revision'from s235_results where name='max-noop'),'9007199254740991','MAX noop returns exact integer without overflow');
select is(public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(14))#>>'{profiles,0,revision}','9007199254740991','bounded read preserves exact MAX_SAFE_INTEGER revision');
select is(public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'fieldflow',9007199254740991,pg_temp.s235_defaults(),pg_temp.s235_id(126)),(select value from s235_results where name='max-noop'),'MAX noop receipt replays exact body');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(14),'fieldflow',9007199254740991,pg_temp.s235_defaults(2),pg_temp.s235_id(127))$$,'22023','Source theme creation defaults revision range exhausted','actual change at MAX rejects atomically');
reset role;
select is((select to_jsonb(x)from public.tenant_theme_profiles x where tenant_id=pg_temp.s235_id(14)and theme_id='fieldflow'),(select value from s235_results where name='max-before'),'MAX noop/failed change leave entire profile unchanged');
select is((select count(*)from public.publisher_command_receipts where tenant_id=pg_temp.s235_id(14)and idempotency_key=pg_temp.s235_id(127)),0::bigint,'failed MAX increment has no receipt');

-- The actual original global rollout command must retain new defaults columns.
-- This intentionally changes the old global active choice AFTER invariants above.
insert into s235_results values('defaults-before-old-api',(
 select jsonb_agg(jsonb_build_object('themeId',theme_id,'defaults',sync_creation_defaults,'revision',sync_creation_defaults_revision) order by theme_id)
 from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10)
));
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
insert into s235_results select 'old-api',public.update_tenant_theme_settings_v3(
 profile.tenant_id,profile.revision,profile.theme_id,profile.theme_version,
 profile.selection_json->'modePolicy',profile.color_overrides,profile.appearance_config,
 profile.selection_json->>'accent',profile.selection_json->>'support'
) from public.tenant_theme_profiles profile
where profile.tenant_id=pg_temp.s235_id(10) and profile.theme_id='onzetrots-tv';
select is((select value->>'outcome' from s235_results where name='old-api'),'applied','unchanged old global theme API still applies a real theme switch');
select ok((select value ? 'rolloutId' from s235_results where name='old-api'),'old global API retains its rollout acknowledgement');
select is((select default_theme_id from public.tenant_settings where tenant_id=pg_temp.s235_id(10)),'onzetrots-tv','old global API still updates its compatibility mirror');
reset role;
select is((select jsonb_agg(jsonb_build_object('themeId',theme_id,'defaults',sync_creation_defaults,'revision',sync_creation_defaults_revision) order by theme_id) from public.tenant_theme_profiles where tenant_id=pg_temp.s235_id(10)),(select value from s235_results where name='defaults-before-old-api'),'old global API leaves both new creation-default columns exact');


select is((select jsonb_agg(to_jsonb(x)order by id)from public.studio_revisions x where tenant_id=pg_temp.s235_id(10)),(select value->'revisions'from s235_results where name='content-before'),'old theme rollout preserves populated immutable Studio revisions');
select is((select jsonb_agg(to_jsonb(x)order by id)from public.dynamic_slide_snapshots x where id=pg_temp.s235_id(52)),(select value->'snapshots'from s235_results where name='content-before'),'old theme rollout preserves original immutable dynamic snapshot');
select is((select jsonb_agg(to_jsonb(x)order by id)from public.playlist_releases x where tenant_id=pg_temp.s235_id(10)),(select value->'releases'from s235_results where name='content-before'),'old theme rollout preserves existing immutable release including manifest/hash');
select is((select jsonb_agg(to_jsonb(x)order by id)from public.playlist_release_items x where tenant_id=pg_temp.s235_id(10)),(select value->'releaseItems'from s235_results where name='content-before'),'old theme rollout preserves exact populated release items');

-- Actual grant denial: anon cannot invoke the wrappers even with a forged sub.
set local role anon;
select set_config('request.jwt.claim.sub',pg_temp.s235_id(1)::text,true);
select throws_ok($$select public.read_sync_theme_creation_defaults_v1(pg_temp.s235_id(10))$$,'42501','permission denied for function read_sync_theme_creation_defaults_v1','anon has no read execute grant');
select throws_ok($$select public.save_sync_theme_creation_defaults_v1(pg_temp.s235_id(10),'fieldflow',3,pg_temp.s235_defaults(),pg_temp.s235_id(130))$$,'42501','permission denied for function save_sync_theme_creation_defaults_v1','anon has no write execute grant');
reset role;
select * from finish();
rollback;
