begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

-- Keep today's fixtures genuinely before/after kickoff at any test execution time.
create function pg_temp.match_time_today(p_time time, p_finished boolean)
returns timestamptz language sql stable as $$
  select case when p_finished
    then day_start + (now() - day_start) * (extract(epoch from p_time) / 86400)::double precision
    else now() + (day_end - now()) * (extract(epoch from p_time) / 86400)::double precision
  end
  from (select
    (now() at time zone 'Europe/Amsterdam')::date::timestamp at time zone 'Europe/Amsterdam' as day_start,
    ((now() at time zone 'Europe/Amsterdam')::date + 1)::timestamp at time zone 'Europe/Amsterdam' as day_end
  ) bounds
$$;


select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-4000-8000-000000001771',
  'authenticated',
  'authenticated',
  's177-owner@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name) values (
  '00000000-0000-4000-8000-000000001771',
  'S177 owner'
);

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000001771',
  'S177 tenant',
  's177-tenant'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000001771'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001771',
  '00000000-0000-4000-8000-000000001771',
  'tenant_owner'
);

create temporary table s177_source (
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select on s177_source to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001771', true);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001771',
  'Sportlink · S177',
  'S177',
  '1581',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

reset role;

insert into s177_source (tenant_id, connection_id, data_source_id)
select connection.tenant_id, connection.id, connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001771'
  and source.name = 'Sportlink · S177';


insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select tenant_id,connection_id,team.id,team.name,jsonb_build_object('competitionOptions',team.options)
from s177_source cross join (values
 ('senior','Senioren 1','[{"externalId":"cup","poolExternalId":"cup-pool","period":"bekerfase","season":"2026"},{"externalId":"league","poolExternalId":"league-pool","period":"competitie","season":"2026"}]'::jsonb),
 ('youth','Jeugd O16-1','[{"externalId":"youth","poolExternalId":"youth-pool","period":"fase 1","season":"2026"}]'::jsonb)
) team(id,name,options);

insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
select tenant_id,connection_id,f.id,case when f.id='league-next' then now()+interval '10 days'
  else pg_temp.match_time_today(time '12:00',f.id in ('cup-played','youth-played')) end,
  case when f.id in ('cup-played','youth-played') then 'finished' else 'scheduled' end,
  jsonb_build_object('externalId',f.home,'name',f.home),jsonb_build_object('externalId',f.away,'name',f.away),
  jsonb_build_object('externalId','fixture-label-hash-'||f.comp,'name',f.comp,'period',f.phase,'season','2026'),
  jsonb_build_object('externalId',f.pool,'competitionExternalId',f.comp),true,true
from s177_source cross join (values
 ('cup-played','senior','opponent','cup','cup-pool','bekerfase'),
 ('cup-next','senior','opponent','cup','cup-pool','bekerfase'),
 ('league-next','opponent','senior','league','league-pool','competitie'),
 ('youth-played','opponent','youth','youth','youth-pool','fase 1'),
 ('youth-next','youth','opponent','youth','youth-pool','fase 1'),
 ('cup-foreign','opponent','other','cup','cup-pool','bekerfase'),
 ('wrong-phase','senior','opponent','cup','cup-pool','andere fase')
) f(id,home,away,comp,pool,phase);

insert into public.sports_standings(tenant_id,source_connection_id,external_id,pool_external_id,season_key,rows_json,metadata,scores_published,active,last_synced_at)
select tenant_id,connection_id,st.comp,st.pool,'2026',jsonb_build_array(
  jsonb_build_object('externalId',st.team,'teamName',st.team,'position',1,'played',st.played,'points',3)),
  jsonb_build_object('competition',jsonb_build_object('externalId',st.comp,'name',st.comp,'period',st.phase,'season','2026'),
    'pool',jsonb_build_object('externalId',st.pool)),true,true,now()+case when st.comp='league' then interval '1 hour' else interval '0 hours' end
from s177_source cross join (values
 ('cup','cup-pool','bekerfase','senior',2),('league','league-pool','competitie','senior',0),
 ('youth','youth-pool','fase 1','youth',2)
) st(comp,pool,phase,team,played);

create function pg_temp.context(p_team text) returns jsonb language sql immutable as $$
 select jsonb_build_object('providerTeamId',p_team,'competitionSelectionMode','auto_current',
 'competitionId',null,'poolId',null,'phaseId',null,'seasonId',null)
$$;
create function pg_temp.snapshot(p_team text,p_blueprint text default 'sportlink.pool_standings')
returns jsonb language sql stable as $$
 select private.build_dynamic_snapshot_data(jsonb_populate_record(null::public.dynamic_slides,
  jsonb_build_object('id','20000000-0000-4000-8000-000000001771','tenant_id',s.tenant_id,
    'data_source_id',s.data_source_id,'name','Actuele selectie','slide_type',t.slide_type,
    'orientation','landscape','selection_mode','latest','template_id',t.id,'template_version_id',t.current_published_version_id,
    'configuration_json',jsonb_build_object('blueprintKey',p_blueprint,'title','Actuele selectie','context',pg_temp.context(p_team)))))
 from s177_source s cross join lateral (select * from public.dynamic_templates
   where slide_type=case when p_blueprint like '%standings' then 'sport_standing' when p_blueprint like '%results%' then 'sport_results' else 'sport_program' end
   and status='published' and orientation='landscape' order by slug limit 1) t
$$;

select is(pg_temp.snapshot('senior')#>>'{sport,poolContext,poolId}','cup-pool','current cup wins over a newer synced future league standing');
select is(pg_temp.snapshot('senior')#>>'{sport,items,0,teamName}','senior','standing contains the selected senior team');
select is(pg_temp.snapshot('senior')#>>'{sport,items,0,played}','2','cup standing is shown instead of unstarted league');
select is(pg_temp.snapshot('youth')#>>'{sport,poolContext,poolId}','youth-pool','youth current phase resolves independently');
select is(pg_temp.snapshot('youth')#>>'{sport,items,0,teamName}','youth','youth never receives another teams standings');
select is(pg_temp.snapshot('unknown')#>>'{sport,emptyStateCode}','COMPETITION_CONTEXT_UNRESOLVED','unknown own team remains empty with a recovery reason');
select is((select string_agg(item->>'id',',' order by item->>'id') from jsonb_array_elements(pg_temp.snapshot('senior','sportlink.pool_schedule_today')#>'{sport,items}') item),
 'cup-foreign,cup-next','pool-linked competition identity accepts the exact pool but rejects wrong phase and started games');
select is(pg_temp.snapshot('youth','sportlink.pool_schedule_today')#>>'{sport,items,0,id}','youth-next','youth programme accepts provider label hash through linked competition ID');
select is(pg_temp.snapshot('senior','sportlink.pool_results_today')#>>'{sport,items,0,id}','cup-played','started cup game is on results, using the same linked context');

select ok((select private.sportlink_match_matches_team_selection_v1(s.tenant_id,s.data_source_id,m,
  jsonb_build_object('mode','selected','matchLocation','both','teamContexts',jsonb_build_array(
    pg_temp.context('senior') || '{"competitionSelectionMode":"pinned","competitionId":"cup","poolId":"cup-pool"}'::jsonb)))
  from s177_source s join public.sports_matches m on m.tenant_id=s.tenant_id and m.external_id='cup-next'),
  'pinned club selection also accepts the linked catalog competition identity');
select ok(not (select private.sportlink_match_matches_team_selection_v1(s.tenant_id,s.data_source_id,m,
  jsonb_build_object('mode','selected','matchLocation','both','teamContexts',jsonb_build_array(
    pg_temp.context('senior') || '{"competitionSelectionMode":"pinned","competitionId":"league","poolId":"league-pool"}'::jsonb)))
  from s177_source s join public.sports_matches m on m.tenant_id=s.tenant_id and m.external_id='cup-next'),
  'pinned club selection still rejects the wrong competition');

update public.sports_standings set rows_json='[{"externalId":"foreign","teamName":"Foreign"}]' where external_id='youth' and tenant_id='10000000-0000-4000-8000-000000001771';
select is(pg_temp.snapshot('youth')#>>'{sport,emptyStateCode}','STANDINGS_NOT_PUBLISHED','standing without selected team fails closed');
update public.sports_standings set scores_published=false where external_id='cup' and tenant_id='10000000-0000-4000-8000-000000001771';
select is(pg_temp.snapshot('senior')#>>'{sport,emptyStateCode}','STANDINGS_NOT_PUBLISHED','unpublished standing never leaks rows');
update public.sports_standings set scores_published=true where external_id='cup' and tenant_id='10000000-0000-4000-8000-000000001771';

update public.sports_matches set starts_at=pg_temp.match_time_today(time '11:00',false) where external_id='league-next' and tenant_id='10000000-0000-4000-8000-000000001771';
select is(pg_temp.snapshot('senior')#>>'{sport,emptyStateCode}','COMPETITION_CONTEXT_UNRESOLVED','two same-day competitions remain explicitly ambiguous');
update public.sports_matches set starts_at=now()+interval '10 days' where external_id='league-next' and tenant_id='10000000-0000-4000-8000-000000001771';

create function pg_temp.draft(p_name text,p_team text default 'senior',p_blueprint text default 'sportlink.pool_standings')
returns jsonb language sql stable as $$
select jsonb_build_object('blueprintKey',p_blueprint,'context',pg_temp.context(p_team),'name',p_name,
 'orientation','landscape','title',p_name,'display','{}'::jsonb,'templateVersionId',t.current_published_version_id,
 'themeSelection','{"ref":{"catalog":"v2","id":"fieldflow","version":"1.0.0"},"modePolicy":{"kind":"fixed","mode":"light"},"accent":null,"support":null,"categoryOverrides":[]}'::jsonb)
 from public.dynamic_templates t where t.slide_type=case when p_blueprint like '%standings' then 'sport_standing' else 'sport_program' end
 and t.status='published' and t.orientation='landscape' order by t.slug limit 1
$$;
create temp table s177_created(result jsonb); grant all on s177_created to authenticated;
select is(private.dynamic_slide_purpose_v1(pg_temp.draft('Welkom','senior','sportlink.visitor_arrivals'),'landscape'),
 private.dynamic_slide_purpose_v1(pg_temp.draft('Andere naam','senior','sportlink.visitor_arrivals') ||
 '{"arrival":{"minutesBefore":90,"minutesAfter":30,"showClubLogo":false}}'::jsonb,'landscape'),
 'arrival defaults and display changes do not create a different purpose');
select isnt(private.dynamic_slide_purpose_v1(pg_temp.draft('Welkom','senior','sportlink.visitor_arrivals'),'landscape'),
 private.dynamic_slide_purpose_v1(pg_temp.draft('Morgen welkom','senior','sportlink.visitor_arrivals') ||
 '{"arrival":{"minutesBefore":1440,"minutesAfter":30}}'::jsonb,'landscape'),
 'different arrival periods remain valid separate selections');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001771',true);
select throws_ok($$select public.create_sportlink_slide_batch_v6(tenant_id,data_source_id,
 jsonb_build_array(pg_temp.draft('Eerste naam'),pg_temp.draft('Tweede naam')),
 '60000000-0000-4000-8000-000000001770') from s177_source$$,
 '22023','duplicate Sportlink purpose within batch','one batch cannot contain the same purpose under two names');
select lives_ok($$insert into s177_created select public.create_sportlink_slide_batch_v6(tenant_id,data_source_id,
 jsonb_build_array(pg_temp.draft('Kantine bekerstand')),'60000000-0000-4000-8000-000000001771') from s177_source$$,'new named slide uses existing version and render pipeline');
select lives_ok($$select public.create_sportlink_slide_batch_v6(tenant_id,data_source_id,
 jsonb_build_array(pg_temp.draft('Kantine bekerstand')),'60000000-0000-4000-8000-000000001771') from s177_source$$,'same request is idempotent');
select throws_ok($$select public.create_sportlink_slide_batch_v6(tenant_id,data_source_id,
 jsonb_build_array(pg_temp.draft('Ander label, dezelfde slide')),'60000000-0000-4000-8000-000000001772') from s177_source$$,
 '23505','Sportlink slides already exist','a fresh wizard request cannot duplicate the same purpose');
select is((select count(*)::integer from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000001771'),1,'duplicate request leaves no extra slides');
select throws_ok($$select public.create_sportlink_slide_batch_v6(tenant_id,data_source_id,
 jsonb_build_array(pg_temp.draft('New youth','youth'),pg_temp.draft('Already exists')),'60000000-0000-4000-8000-000000001773') from s177_source$$,
 '23505','Sportlink slides already exist','mixed duplicate batch rolls back atomically');
select is((select count(*)::integer from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000001771'),1,'no partial creation on mixed duplicate batch');
select is((select count(*)::integer from public.dynamic_render_jobs where tenant_id='10000000-0000-4000-8000-000000001771'),1,'no orphan render jobs on duplicate rollback');
-- Promote the first real snapshot exactly as the completion pipeline does,
-- so renaming is proven on a published slide without an authoring draft.
reset role;
update public.dynamic_slide_snapshots set status='ready',completed_at=now()
where tenant_id='10000000-0000-4000-8000-000000001771';
update public.dynamic_slides set current_snapshot_id=(select (result#>>'{slides,0,snapshotId}')::uuid from s177_created),status='ready'
where tenant_id='10000000-0000-4000-8000-000000001771';
select ok((select current_published_version_id is not null and active_draft_version_id is null from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000001771'),
 'fixture reproduces published slide with no draft');
set local role authenticated;
select lives_ok($$select public.rename_dynamic_slide_v1('10000000-0000-4000-8000-000000001771',
 (result#>>'{slides,0,slideId}')::uuid,'Kantine · Senioren beker',0) from s177_created$$,'library label can be renamed');
select is((select library_sort_name from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000001771'),'Kantine · Senioren beker','searchable name updates immediately');
select is((select name from public.dynamic_slide_versions where tenant_id='10000000-0000-4000-8000-000000001771'),'Kantine bekerstand','rename does not rewrite design version');
select ok((select current_published_version_id is not null and active_draft_version_id is null from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000001771'),
 'library rename does not create a draft or replace published version');
select lives_ok($$select public.create_or_resume_dynamic_slide_version_v1((result#>>'{slides,0,slideId}')::uuid,null) from s177_created$$,
 'edit action prepares a draft for a published slide');
select lives_ok($$select public.create_or_resume_dynamic_slide_version_v1((result#>>'{slides,0,slideId}')::uuid,null) from s177_created$$,
 'repeated edit action resumes the same draft');
select is((select count(*)::integer from public.dynamic_slide_versions where tenant_id='10000000-0000-4000-8000-000000001771' and status='draft'),1,
 'edit action cannot create duplicate drafts');
select throws_ok($$select public.rename_dynamic_slide_v1('10000000-0000-4000-8000-000000001771',
 (result#>>'{slides,0,slideId}')::uuid,'Stale name',0) from s177_created$$,'40001','slide label changed','stale rename is rejected');
select throws_ok($$select public.rename_dynamic_slide_v1('10000000-0000-4000-8000-000000001772',
 (result#>>'{slides,0,slideId}')::uuid,'Other tenant',1) from s177_created$$,'42501','slide write permission required','tenant cannot rename through a different tenant ID');
select throws_ok($$select public.rename_dynamic_slide_v1('10000000-0000-4000-8000-000000001771',
 (result#>>'{slides,0,slideId}')::uuid,' ',1) from s177_created$$,'22023','invalid slide label','empty name is rejected');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001772',true);
set local role authenticated;
select is((select count(*)::integer from public.dynamic_slides where tenant_id='10000000-0000-4000-8000-000000001771'),0,'unrelated tenant cannot read managed slides');
select throws_ok($$select public.rename_dynamic_slide_v1('10000000-0000-4000-8000-000000001771',
 (result#>>'{slides,0,slideId}')::uuid,'Foreign actor',1) from s177_created$$,'42501','slide write permission required','unrelated actor cannot rename');
reset role;
set local role anon;
select throws_ok($$select public.rename_dynamic_slide_v1('10000000-0000-4000-8000-000000001771','20000000-0000-4000-8000-000000001771','Anon',0)$$,
 '42501',null,'anonymous rename has no execution grant');
reset role;
select * from finish();
rollback;
