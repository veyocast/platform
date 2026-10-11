begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select ok(has_function_privilege('service_role','public.prune_superseded_publication_versions_v1(uuid,integer)','EXECUTE')
  and has_function_privilege('service_role','public.prune_queued_publication_versions_v1(integer)','EXECUTE'),
  'only the worker receives the two bounded prune commands');
select ok(not has_function_privilege('authenticated','public.prune_superseded_publication_versions_v1(uuid,integer)','EXECUTE')
  and not has_function_privilege('anon','public.prune_queued_publication_versions_v1(integer)','EXECUTE'),
  'browsers and anonymous devices cannot prune configuration history');
select ok(not has_table_privilege('service_role','private.publication_version_prune_context','INSERT')
  and not has_table_privilege('authenticated','private.publication_version_prune_context','INSERT')
  and not has_table_privilege('service_role','private.publication_version_prune_queue','SELECT'),
  'worker and browser cannot forge the owner-written candidate allowlist');
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_catalog.pg_class
  where oid in ('private.publication_version_prune_queue'::regclass,'private.publication_version_prune_context'::regclass)),
  'both private tenant tables force default-deny RLS without client policies');

insert into public.tenants(id,name,slug) values
  ('10000000-0000-4000-8000-000000001901','Retention tenant A','retention-s190-a'),
  ('10000000-0000-4000-8000-000000001902','Retention tenant B','retention-s190-b');
insert into public.tenant_settings(tenant_id) values
  ('10000000-0000-4000-8000-000000001901'),('10000000-0000-4000-8000-000000001902');
insert into public.playlists(id,tenant_id,name) values
  ('20000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','Retention A'),
  ('20000000-0000-4000-8000-000000001902','10000000-0000-4000-8000-000000001902','Retention B');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,
  item_count,total_duration_seconds,total_bytes)
select ('30000000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,
  '10000000-0000-4000-8000-000000001901','20000000-0000-4000-8000-000000001901',number,
  repeat('a',64),'{}',1,10,100 from generate_series(1,9) number order by number;
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,
  item_count,total_duration_seconds,total_bytes) values
  ('31000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000001902','20000000-0000-4000-8000-000000001902',1,repeat('b',64),'{}',1,10,100),
  ('31000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000001902','20000000-0000-4000-8000-000000001902',2,repeat('c',64),'{}',1,10,100);

insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,
  file_size_bytes,checksum_sha256,width,height) values
  ('40000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','image','Shared upload','photo.png','image/png','ready',
  'tenants/10000000-0000-4000-8000-000000001901/assets/40000000-0000-4000-8000-000000001901/original.png',100,repeat('d',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select '41000000-0000-4000-8000-000000001901',tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
  from public.media_assets where id='40000000-0000-4000-8000-000000001901';
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,
  sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256)
select asset.tenant_id,'20000000-0000-4000-8000-000000001901',release.id,asset.id,variant.id,
  0,10,'contain',true,asset.kind,asset.title,asset.storage_path,asset.mime_type,asset.file_size_bytes,asset.checksum_sha256
from public.media_assets asset join public.media_variants variant on variant.asset_id=asset.id
cross join public.playlist_releases release where asset.id='40000000-0000-4000-8000-000000001901'
  and release.id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009');

insert into public.screens(id,tenant_id,name,status,active_assignment_source,assigned_playlist_id,assigned_release_id,default_playlist_id,default_release_id)
values('50000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','Offline retained screen','disabled','override',
  '20000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000006');
insert into public.player_devices(id,tenant_id,screen_id,token_hash,active_release_id,desired_release_id,last_seen_at,paired_at)
values('51000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','50000000-0000-4000-8000-000000001901',
  repeat('e',64),'30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000008',now()-interval '90 days',now()-interval '100 days');
insert into public.screen_groups(id,tenant_id,name,status,archived_at,default_playlist_id,default_release_id)
values('52000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','Archived group','archived',now(),
  '20000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000007');
insert into public.content_schedules(id,tenant_id,name,target_kind,target_screen_id,playlist_id,release_id,
  timezone_name,starts_at,ends_at,enabled)
values('53000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','Recoverable old schedule','screen',
  '50000000-0000-4000-8000-000000001901','20000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000003',
  'Europe/Amsterdam',now()-interval '14 days',now()-interval '7 days',false);
insert into public.sponsor_plan_revisions(id,tenant_id,version,content_release_id,plan_hash,plan_json,valid_from,expires_at)
values('54000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901',1,
  '30000000-0000-4000-8000-000000000004',repeat('f',64),'{}',now()-interval '14 days',now()-interval '7 days');
insert into public.publisher_target_snapshots(id,tenant_id,release_id,source_kind,target_count,targets_json,snapshot_hash)
values('55000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901',
  '30000000-0000-4000-8000-000000000001','direct',1,'[]',repeat('a',64));
insert into public.publisher_target_snapshot_screens(tenant_id,snapshot_id,screen_id,provenance_kind)
values('10000000-0000-4000-8000-000000001901','55000000-0000-4000-8000-000000001901','50000000-0000-4000-8000-000000001901','direct');
insert into public.release_screen_assignments(tenant_id,release_id,screen_id,assignment_kind,target_snapshot_id)
values('10000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000001901','published','55000000-0000-4000-8000-000000001901');
insert into public.playlist_release_authoring_snapshots(tenant_id,playlist_id,release_id,snapshot_json,snapshot_hash)
values('10000000-0000-4000-8000-000000001901','20000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000001','{}',repeat('a',64));

select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($$select public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1)$$,
  '42501','service role required','even an owner connection carrying an ordinary JWT cannot invoke worker cleanup');
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$select public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',0)$$,
  '22023','invalid prune scope or batch limit','zero batch cannot bypass bounds');
