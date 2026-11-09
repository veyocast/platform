begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000000301','Source recovery A','season-s301-a'),
 ('10000000-0000-4000-8000-000000000302','Source recovery B','season-s301-b');
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('season-s301-a','season-s301-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000301','consistency-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000302','consistency-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000303','consistency-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000301','Owner A'),('00000000-0000-4000-8000-000000000302','Owner B'),('00000000-0000-4000-8000-000000000303','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000301','tenant_owner'),
 ('10000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000302','tenant_owner'),
 ('10000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000303','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000301','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000302','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000302');
grant select on own_source to authenticated;

create function pg_temp.seed() returns jsonb language sql immutable as $$select $seed${"schemaVersion":1,"rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","family":"matchday","orientation":"landscape","theme":"onzetrots-tv","name":"Onze wedstrijddag","club":{"name":"Eigen club","tagline":""},"title":"WEDSTRIJDDAG","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":6,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"rustig","background":"clubmuur","backgroundPosition":"center","font":"Brush","fontChanged":true,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true},"visual":{"schemaVersion":1,"mode":"light","scrollSpeed":"normal","panelOpacity":94},"authoring":{"schemaVersion":1,"visualRevision":"onzetrots-20261024","headerSubtitles":{},"headerTexts":{},"welcomeScalePercent":150}}$seed$::jsonb$$;
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name) select tenant_id,id,'own-club','Own club' from own_source;
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select tenant_id,id,team_id,name,'{"competitionOptions":[{"externalId":"league","poolExternalId":"701","poolName":"C","period":"phase","season":null},{"externalId":"cup","poolExternalId":"702","poolName":"B","period":"cup-phase","season":null}]}'from own_source cross join(values('own-team','Own team'),('own-team-2','Own team 2'))teams(team_id,name);
insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,scores_published,rows_json,metadata)
select tenant_id,id,competition,pool,'unknown',true,'[{"externalId":"own-team","teamName":"Own team","position":1,"played":1,"won":1,"drawn":0,"lost":0,"goalDifference":2,"points":3,"form":["W"]}]',jsonb_build_object('competition',jsonb_build_object('externalId',competition,'period',phase),'pool',jsonb_build_object('externalId',pool,'competitionExternalId',competition))from own_source cross join(values('league','701','phase'),('cup','702','cup-phase'))p(competition,pool,phase);
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,is_home_match)
select s.tenant_id,s.id,f.id,now()+make_interval(days=>f.days),f.status,
 jsonb_build_object('externalId',f.home,'name','Own team','score',2),jsonb_build_object('externalId',f.away,'name','Opponent','score',1),
 '{"externalId":"league","period":"phase","season":null}',jsonb_build_object('externalId',encode(extensions.digest(convert_to('pool-context','UTF8')||decode('00','hex')||convert_to('league|C','UTF8'),'sha256'),'hex'),'name','C','competitionExternalId','league'),true,false
from own_source s cross join(values('home',1,'scheduled','own-team','other'),('away',2,'scheduled','other','own-team'),('internal',3,'scheduled','own-team','own-team-2'),('neutral',2,'scheduled','own-team','other'),('lookalike',1,'scheduled','other','external'),('far',8,'scheduled','own-team','other'),('result-home',-1,'finished','own-team','other'),('result-away',-1,'finished','other','own-team'),('result-internal',-2,'finished','own-team','own-team-2'))f(id,days,status,home,away);
create function pg_temp.context() returns jsonb language sql immutable as $$select '{"providerTeamId":"own-team","competitionSelectionMode":"auto_current","competitionId":null,"phaseId":null,"poolId":null,"seasonId":null}'::jsonb$$;
create function pg_temp.config(family text,kind text,direction text default 'both',days integer default 7)returns jsonb language sql stable as $$
 select jsonb_build_object('schemaVersion',1,'maxItems',200,'context',pg_temp.context(),
 'teamSelection',jsonb_build_object('mode','selected','teamContexts',jsonb_build_array(pg_temp.context()),'matchLocation',direction),
 'syncConfiguration',jsonb_build_object('schemaVersion',1,'kind','dynamic','rendererVersion','sync-onzetrots-v9','sourceRevision','5ba52a657d6d16ad103ba2fb43b8db18aa83715a','slideType',kind,'secondsPerPage',5,'seed',jsonb_set(pg_temp.seed(),'{family}',to_jsonb(family))))
 ||case when kind='sport_program'then jsonb_build_object('blueprintKey',case when family='pool-program'then'sportlink.pool_schedule_next_7_days'else'sportlink.club_schedule_next_7_days'end)
 when kind='sport_results'then jsonb_build_object('blueprintKey',case when family='pool-results'then'sportlink.pool_results_previous_7_days'else'sportlink.club_results_previous_7_days'end)
 when kind='sport_visitor_arrivals'then jsonb_build_object('blueprintKey','sportlink.visitor_arrivals','teamContexts',jsonb_build_array(pg_temp.context()),'arrival',jsonb_build_object('minutesBefore',days*1440,'minutesAfter',0,'emptyBehavior','skip')) else '{}'::jsonb end
