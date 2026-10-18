begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
create function pg_temp.source_doc()returns jsonb language sql immutable as $function$
 select $source_doc${"schemaVersion":1,"artboard":{"width":1920,"height":1080,"orientation":"landscape","background":{"kind":"solid","color":"#FAFAF7"},"safeArea":{"top":64,"right":64,"bottom":64,"left":64}},"motion":{"enabled":false,"durationMs":3000,"fps":30},"elements":[],"syncPresentation":{"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"club-story","orientation":"landscape","theme":"fieldflow","name":"Clubverhaal","club":{"name":"Source A","tagline":""},"title":"DIT IS ONZE TROTS","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"geen","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}},"metadata":{"fontRegistryVersion":"2026-09-09.1","tenantBrandApplied":false}}$source_doc$::jsonb;
$function$;
create temp table source_ids(label text primary key,id uuid);
grant all on source_ids to authenticated;
insert into auth.users(id,email)values
 ('00000000-0000-4000-8000-000000226091','source-metadata-a@veyocast.test'),
 ('00000000-0000-4000-8000-000000226092','source-metadata-b@veyocast.test'),
 ('00000000-0000-4000-8000-000000226093','source-metadata-viewer@veyocast.test');
insert into public.profiles(id,display_name)values
 ('00000000-0000-4000-8000-000000226091','Source A'),('00000000-0000-4000-8000-000000226092','Source B'),('00000000-0000-4000-8000-000000226093','Source viewer');
insert into public.tenants(id,name,slug)values
 ('10000000-0000-4000-8000-000000226091','Source A','source-metadata-a'),('10000000-0000-4000-8000-000000226092','Source B','source-metadata-b');
insert into public.tenant_settings(tenant_id)values('10000000-0000-4000-8000-000000226091'),('10000000-0000-4000-8000-000000226092');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000226091','00000000-0000-4000-8000-000000226091','tenant_owner'),
 ('10000000-0000-4000-8000-000000226092','00000000-0000-4000-8000-000000226092','tenant_owner'),
 ('10000000-0000-4000-8000-000000226091','00000000-0000-4000-8000-000000226093','tenant_viewer');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226091',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226091","role":"authenticated","aal":"aal2"}',true);
insert into source_ids values('a',(public.create_studio_project_v1('10000000-0000-4000-8000-000000226091','Clubverhaal','landscape',pg_temp.source_doc(),'{}','design','40000000-0000-4000-8000-000000226091')->>'projectId')::uuid);
select is(public.mutate_studio_project_v1((select id from source_ids where label='a'),0,'rename','{"name":"Een nieuwe bibliotheeknaam"}','40000000-0000-4000-8000-000000226094')->>'outcome','applied','Source rename uses the real authorized metadata command');
select is((select document_json#>>'{syncPresentation,name}' from public.studio_project_drafts where project_id=(select id from source_ids where label='a')),'Een nieuwe bibliotheeknaam','the immutable-input draft and library name agree');
select is((select draft_revision from public.studio_project_drafts where project_id=(select id from source_ids where label='a')),1::bigint,'renaming advances the draft CAS');
select is((select revision from public.studio_projects where id=(select id from source_ids where label='a')),1::bigint,'the project revision advances once');
select is(public.save_studio_draft_v1((select id from source_ids where label='a'),0,pg_temp.source_doc(),'{}','40000000-0000-4000-8000-000000226095')->>'outcome','conflict','an older editor cannot overwrite the later library rename');
select is(public.mutate_studio_project_v1((select id from source_ids where label='a'),0,'rename','{"name":"Een nieuwe bibliotheeknaam"}','40000000-0000-4000-8000-000000226094')->>'outcome','applied','a lost metadata ACK replays its original receipt despite later revisions');
select is((select draft_revision from public.studio_project_drafts where project_id=(select id from source_ids where label='a')),1::bigint,'metadata receipt replay does not write again');
insert into source_ids values('copy',(public.mutate_studio_project_v1((select id from source_ids where label='a'),1,'duplicate','{"name":"Een zelfstandige kopie"}','40000000-0000-4000-8000-000000226096')->>'projectId')::uuid);
select is((select document_json#>>'{syncPresentation,name}' from public.studio_project_drafts where project_id=(select id from source_ids where label='copy')),'Een zelfstandige kopie','a duplicated Source draft keeps the actual copy name');
select is((select name from public.studio_projects where id=(select id from source_ids where label='a')),'Een nieuwe bibliotheeknaam','duplication preserves the original name');
select is((select count(*)from public.studio_render_jobs where tenant_id='10000000-0000-4000-8000-000000226091'),0::bigint,'rename and duplicate never start a render');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000226092',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000226092","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.mutate_studio_project_v1((select id from source_ids where label='a'),1,'rename','{"name":"Ander tenant"}','40000000-0000-4000-8000-000000226097')$$,'42501',null,'tenant B cannot rename a Source project of A');
reset role;
select is((select document_hash=private.studio_document_hash(document_json) from public.studio_project_drafts where project_id=(select id from source_ids where label='copy')),true,'the independent copy has its own matching draft hash');
select *from finish();
rollback;