select set_config('veyocast.publication_prune','on',true);
select throws_ok($$delete from public.playlist_releases where id='30000000-0000-4000-8000-000000000001'$$,
  '23514','playlist releases are immutable','a forged transaction setting does not authorize immutable release deletion');

-- Exercise triggers even if a future table grant/policy is accidentally widened.
-- All temporary grants and policies below roll back with this test transaction.
grant select,delete on public.playlist_release_items,public.publisher_target_snapshots to authenticated,service_role;
create policy s190_test_item_mutation on public.playlist_release_items for all to authenticated
  using(tenant_id='10000000-0000-4000-8000-000000001901') with check(tenant_id='10000000-0000-4000-8000-000000001901');
create policy s190_test_target_mutation on public.publisher_target_snapshots for all to authenticated
  using(tenant_id='10000000-0000-4000-8000-000000001901') with check(tenant_id='10000000-0000-4000-8000-000000001901');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('veyocast.playlist_delete','on',true);
select is(private.publication_prune_contains_v1('10000000-0000-4000-8000-000000001901','release','30000000-0000-4000-8000-000000000001'),
  false,'read-only trigger helper cannot convert an ordinary caller setting into owner authorization');
select throws_ok($$delete from public.playlist_release_items where release_id='30000000-0000-4000-8000-000000000001'$$,
  '42501','permission denied for function playlist_delete_context_v1','authenticated forged legacy setting cannot delete immutable release items even with a test table grant');
select throws_ok($$delete from public.publisher_target_snapshots where id='55000000-0000-4000-8000-000000001901'$$,
  '42501','permission denied for function playlist_delete_context_v1','authenticated forged legacy setting cannot delete immutable targets even with a test policy');
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$delete from public.playlist_release_items where release_id='30000000-0000-4000-8000-000000000001'$$,
  '42501','permission denied for function playlist_delete_context_v1','worker DML cannot forge the legacy deletion context after a future table grant');
select throws_ok($$delete from public.publisher_target_snapshots where id='55000000-0000-4000-8000-000000001901'$$,
  '42501','permission denied for function playlist_delete_context_v1','worker DML cannot bypass immutable target guards through the legacy setting');
reset role;
select set_config('veyocast.playlist_delete','off',true);
select is((select count(*) from public.playlist_release_items where release_id='30000000-0000-4000-8000-000000000001'),1::bigint,
  'forged legacy contexts leave the release item intact for the authorized command');