$$;
create function pg_temp.dynamic(family text,kind text,direction text default 'both',days integer default 7)returns public.dynamic_slides language sql stable as $$
 select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id','60000000-0000-4000-8000-000000000301','tenant_id',tenant_id,'name','Controlled source','slide_type',kind,'orientation','landscape','data_source_id',data_source_id,'configuration_json',pg_temp.config(family,kind,direction,days)))from own_source where tenant_id='10000000-0000-4000-8000-000000000301'
$$;

update public.sports_teams set name='Same visible name',team_type='field',metadata='{"competitionOptions":[
 {"externalId":"old-league","name":"League","poolExternalId":"701","poolName":"Old pool","period":"old-phase","season":"2025","type":"league","level":"2"},
 {"externalId":"new-league","name":"League","poolExternalId":"801","poolName":"New pool","period":"new-phase","season":"2026","type":"league","level":"2"},
 {"externalId":"new-cup","name":"League","poolExternalId":"802","poolName":"New pool","period":"cup-phase","season":"2026","type":"cup","level":"2"}]}'::jsonb;
update public.sports_matches set competition='{"externalId":"old-league","period":"old-phase","season":"2025"}',
 pool='{"externalId":"701","competitionExternalId":"old-league"}';
update public.sportlink_sync_policies set last_success_at=now(),next_sync_at=now()+interval '1 day';
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,team_type,metadata)
select tenant_id,source_connection_id,'-1','Same visible name',team_type,metadata from public.sports_teams
 where source_connection_id=(select id from own_source where tenant_id='10000000-0000-4000-8000-000000000301')and external_id='own-team';
create or replace function pg_temp.context()returns jsonb language sql immutable as $$select
 '{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"old-league","phaseId":"old-phase","poolId":"701","seasonId":"2025"}'::jsonb$$;
create function pg_temp.destination(team text default 'own-team')returns jsonb language sql immutable as $$select
 jsonb_build_object('providerTeamId',team,'competitionSelectionMode','pinned','competitionId','new-league',
  'phaseId','new-phase','poolId','801','seasonId','2026')$$;
create temporary table facts(key text primary key,value jsonb);
grant all on facts to authenticated;
create function pg_temp.source_id()returns uuid language sql stable as $$select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000301'$$;
create function pg_temp.connection_id()returns uuid language sql stable as $$select id from own_source where tenant_id='10000000-0000-4000-8000-000000000301'$$;
create function pg_temp.create_design(label text,kind text,configuration jsonb)returns jsonb language plpgsql as $$
declare result jsonb;template_id uuid;
begin
 select current_published_version_id into template_id from public.dynamic_templates
  where slide_type=kind and orientation='landscape'and status='published'order by id limit 1;
 result:=public.create_dynamic_slide_v1('10000000-0000-4000-8000-000000000301',label,template_id,pg_temp.source_id(),'latest',configuration);
 insert into facts values(label,result);
 return result;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select public.set_sync_dom_rollout_v2('10000000-0000-4000-8000-000000000301',true,repeat('a',40));
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.create_design('Matchday','sport_match_of_the_day',pg_temp.config('matchday','sport_match_of_the_day','home')||'{"syncPlaybackProtocol":2,"customSetting":{"preserve":"yes"}}');
select pg_temp.create_design('Multi','sport_results',jsonb_set(pg_temp.config('club-results','sport_results','away'),'{teamSelection,teamContexts}',
 jsonb_build_array(pg_temp.context(),jsonb_set(pg_temp.context(),'{providerTeamId}','"own-team-2"'))));
select pg_temp.create_design('Broad','sport_results',jsonb_set(pg_temp.config('club-results','sport_results'),'{teamSelection}',
 '{"mode":"all","teamContexts":[],"matchLocation":"both"}'));
select pg_temp.create_design('Legacy','sport_standing',jsonb_build_object('schemaVersion',1,'maxItems',20,'context',pg_temp.context(),'blueprintKey','sportlink.pool_standings'));
reset role;
insert into public.media_assets(id,tenant_id,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height)
values('e3010000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000301','image','Season fallback','fixture.png','image/png','ready',
 'tenants/10000000-0000-4000-8000-000000000301/assets/e3010000-0000-4000-8000-000000000002/original.png',100,repeat('b',64),1920,1080);
insert into public.media_variants(id,tenant_id,asset_id,variant_type,storage_path,mime_type,file_size_bytes,checksum_sha256,width,height)
select 'e3010000-0000-4000-8000-000000000003',tenant_id,id,'original',storage_path,mime_type,file_size_bytes,checksum_sha256,width,height
 from public.media_assets where id='e3010000-0000-4000-8000-000000000002';
-- A real frozen published basis, assembled as a worker-completed fixture.
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,dynamic_slide_version_id,
 source_revision_hash,snapshot_data_json,status,completed_at,output_media_asset_id)
select 'e3010000-0000-4000-8000-000000000001',slide.tenant_id,slide.id,slide.template_version_id,slide.data_source_id,
 (select id from public.dynamic_slide_versions where dynamic_slide_id=slide.id),repeat('a',64),private.build_dynamic_snapshot_data(slide),'ready',now(),'e3010000-0000-4000-8000-000000000002'from public.dynamic_slides slide
 where slide.id=(select(value->>'slideId')::uuid from facts where key='Matchday');
update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id='e3010000-0000-4000-8000-000000000001'
 where dynamic_slide_id=(select(value->>'slideId')::uuid from facts where key='Matchday');
