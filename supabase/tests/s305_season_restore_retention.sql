-- S305: reuse the established S301 canonical source/authoring fixture.
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

-- Two immutable publications of one old basis: the UI correctly has no single
-- restore link. Both are genuine S301 dependencies, not name-based fallbacks.
reset role;
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3050000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000005',1,repeat('d',64),'{}',1,10,100);
insert into public.playlist_release_items(tenant_id,playlist_id,release_id,media_asset_id,media_variant_id,sort_order,duration_seconds,fit_mode,muted,
 asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled)
select tenant_id,'e3010000-0000-4000-8000-000000000005','e3050000-0000-4000-8000-000000000001',media_asset_id,media_variant_id,
 sort_order,duration_seconds,fit_mode,muted,asset_kind,asset_title,storage_path,mime_type,file_size_bytes,checksum_sha256,dynamic_snapshot_id,live_data_enabled
from public.playlist_release_items where release_id='e3010000-0000-4000-8000-000000000006';
set local role authenticated;
select is(pg_temp.row_for('Matchday')#>>'{links,restore}',null,'multiple old playlists do not invent one arbitrary recovery link');
insert into facts values('legacy-old',jsonb_build_object('id',(select current_published_version_id from public.dynamic_slides where id=(select(value->>'slideId')::uuid from facts where key='Legacy'))));
insert into facts values('legacy-conflict-command',jsonb_set(pg_temp.input_for('Legacy'),'{expectedRevision}',to_jsonb(999999::bigint)));
insert into facts values('legacy-conflict',public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='legacy-conflict-command')));
select is((select value->>'status'from facts where key='legacy-conflict'),'conflict','a real rejected CAS receipt does not own the old basis');
insert into facts values('legacy-replacement',public.create_or_resume_dynamic_slide_version_v1((select(value->>'slideId')::uuid from facts where key='Legacy')));
insert into facts values('command',pg_temp.input_for('Matchday'));
insert into facts values('applied',public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='command')));
select is((select value->>'status'from facts where key='applied'),'applied','normal S301 command applies before its replacement is published');
select is(public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='command')),
 (select value from facts where key='applied'),'exact replay keeps one successful receipt and original basis');
select throws_ok($$select public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',
 (select value||jsonb_build_object('correlationId',gen_random_uuid())from facts where key='command'))$$,'23505',null,'changed replay cannot broaden recovery ownership');
reset role;
select is((select count(*)from public.publisher_command_receipts where command_type='sportlink.season.draft.apply'
 and target_id=(select(value->>'slideId')::uuid from facts where key='Matchday')),1::bigint,'one real applied receipt owns the previous version');
-- Worker-completed replacement fixture; no old immutable bytes are changed.
update public.dynamic_slide_versions set status='publishing'where id=(select(value->>'draftVersionId')::uuid from facts where key='applied');
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,dynamic_slide_version_id,
 source_revision_hash,snapshot_data_json,status,completed_at,output_media_asset_id)
select 'e3050000-0000-4000-8000-000000000002',slide.tenant_id,slide.id,version.template_version_id,version.data_source_id,version.id,
 repeat('e',64),private.build_dynamic_snapshot_data(slide),'ready',now(),'e3010000-0000-4000-8000-000000000002'
from public.dynamic_slides slide join public.dynamic_slide_versions version on version.tenant_id=slide.tenant_id and version.id=slide.active_draft_version_id
where slide.id=(select(value->>'slideId')::uuid from facts where key='Matchday');
update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id='e3050000-0000-4000-8000-000000000002'
where id=(select(value->>'draftVersionId')::uuid from facts where key='applied');
update public.dynamic_slides set current_published_version_id=(select(value->>'draftVersionId')::uuid from facts where key='applied'),
 active_draft_version_id=null,current_snapshot_id='e3050000-0000-4000-8000-000000000002',status='ready'
where id=(select(value->>'slideId')::uuid from facts where key='Matchday');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3050000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000004',2,repeat('e',64),'{}',1,10,100),
 ('e3050000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000301','e3010000-0000-4000-8000-000000000005',2,repeat('f',64),'{}',1,10,100);
update public.playlist_items set dynamic_snapshot_id='e3050000-0000-4000-8000-000000000002'
where tenant_id='10000000-0000-4000-8000-000000000301'and dynamic_slide_id=(select(value->>'slideId')::uuid from facts where key='Matchday');
update public.screens set assigned_release_id='e3050000-0000-4000-8000-000000000003',default_release_id='e3050000-0000-4000-8000-000000000003'
where id='e3010000-0000-4000-8000-000000000007';
update public.player_devices set active_release_id='e3050000-0000-4000-8000-000000000003',desired_release_id='e3050000-0000-4000-8000-000000000003'
where id='e3010000-0000-4000-8000-000000000011';
update public.dynamic_slide_versions set status='publishing'where id=(select(value->>'versionId')::uuid from facts where key='legacy-replacement');
insert into public.dynamic_slide_snapshots(id,tenant_id,dynamic_slide_id,template_version_id,data_source_id,dynamic_slide_version_id,
 source_revision_hash,snapshot_data_json,status,completed_at,output_media_asset_id)