-- A future FK unknown to this command must undo all its earlier child deletes.
create table public.s190_retention_future_fk_probe(tenant_id uuid not null,release_id uuid not null,
  foreign key(tenant_id,release_id) references public.playlist_releases(tenant_id,id) on delete restrict);
alter table public.s190_retention_future_fk_probe enable row level security;
insert into public.s190_retention_future_fk_probe values('10000000-0000-4000-8000-000000001901','30000000-0000-4000-8000-000000000001');
create temporary table s190_prune_results(label text primary key,result jsonb);
insert into s190_prune_results values('future-fk',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1));
select is((select result->>'skippedReferences' from s190_prune_results where label='future-fk'),'1','unknown FK safely skips one whole candidate');
select is((select count(*) from public.playlist_release_items where release_id='30000000-0000-4000-8000-000000000001'),1::bigint,'FK rollback restores immutable item dependants');
select is((select count(*) from public.publisher_target_snapshots where id='55000000-0000-4000-8000-000000001901'),1::bigint,'FK rollback restores target provenance');
select is((select count(*) from private.publication_version_prune_context),0::bigint,'failed candidate leaves no reusable owner context');
drop table public.s190_retention_future_fk_probe;
insert into s190_prune_results values('release',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1));
select is((select result->>'releasesDeleted' from s190_prune_results where label='release'),'1','unreferenced prior release is actually deleted');
select is((select count(*) from public.playlist_release_authoring_snapshots where release_id='30000000-0000-4000-8000-000000000001'),0::bigint,'obsolete authoring history is deleted in the same transaction');
select is((select count(*) from public.publisher_target_snapshots where id='55000000-0000-4000-8000-000000001901'),0::bigint,'obsolete target history is removed without detaching live screens');
select is((select count(*) from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000001901'),8::bigint,'every current, offline, desired, schedule, sponsor, screen, default and archived group reference is retained');
select is((select count(*) from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000001902'),2::bigint,'tenant A pruning never deletes tenant B history');
select is((select active_release_id::text from public.player_devices where id='51000000-0000-4000-8000-000000001901'),
  '30000000-0000-4000-8000-000000000002','a device offline for ninety days retains its exact active release');
select is((select checksum_sha256 from public.media_assets where id='40000000-0000-4000-8000-000000001901'),repeat('d',64),'shared user upload bytes and metadata remain unchanged');
select is((select result->>'assetsDeleted' from s190_prune_results where label='release'),'0','configuration retention never claims byte deletion');
select is((select count(*) from private.publication_version_prune_context),0::bigint,'successful cleanup removes its transaction allowlist');
select ok((select not pending from private.publication_version_prune_queue where tenant_id='10000000-0000-4000-8000-000000001901'),
  'protected references alone do not keep a hot worker queue');
update public.player_devices set active_release_id='30000000-0000-4000-8000-000000000009'
  where id='51000000-0000-4000-8000-000000001901';
select ok((select pending from private.publication_version_prune_queue where tenant_id='10000000-0000-4000-8000-000000001901'),
  'a newly recorded active acknowledgement enqueues safe previous-version cleanup');
insert into s190_prune_results values('ack',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1));
select is((select result->>'releasesDeleted' from s190_prune_results where label='ack'),'1','the formerly active release becomes eligible only after acknowledgement');

insert into public.dynamic_data_sources(id,tenant_id,name,kind,status,provider_status,config_json)
values('60000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','Retention Sportlink','sportlink','active','ready','{}');
insert into public.dynamic_slides(id,tenant_id,name,slide_type,orientation,template_id,template_version_id,
  data_source_id,selection_mode,status,configuration_json)
select '61000000-0000-4000-8000-000000001901','10000000-0000-4000-8000-000000001901','Retention standings',
  'sport_standing','landscape',template.id,version.id,'60000000-0000-4000-8000-000000001901','latest','draft',
  '{"schemaVersion":1,"blueprintKey":"sportlink.pool_standings","title":"Poulestand","context":{"competitionId":null,"competitionSelectionMode":"auto_current","phaseId":null,"poolId":null,"providerTeamId":"jo17","seasonId":null},"display":{"columns":"two","showDressingRoom":false,"showField":true,"showHomeAway":true,"showReferee":false},"editorial":{"schemaVersion":2,"themeSelection":{"ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}},"maxItems":40}'::jsonb
from public.dynamic_templates template join public.dynamic_template_versions version on version.id=template.current_published_version_id
where template.slide_type='sport_standing' and template.orientation='landscape' and template.status='published' limit 1;
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,
  source_revision_hash,snapshot_data_json,status,completed_at)
select ('62000000-0000-4000-8000-'||lpad(number::text,12,'0'))::uuid,slide.tenant_id,slide.id,
  slide.template_version_id,slide.data_source_id,lpad(number::text,64,'a'),
  '{"type":"sport_standing","sport":{"title":"Frozen v1","items":[]}}','ready',now()
from public.dynamic_slides slide cross join generate_series(1,3) number where slide.id='61000000-0000-4000-8000-000000001901';
update public.dynamic_slides set current_snapshot_id='62000000-0000-4000-8000-000000000001',status='ready'
  where id='61000000-0000-4000-8000-000000001901';
insert into public.dynamic_slide_versions(id,tenant_id,dynamic_slide_id,version_number,status,name,slide_type,
  orientation,template_id,template_version_id,data_source_id,selection_mode,configuration_json,theme_selection_json,based_on_version_id)
select '63000000-0000-4000-8000-000000001902',tenant_id,dynamic_slide_id,2,'publishing',name,slide_type,
  orientation,template_id,template_version_id,data_source_id,selection_mode,configuration_json,theme_selection_json,id
from public.dynamic_slide_versions where dynamic_slide_id='61000000-0000-4000-8000-000000001901' and version_number=1;
update public.dynamic_slides set active_draft_version_id='63000000-0000-4000-8000-000000001902'
  where id='61000000-0000-4000-8000-000000001901';
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,
  source_revision_hash,snapshot_data_json,status,completed_at)
select '62000000-0000-4000-8000-000000000004',tenant_id,id,template_version_id,data_source_id,repeat('b',64),
  '{"type":"sport_standing","sport":{"title":"Frozen v2","items":[]}}','ready',now()
from public.dynamic_slides where id='61000000-0000-4000-8000-000000001901';
update public.dynamic_slides set current_snapshot_id='62000000-0000-4000-8000-000000000004'
  where id='61000000-0000-4000-8000-000000001901';

select throws_ok($$update public.dynamic_slide_versions set name='Unsafe rewrite' where id='63000000-0000-4000-8000-000000001902'$$,
  '55000','published dynamic slide versions are immutable','publishing a successor never makes its configuration mutable');
select throws_ok($$delete from public.dynamic_slide_snapshots where id='62000000-0000-4000-8000-000000000001'$$,
  '55000','dynamic snapshot records are immutable','direct snapshot deletion remains forbidden');
insert into s190_prune_results values('slide-batch1',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1));
select is((select result->>'snapshotsDeleted' from s190_prune_results where label='slide-batch1'),'1','a large superseded version removes only one snapshot at a batch limit of one');
select is((select count(*) from public.dynamic_slide_versions where dynamic_slide_id='61000000-0000-4000-8000-000000001901'),2::bigint,'partially pruned version remains until its remaining snapshots are safely deleted');
select ok((select pending from private.publication_version_prune_queue where tenant_id='10000000-0000-4000-8000-000000001901'),
  'more obsolete snapshots keep bounded cleanup queued');