do $$declare design public.dynamic_slides%rowtype;snapshot_id uuid;begin
 for design in select slide.*from public.dynamic_slides slide join facts on slide.id=(facts.value->>'slideId')::uuid where facts.key in('Multi','Broad','Legacy')loop
  snapshot_id:=gen_random_uuid();
  insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,dynamic_slide_version_id,source_revision_hash,snapshot_data_json,status,completed_at,output_media_asset_id)
  values(snapshot_id,design.tenant_id,design.id,design.template_version_id,design.data_source_id,(select id from public.dynamic_slide_versions where dynamic_slide_id=design.id),repeat('a',64),private.build_dynamic_snapshot_data(design),'ready',now(),'e3010000-0000-4000-8000-000000000002');
  update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id=snapshot_id where dynamic_slide_id=design.id;
 end loop;
end$$;
update public.dynamic_slides slide set current_published_version_id=version.id,active_draft_version_id=null,
 current_snapshot_id=version.published_snapshot_id,status='ready'
 from public.dynamic_slide_versions version where version.tenant_id=slide.tenant_id and version.dynamic_slide_id=slide.id
 and version.status='published'and slide.tenant_id='10000000-0000-4000-8000-000000000301';
set local role authenticated;
select public.create_or_resume_dynamic_slide_version_v1((select(value->>'slideId')::uuid from facts where key='Multi'));
reset role;
insert into public.playlists(id,tenant_id,name)values
 ('e3010000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000301','Season playlist A'),
 ('e3010000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000301','Season playlist B');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3010000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000004',1,repeat('c',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,
 asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select tenant_id,'e3010000-0000-4000-8000-000000000004','e3010000-0000-4000-8000-000000000006',id,
 'e3010000-0000-4000-8000-000000000003',0,10,'contain',true,kind,title,storage_path,mime_type,file_size_bytes,checksum_sha256,
 'e3010000-0000-4000-8000-000000000001',false from public.media_assets where id='e3010000-0000-4000-8000-000000000002';
insert into public.screens(id,tenant_id,name,assigned_playlist_id,assigned_release_id,default_playlist_id,default_release_id)values
 ('e3010000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000301','Season screen',
 'e3010000-0000-4000-8000-000000000004','e3010000-0000-4000-8000-000000000006',
 'e3010000-0000-4000-8000-000000000004','e3010000-0000-4000-8000-000000000006');
insert into public.playlist_items(tenant_id,playlist_id,media_asset_id,sort_order,duration_seconds,fit_mode,muted,
 dynamic_slide_id,dynamic_snapshot_id,dynamic_selection_mode)
select '10000000-0000-4000-8000-000000000301',playlist,'e3010000-0000-4000-8000-000000000002',0,10,'contain',true,
 (select(value->>'slideId')::uuid from facts where key='Matchday'),'e3010000-0000-4000-8000-000000000001','pinned'
from unnest(array['e3010000-0000-4000-8000-000000000004'::uuid,'e3010000-0000-4000-8000-000000000005'::uuid])playlist;
insert into public.screen_compositions(id,tenant_id,screen_id,revision,configuration_json,published_by)values
 ('e3010000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000007',1,
 '{"schemaVersion":1,"orientation":"landscape","layout":"sidebar","mainWidthPercent":70,"bottomHeightPercent":25,"zones":[{"id":"main","playlistId":"e3010000-0000-4000-8000-000000000004"},{"id":"side","playlistId":"e3010000-0000-4000-8000-000000000004"}]}',
 '00000000-0000-4000-8000-000000000301');
insert into public.screen_composition_bindings(tenant_id,composition_id,zone_id,playlist_id,release_id,config_revision)
select '10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000008',zone,
 'e3010000-0000-4000-8000-000000000004','e3010000-0000-4000-8000-000000000006',1 from unnest(array['main','side'])zone;
update public.screens set composition_id='e3010000-0000-4000-8000-000000000008',composition_revision=1
where id='e3010000-0000-4000-8000-000000000007';
set local role authenticated;
select public.mutate_content_schedule_v2('10000000-0000-4000-8000-000000000301',null,0,'create',
 jsonb_build_object('name','Future recurring source','targetKind','screen','targetId','e3010000-0000-4000-8000-000000000007',
 'releaseId','e3010000-0000-4000-8000-000000000006','timezoneName','Europe/Amsterdam','source','publisher','priority',100,
 'scheduleKind','weekly','startsAt',now()+interval '1 day','endsAt',now()+interval '30 days',
 'recurrence',jsonb_build_object('weekdays',jsonb_build_array(1),'startTime','20:00','endTime','22:00'),'enabled',true),
 'e3010000-0000-4000-8000-000000000009');
reset role;
insert into public.player_devices(id,tenant_id,screen_id,token_hash,status)values
 ('e3010000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000007',repeat('d',64),'paired');
create function pg_temp.inventory(filters jsonb default '{"resourceKind":"dynamic_slide"}',cursor text default null,limit_rows int default 50)returns jsonb language sql stable as $$
 select public.get_sportlink_season_switch_inventory_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id(),'2026',filters,cursor,limit_rows)
$$;
create function pg_temp.row_for(label text)returns jsonb language sql stable as $$
 select value from jsonb_array_elements(pg_temp.inventory()->'rows')where value->>'resourceId'=(select value->>'slideId'from facts where key=label)
