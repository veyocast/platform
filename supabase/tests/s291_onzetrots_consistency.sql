begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.tenants(id,name,slug) values
 ('10000000-0000-4000-8000-000000000291','Source recovery A','consistency-a'),
 ('10000000-0000-4000-8000-000000000292','Source recovery B','consistency-b');
insert into public.tenant_settings(tenant_id) select id from public.tenants where slug in('consistency-a','consistency-b');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000291','consistency-owner@test.invalid'),
 ('00000000-0000-4000-8000-000000000292','consistency-other@test.invalid'),
 ('00000000-0000-4000-8000-000000000293','consistency-viewer@test.invalid');
insert into public.profiles(id,display_name) values
 ('00000000-0000-4000-8000-000000000291','Owner A'),('00000000-0000-4000-8000-000000000292','Owner B'),('00000000-0000-4000-8000-000000000293','Viewer A');
insert into public.tenant_memberships(tenant_id,user_id,role)values
 ('10000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000291','tenant_owner'),
 ('10000000-0000-4000-8000-000000000292','00000000-0000-4000-8000-000000000292','tenant_owner'),
 ('10000000-0000-4000-8000-000000000291','00000000-0000-4000-8000-000000000293','tenant_viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000291','Source A','Own club','287000','encrypted-fixture','iv-fixture','tag-fixture');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000292',true);
select public.upsert_sportlink_connection_v1('10000000-0000-4000-8000-000000000292','Source B','Other club','288000','encrypted-fixture','iv-fixture','tag-fixture');
reset role;
create temporary table own_source as select tenant_id,id,data_source_id from public.sportlink_connections where tenant_id in('10000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000292');

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
 select jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id','60000000-0000-4000-8000-000000000291','tenant_id',tenant_id,'name','Controlled source','slide_type',kind,'orientation','landscape','data_source_id',data_source_id,'configuration_json',pg_temp.config(family,kind,direction,days)))from own_source where tenant_id='10000000-0000-4000-8000-000000000291'