select 'e3050000-0000-4000-8000-000000000020',slide.tenant_id,slide.id,version.template_version_id,version.data_source_id,version.id,
 repeat('f',64),private.build_dynamic_snapshot_data(slide),'ready',now(),'e3010000-0000-4000-8000-000000000002'
from public.dynamic_slides slide join public.dynamic_slide_versions version on version.tenant_id=slide.tenant_id and version.id=slide.active_draft_version_id
where slide.id=(select(value->>'slideId')::uuid from facts where key='Legacy');
update public.dynamic_slide_versions set status='published',published_at=now(),published_snapshot_id='e3050000-0000-4000-8000-000000000020'
where id=(select(value->>'versionId')::uuid from facts where key='legacy-replacement');
update public.dynamic_slides set current_published_version_id=(select(value->>'versionId')::uuid from facts where key='legacy-replacement'),
 active_draft_version_id=null,current_snapshot_id='e3050000-0000-4000-8000-000000000020',status='ready'
where id=(select(value->>'slideId')::uuid from facts where key='Legacy');
-- Ordinary tenant B history remains subject to the same retention command.
insert into public.playlists(id,tenant_id,name)values('e3050000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000302','Unreferenced B');
insert into public.playlist_releases(id,tenant_id,playlist_id,version,manifest_hash,manifest_json,item_count,total_duration_seconds,total_bytes)
values('e3050000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000302','e3050000-0000-4000-8000-000000000010',1,repeat('a',64),'{}',1,10,100),
 ('e3050000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000302','e3050000-0000-4000-8000-000000000010',2,repeat('b',64),'{}',1,10,100);
-- Finish only fixture-generated pending renders; pending work correctly owns
-- snapshots and would hide the version/snapshot retention regression.
update public.dynamic_render_jobs set status='failed',finished_at=now(),error_code='FIXTURE_FINISHED'
where tenant_id='10000000-0000-4000-8000-000000000301'and status in('queued','rendering');
update public.dynamic_slide_snapshots set status='failed',completed_at=now(),error_code='FIXTURE_FINISHED'
where tenant_id='10000000-0000-4000-8000-000000000301'and status in('queued','rendering');
select set_config('request.jwt.claim.role','service_role',true);
select public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000000301',25);
select public.prune_superseded_publication_versions_v1('10000000-0000-4000-8000-000000000302',25);
select ok(exists(select 1 from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000000301'and id='e3010000-0000-4000-8000-000000000006'),
 'regression: old first release survives actual prune after every screen and Player switched to the new publication');
select ok(exists(select 1 from public.playlist_releases where tenant_id='10000000-0000-4000-8000-000000000301'and id='e3050000-0000-4000-8000-000000000001'),
 'regression: second old playlist survives without a single restore link');
select is((select to_jsonb(release)from public.playlist_releases release where id='e3010000-0000-4000-8000-000000000006'),
 (select release from original_state),'old immutable release remains byte-equivalent after retention');
select is((select to_jsonb(snapshot)from public.dynamic_slide_snapshots snapshot where id='e3010000-0000-4000-8000-000000000001'),
 (select snapshot from original_state),'old immutable snapshot remains byte-equivalent after retention');
select is((select to_jsonb(version)from public.dynamic_slide_versions version where id=(select(published->>'id')::uuid from original_state)),
 (select published from original_state),'old published authoring version remains byte-equivalent after retention');
select ok(not exists(select 1 from public.dynamic_slide_versions where id=(select(value->>'id')::uuid from facts where key='legacy-old')),
 'a rejected season receipt does not prevent ordinary old-version pruning');
select ok(not exists(select 1 from public.playlist_releases where id='e3050000-0000-4000-8000-000000000011'),
 'ordinary unreferenced tenant B history is still pruned');
select ok(not private.publication_release_is_referenced_v1('10000000-0000-4000-8000-000000000302','e3010000-0000-4000-8000-000000000006'),
 'tenant A receipt does not make an old release a tenant B reference');
select ok(not private.publication_snapshot_is_referenced_v1('10000000-0000-4000-8000-000000000302','e3010000-0000-4000-8000-000000000001'),
 'tenant A receipt does not make an old snapshot a tenant B reference');
select ok(not private.publication_version_can_prune_v1('10000000-0000-4000-8000-000000000302',(select(value->>'previousVersionId')::uuid from facts where key='applied')),
 'foreign versions are never candidates in another tenant');
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',true);
select throws_ok($$select public.apply_sportlink_season_switch_draft_v1('10000000-0000-4000-8000-000000000301',(select value from facts where key='command'))$$,
 '42501',null,'tenant B cannot manufacture ownership by replaying tenant A command');
reset role;
select ok(not exists(select 1 from pg_proc proc join pg_namespace ns on ns.oid=proc.pronamespace
 where ns.nspname='private'and proc.proname like '%s305_v1'and(has_function_privilege('authenticated',proc.oid,'execute')or has_function_privilege('service_role',proc.oid,'execute'))),
 'receipt probes and lock helper are not alternate client or worker entrypoints');
select *from finish();
rollback;
