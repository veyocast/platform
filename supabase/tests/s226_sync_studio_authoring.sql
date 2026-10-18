begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

create function pg_temp.sync_doc() returns jsonb language sql immutable as $function$
 select $sync_doc${"schemaVersion":1,"artboard":{"width":1920,"height":1080,"orientation":"landscape","background":{"kind":"solid","color":"#FAFAF7"},"safeArea":{"top":64,"right":64,"bottom":64,"left":64}},"motion":{"enabled":false,"durationMs":12000,"fps":30},"elements":[],"syncPresentation":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"free","orientation":"landscape","theme":"fieldflow","name":"Vrij ontwerp","club":{"name":"Sync A","tagline":""},"title":"JOUW VERHAAL","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"metadata":{"fontRegistryVersion":"2026-09-09.1","tenantBrandApplied":false}}$sync_doc$::jsonb;
$function$;

insert into auth.users(id,email) values('00000000-0000-4000-8000-000000226051','sync-a@veyocast.test'),('00000000-0000-4000-8000-000000226052','sync-b@veyocast.test');
insert into public.profiles(id,display_name) values('00000000-0000-4000-8000-000000226051','Sync A'),('00000000-0000-4000-8000-000000226052','Sync B');
insert into public.tenants(id,name,slug) values('10000000-0000-4000-8000-000000226051','Sync A','sync-a'),('10000000-0000-4000-8000-000000226052','Sync B','sync-b');
insert into public.tenant_settings(tenant_id) values('10000000-0000-4000-8000-000000226051'),('10000000-0000-4000-8000-000000226052');
insert into public.tenant_memberships(tenant_id,user_id,role) values('10000000-0000-4000-8000-000000226051','00000000-0000-4000-8000-000000226051','tenant_owner'),('10000000-0000-4000-8000-000000226052','00000000-0000-4000-8000-000000226052','tenant_viewer');
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256)
 values('20000000-0000-4000-8000-000000226052','10000000-0000-4000-8000-000000226052','image','Private B','logo.png','image/png','ready','tenants/10000000-0000-4000-8000-000000226052/assets/20000000-0000-4000-8000-000000226052/original/logo.png',1024,repeat('a',64));
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256)
 values('90000000-0000-4000-8000-000000226052','10000000-0000-4000-8000-000000226052','20000000-0000-4000-8000-000000226052','original','tenants/10000000-0000-4000-8000-000000226052/assets/20000000-0000-4000-8000-000000226052/original/logo.png','image/png',1024,repeat('a',64));