$$;
select is(private.resolve_sportlink_pool_context_v1(s.tenant_id,s.data_source_id,pg_temp.context(),'sportlink.pool_standings'),null::jsonb,'old automatic resolver reproduces the actual hash-versus-poulecode failure')from own_source s where s.tenant_id='10000000-0000-4000-8000-000000000291';
select is(private.sync_resolve_sportlink_pool_context_v1(s.tenant_id,s.data_source_id,pg_temp.context(),'sportlink.pool_standings')->>'poolId','701','exact own-team catalog hash restores the stable official pool ID')from own_source s where s.tenant_id='10000000-0000-4000-8000-000000000291';
select is(private.sync_sportlink_effective_pool_v1(m),'701','a stored synthetic pool is resolved only from exact authorized IDs')from public.sports_matches m where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='home';
select is(private.sync_sportlink_effective_pool_v1(m),null::text,'matching names without own team IDs cannot resolve a synthetic pool')from public.sports_matches m where tenant_id='10000000-0000-4000-8000-000000000291'and external_id='lookalike';
create temporary table proof(name text primary key,value jsonb);
insert into proof values('matchday',private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day')));
select is((select value#>>'{sport,matchday,context,poolId}'from proof where name='matchday'),'701','matchday uses the recovered exact pool');
select is((select jsonb_array_length(value#>'{sport,matchday,standings,items}')from proof where name='matchday'),1,'the full published stand survives the existing nullable season contract');
select is((select value#>'{sport,matchday,context,seasonId}'from proof where name='matchday'),'null'::jsonb,'an absent provider season is not fabricated');
select is((select jsonb_array_length(value#>'{sport,matchday,results,items}')from proof where name='matchday'),3,'all actual results enter the same composite');
select is((select jsonb_array_length(value#>'{sport,matchday,fixtures,items}')from proof where name='matchday'),5,'program includes controlled pool records, without a foreign synthetic identity');
-- Direction is relative to stable selected IDs, before bounding. Internal games count once.
insert into proof select family||'-'||direction,private.build_dynamic_snapshot_data(pg_temp.dynamic(family,kind,direction))from(values('fixtures','sport_program'),('results','sport_results'),('pool-program','sport_program'),('pool-results','sport_results'))f(family,kind)cross join(values('both'),('home'),('away'))d(direction);
select is(jsonb_array_length(value#>'{sport,items}'),case when name like 'fixtures-%'or name like'pool-program-%'then case when name like'%-away'then 1 when name like'%-home'then 3 else 4 end else case when name like'%-both'then 3 when name like'%-away'then 1 else 2 end end,'direction and stable own-team filter: '||name)from proof where name<>'matchday';
select ok(not(value#>'{sport,items}')::text like '%lookalike%','same team names never authorize an unrelated match: '||name)from proof where name<>'matchday';
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('matchday','sport_match_of_the_day','home'))#>'{sport,matchday,standings,items}'),1,'home/away never filters the competition table');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('welcome','sport_visitor_arrivals','both',1))#>'{sport,items}'),1,'one-day welcome filters before the next-four limit');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('welcome','sport_visitor_arrivals','both',7))#>'{sport,items}'),3,'seven-day welcome uses only selected own home teams');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(pg_temp.dynamic('welcome','sport_visitor_arrivals','both',14))#>'{sport,items}'),4,'fourteen-day welcome includes the later actual home match');
select is(jsonb_array_length(private.build_dynamic_snapshot_data(jsonb_populate_record(pg_temp.dynamic('fixtures','sport_program','away'),jsonb_build_object('configuration_json',jsonb_set(pg_temp.config('fixtures','sport_program','away'),'{teamSelection}','{"mode":"all","teamContexts":[],"matchLocation":"away"}'))))#>'{sport,items}'),2,'an internal club fixture is relevant to away when all own teams are selected, once by stable match ID');
-- Read-only preview under actual tenant role; no provider call or persistent command.
create function pg_temp.preview(family text,kind text,direction text default 'both') returns jsonb language sql stable as $$
 select public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000000291','Controlled source',(select current_published_version_id from public.dynamic_templates where slide_type=kind and orientation='landscape'and status='published'limit 1),(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'),pg_temp.config(family,kind,direction))
$$;
grant select on own_source to authenticated;
create function pg_temp.write_counts()returns jsonb language sql stable as $$select jsonb_build_array((select count(*)from public.dynamic_slides),(select count(*)from public.dynamic_slide_versions),(select count(*)from public.dynamic_slide_snapshots),(select count(*)from public.playlist_releases),(select count(*)from public.dynamic_sync_runs),(select count(*)from public.screens))$$;
insert into proof values('before-preview',pg_temp.write_counts());
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select lives_ok($$select pg_temp.preview('matchday','sport_match_of_the_day')$$,'the actual authorized public RPC recovers automatic matchday');
select is(jsonb_array_length(pg_temp.preview('matchday','sport_match_of_the_day')#>'{data,sport,matchday,standings,items}'),1,'the public RPC contains the complete stand');
select lives_ok($$select pg_temp.preview('pool-program','sport_program','home')$$,'current pool home selection passes the guarded authoring contract');
reset role;
select is(pg_temp.write_counts(),(select value from proof where name='before-preview'),'source checking changes no design, revision, snapshot, sync run, playlist or screen');
select ok(not has_function_privilege('authenticated','private.sync_sportlink_effective_pool_v1(public.sports_matches)','execute'),'no browser execute grant on source identity helper');
select ok(not has_function_privilege('service_role','private.build_sync_sport_snapshot_s291_v1(public.dynamic_slides)','execute'),'worker cannot invoke the private source builder directly');
-- Real authoring commands after the read-only proof, entirely rolled back.
create temporary table saved_designs(family text,kind text,request jsonb,reply jsonb);
grant select,insert,update on saved_designs to authenticated;
create function pg_temp.request(family text,kind text,direction text default 'home')returns jsonb language sql stable as $$
 select jsonb_build_object('templateVersionId',(select current_published_version_id from public.dynamic_templates where slide_type=kind and orientation='landscape'and status='published'order by slug limit 1),'dataSourceId',(select data_source_id from own_source where tenant_id='10000000-0000-4000-8000-000000000291'),'configuration',case when kind='sport_visitor_arrivals'then pg_temp.config(family,kind,direction,14)-'teamSelection'else pg_temp.config(family,kind,direction,14)end)
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
insert into saved_designs select family,kind,request,public.mutate_sync_dynamic_authoring_v1('10000000-0000-4000-8000-000000000291','create',null,null,0,request,gen_random_uuid())from(select family,kind,pg_temp.request(family,kind)request from(values('pool-program','sport_program'),('pool-results','sport_results'),('matchday','sport_match_of_the_day'),('welcome','sport_visitor_arrivals'))s(family,kind))requests;
select is(count(*),4::bigint,'all current direction/window designs pass the real guarded create command')from saved_designs;
select is(slide.configuration_json#>>'{teamSelection,matchLocation}','home','stored direction survives reopening '||saved.family)from saved_designs saved join public.dynamic_slides slide on slide.id=(saved.reply->>'slideId')::uuid where saved.family<>'welcome';
select is(slide.configuration_json#>>'{arrival,minutesBefore}','20160','stored welcome window survives reopening')from saved_designs saved join public.dynamic_slides slide on slide.id=(saved.reply->>'slideId')::uuid where saved.family='welcome';
select is(slide.configuration_json#>>'{syncConfiguration,seed,authoring,visualRevision}','onzetrots-20261024','the current visual contract survives storage '||saved.family)from saved_designs saved join public.dynamic_slides slide on slide.id=(saved.reply->>'slideId')::uuid;
reset role;

-- Explicit new pool direction also works with FieldFlow; old absent selections retain their prior behavior.
create function pg_temp.fieldflow_request(kind text,direction text)returns jsonb language sql stable as $$
 select jsonb_set(pg_temp.request(case when kind='sport_program'then'pool-program'else'pool-results'end,kind,direction),'{configuration,syncConfiguration}',jsonb_build_object('schemaVersion',1,'kind','dynamic','rendererVersion','sync-v1','sourceRevision','8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a','slideType',kind,'secondsPerPage',5,'seed',jsonb_set($fieldflow${"schemaVersion":1,"rendererVersion":"sync-v1","sourceRevision":"8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a","family":"pool-program","orientation":"landscape","theme":"fieldflow","name":"Pouleprogramma","club":{"name":"Own club","tagline":""},"title":"IN ONZE POULE","headline":"","body":"","subtitle":"","topLabel":"CLUB TV","footer":"","footerRight":"","rows":[],"rowsPerPage":4,"ownRowIndexes":[],"category":"","subline":"","lineup":[],"news":[],"imageCaption":"","state":"ready","style":{"motion":"rustig","background":"stadium","backgroundPosition":"center","font":"Inter, sans-serif","fontChanged":false,"accent":"#1763ed","alignment":"left","scale":100,"safeMargin":5,"showLogo":true,"showFooter":true}}$fieldflow$::jsonb,'{family}',to_jsonb(case when kind='sport_program'then'pool-program'else'pool-results'end))))
$$;
set local role authenticated;
select is(jsonb_array_length(public.preview_dynamic_slide_v1('10000000-0000-4000-8000-000000000291','FieldFlow pool',(request->>'templateVersionId')::uuid,(request->>'dataSourceId')::uuid,request->'configuration')#>'{data,sport,items}'),case when direction='away'then 1 when kind='sport_program'then 3 else 2 end,'explicit FieldFlow pool direction: '||kind||'/'||direction)
from(select kind,direction,pg_temp.fieldflow_request(kind,direction)request from(values('sport_program'),('sport_results'))k(kind)cross join(values('home'),('away'))d(direction))requests;
select lives_ok(format('select public.mutate_sync_dynamic_authoring_v1(''10000000-0000-4000-8000-000000000291'',''create'',null,null,0,%L::jsonb,gen_random_uuid())',pg_temp.fieldflow_request(kind,direction)::text),'explicit FieldFlow pool direction saves: '||kind||'/'||direction)from(values('sport_program'),('sport_results'))k(kind)cross join(values('home'),('away'))d(direction);
reset role;

-- Supplier overrides are authenticated source management, never preview side effects.
insert into public.dynamic_data_sources(id,tenant_id,name,kind,config_json)values
 ('20000000-0000-4000-8000-000000000291','10000000-0000-4000-8000-000000000291','RSS A','rss','{"url":"https://news.example.org/a"}'),
 ('20000000-0000-4000-8000-000000000292','10000000-0000-4000-8000-000000000292','RSS B','rss','{"url":"https://news.example.org/b"}');
insert into public.media_assets(id,tenant_id,created_by,kind,title,original_file_name,mime_type,status,storage_path,file_size_bytes,checksum_sha256,width,height,processed_at)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'image','Verified supplier artwork','supplier.webp','image/webp','ready','tenants/10000000-0000-4000-8000-'||lpad(n::text,12,'0')||'/assets/40000000-0000-4000-8000-'||lpad(n::text,12,'0')||'/supplier.webp',2048,repeat('d',64),260,150,now()from generate_series(291,292)n;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000291',true);
select lives_ok($$select public.set_rss_provider_logo_v1('10000000-0000-4000-8000-000000000291','20000000-0000-4000-8000-000000000291','40000000-0000-4000-8000-000000000291')$$,'owner configures actual own supplier artwork explicitly');
select is((select revision from public.dynamic_data_sources where id='20000000-0000-4000-8000-000000000291'),1::bigint,'supplier-only change invalidates the existing source revision immediately');
select is((select config_json->>'providerLogoOverrideMediaAssetId'from public.dynamic_data_sources where id='20000000-0000-4000-8000-000000000291'),'40000000-0000-4000-8000-000000000291','supplier selection is retained per feed');
select throws_ok($$select public.set_rss_provider_logo_v1('10000000-0000-4000-8000-000000000291','20000000-0000-4000-8000-000000000292',null)$$,'42501',null,'foreign feed cannot be modified');
select throws_ok($$select public.set_rss_provider_logo_v1('10000000-0000-4000-8000-000000000291','20000000-0000-4000-8000-000000000291','40000000-0000-4000-8000-000000000292')$$,'23514',null,'foreign media cannot impersonate supplier artwork');
select lives_ok($$select public.set_rss_provider_logo_v1('10000000-0000-4000-8000-000000000291','20000000-0000-4000-8000-000000000291',null)$$,'owner can restore automatic supplier metadata');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000293',true);
select throws_ok($$select public.set_rss_provider_logo_v1('10000000-0000-4000-8000-000000000291','20000000-0000-4000-8000-000000000291',null)$$,'42501',null,'viewer cannot alter supplier metadata');
reset role;
select ok(not has_function_privilege('anon','public.set_rss_provider_logo_v1(uuid,uuid,uuid)','execute'),'unauthenticated callers cannot change supplier artwork');

-- Text-identical media changes still produce a distinct effective source hash.
insert into public.dynamic_news_articles(tenant_id,data_source_id,external_id,title,intro,source_name,link,content_hash,hero_media_asset_id)
values('10000000-0000-4000-8000-000000000291','20000000-0000-4000-8000-000000000291','media-revision','Same title','Same summary','RSS A','https://news.example.org/item',repeat('a',64),'40000000-0000-4000-8000-000000000291');
update public.dynamic_data_sources set revision=revision+1,last_successful_sync_at=now()where id='20000000-0000-4000-8000-000000000291';
insert into proof select 'rss-media-hash',to_jsonb(config_json->>'contentRevisionHash')from public.dynamic_data_sources where id='20000000-0000-4000-8000-000000000291';
update public.dynamic_news_articles set hero_media_asset_id=null where data_source_id='20000000-0000-4000-8000-000000000291';
update public.dynamic_data_sources set revision=revision+1,last_successful_sync_at=now()+interval '1 minute'where id='20000000-0000-4000-8000-000000000291';
select isnt(to_jsonb(config_json->>'contentRevisionHash'),(select value from proof where name='rss-media-hash'),'an image-only update changes the source hash while title/body stay equal')from public.dynamic_data_sources where id='20000000-0000-4000-8000-000000000291';
select *from finish();rollback;