insert into s190_prune_results values('slide-batch2',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1));
insert into s190_prune_results values('slide-batch3',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',1));
select is((select count(*) from public.dynamic_slide_versions where dynamic_slide_id='61000000-0000-4000-8000-000000001901'),1::bigint,'obsolete prior design is actually removed after its last snapshot');
select is((select based_on_version_id from public.dynamic_slide_versions where id='63000000-0000-4000-8000-000000001902'),null::uuid,
  'obsolete ancestry is detached without retaining every prior design forever');
select is((select snapshot_data_json#>>'{sport,title}' from public.dynamic_slide_snapshots where id='62000000-0000-4000-8000-000000000004'),
  'Frozen v2','current published fallback payload is never rewritten');
select is((select max(version_number)+1 from public.dynamic_slide_versions where dynamic_slide_id='61000000-0000-4000-8000-000000001901'),3,
  'next design number remains monotone after prior history is removed');

-- An unreferenced dataset row may cascade, but a worker holding it must finish.
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,
  source_revision_hash,snapshot_data_json,status,completed_at)
select '62000000-0000-4000-8000-000000000005',tenant_id,id,template_version_id,data_source_id,repeat('c',64),
  '{"type":"sport_standing","sport":{"title":"Old source snapshot","items":[]}}','ready',now()
from public.dynamic_slides where id='61000000-0000-4000-8000-000000001901';
insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id,lease_token,lease_until)
values('10000000-0000-4000-8000-000000001901','62000000-0000-4000-8000-000000000005',
  '60000000-0000-4000-8000-000000001901','64000000-0000-4000-8000-000000001901',now()+interval '1 minute');