$$;
create function pg_temp.input_for(label text,nonce uuid default gen_random_uuid())returns jsonb language sql stable as $$
 select jsonb_build_object('resourceKind','dynamic_slide','resourceId',row_value->'resourceId','basisVersionId',row_value->'basisVersionId',
 'expectedRevision',row_value->'expectedRevision','oldBindingHash',row_value->'oldBindingHash','contextHash',row_value->'contextHash',
 'newSelection',jsonb_build_object('mappings',(select jsonb_agg(jsonb_build_object('fromProviderTeamId',binding->>'fromProviderTeamId',
  'context',pg_temp.destination(binding->>'fromProviderTeamId')))from jsonb_array_elements(row_value->'bindings')binding)),
 'clearSelectedMatches',false,'requestId',nonce,'correlationId','e3010000-0000-4000-8000-000000000099')
 from(select pg_temp.row_for(label)row_value)current_row
$$;
create temporary table original_state as select
 (select to_jsonb(release)from public.playlist_releases release where id='e3010000-0000-4000-8000-000000000006')release,
 (select to_jsonb(snapshot)from public.dynamic_slide_snapshots snapshot where id='e3010000-0000-4000-8000-000000000001')snapshot,
 (select to_jsonb(screen)from public.screens screen where id='e3010000-0000-4000-8000-000000000007')screen,
 (select jsonb_build_object('dataRevision',data_revision,'contentHash',content_hash,'data',data_json)from public.published_dynamic_data
  where snapshot_id='e3010000-0000-4000-8000-000000000001')published_data,
 public.get_player_effective_target_v1(repeat('d',64))->>'data_key'data_key,
 (select to_jsonb(version)from public.dynamic_slide_versions version where dynamic_slide_id=(select(value->>'slideId')::uuid from facts where key='Matchday'))published;
grant select on original_state to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
select is(jsonb_array_length(pg_temp.inventory()->'rows'),4,'SEI-01 one canonical row per design, including legacy and broad selections');
select is(pg_temp.inventory()->>'totalCount','4','full filtered count is independent of detail page size');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->'confirmedVersionId'<>'null'::jsonb),'configured publication, schedule, screen and zone versions are not claimed as Player-confirmed frames');
select is(pg_temp.row_for('Broad')->>'state','broad_unchanged','SEI-12 a broad all-team selection is never assigned a season');
select is((pg_temp.row_for('Broad')->>'canUpdate')::boolean,false,'broad unchanged selection is not selectable');
select is(pg_temp.row_for('Matchday')->>'state','available','SEI-01 one stable exact team context with matching qualifiers is a proposal');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{bindings,0,candidates}')candidate
 where candidate#>>'{context,competitionId}'='new-cup'),'SEI-02 a known league context never proposes the similarly named cup');
select is(pg_temp.row_for('Legacy')->>'state','available','explicit historical configuration participates without a Sync-only rewrite');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{bindings,0,candidates}')candidate
 where candidate#>>'{context,providerTeamId}'='-1'),'canonical string team identities are never restricted to positive digit-only codes');
select ok(not(pg_temp.row_for('Matchday')->'impact'?'reviewHash'),'internal review fingerprint is not an extra public payload field');
select is(pg_temp.inventory()#>>'{integration,matchdayRunbooks}',case when to_regclass('public.matchday_runbooks')is not null then'available'else'unavailable'end,'S300 integration accurately reports the installed private adapter');
select is(public.get_sportlink_season_switch_inventory_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id(),'2026')->'totalCount',case when to_regclass('public.matchday_runbooks')is not null then'4'::jsonb else'null'::jsonb end,
 'known runbooks permit an exact heterogeneous count; unavailable integration retains unknown');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')ref where ref->>'kind'='publication')
 and exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')ref where ref->>'kind'='screen'),
 'exact frozen release and desired/default screen impact are retained');
