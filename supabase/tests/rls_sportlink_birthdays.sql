begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(48);

select ok((select bool_and(relrowsecurity and relforcerowsecurity)
  from pg_catalog.pg_class where oid=any(array[
    'public.sportlink_birthdays'::regclass,'public.sportlink_team_members'::regclass,
    'public.sportlink_birthday_imports'::regclass,'public.sportlink_birthday_enrichments'::regclass,
    'public.sportlink_birthday_import_changes'::regclass,'public.sportlink_birthday_manual_links'::regclass
  ])), 'all birthday tables force RLS');
select ok(not has_table_privilege('anon','public.sportlink_birthdays','SELECT')
  and not has_table_privilege('authenticated','public.sportlink_birthdays','INSERT')
  and not has_table_privilege('authenticated','public.sportlink_birthday_enrichments','INSERT'),
  'browser roles cannot bypass guarded writes');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000001281','authenticated','authenticated','birthday-owner@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001282','authenticated','authenticated','birthday-viewer@test.invalid','x',now(),now(),now(),'{}','{}'),
('00000000-0000-4000-8000-000000001283','authenticated','authenticated','birthday-other@test.invalid','x',now(),now(),now(),'{}','{}');
insert into public.profiles(id,display_name) values
('00000000-0000-4000-8000-000000001281','Birthday owner'),
('00000000-0000-4000-8000-000000001282','Birthday viewer'),
('00000000-0000-4000-8000-000000001283','Birthday other');
insert into public.tenants(id,name,slug) values
('10000000-0000-4000-8000-000000001281','Birthday tenant','birthday-tenant'),
('10000000-0000-4000-8000-000000001282','Other birthday tenant','other-birthday-tenant');
insert into public.tenant_settings(tenant_id) values
('10000000-0000-4000-8000-000000001281'),('10000000-0000-4000-8000-000000001282');
insert into public.tenant_memberships(tenant_id,user_id,role) values
('10000000-0000-4000-8000-000000001281','00000000-0000-4000-8000-000000001281','tenant_owner'),
('10000000-0000-4000-8000-000000001281','00000000-0000-4000-8000-000000001282','tenant_viewer'),
('10000000-0000-4000-8000-000000001282','00000000-0000-4000-8000-000000001283','tenant_owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
select lives_ok($$select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001281','Sportlink · Jarig','Jarig SV',
  '1234','encrypted-value','initialization-vector','authentication-tag')$$,'owner creates encrypted connection');
select ok((select enabled from public.tenant_feature_flags where tenant_id='10000000-0000-4000-8000-000000001281' and flag_key='sportlink_birthdays'),
  'active connection receives birthday entitlement');