select lives_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,pg_temp.sync_doc(),'{}')$$,'canonical client Sync document passes the unchanged Studio admission chain');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(pg_temp.sync_doc(),'{syncPresentation,name}','" "'),'{}')$$,'23514','Sync document name invalid','an empty internal name cannot enter a Studio document');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(pg_temp.sync_doc(),'{syncPresentation,name}',to_jsonb(repeat('a',121))),'{}')$$,'23514','Sync document name invalid','internal names respect the existing project limit');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(pg_temp.sync_doc(),'{syncPresentation,sourceRevision}','"0000000000000000000000000000000000000000"'),'{}')$$,'23514','Sync slide structure invalid','a mixed source identity is refused');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',(pg_temp.sync_doc()->'syncPresentation')||'{"html":"<script>unsafe()</script>"}')$$,'23514','Sync slide structure invalid','unexpected HTML and unknown fields are rejected by the same generated schema');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',jsonb_set(pg_temp.sync_doc()->'syncPresentation','{style,accent}','"red;position:fixed"'))$$,'23514','Sync slide structure invalid','arbitrary CSS cannot cross the database boundary');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',jsonb_set(pg_temp.sync_doc()->'syncPresentation','{club,logo}',jsonb_build_object('kind','system','path','/assets/logo-pack.zip','checksumSha256',repeat('a',64))))$$,'23514','Sync system asset identity invalid','private source archives cannot become presentation assets');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',jsonb_set(pg_temp.sync_doc()->'syncPresentation','{club,logo}',jsonb_build_object('kind','tenant','mediaAssetId','20000000-0000-4000-8000-000000226052','checksumSha256',repeat('a',64))))$$,'23514','Sites media unavailable in this tenant','tenant A cannot refer to a ready image of tenant B');
select lives_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226052',jsonb_set(pg_temp.sync_doc()->'syncPresentation','{club,logo}',jsonb_build_object('kind','tenant','mediaAssetId','20000000-0000-4000-8000-000000226052','checksumSha256',repeat('a',64))))$$,'the established original/checksum boundary accepts its own tenant image');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226052',jsonb_set(pg_temp.sync_doc()->'syncPresentation','{club,logo}',jsonb_build_object('kind','tenant','mediaAssetId','20000000-0000-4000-8000-000000226052','checksumSha256',repeat('b',64))))$$,'23514','Sites media unavailable in this tenant','a changed image checksum is rejected');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,pg_temp.sync_doc(),array['20000000-0000-4000-8000-000000226052']::uuid[])$$,'23514','Sync tenant manifest mismatch','extra assets cannot be smuggled into the render manifest');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,pg_temp.sync_doc()||'{"sitesPresentation":{}}','{}')$$,'23514','Sync document composition invalid','two renderers cannot be combined in one document');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','portrait',1080,1920,pg_temp.sync_doc(),'{}')$$,'23514',null,'a source orientation cannot bypass existing project dimensions');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',jsonb_set(pg_temp.sync_doc()->'syncPresentation','{ownRowIndexes}','[0]'))$$,'23514','Sync own row missing','an explicit own-row marker must point to an existing row');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',(pg_temp.sync_doc()->'syncPresentation')||'{"news":[{"title":"News","intro":"Read","source":"A","url":"javascript:alert(1)"}]}')$$,'23514',null,'QR links must be actual HTTPS URLs');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',(pg_temp.sync_doc()->'syncPresentation')||'{"youtubeUrl":"https://youtube.com.attacker.example/watch?v=abcdefghijk"}')$$,'23514','Sync video origin invalid','lookalike video hosts are refused');

create function pg_temp.sync_poll(p_status text,p_visibility text,p_votes integer) returns jsonb language sql immutable as $$
 select (pg_temp.sync_doc()->'syncPresentation')||jsonb_build_object('family','engage','poll',jsonb_build_object('id','50000000-0000-4000-8000-000000226051','title','Een echte keuze','status',p_status,'visibility',p_visibility,'options',jsonb_build_array(jsonb_build_object('id','50000000-0000-4000-8000-000000226052','label','A','votes',p_votes),jsonb_build_object('id','50000000-0000-4000-8000-000000226053','label','B','votes',0))));