select is((pg_temp.row_for('Matchday')#>>'{impact,unknown}')::boolean,true,'unverified embedded-series and physical playback impact remain unknown');
select is((select count(*)from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')ref
 where ref->>'kind'='publication'and ref->>'state'='draft_playlist'),2::bigint,'one shared design reports both draft playlist references');
select is((select count(*)from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')ref where ref->>'kind'='zone'),2::bigint,
 'both composition zones retain exact immutable release dependencies');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')ref
 where ref->>'kind'='schedule'and ref->>'state'='recurring_schedule'),'future recurring schedule dependency is not lost');
select is(pg_temp.row_for('Matchday')#>>'{links,restore}','/dashboard/publications/e3010000-0000-4000-8000-000000000006',
 'SEI-10 old-publication link preserves the exact immutable recovery identity');
insert into facts values('page1',pg_temp.inventory('{"resourceKind":"dynamic_slide"}',null,2));
insert into facts values('page2',pg_temp.inventory('{"resourceKind":"dynamic_slide"}',(select value->>'nextCursor'from facts where key='page1'),2));
select is((select count(*)from facts first_page cross join lateral jsonb_array_elements(first_page.value->'rows')a
 join facts second_page on second_page.key='page2'cross join lateral jsonb_array_elements(second_page.value->'rows')b
 where first_page.key='page1'and a->>'resourceId'=b->>'resourceId'),0::bigint,'stable keyset pages do not repeat a design');
select is((select value->>'totalCount'from facts where key='page2'),'4','cursor never limits the full filtered count');
select throws_ok($$select pg_temp.inventory('{"resourceKind":"dynamic_slide","query":"different"}',(select value->>'nextCursor'from facts where key='page1'),2)$$,
 '22023',null,'cursor is bound to exact source/season/filters');
insert into facts values('command',pg_temp.input_for('Matchday'));
insert into facts values('before-read',jsonb_build_object('versions',(select count(*)from public.dynamic_slide_versions),
 'snapshots',(select count(*)from public.dynamic_slide_snapshots),'jobs',(select count(*)from public.dynamic_render_jobs),
 'audit',(select count(*)from public.audit_events),'receipts',(select count(*)from public.publisher_command_receipts)));
insert into facts values('preview',public.preview_sportlink_season_switch_v1('10000000-0000-4000-8000-000000000301',
 (select value-'requestId'-'correlationId'from facts where key='command')));
select is((select value->>'canApply'from facts where key='preview'),'true','exact verified preview may prepare a draft');
select ok((select value#>>'{preview,data,previewId}'is not null from facts where key='preview'),'preview reuses the original safe canonical envelope');
select is(jsonb_build_object('versions',(select count(*)from public.dynamic_slide_versions),
 'snapshots',(select count(*)from public.dynamic_slide_snapshots),'jobs',(select count(*)from public.dynamic_render_jobs),
 'audit',(select count(*)from public.audit_events),'receipts',(select count(*)from public.publisher_command_receipts)),
 (select value from facts where key='before-read'),'inventory and preview create no draft, snapshot, render, audit or receipt');
select is((select value#>>'{preview,state}'from facts where key='preview'),'empty','verified target identity without match facts has a legal empty preview');
select throws_ok($$select public.preview_sportlink_season_switch_v1('10000000-0000-4000-8000-000000000301',
 jsonb_set((select value-'requestId'-'correlationId'from facts where key='command'),'{newSelection,mappings,0,context,phaseId}','"wrong-phase"'))$$,
 '42501',null,'SEI-02 a wrong phase is never accepted through pool or name coincidence');
select throws_ok($$select public.preview_sportlink_season_switch_v1('10000000-0000-4000-8000-000000000301',
 jsonb_set((select value-'requestId'-'correlationId'from facts where key='command'),'{newSelection,mappings,0,context,poolId}','"foreign-pool"'))$$,
 '42501',null,'destination must be in the exact connection and tenant context');
select throws_ok($$select public.preview_sportlink_season_switch_v1('10000000-0000-4000-8000-000000000301',
 jsonb_set((select value-'requestId'-'correlationId'from facts where key='command'),'{newSelection,mappings,0,context,seasonId}','"2099"'))$$,
 '42501',null,'SEI-03 a season inferred only from the calendar is not observed source identity');
select throws_ok($$select public.get_sportlink_season_switch_inventory_v1('10000000-0000-4000-8000-000000000301',
 (select id from own_source where tenant_id='10000000-0000-4000-8000-000000000302'),'2026')$$,
 '42501',null,'INT-10 a foreign connection cannot be inventoried even with identical external team codes');
select throws_ok($$select pg_temp.inventory('{}',null,51)$$,'22023',null,'inventory page size is bounded server-side');
select throws_ok($$select public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value||'{"configuration":{"title":"overwrite"}}'from facts where key='command'))$$,
 '22023',null,'client cannot submit a replacement configuration outside binding fields');
select throws_ok($$select public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 jsonb_set(pg_temp.input_for('Multi'),'{newSelection,mappings}',jsonb_build_array(pg_temp.input_for('Multi')#>'{newSelection,mappings,0}')))$$,
 '22023',null,'multi-team selection must cover every original provider identity');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
select lives_ok($$select pg_temp.inventory()$$,'read-only actor can inspect permitted normalized source inventory');
select is((pg_temp.row_for('Matchday')->>'canUpdate')::boolean,false,'read-only inventory never implies draft write authority');
select is(public.preview_sportlink_season_switch_v1('10000000-0000-4000-8000-000000000301',
 (select value-'requestId'-'correlationId'from facts where key='command'))->>'canApply','false','viewer preview does not bypass the existing canonical preview write gate');
select throws_ok($$select public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='command'))$$,'42501',null,'viewer cannot write even when it knows exact hashes');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',true);
select throws_ok($$select pg_temp.inventory()$$,'42501',null,'tenant B cannot inspect tenant A inventory');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
select ok(not has_function_privilege('anon','public.apply_sportlink_season_switch_draft_v1(uuid,jsonb)','execute'),
 'anonymous cannot invoke the new write entrypoint');
select throws_ok($$select private.sportlink_season_contexts_s301_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id())$$,
 '42501',null,'private normalized context helper is not a browser privilege bypass');
insert into facts values('applied',public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='command')));
select is((select value->>'status'from facts where key='applied'),'applied','SEI-01 published basis creates and saves a new canonical draft');
select is((select(value->>'newRevision')::bigint from facts where key='applied'),
 (select edit_revision from public.dynamic_slide_versions where id=(select(value->>'draftVersionId')::uuid from facts where key='applied')),
 'acknowledgement uses the actual post-materialization canonical draft revision');
