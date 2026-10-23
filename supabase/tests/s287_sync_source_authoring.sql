-- S287: actual guarded authoring, including initial draft triggers and receipts.
-- Static outer binding fixtures were captured from compileSyncSportlinkBinding;
-- source facts are created only in this transaction and never in seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000000287','Source recovery A','source-recovery-a'),
 ('10000000-0000-4000-8000-000000000288','Source recovery B','source-recovery-b');
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('source-recovery-a','source-recovery-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000287','source-recovery-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000288','source-recovery-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000289','source-recovery-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000287','Owner A'),('00000000-0000-4000-8000-000000000288','Owner B'),('00000000-0000-4000-8000-000000000289','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000287','00000000-0000-4000-8000-000000000287','tenant_owner'),
 ('10000000-0000-4000-8000-000000000288','00000000-0000-4000-8000-000000000288','tenant_owner'),
 ('10000000-0000-4000-8000-000000000287','00000000-0000-4000-8000-000000000289','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000287',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000287','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000288',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000288','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000287','10000000-0000-4000-8000-000000000288');
insert into public.sports_clubs(tenant_id,source_connection_id,external_id,name) select tenant_id,id,'own-club','Own club' from own_source;
insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata) select tenant_id,id,'own-team','Own team','{"competitionOptions":[{"externalId":"cup","poolExternalId":"pool","period":"phase","season":"2026"}]}'from own_source;
insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,scores_published,rows_json,metadata)
select tenant_id,id,'standing','pool','2026',true,'[{"externalId":"own-team","teamName":"Own team","position":1,"played":1,"won":1,"drawn":0,"lost":0,"goalDifference":2,"points":3,"form":["W"]}]',
 '{"competition":{"externalId":"cup","period":"phase","season":"2026"},"pool":{"externalId":"pool","competitionExternalId":"cup"}}'from own_source;
insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,is_home_match)
select s.tenant_id,s.id,'match-'||n,now()+make_interval(hours=>n),'scheduled','{"externalId":"own-team","name":"Own team"}','{"externalId":"opponent","name":"Opponent"}',
 '{"externalId":"cup","period":"phase","season":"2026"}','{"externalId":"pool","competitionExternalId":"cup"}',true,true from own_source s cross join generate_series(1,14)n;