$$;
-- Source admission now resolves the actual tenant campaign. These schema
-- cases retain their original assertions using an explicit owned authority.
insert into public.tenant_feature_flags(tenant_id,flag_key,enabled,rollout_reason,changed_by)values('10000000-0000-4000-8000-000000226051','engage',true,'Source authoring privacy fixture','00000000-0000-4000-8000-000000226051');
insert into public.engage_campaigns(id,public_id,tenant_id,kind,status,title,question,result_visibility)values('50000000-0000-4000-8000-000000226050','50000000-0000-4000-8000-000000226051','10000000-0000-4000-8000-000000226051','poll','live','Eigen schemafixture','Een echte keuze','live');
insert into public.engage_options(id,tenant_id,campaign_id,label,sort_order)values('50000000-0000-4000-8000-000000226052','10000000-0000-4000-8000-000000226051','50000000-0000-4000-8000-000000226050','Keuze A',0),('50000000-0000-4000-8000-000000226053','10000000-0000-4000-8000-000000226051','50000000-0000-4000-8000-000000226050','Keuze B',1);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226051',true);
select lives_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',pg_temp.sync_poll('live','live',12))$$,'confirmed public live votes are renderable');
update public.engage_campaigns set status='closed',result_visibility='after_close'where id='50000000-0000-4000-8000-000000226050';
select lives_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',pg_temp.sync_poll('closed','after_close',12))$$,'a closed poll may publish its authorised final results');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',pg_temp.sync_poll('live','after_vote',12))$$,'23514','Sync nonpublic votes forbidden','phone-only poll counts cannot enter the public screen document');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',pg_temp.sync_poll('draft','live',12))$$,'23514','Sync nonpublic votes forbidden','draft counts remain private even when live visibility is selected');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',jsonb_set(pg_temp.sync_poll('live','live',12),'{poll,options,1,id}','"50000000-0000-4000-8000-000000226052"'))$$,'23514','Sync poll choice identity repeated','repeated choices cannot distort public totals');
select throws_ok($$select private.assert_sync_slide_v1('10000000-0000-4000-8000-000000226051',jsonb_set(pg_temp.sync_poll('live','live',12),'{poll,publicUrl}','"https://secret@example.org/poll"'))$$,'23514','Sync public URL invalid','QR destinations cannot contain credentials');

create function pg_temp.sync_multipage(p_enabled boolean,p_duration integer) returns jsonb language sql immutable as $$
 select jsonb_set(pg_temp.sync_doc(),'{motion}',jsonb_build_object('enabled',p_enabled,'durationMs',p_duration,'fps',30))||jsonb_build_object('syncPresentation',(pg_temp.sync_doc()->'syncPresentation')||jsonb_build_object('family','fixtures','rows',jsonb_build_array(jsonb_build_array('A','B','11:00','1'),jsonb_build_array('A','B','11:00','1'),jsonb_build_array('A','B','11:00','1'),jsonb_build_array('A','B','11:00','1'),jsonb_build_array('Last','B','12:00','2'))));
$$;
select lives_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,pg_temp.sync_multipage(true,6000),'{}')$$,'every data page receives its minimum time budget');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,pg_temp.sync_multipage(true,5000),'{}')$$,'23514','Sync document duration invalid','too-short page budgets are refused');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,pg_temp.sync_multipage(false,6000),'{}')$$,'23514','Sync document duration invalid','a single PNG cannot silently replace a multipage document');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(pg_temp.sync_doc(),'{syncPresentation,style,motion}','"rustig"'),'{}')$$,'23514','Sync animated document requires video','selected animation cannot be exported as a still PNG');
select lives_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(jsonb_set(pg_temp.sync_doc(),'{syncPresentation,style,motion}','"dynamisch"'),'{motion,enabled}','true'),'{}')$$,'selected motion admits the complete video path');
select lives_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(pg_temp.sync_doc(),'{syncPresentation,style,motion}','"geen"'),'{}')$$,'explicit no animation retains the still path');
select throws_ok($$select private.assert_studio_document('10000000-0000-4000-8000-000000226051','landscape',1920,1080,jsonb_set(pg_temp.sync_doc(),'{syncPresentation,style,motion}','"unknown"'),'{}')$$,'23514','Sync slide structure invalid','unknown animation never reaches the worker');