select ok((select value->>'draftVersionId'is not null and value->>'draftVersionId'<>value->>'previousVersionId'from facts where key='applied'),
 'published version is forked instead of mutated');
select is((select outcome_json from public.publisher_command_receipts where id=(select(value->>'receiptId')::uuid from facts where key='applied')),
 (select value from facts where key='applied'),'real receipt primary key and returned acknowledgement are identical');
select is((select configuration_json#>>'{context,seasonId}'from public.dynamic_slide_versions where id=(select(value->>'draftVersionId')::uuid from facts where key='applied')),
 '2026','draft has exact confirmed target season');
select is((select configuration_json#>>'{customSetting,preserve}'from public.dynamic_slide_versions where id=(select(value->>'draftVersionId')::uuid from facts where key='applied')),
 'yes','unrelated stored configuration remains intact');
select is((select configuration_json#>>'{teamSelection,matchLocation}'from public.dynamic_slide_versions where id=(select(value->>'draftVersionId')::uuid from facts where key='applied')),
 'home','strict own-team home/away setting remains intact');
select is((select to_jsonb(version)from public.dynamic_slide_versions version where id=(select(published->>'id')::uuid from original_state)),
 (select published from original_state),'SEI-09 original published version remains byte-equivalent');
select is((select to_jsonb(snapshot)from public.dynamic_slide_snapshots snapshot where id='e3010000-0000-4000-8000-000000000001'),
 (select snapshot from original_state),'old immutable snapshot remains byte-equivalent');
select is((select to_jsonb(release)from public.playlist_releases release where id='e3010000-0000-4000-8000-000000000006'),
 (select release from original_state),'active immutable release remains byte-equivalent');
select is((select to_jsonb(screen)from public.screens screen where id='e3010000-0000-4000-8000-000000000007'),
 (select screen from original_state),'draft save does not publish or change current/default screen assignments');
reset role;
select ok((select published_data is not null from original_state),'canary publication has a real live published-data binding');
select is((select jsonb_build_object('dataRevision',data_revision,'contentHash',content_hash,'data',data_json)from public.published_dynamic_data
 where snapshot_id='e3010000-0000-4000-8000-000000000001'),(select published_data from original_state),
 'SEI-09 old live projection revision/hash/data remain intact when the authoring draft changes');
select is(public.get_player_effective_target_v1(repeat('d',64))->>'data_key',(select data_key from original_state),
 'existing authorized device data key remains stable until explicit publication');
set local role authenticated;
select is((select competition->>'season'from public.sports_matches where tenant_id='10000000-0000-4000-8000-000000000301'and external_id='home'),
 '2025','SEI-05 a future kick-off retains its old canonical source season');
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='command')),
 (select value from facts where key='applied'),'exact retry returns before the old published revision and new active draft CAS');
select throws_ok($$select public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value||jsonb_build_object('correlationId',gen_random_uuid())from facts where key='command'))$$,
 '23505',null,'a different body under the same nonce is rejected');
insert into facts values('multi-command',pg_temp.input_for('Multi'));
reset role;
insert into facts values('hash-before',to_jsonb(private.sportlink_season_source_hash_s301_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id(),
 private.sportlink_season_contexts_s301_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id()))));
update public.sports_teams set name='Changed display label',last_synced_at=now()+interval '1 minute';
select is(private.sportlink_season_source_hash_s301_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id(),
 private.sportlink_season_contexts_s301_v1('10000000-0000-4000-8000-000000000301',pg_temp.connection_id())),
 (select value#>>'{}'from facts where key='hash-before'),'observation times and current labels are not source identity hash changes');
update public.sports_teams set metadata=jsonb_set(metadata,'{competitionOptions,1,period}','"changed-phase"')where source_connection_id=pg_temp.connection_id();
set local role authenticated;
insert into facts values('source-conflict',public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='multi-command')));
select is((select value->>'status'from facts where key='source-conflict'),'conflict','INT-09 a changed normalized candidate invalidates the reviewed hash');
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='command')),
 (select value from facts where key='applied'),'successful exact retry also precedes changed source context validation');
reset role;
update public.sports_teams set metadata=jsonb_set(metadata,'{competitionOptions,1,period}','"new-phase"')where source_connection_id=pg_temp.connection_id();
set local role authenticated;
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='multi-command')),
 (select value from facts where key='source-conflict'),'a recorded conflict retries identically; a new review needs a new request identity');
insert into facts values('publication-command',pg_temp.input_for('Multi'));
reset role;
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3010000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000005',1,repeat('d',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,
 asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select asset.tenant_id,'e3010000-0000-4000-8000-000000000005','e3010000-0000-4000-8000-000000000010',asset.id,
 'e3010000-0000-4000-8000-000000000003',0,10,'contain',true,asset.kind,asset.title,asset.storage_path,asset.mime_type,asset.file_size_bytes,asset.checksum_sha256,
 version.published_snapshot_id,false from public.media_assets asset cross join public.dynamic_slide_versions version
 where asset.id='e3010000-0000-4000-8000-000000000002'and version.dynamic_slide_id=(select(value->>'slideId')::uuid from facts where key='Multi')and version.status='published';