insert into s190_prune_results values('lease',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',25));
select is((select result->>'snapshotsDeleted' from s190_prune_results where label='lease'),'0','a leased live-data refresh protects the snapshot from a cascade race');
update private.published_data_refresh_queue set lease_token=null,lease_until=null
  where tenant_id='10000000-0000-4000-8000-000000001901' and snapshot_id='62000000-0000-4000-8000-000000000005';
insert into s190_prune_results values('unleased',public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000001901',25));
select is((select result->>'snapshotsDeleted' from s190_prune_results where label='unleased'),'1','unleased obsolete source snapshot is removed without a new slide version');
select is((select count(*) from private.published_data_refresh_queue where snapshot_id='62000000-0000-4000-8000-000000000005'),0::bigint,
  'obsolete unleased binding work cascades rather than becoming an orphan job');
update private.publication_version_prune_queue set pending=false where tenant_id='10000000-0000-4000-8000-000000001901';
update public.dynamic_data_sources set revision=revision+1 where id='60000000-0000-4000-8000-000000001901';
select ok((select not pending from private.publication_version_prune_queue where tenant_id='10000000-0000-4000-8000-000000001901'),
  'ordinary provider data refresh never enqueues configuration retention');
select ok(exists(select 1 from public.audit_events where tenant_id='10000000-0000-4000-8000-000000001901'
  and action='publication.superseded_versions.pruned' and metadata->'detachedBasis' <> '[]'::jsonb),
  'audit preserves removed ancestry before the old design record disappears');
select ok(not exists(select 1 from public.audit_events where action='publication.superseded_versions.pruned'
  and tenant_id='10000000-0000-4000-8000-000000001901' and metadata::text like '%Frozen v%'),
  'retention audit stores technical identities and provenance without source content');
select is((select count(*) from private.publication_version_prune_context),0::bigint,'all completed batches leave no deletion authorization behind');

delete from private.publication_version_prune_queue;
select is(public.prune_queued_publication_versions_v1(25)->>'status','idle','an empty queue is a lightweight idle poll');
insert into private.publication_version_prune_queue(tenant_id,pending)
  values('10000000-0000-4000-8000-000000001901',false);
select is(public.prune_queued_publication_versions_v1(25)->>'status','idle',
  'a recently checked quiet tenant does not create repeated cleanup work');
delete from public.content_schedules where id='53000000-0000-4000-8000-000000001901';
select ok((select not pending from private.publication_version_prune_queue
  where tenant_id='10000000-0000-4000-8000-000000001901'),
  'removing a schedule pin does not require another publication or source update');
update private.publication_version_prune_queue set updated_at=statement_timestamp()-interval '11 minutes'
  where tenant_id='10000000-0000-4000-8000-000000001901';
insert into s190_prune_results values('resweep',public.prune_queued_publication_versions_v1(25));
select is((select result->>'releasesDeleted' from s190_prune_results where label='resweep'),'1',
  'the bounded safety resweep removes a prior release after its last schedule pin is removed');
select is((select result->>'resweep' from s190_prune_results where label='resweep'),'true',
  'one quiet tenant is rechecked after the ten-minute interval');
select is(public.prune_queued_publication_versions_v1(25)->>'status','idle',
  'completed resweep resets the quiet interval instead of keeping the hint busy');
select * from finish();
rollback;