select ok(private.json_has_sites_authoring_v1(pg_temp.sync_doc()),'the existing authoring pause recognises nested Sync documents');
select is(private.sites_presentation_identity_is_valid_v2('sync-v1','8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'),false,'legacy renderer identity admission is not widened');
select is(has_function_privilege('authenticated','private.assert_sync_slide_v1(uuid,jsonb)','EXECUTE'),false,'the private validator is not an authenticated public API');
select is(has_function_privilege('anon','private.assert_studio_document(uuid,text,integer,integer,jsonb,uuid[])','EXECUTE'),false,'anonymous users cannot invoke admission helpers');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226051',true);
select lives_ok($$select public.create_studio_project_v1(p_tenant_id=>'10000000-0000-4000-8000-000000226051',p_name=>'Sync persisted',p_orientation=>'landscape',p_document=>pg_temp.sync_doc(),p_referenced_asset_ids=>'{}',p_project_kind=>'design',p_idempotency_key=>'40000000-0000-4000-8000-000000226051')$$,'actual authorised command creates a Sync draft');
select lives_ok($$select public.create_studio_project_v1(p_tenant_id=>'10000000-0000-4000-8000-000000226051',p_name=>'Sync persisted',p_orientation=>'landscape',p_document=>pg_temp.sync_doc(),p_referenced_asset_ids=>'{}',p_project_kind=>'design',p_idempotency_key=>'40000000-0000-4000-8000-000000226051')$$,'the unchanged create receipt permits an identical retry');
select throws_ok($$select public.create_studio_project_v1(p_tenant_id=>'10000000-0000-4000-8000-000000226052',p_name=>'Forbidden',p_orientation=>'landscape',p_document=>pg_temp.sync_doc(),p_referenced_asset_ids=>'{}',p_project_kind=>'design',p_idempotency_key=>'40000000-0000-4000-8000-000000226053')$$,'42501',null,'tenant A cannot create a design in tenant B');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226052',true);
select is((select count(*) from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),0::bigint,'tenant B cannot read the Sync draft of tenant A');
select throws_ok($$select public.create_studio_project_v1(p_tenant_id=>'10000000-0000-4000-8000-000000226052',p_name=>'Viewer forbidden',p_orientation=>'landscape',p_document=>pg_temp.sync_doc(),p_referenced_asset_ids=>'{}',p_project_kind=>'design',p_idempotency_key=>'40000000-0000-4000-8000-000000226054')$$,'42501',null,'a viewer cannot create a new Sync draft');
reset role;
select is((select count(*) from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),1::bigint,'receipt retry retains exactly one project identity');
select is((select document_json#>>'{syncPresentation,rendererVersion}' from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),'sync-v1','the original document format is persisted without a compatibility rewrite');
select is((select count(*) from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000226051'),0::bigint,'draft creation creates no spurious release');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226051',true);
select lives_ok($$select public.request_studio_render_v1((select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),(select draft_revision from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),'png','40000000-0000-4000-8000-000000226055')$$,'the existing render command accepts the stored Sync draft');
reset role;
create function pg_temp.sync_job_id() returns uuid language sql stable security definer set search_path='' as $$select id from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226051'$$;
set local role service_role;
select lives_ok($$select * from public.claim_studio_render_job_v1('s226:attempt-one',900,3)$$,'first attempt is claimed through the existing service boundary');
select lives_ok($$select public.update_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-one','rendering',60)$$,'an attempt can reach a later progress value');
select lives_ok($$select public.fail_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-one','encoding_failed','Recorded transient test failure',true)$$,'a real retryable failure uses the existing queue transition');
reset role;
update public.studio_render_jobs set next_attempt_at=now()-interval '1 second' where id=pg_temp.sync_job_id();
set local role service_role;
select lives_ok($$select * from public.claim_studio_render_job_v1('s226:attempt-two',900,3)$$,'a due second attempt is claimed without rewriting the job identity');
reset role;
select is((select progress from public.studio_render_jobs where id=pg_temp.sync_job_id()),1,'new attempt resets progress instead of inheriting sixty percent');
set local role service_role;
select lives_ok($$select public.update_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-two','rendering',20)$$,'the next attempt can report its actual first render progress');
select throws_ok($$select public.update_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-two','rendering',19)$$,'23514',null,'progress still cannot move backwards within an attempt');
select throws_ok($$select public.update_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-one','rendering',80)$$,'42501',null,'the previous worker remains fenced after retry');
reset role;
update public.studio_render_jobs set locked_at=now()-interval '16 minutes' where id=pg_temp.sync_job_id();
set local role service_role;
select lives_ok($$select * from public.claim_studio_render_job_v1('s226:attempt-three',900,3)$$,'an actually expired lease is reclaimed through the same claim command');
reset role;
select is((select progress from public.studio_render_jobs where id=pg_temp.sync_job_id()),1,'expired lease recovery starts its own attempt progress');
select is((select attempt_count from public.studio_render_jobs where id=pg_temp.sync_job_id()),3,'the existing attempt budget still counts every claim');
set local role service_role;
select throws_ok($$select public.update_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-two','rendering',80)$$,'42501',null,'the worker of the expired lease cannot update the new attempt');
select lives_ok($$select public.fail_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-three','encoding_failed','Terminal fixture completion',false)$$,'terminal fixture failure uses the normal worker report');
reset role;

create function pg_temp.sync_portrait_doc() returns jsonb language sql immutable as $$
 select jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.sync_doc(),'{artboard,width}','1080'),'{artboard,height}','1920'),'{artboard,orientation}','"portrait"'),'{syncPresentation,orientation}','"portrait"'),'{syncPresentation,name}','"Staand ontwerp"');
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226051',true);
select is(public.save_studio_draft_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_expected_revision=>(select draft_revision from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_document=>pg_temp.sync_portrait_doc(),p_referenced_asset_ids=>'{}',p_idempotency_key=>'40000000-0000-4000-8000-000000226056'
)->>'outcome','saved','the real save command changes both the Sync canvas and project orientation');
reset role;
select is((select orientation from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),'portrait','project metadata follows the actual portrait draft');
select is((select width from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),1080,'project width follows the actual portrait draft');
select is((select height from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),1920,'project height follows the actual portrait draft');
select is((select name from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),'Staand ontwerp','the internal name is saved atomically with its draft');
update private.tenant_feature_flag_definitions set kill_switch_active=true where flag_key='sites_authoring_paused';
set local role authenticated;
select throws_ok($$select public.save_studio_draft_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_expected_revision=>(select draft_revision from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_document=>jsonb_set(pg_temp.sync_portrait_doc(),'{syncPresentation,title}','"Forbidden paused edit"'),p_referenced_asset_ids=>'{}',p_idempotency_key=>'40000000-0000-4000-8000-000000226057')$$,'55000','Sites authoring is paused','the unchanged pause trigger refuses a new Sync edit');
select is(public.restore_studio_revision_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_revision_id=>(select id from public.studio_revisions where tenant_id='10000000-0000-4000-8000-000000226051' order by revision_number limit 1),
 p_expected_draft_revision=>(select draft_revision from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_idempotency_key=>'40000000-0000-4000-8000-000000226058'
)->>'outcome','restored','the current public restore wrapper permits an exact immutable Sync restore during pause');
reset role;
select is((select orientation from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),'landscape','the immutable landscape snapshot restores matching project dimensions');
select is((select name from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),'Vrij ontwerp','immutable restore also restores the recorded internal name');
select is((select count(*) from private.sites_immutable_restore_contexts where tenant_id='10000000-0000-4000-8000-000000226051'),0::bigint,'the guarded restore context is removed after the command');
select is(has_function_privilege('authenticated','public.restore_studio_revision_before_sites_pause_v1(uuid,uuid,bigint,uuid)','EXECUTE'),false,'the underlying restore implementation remains unavailable to clients');
update private.tenant_feature_flag_definitions set kill_switch_active=false where flag_key='sites_authoring_paused';
set local role authenticated;
select is(public.save_studio_draft_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_expected_revision=>(select draft_revision from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_document=>pg_temp.sync_multipage(true,6000),p_referenced_asset_ids=>'{}',p_idempotency_key=>'40000000-0000-4000-8000-000000226059'
)->>'outcome','saved','a later editor can save a different two-page video draft');
select is(public.request_studio_render_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_expected_draft_revision=>0,p_output_kind=>'png',p_idempotency_key=>'40000000-0000-4000-8000-000000226055'
)->>'renderJobId',pg_temp.sync_job_id()::text,'the original PNG receipt is recovered after both draft hash and output kind changed');
reset role;
select is((select count(*) from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226051'),1::bigint,'receipt recovery never creates a second job or revision');
select is(has_function_privilege('authenticated','private.replay_committed_studio_render_v1(uuid,uuid,bigint,text,uuid)','EXECUTE'),false,'the committed receipt helper is not a new public API');

-- A human may authorise one additional attempt after the automatic budget.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226051',true);
select throws_ok($$select public.request_studio_render_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_expected_draft_revision=>0,p_output_kind=>'mp4',p_idempotency_key=>'40000000-0000-4000-8000-000000226055')$$,'23505',null,'an original PNG key cannot be rebound to a different requested output');
select is(public.save_studio_draft_v1(
 p_project_id=>(select id from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_expected_revision=>(select draft_revision from public.studio_project_drafts where tenant_id='10000000-0000-4000-8000-000000226051'),
 p_document=>pg_temp.sync_portrait_doc(),p_referenced_asset_ids=>'{}',p_idempotency_key=>'40000000-0000-4000-8000-000000226062'
)->>'outcome','saved','a later portrait draft cannot redefine the dimensions of a pending landscape render');
select is(public.retry_studio_render_v1(pg_temp.sync_job_id(),'40000000-0000-4000-8000-000000226060')->>'outcome','queued','an authorised manual retry queues the exhausted job');
reset role;
set local role service_role;
select is((select jsonb_build_array(width,height,duration_ms,fps) from public.claim_studio_render_job_v1('s226:manual-four',900,3)),'[1920,1080,12000,30]'::jsonb,'the authorised fourth attempt retains immutable snapshot dimensions and timing with unchanged global limit three');
reset role;
select is((select width from public.studio_projects where tenant_id='10000000-0000-4000-8000-000000226051'),1080,'the current project really has the newer portrait dimensions');
select is((select attempt_count from public.studio_render_jobs where id=pg_temp.sync_job_id()),4,'a manual retry never erases the three earlier attempts');
select is((select progress from public.studio_render_jobs where id=pg_temp.sync_job_id()),1,'the manual retry starts at actual first progress');
set local role service_role;
select throws_ok($$select public.update_studio_render_job_v1(pg_temp.sync_job_id(),'s226:attempt-three','rendering',20)$$,'42501',null,'a worker from before the manual retry remains fenced');
select lives_ok($$select public.fail_studio_render_job_v1(pg_temp.sync_job_id(),'s226:manual-four','encoding_failed','Explicit manual attempt failed',true)$$,'the explicit manual attempt can report a retryable failure normally');
reset role;
select is((select status from public.studio_render_jobs where id=pg_temp.sync_job_id()),'failed','one manual permission does not grant unbounded automatic retries');
set local role service_role;
select is((select count(*) from public.claim_studio_render_job_v1('s226:no-fifth',900,3)),0::bigint,'a fifth attempt requires another explicit human command');
reset role;
set local role authenticated;
select is(public.retry_studio_render_v1(pg_temp.sync_job_id(),'40000000-0000-4000-8000-000000226060')->>'outcome','queued','a lost manual retry receipt is recovered without granting another attempt');
reset role;
select is((select status from public.studio_render_jobs where id=pg_temp.sync_job_id()),'failed','replaying the original permission does not mutate the newly failed attempt');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226052',true);
select throws_ok($$select public.retry_studio_render_v1(pg_temp.sync_job_id(),'40000000-0000-4000-8000-000000226061')$$,'42501',null,'another tenant cannot grant an extra attempt');
reset role;

select * from finish();
rollback;