set local role authenticated;
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='publication-command'))->>'status','conflict','SEI-07 a newly published dependency invalidates the reviewed per-object context');
insert into facts values('multi-applied',public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',pg_temp.input_for('Multi')));
select is((select value->>'status'from facts where key='multi-applied'),'applied','existing checked draft is updated through canonical save');
select is((select jsonb_array_length(configuration_json#>'{teamSelection,teamContexts}')from public.dynamic_slide_versions
 where id=(select(value->>'draftVersionId')::uuid from facts where key='multi-applied')),2,'multi-team update preserves every selected team');
select is((select configuration_json#>>'{teamSelection,teamContexts,1,providerTeamId}'from public.dynamic_slide_versions
 where id=(select(value->>'draftVersionId')::uuid from facts where key='multi-applied')),'own-team-2','multi-team order and exact identity remain stable');
select is((select configuration_json#>>'{teamSelection,matchLocation}'from public.dynamic_slide_versions
 where id=(select(value->>'draftVersionId')::uuid from facts where key='multi-applied')),'away','multi-team update retains home/away and presentation settings');
insert into facts values('legacy-stale',pg_temp.input_for('Legacy'));
select public.create_or_resume_dynamic_slide_version_v1((select(value->>'slideId')::uuid from facts where key='Legacy'));
insert into facts values('legacy-conflict',public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='legacy-stale')));
select is((select value->>'status'from facts where key='legacy-conflict'),'conflict','SEI-07 another editor creating a draft conflicts instead of silently resuming it');
select is((select configuration_json#>>'{context,seasonId}'from public.dynamic_slide_versions where dynamic_slide_id=(select(value->>'slideId')::uuid from facts where key='Legacy')and status='draft'),
 '2025','concurrent editor draft is not overwritten');
select throws_ok($$select public.preview_sportlink_season_switch_v1('10000000-0000-4000-8000-000000000301',
 ((select value-'requestId'-'correlationId'from facts where key='command')||'{"resourceKind":"matchday_runbook"}'))$$,
 case when to_regclass('public.matchday_runbooks')is not null then'42501'else'55000'end,null,'S300 adapter rejects a non-runbook resource or explicitly unavailable integration');
reset role;
select is(private.sportlink_season_patch_s301_v1(jsonb_build_object('context',pg_temp.context(),
 'sourceTeamSelection',jsonb_build_object('mode','selected','teamContexts',jsonb_build_array(pg_temp.context()))),
 jsonb_build_array(jsonb_build_object('fromProviderTeamId','own-team','context',pg_temp.destination('own-team-2'))))#>>'{sourceTeamSelection,teamContexts,0,providerTeamId}',
 'own-team-2','sourceTeamSelection family path is updated using the same checked identity mapping');
select is(private.sportlink_season_patch_s301_v1(jsonb_build_object('context',pg_temp.context(),'birthday',
 jsonb_build_object('selection',jsonb_build_object('selectedTeamIds',jsonb_build_array('own-team'),'showAge',false))),
 jsonb_build_array(jsonb_build_object('fromProviderTeamId','own-team','context',pg_temp.destination('own-team-2'))))#>>'{birthday,selection,selectedTeamIds,0}',
 'own-team-2','birthday team-filter identity follows an explicit changed team code');
select is(private.sportlink_season_patch_s301_v1(jsonb_build_object('context',pg_temp.context(),'birthday',
 jsonb_build_object('selection',jsonb_build_object('selectedTeamIds',jsonb_build_array('own-team'),'showAge',false))),
 jsonb_build_array(jsonb_build_object('fromProviderTeamId','own-team','context',pg_temp.destination('own-team-2'))))#>'{birthday,selection,showAge}',
 'false'::jsonb,'birthday privacy/presentation settings remain untouched');
update public.dynamic_slide_versions set configuration_json=jsonb_set(configuration_json,'{context}','{"providerTeamId":"own-team"}')
 where dynamic_slide_id=(select(value->>'slideId')::uuid from facts where key='Legacy')and status='draft';
set local role authenticated;
select is(pg_temp.row_for('Legacy')->>'state','malformed','malformed legacy context is visible for manual review and never guessed');
select is((pg_temp.row_for('Legacy')->>'canUpdate')::boolean,false,'malformed legacy row cannot be selected for bulk mutation');
reset role;
update public.tenant_memberships set role='tenant_owner'where tenant_id='10000000-0000-4000-8000-000000000301'and user_id='00000000-0000-4000-8000-000000000303';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='command'))->>'status',
 'conflict','matching nonce is actor-scoped and cannot replay another editor successful result');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
insert into facts values('schedule-review',pg_temp.input_for('Matchday'));
select public.mutate_content_schedule_v2('10000000-0000-4000-8000-000000000301',schedule.id,schedule.revision,'update',
 jsonb_build_object('name',schedule.name,'targetKind','screen','targetId',schedule.target_screen_id,
 'releaseId',schedule.release_id,'timezoneName',schedule.timezone_name,'source',schedule.source,'priority',schedule.priority+1,
 'scheduleKind','weekly','startsAt',schedule.starts_at+interval '1 hour','endsAt',schedule.ends_at+interval '2 hours',
 'recurrence',jsonb_build_object('weekdays',jsonb_build_array(2),'startTime','19:00','endTime','21:00'),'enabled',true),
 'e3010000-0000-4000-8000-000000000021')from public.content_schedules schedule
 where tenant_id='10000000-0000-4000-8000-000000000301'and name='Future recurring source';