select lives_ok($$select public.activate_sportlink_birthdays_v1(
  (select id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000001281'),true)$$,
  'owner activates birthdays using Client ID only');
select ok((select privacy_birthdays_enabled and not privacy_people_enabled
  from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000001281'),
  'birthday privacy switch is independent from people token scope');
select is((select frequency from public.sportlink_sync_policies where tenant_id='10000000-0000-4000-8000-000000001281' and dataset_group='public_people'),'daily',
  'birthday synchronization is daily');
reset role;
update public.sportlink_sync_policies set last_success_at=now()
where tenant_id='10000000-0000-4000-8000-000000001281' and dataset_group='public_people';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
select ok(public.get_sportlink_birthday_status_v1(
  (select id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000001281')
)#>'{lastSuccessAt}'='null'::jsonb,
  'generic public_people success is not reported as birthday success');
select throws_ok($$select public.create_sportlink_birthday_slide_v1(
  '10000000-0000-4000-8000-000000001281',
  (select data_source_id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000001281'),
  'Te vroeg',
  (select current_published_version_id from public.dynamic_templates where slide_type='sport_birthdays' and status='published' and orientation='landscape'),
  '{"schemaVersion":1,"title":"Verjaardagen","emptyBehavior":"skip","period":{"mode":"next_7_days","days":7},"selection":{"emphasizeToday":true,"includeWithoutTeam":true,"includeUnknownRoles":true,"nameMode":"full","roleFilter":"all","selectedRoles":[],"selectedTeamIds":[],"showAge":true,"showDate":true,"showDayOfWeek":true,"showPhoto":true,"showRole":true,"showTeam":true,"teamSelectionMode":"all"},"presentation":{"backgroundColor":"#111827","backgroundMediaAssetId":null,"cardStyle":"glass","confetti":true,"gradientOverlay":true,"layout":"auto","logoPosition":"top_left","maxPerLandscapePage":4,"maxPerPortraitPage":3,"motion":true,"pageDurationSeconds":8,"radius":"lg","textAlign":"left","themeMode":"dark","useTenantTheme":true}}')$$,
  '55000','sportlink_birthdays_sync_required',
  'server rejects a birthday slide before the first successful sync');

reset role;
update public.sportlink_sync_policies set enabled=(dataset_group='public_people'),next_sync_at=now()
where tenant_id='10000000-0000-4000-8000-000000001281';
create temporary table birthday_test_ids(name text primary key,id uuid not null);
grant select,insert on birthday_test_ids to service_role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
insert into birthday_test_ids select 'run',run_id from public.claim_due_sportlink_sync_v2('worker:birthday',900);
select is((select count(*) from birthday_test_ids where name='run'),1::bigint,'worker claims one birthday lease');
select is((public.complete_sportlink_birthdays_v1(
  (select id from birthday_test_ids where name='run'),'worker:birthday',
  jsonb_build_array(
    jsonb_build_object('externalId',repeat('b',40),'displayName','Sam de Wit','normalizedName','sam de wit','month',extract(month from current_date+1)::integer,'day',extract(day from current_date+1)::integer,'nextOccurrence',(current_date+1)::text,'matchStatus','matched','memberIdentityKey',repeat('a',40),'role','Speler','teamAssignments',jsonb_build_array(jsonb_build_object('externalId','team-1','name','JO17-1'))),
    jsonb_build_object('externalId',repeat('c',40),'displayName','Alex Jansen','normalizedName','alex jansen','month',extract(month from current_date+2)::integer,'day',extract(day from current_date+2)::integer,'nextOccurrence',(current_date+2)::text,'matchStatus','ambiguous','teamAssignments','[]'::jsonb)
  ),
  jsonb_build_array(
    jsonb_build_object('identityKey',repeat('a',40),'externalMemberCode','M1','displayName','Sam de Wit','normalizedName','sam de wit','role','Speler','teamAssignments',jsonb_build_array(jsonb_build_object('externalId','team-1','name','JO17-1'))),
    jsonb_build_object('identityKey',repeat('d',40),'externalMemberCode','M2','displayName','Alex Jansen','normalizedName','alex jansen','role','Trainer','teamAssignments',jsonb_build_array(jsonb_build_object('externalId','team-2','name','1e elftal'))),
    jsonb_build_object('identityKey',repeat('e',40),'externalMemberCode','M3','displayName','Alex Jansen','normalizedName','alex jansen','role','Leider','teamAssignments',jsonb_build_array(jsonb_build_object('externalId','team-3','name','JO11-2')))
  ),'[]'::jsonb,now()
)->>'outcome'),'succeeded','valid minimized batch completes');
reset role;
select is((select count(*) from public.sportlink_birthdays where active),2::bigint,'two normalized birthdays are Last Known Good');
select is((select count(*) from public.sportlink_birthdays where match_status='matched'),1::bigint,'unique exact name is enriched');
select is((select count(*) from public.sportlink_birthdays where match_status='ambiguous'),1::bigint,'duplicate exact name remains ambiguous');

insert into public.sportlink_sync_runs(id,tenant_id,connection_id,dataset_group,status,worker_id,locked_at) values
('40000000-0000-4000-8000-000000001282','10000000-0000-4000-8000-000000001281',(select id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000001281'),'public_people','running','worker:retry',now());
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select is((public.complete_sportlink_birthdays_v1(
  '40000000-0000-4000-8000-000000001282','worker:retry',
  jsonb_build_array(
    jsonb_build_object('externalId',repeat('b',40),'displayName','Sam de Wit','normalizedName','sam de wit','month',extract(month from current_date+1)::integer,'day',extract(day from current_date+1)::integer,'nextOccurrence',(current_date+1)::text,'matchStatus','matched','memberIdentityKey',repeat('a',40),'role','Speler','teamAssignments','[]'::jsonb),
    jsonb_build_object('externalId',repeat('c',40),'displayName','Alex Jansen','normalizedName','alex jansen','month',extract(month from current_date+2)::integer,'day',extract(day from current_date+2)::integer,'nextOccurrence',(current_date+2)::text,'matchStatus','ambiguous','teamAssignments','[]'::jsonb)
  ),jsonb_build_array(
    jsonb_build_object('identityKey',repeat('a',40),'externalMemberCode','M1','displayName','Sam de Wit','normalizedName','sam de wit','role','Speler','teamAssignments','[]'::jsonb),
    jsonb_build_object('identityKey',repeat('d',40),'externalMemberCode','M2','displayName','Alex Jansen','normalizedName','alex jansen','role','Trainer','teamAssignments',jsonb_build_array(jsonb_build_object('externalId','team-2','name','1e elftal'))),
    jsonb_build_object('identityKey',repeat('e',40),'externalMemberCode','M3','displayName','Alex Jansen','normalizedName','alex jansen','role','Leider','teamAssignments','[]'::jsonb)
  ),'[]'::jsonb,now())->>'outcome'),'succeeded','retry batch upserts idempotently');
reset role;
select is((select count(*) from public.sportlink_birthdays where active),2::bigint,'retry creates no duplicate birthday');

insert into public.sportlink_sync_runs(id,tenant_id,connection_id,dataset_group,status,worker_id,locked_at) values
('40000000-0000-4000-8000-000000001283','10000000-0000-4000-8000-000000001281',(select id from public.sportlink_connections where tenant_id='10000000-0000-4000-8000-000000001281'),'public_people','running','worker:invalid',now());
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$select public.complete_sportlink_birthdays_v1(
  '40000000-0000-4000-8000-000000001283','worker:invalid','[{"externalId":"bad"}]','[]','[]',now())$$,
  '22023',null,'invalid response is rejected before LKG mutation');
reset role;
select is((select count(*) from public.sportlink_birthdays where active),2::bigint,'failed sync retains Last Known Good');
select ok(not has_function_privilege('authenticated','public.complete_sportlink_birthdays_v1(uuid,text,jsonb,jsonb,jsonb,timestamptz)','execute'),
  'browser cannot complete worker sync');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
select is(((public.get_sportlink_birthday_status_v1((select id from public.sportlink_connections limit 1))#>>'{counts,birthdays}')::integer),2,'safe status reports count without names');
select lives_ok($$select public.resolve_sportlink_birthday_match_v1(
  (select id from public.sportlink_birthdays where normalized_name='alex jansen'),
  (select id from public.sportlink_team_members where normalized_name='alex jansen' order by identity_key limit 1))$$,
  'manager resolves an ambiguous exact identity manually');
select is((select match_status from public.sportlink_birthdays where normalized_name='alex jansen'),'manual','manual provenance wins');

select is((public.apply_sportlink_birthday_import_v1(
  '10000000-0000-4000-8000-000000001281',(select id from public.sportlink_connections limit 1),
  '60000000-0000-4000-8000-000000001281','birthdays.csv',repeat('f',64),
  jsonb_build_array(
    jsonb_build_object('rowNumber',2,'status','valid','errors','[]'::jsonb,'normalized',jsonb_build_object('displayName','Sam de Wit','normalizedName','sam de wit','externalMemberCode','M1','birthYear',2000,'birthMonth',null,'birthDay',null,'team','JO17-1','role','Speler')),
    jsonb_build_object('rowNumber',3,'status','invalid','errors',jsonb_build_array('1900 is verboden'),'normalized',jsonb_build_object('displayName','Onbekend','normalizedName','onbekend','externalMemberCode',null,'birthYear',null,'birthMonth',null,'birthDay',null,'team',null,'role',null))
  ))#>>'{valid}')::integer,1,'one reliable birth year is merged');
select is((select invalid_count from public.sportlink_birthday_imports limit 1),1,'invalid import row is reported');
select is((select count(*) from public.sportlink_birthday_enrichments where birth_year=1900),0::bigint,'fictitious year 1900 is never stored');
select ok((public.apply_sportlink_birthday_import_v1(
  '10000000-0000-4000-8000-000000001281',(select id from public.sportlink_connections limit 1),
  '60000000-0000-4000-8000-000000001281','birthdays.csv',repeat('f',64),'[]')#>>'{idempotent}')::boolean,
  'same import key is idempotent');
select is(((public.get_sportlink_birthday_status_v1((select id from public.sportlink_connections limit 1))#>>'{counts,knownAge}')::integer),1,'status reports reliable age coverage');
select ok((public.get_sportlink_birthday_preview_v1((select id from public.sportlink_connections limit 1))->0->>'age')::integer = extract(year from current_date+1)::integer-2000
  and public.get_sportlink_birthday_preview_v1((select id from public.sportlink_connections limit 1))::text not like '%birthYear%'
  and public.get_sportlink_birthday_preview_v1((select id from public.sportlink_connections limit 1))::text not like '%externalMemberCode%',
  'Control preview receives calculated age but never private birth year or member code');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001282',true);
select is((select count(*) from public.sportlink_birthdays),2::bigint,'tenant viewer may read display birthdays');
select is((select count(*) from public.sportlink_birthday_enrichments),0::bigint,'viewer cannot read birth years');
select is((select count(*) from public.sportlink_team_members),0::bigint,'viewer cannot read matching identities');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001283',true);
select is((select count(*) from public.sportlink_birthdays),0::bigint,'other tenant cannot read birthdays');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
select lives_ok($$select public.request_sportlink_birthday_sync_v1((select id from public.sportlink_connections limit 1))$$,'manager requests manual sync');
select throws_ok($$select public.request_sportlink_birthday_sync_v1((select id from public.sportlink_connections limit 1))$$,'55000',null,'manual sync is rate limited');
reset role;
select is((select count(*) from public.dynamic_templates where slide_type='sport_birthdays' and status='published'),2::bigint,'one fallback template per orientation is published');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
select lives_ok($$select public.create_sportlink_birthday_slide_v1(
  '10000000-0000-4000-8000-000000001281',
  (select data_source_id from public.sportlink_connections limit 1),'Verjaardagen',
  (select current_published_version_id from public.dynamic_templates where slide_type='sport_birthdays' and status='published' and orientation='landscape'),
  '{"schemaVersion":1,"title":"Verjaardagen","emptyBehavior":"skip","period":{"mode":"next_7_days","days":7},"selection":{"emphasizeToday":true,"includeUnknownRoles":true,"nameMode":"full","roleFilter":"all","selectedRoles":[],"selectedTeamIds":[],"showAge":true,"showDate":true,"showDayOfWeek":true,"showPhoto":true,"showRole":true,"showTeam":true},"presentation":{"backgroundColor":"#111827","backgroundMediaAssetId":null,"cardStyle":"glass","confetti":true,"gradientOverlay":true,"layout":"auto","logoPosition":"top_left","maxPerLandscapePage":4,"maxPerPortraitPage":3,"motion":true,"pageDurationSeconds":8,"radius":"lg","textAlign":"left","themeMode":"dark","useTenantTheme":true}}')$$,
  'manager creates canonical birthday slide and first snapshot');
select ok((select snapshot_data_json::text not like '%birthYear%' and snapshot_data_json::text not like '%externalMemberCode%' from public.dynamic_slide_snapshots order by created_at desc limit 1),
  'Player snapshot never contains birth year or member code');
select ok((select (snapshot_data_json#>'{sport,birthdays,0}') ? 'age' from public.dynamic_slide_snapshots order by created_at desc limit 1),
  'Player snapshot contains only calculated age when needed');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
create temporary table birthday_render_claim as
select * from public.claim_dynamic_render_job_v1('birthday-render-worker',120,10);
do $$
declare claimed record;
begin
  select claim.* into strict claimed
  from birthday_render_claim claim
  join public.dynamic_slide_snapshots snapshot on snapshot.id=claim.snapshot_id
  join public.dynamic_slides slide on slide.id=snapshot.dynamic_slide_id
  where slide.slide_type='sport_birthdays';
  perform public.complete_dynamic_render_job_v1(
    claimed.job_id,'birthday-render-worker',
    'tenants/'||claimed.tenant_id::text||'/assets/'||
      claimed.output_media_asset_id::text||'/dynamic-slide.png',
    4096,repeat('8',64),1920,1080
  );
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
insert into public.playlists(id,tenant_id,name,created_by) values(
  '50000000-0000-4000-8000-000000001281',
  '10000000-0000-4000-8000-000000001281','Verjaardagen op scherm',
  '00000000-0000-4000-8000-000000001281'
);
select lives_ok($$select public.add_dynamic_slide_to_playlist_v2(
  '50000000-0000-4000-8000-000000001281',
  (select id from public.dynamic_slides where slide_type='sport_birthdays' limit 1),
  0,5,'90000000-0000-4000-8000-000000001281')$$,
  'birthday slide enters Playlist Studio with automatic minimum duration');
select is((select duration_seconds from public.playlist_items
  where playlist_id='50000000-0000-4000-8000-000000001281'),8,
  'playlist duration cannot be shorter than one complete birthday page');

reset role;
insert into public.dynamic_slide_snapshots(
  id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,
  source_revision_hash,snapshot_data_json,status,output_media_asset_id
)
select
  '40000000-0000-4000-8000-000000001284',slide.tenant_id,slide.id,
  slide.template_version_id,slide.data_source_id,repeat('9',64),
  jsonb_build_object(
    'type','sport_birthdays','sport',jsonb_build_object(
      'birthdays',(select jsonb_agg(jsonb_build_object(
        'displayName','Persoon '||sequence,'displayDate',current_date::text
      )) from generate_series(1,7) sequence),
      'configuration',slide.configuration_json
    )
  ),'queued',snapshot.output_media_asset_id
from public.dynamic_slides slide
join public.dynamic_slide_snapshots snapshot on snapshot.id=slide.current_snapshot_id
where slide.slide_type='sport_birthdays' limit 1;
update public.dynamic_slide_snapshots
set status='ready',completed_at=now()
where id='40000000-0000-4000-8000-000000001284';
select is((select duration_seconds from public.playlist_items
  where playlist_id='50000000-0000-4000-8000-000000001281'),24,
  'new Last Known Good snapshot expands duration for all portrait pages');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001281',true);
select lives_ok($$select public.rollback_sportlink_birthday_import_v1((select id from public.sportlink_birthday_imports limit 1))$$,'last import rolls back safely');
select is((select count(*) from public.sportlink_birthday_enrichments),0::bigint,'rollback removes only imported enrichment');
select ok((select coalesce(bool_and(event.metadata::text not like '%Sam de Wit%' and event.metadata::text not like '%Alex Jansen%'),true) from public.audit_events event where event.action like 'sportlink.birthdays.%'),
  'technical birthday audit metadata contains no names');

select lives_ok($$select public.create_sportlink_birthday_slide_v1(
  '10000000-0000-4000-8000-000000001281',
  (select data_source_id from public.sportlink_connections limit 1),'Verjaardagen zonder team',
  (select current_published_version_id from public.dynamic_templates where slide_type='sport_birthdays' and status='published' and orientation='landscape'),
  '{"schemaVersion":1,"title":"Verjaardagen","emptyBehavior":"skip","period":{"mode":"next_7_days","days":7},"selection":{"emphasizeToday":true,"includeWithoutTeam":true,"includeUnknownRoles":true,"nameMode":"full","roleFilter":"all","selectedRoles":[],"selectedTeamIds":[],"showAge":true,"showDate":true,"showDayOfWeek":true,"showPhoto":true,"showRole":true,"showTeam":false,"teamSelectionMode":"selected"},"presentation":{"backgroundColor":"#111827","backgroundMediaAssetId":null,"cardStyle":"glass","confetti":true,"gradientOverlay":true,"layout":"auto","logoPosition":"top_left","maxPerLandscapePage":4,"maxPerPortraitPage":3,"motion":true,"pageDurationSeconds":8,"radius":"lg","textAlign":"left","themeMode":"dark","useTenantTheme":true}}')$$,
  'manager creates a birthday slide for people without a team');
select ok((select
    jsonb_array_length(snapshot.snapshot_data_json#>'{sport,birthdays}')=1
    and snapshot.snapshot_data_json#>>'{sport,birthdays,0,displayName}'='Sam de Wit'
    and snapshot.snapshot_data_json#>'{sport,birthdays,0,teamIds}'='[]'::jsonb
  from public.dynamic_slide_snapshots snapshot
  join public.dynamic_slides slide on slide.id=snapshot.dynamic_slide_id
  where slide.name='Verjaardagen zonder team'
  order by snapshot.created_at desc limit 1),
  'without-team selection contains only unassigned people and explicit metadata');

select lives_ok($$select public.create_sportlink_birthday_slide_v1(
  '10000000-0000-4000-8000-000000001281',
  (select data_source_id from public.sportlink_connections limit 1),'Verjaardagen team verborgen',
  (select current_published_version_id from public.dynamic_templates where slide_type='sport_birthdays' and status='published' and orientation='landscape'),
  '{"schemaVersion":1,"title":"Verjaardagen","emptyBehavior":"skip","period":{"mode":"next_7_days","days":7},"selection":{"emphasizeToday":true,"includeWithoutTeam":false,"includeUnknownRoles":true,"nameMode":"full","roleFilter":"all","selectedRoles":[],"selectedTeamIds":["team-2"],"showAge":true,"showDate":true,"showDayOfWeek":true,"showPhoto":true,"showRole":true,"showTeam":false,"teamSelectionMode":"selected"},"presentation":{"backgroundColor":"#111827","backgroundMediaAssetId":null,"cardStyle":"glass","confetti":true,"gradientOverlay":true,"layout":"auto","logoPosition":"top_left","maxPerLandscapePage":4,"maxPerPortraitPage":3,"motion":true,"pageDurationSeconds":8,"radius":"lg","textAlign":"left","themeMode":"dark","useTenantTheme":true}}')$$,
  'manager creates a selected-team birthday slide with hidden labels');
select ok((select
    jsonb_array_length(snapshot.snapshot_data_json#>'{sport,birthdays}')=1
    and snapshot.snapshot_data_json#>>'{sport,birthdays,0,displayName}'='Alex Jansen'
    and snapshot.snapshot_data_json#>'{sport,birthdays,0,teamIds}'='["team-2"]'::jsonb
    and snapshot.snapshot_data_json#>'{sport,birthdays,0,teams}'='[]'::jsonb
  from public.dynamic_slide_snapshots snapshot
  join public.dynamic_slides slide on slide.id=snapshot.dynamic_slide_id
  where slide.name='Verjaardagen team verborgen'
  order by snapshot.created_at desc limit 1),
  'hidden team labels retain private-free filter metadata for Player');

select * from finish();
rollback;