create temporary table bindings(slide_type text primary key,family text,configuration jsonb);
insert into bindings values
('sport_program','fixtures',$binding${"maxItems":200,"schemaVersion":1,"title":"HET CLUBPROGRAMMA","blueprintKey":"sportlink.club_schedule_next_7_days","teamSelection":{"mode":"all","teamContexts":[]}}$binding$::jsonb),
('sport_results','results',$binding${"maxItems":200,"schemaVersion":1,"title":"ZO SPEELDEN WE","blueprintKey":"sportlink.club_results_previous_7_days","teamSelection":{"mode":"all","teamContexts":[]}}$binding$::jsonb),
('sport_standing','standings',$binding${"maxItems":200,"schemaVersion":1,"title":"DE STAND VAN ZAKEN","blueprintKey":"sportlink.pool_standings","context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_period_standing','period-standings',$binding${"maxItems":200,"schemaVersion":1,"title":"DE PERIODERACE","teamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_match_of_the_day','matchday',$binding${"maxItems":200,"schemaVersion":1,"title":"WEDSTRIJDDAG","teamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_next_match','next-match',$binding${"maxItems":200,"schemaVersion":1,"title":"DE VOLGENDE","teamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_cancellations','cancellations',$binding${"maxItems":200,"schemaVersion":1,"title":"LET OP \u00b7 AFGELAST","teamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_dressing_rooms','dressing-rooms',$binding${"maxItems":200,"schemaVersion":1,"title":"VIND JE KLEEDKAMER","teamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_officials','officials',$binding${"maxItems":200,"schemaVersion":1,"title":"DE MENSEN ACHTER DE WEDSTRIJD","teamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_team','team-info',$binding${"maxItems":200,"schemaVersion":1,"title":"DIT IS ONS TEAM","sourceTeamSelection":{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]},"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_sponsor','sponsors',$binding${"maxItems":200,"schemaVersion":1,"title":"SAMEN MAKEN WE DE CLUB","sourceTeamSelection":{"mode":"all","teamContexts":[]}}$binding$::jsonb),
('sport_activities','activities',$binding${"maxItems":200,"schemaVersion":1,"title":"SAMEN OP DE CLUB"}$binding$::jsonb),
('sport_trainings','training',$binding${"maxItems":200,"schemaVersion":1,"title":"TIJD OM TE TRAINEN","sourceTeamSelection":{"mode":"all","teamContexts":[]}}$binding$::jsonb),
('sport_volunteers','volunteers',$binding${"maxItems":200,"schemaVersion":1,"title":"JULLIE MAKEN HET VERSCHIL"}$binding$::jsonb),
('sport_birthdays','birthdays',$binding${"maxItems":200,"schemaVersion":1,"title":"VANDAAG VIEREN WE","teamSelection":{"mode":"all","teamContexts":[]},"birthday":{"emptyBehavior":"skip","period":{"days":7,"mode":"next_7_days"},"presentation":{"backgroundColor":"#111827","backgroundMediaAssetId":null,"cardStyle":"glass","confetti":true,"gradientOverlay":true,"layout":"auto","logoPosition":"top_left","maxPerLandscapePage":6,"maxPerPortraitPage":6,"motion":true,"pageDurationSeconds":8,"radius":"lg","textAlign":"left","themeMode":"dark","useTenantTheme":true},"schemaVersion":1,"selection":{"emphasizeToday":true,"includeWithoutTeam":true,"includeUnknownRoles":true,"nameMode":"full","roleFilter":"all","selectedRoles":[],"selectedTeamIds":[],"showAge":true,"showDate":true,"showDayOfWeek":true,"showPhoto":true,"showRole":true,"showTeamRole":true,"showTeam":true,"teamSelectionMode":"all"},"title":"VANDAAG VIEREN WE"}}$binding$::jsonb),
('sport_visitor_arrivals','visitors',$binding${"maxItems":200,"schemaVersion":1,"title":"WELKOM BIJ OWN CLUB","blueprintKey":"sportlink.visitor_arrivals","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}],"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb),
('sport_referee_arrivals','referees',$binding${"maxItems":200,"schemaVersion":1,"title":"BEDANKT VOOR JE INZET","blueprintKey":"sportlink.referee_arrivals","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}],"context":{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}}$binding$::jsonb);
-- Also exercise the exact family shown in the production report.
insert into bindings select 'club-program','club-program',configuration from bindings where slide_type='sport_program';
create function pg_temp.request(binding text,orientation text default 'landscape',selected boolean default false) returns jsonb language sql stable as $fn$
 select jsonb_build_object('templateVersionId',t.current_published_version_id,'dataSourceId',s.data_source_id,'configuration',
 case when selected then b.configuration||jsonb_build_object('context','{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}'::jsonb,
 'teamSelection','{"mode":"selected","teamContexts":[{"providerTeamId":"own-team","competitionSelectionMode":"pinned","competitionId":"cup","phaseId":"phase","poolId":"pool","seasonId":"2026"}]}'::jsonb) else b.configuration end
 || jsonb_build_object('syncConfiguration',jsonb_set(jsonb_set(jsonb_set($config${"schemaVersion":1,"kind":"dynamic","rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","slideType":"sport_program","seed":{"schemaVersion":1,"rendererVersion":"sync-onzetrots-v9","sourceRevision":"5ba52a657d6d16ad103ba2fb43b8db18aa83715a","family":"fixtures","orientation":"landscape","theme":"onzetrots-tv","name":"Programma","club":{"name":"Own club","tagline":""},"title":"HET CLUBPROGRAMMA","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":6,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"rustig","background":"clubmuur","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true},"visual":{"schemaVersion":1,"mode":"light","scrollSpeed":"normal","panelOpacity":94},"authoring":{"schemaVersion":1,"headerSubtitles":{},"headerTexts":{},"welcomeScalePercent":150}},"secondsPerPage":15}$config$::jsonb,'{slideType}',to_jsonb(t.slide_type)),'{seed,family}',to_jsonb(b.family)),'{seed,orientation}',to_jsonb(orientation))))
 from bindings b cross join own_source s join public.dynamic_templates t on t.slide_type=case when b.slide_type='club-program'then 'sport_program'else b.slide_type end
 where b.slide_type=binding and s.tenant_id='10000000-0000-4000-8000-000000000287' and t.orientation=orientation and t.status='published' order by t.slug limit 1;
$fn$;
create temporary table results(binding text,orientation text,nonce uuid,request jsonb,result jsonb,primary key(binding,orientation));
grant select on bindings,own_source to authenticated;grant select,insert on results to authenticated;
create function pg_temp.create_binding(binding text,orientation text)returns void language plpgsql as $$
declare request jsonb:=pg_temp.request(binding,orientation);nonce uuid:=gen_random_uuid();result jsonb;
begin
 result:=public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,request,nonce);
 insert into results values(binding,orientation,nonce,request,result);
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000287',true);
select lives_ok($$select public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000000287','Clubprogramma',
 (pg_temp.request('club-program')->>'templateVersionId')::uuid,(pg_temp.request('club-program')->>'dataSourceId')::uuid,
 pg_temp.request('club-program')->'configuration')$$,'the same all-team request succeeds in the real canonical preview');
select lives_ok(format('select pg_temp.create_binding(%L,%L)',b.slide_type,o),b.slide_type||' creates through real draft/authoring guards in '||o)
 from bindings b cross join unnest(array['landscape','portrait'])o order by b.slide_type,o;
select is((select count(*)from public.sync_content_library_v1 where tenant_id='10000000-0000-4000-8000-000000000287' and kind='dynamic'),36::bigint,'saved source designs remain visible in Content while rendering');
select is((select jsonb_array_length(s.snapshot_data_json#>'{sport,items}')from results r join public.dynamic_slide_snapshots s on s.id=(r.result->>'snapshotId')::uuid where r.binding='club-program'and r.orientation='landscape'),14,'the exact programme retains every authorized match across pages');
select ok((select s.configuration_json->'syncConfiguration'=r.request#>'{configuration,syncConfiguration}'from results r join public.dynamic_slides s on s.id=(r.result->>'slideId')::uuid where r.binding='club-program'and r.orientation='landscape'),'storage retains the exact versioned seed and header authoring');
select is((select count(*)from results),36::bigint,'all 17 provider types and the reported club-program family are saved in both orientations');
select is((select count(*)from results where result?'slideId'and result?'snapshotId'),36::bigint,'each real create returns both canonical identities');
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000000287'),36::bigint,'each create enqueues exactly one existing render job');
select is(public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,r.request,r.nonce),r.result,r.binding||' lost reply returns the same receipt')from results r order by binding,orientation;
select is((select count(*)from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000000287'),36::bigint,'replaying every command never adds a render job');
select lives_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,pg_temp.request('club-program','landscape',true),gen_random_uuid())$$,'an explicit owned team/competition remains supported');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,jsonb_set(pg_temp.request('club-program','landscape',true),'{configuration,context,providerTeamId}','"foreign-team"'),gen_random_uuid())$$,'23514',null,'a foreign primary team never becomes an all-teams fallback');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,jsonb_set(pg_temp.request('club-program','landscape',true),'{configuration,teamSelection,teamContexts,0,providerTeamId}','"foreign-team"'),gen_random_uuid())$$,'23514',null,'a foreign selected team is rejected by the original source-bound helper');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,pg_temp.request('club-program','landscape',true)#-'{configuration,context}',gen_random_uuid())$$,'23514',null,'selected mode still requires an explicit matching primary context');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,jsonb_set(pg_temp.request('club-program'),'{configuration,context}','null'),gen_random_uuid())$$,'23514',null,'an explicitly supplied null context remains invalid');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,jsonb_set(pg_temp.request('club-program'),'{configuration,syncConfiguration,sourceRevision}','"wrong-source"'),gen_random_uuid())$$,'23514',null,'an invalid Sync marker cannot access the new trigger branch');
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,jsonb_set(pg_temp.request('club-program'),'{configuration,syncConfiguration,seed,rows}','[["forged","source","facts",""]]'),gen_random_uuid())$$,'23514',null,'browser-provided source facts remain rejected');
select throws_ok(format($sql$select public.mutate_sync_dynamic_authoring_v1(%L,'create',null,null,0,%L::jsonb,%L)$sql$,
 '10000000-0000-4000-8000-000000000287',jsonb_set(pg_temp.request('club-program'),'{dataSourceId}',to_jsonb((select data_source_id::text from own_source where tenant_id='10000000-0000-4000-8000-000000000288')))::text,gen_random_uuid()),'23514',null,'another tenant source cannot be used');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000288',true);
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,pg_temp.request('club-program'),gen_random_uuid())$$,'42501',null,'tenant B cannot author for tenant A');
select is((select count(*)from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000000287'),0::bigint,'tenant B cannot read tenant A saved designs');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000289',true);
select throws_ok($$select public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000287','create',null,null,0,pg_temp.request('club-program'),gen_random_uuid())$$,'42501',null,'viewer authoring stays forbidden');
reset role;
select is(has_function_privilege('anon','private.enforce_sportlink_arrival_team_contexts_v1()','execute'),false,'anonymous clients cannot invoke the trigger helper');
select is(has_function_privilege('authenticated','private.enforce_sportlink_arrival_team_contexts_v1()','execute'),false,'browser roles cannot invoke the trigger helper');
select is(has_function_privilege('service_role','private.enforce_sportlink_arrival_team_contexts_v1()','execute'),false,'worker roles cannot invoke the trigger helper');
select *from finish();rollback;