select isnt(pg_temp.row_for('Matchday')->>'contextHash',(select value->>'contextHash'from facts where key='schedule-review'),
 'changed recurrence, local interval, ranking, target snapshot and schedule revision invalidate the impact fingerprint');
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='schedule-review'))->>'status','conflict','SEI-07 concurrent canonical planning edits require a fresh source review');
reset role;
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3010000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000004',2,repeat('e',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,
 asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select tenant_id,'e3010000-0000-4000-8000-000000000004','e3010000-0000-4000-8000-000000000012',id,
 'e3010000-0000-4000-8000-000000000003',0,10,'contain',true,kind,title,storage_path,mime_type,file_size_bytes,checksum_sha256,
 'e3010000-0000-4000-8000-000000000001',false from public.media_assets where id='e3010000-0000-4000-8000-000000000002';
set local role authenticated;
insert into facts values('screen-review',pg_temp.input_for('Matchday'));
reset role;
update public.screens set assigned_release_id='e3010000-0000-4000-8000-000000000012',target_revision=target_revision+1
 where id='e3010000-0000-4000-8000-000000000007';
set local role authenticated;
select isnt(pg_temp.row_for('Matchday')->>'contextHash',(select value->>'contextHash'from facts where key='screen-review'),
 'changing the assigned immutable release with the same exact slide version changes the private impact fingerprint');
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value from facts where key='screen-review'))->>'status','conflict','SEI-07 a concurrent screen release reassignment cannot reuse an obsolete review');
reset role;
insert into public.sportlink_sync_runs(tenant_id,connection_id,dataset_group,status,error_code,started_at,finished_at)
values('10000000-0000-4000-8000-000000000301',pg_temp.connection_id(),'competitions','failed','SPORTLINK_TIMEOUT',now(),now()+interval '1 second');
set local role authenticated;
select is(pg_temp.inventory()#>>'{sourceHealth,state}','incomplete','source-only competition failure is visible instead of a fabricated ready state');
select is((pg_temp.inventory()#>>'{sourceHealth,matchesLastSuccessAt}')::timestamptz,now(),'independent valid match sync evidence survives competition failure');
select is((pg_temp.inventory()#>>'{sourceHealth,coverageKnown}')::boolean,false,'normalized observations never invent complete provider coverage');
insert into facts values('frame-review',to_jsonb(pg_temp.row_for('Matchday')->>'contextHash'));
reset role;
update public.player_devices set active_release_id='e3010000-0000-4000-8000-000000000012',last_seen_at=now(),
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId','e3010000-0000-4000-8000-000000000012',
 'firstFrameAt',now()-interval '1 minute'))where id='e3010000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->>'kind'='screen'and reference->>'confirmedVersionId'=(select published->>'id'from original_state)),
 'SEI-01 a paired exact screen/publication with a valid first frame exposes its actual immutable version');
select is(pg_temp.row_for('Matchday')->>'contextHash',(select value#>>'{}'from facts where key='frame-review'),
 'frame receipt and observation timestamps never invalidate a reviewed semantic dependency fingerprint');
reset role;
update public.player_devices set active_release_id='e3010000-0000-4000-8000-000000000006',
 current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object('releaseId','e3010000-0000-4000-8000-000000000006',
 'firstFrameAt',now()-interval '1 minute'))where id='e3010000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->>'kind'='screen'and reference->>'state'='confirmed_publication'
 and reference->>'confirmedVersionId'=(select published->>'id'from original_state)),
 'an exact historic Player frame stays visible when desired and default already point at another release');
select is(pg_temp.row_for('Matchday')->>'contextHash',(select value#>>'{}'from facts where key='frame-review'),
 'an observation-only historic Player screen reference does not invalidate the configured impact review');
select is((pg_temp.row_for('Matchday')#>>'{impact,knownCount}')::int,jsonb_array_length(pg_temp.row_for('Matchday')#>'{impact,references}'),
 'known count includes configured and historic observed dependencies within the response cap');
reset role;
update public.player_devices set current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object(
 'releaseId','e3010000-0000-4000-8000-000000000012','firstFrameAt',now()-interval '1 minute'))
 where id='e3010000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->'confirmedVersionId'<>'null'::jsonb),'a frame for another release is never confirmed as this screen version');
reset role;
update public.player_devices set current_sync_detail=jsonb_build_object('publicationTrace',jsonb_build_object(
 'releaseId',active_release_id,'firstFrameAt',now()+interval '1 minute'))where id='e3010000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->'confirmedVersionId'<>'null'::jsonb),'a future frame timestamp never proves a confirmed version');
reset role;
update public.player_devices set current_sync_detail='{}'where id='e3010000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->'confirmedVersionId'<>'null'::jsonb),'an active release pointer without a frame receipt is not confirmation');
reset role;
update public.player_devices set last_seen_at=now()+interval '1 minute',current_sync_detail=jsonb_build_object(
 'publicationTrace',jsonb_build_object('releaseId',active_release_id,'firstFrameAt',now()))
 where id='e3010000-0000-4000-8000-000000000011';
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.row_for('Matchday')#>'{impact,references}')reference
 where reference->'confirmedVersionId'<>'null'::jsonb),'a future last-seen observation is not valid frame evidence');
reset role;
select *from finish();
rollback;
