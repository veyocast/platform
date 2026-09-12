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
  '00000000-0000-4000-8000-000000001761',
  'authenticated',
  'authenticated',
  's176-owner@veyocast.test',
  'test',
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.profiles (id, display_name) values (
  '00000000-0000-4000-8000-000000001761',
  'S176 owner'
);

insert into public.tenants (id, name, slug) values (
  '10000000-0000-4000-8000-000000001761',
  'S176 tenant',
  's176-tenant'
);

insert into public.tenant_settings (tenant_id) values (
  '10000000-0000-4000-8000-000000001761'
);

insert into public.tenant_memberships (tenant_id, user_id, role) values (
  '10000000-0000-4000-8000-000000001761',
  '00000000-0000-4000-8000-000000001761',
  'tenant_owner'
);

create temporary table s176_source (
  tenant_id uuid not null,
  connection_id uuid not null,
  data_source_id uuid not null
);
grant select on s176_source to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001761', true);

select public.upsert_sportlink_connection_v1(
  '10000000-0000-4000-8000-000000001761',
  'Sportlink · S176',
  'S176',
  '1581',
  'encrypted-value',
  'initialization-vector',
  'authentication-tag'
);

reset role;

insert into s176_source (tenant_id, connection_id, data_source_id)
select connection.tenant_id, connection.id, connection.data_source_id
from public.sportlink_connections connection
join public.dynamic_data_sources source
  on source.tenant_id = connection.tenant_id
 and source.id = connection.data_source_id
where connection.tenant_id = '10000000-0000-4000-8000-000000001761'
  and source.name = 'Sportlink · S176';


insert into public.sports_teams(tenant_id,source_connection_id,external_id,name,metadata)
select tenant_id,connection_id,'s176-own','Eigen team','{"competitionOptions":[{"externalId":"comp","poolExternalId":"pool","period":"phase","season":"2026"}]}'::jsonb from s176_source;

create function pg_temp.match_snapshot(p_blueprint text, p_location text default 'both', p_tenant uuid default '10000000-0000-4000-8000-000000001761')
returns jsonb language sql stable as $$
  select private.build_dynamic_snapshot_data(jsonb_populate_record(null::public.dynamic_slides,
    jsonb_build_object('id','20000000-0000-4000-8000-000000001761','tenant_id',p_tenant,
      'data_source_id',s.data_source_id,'name','Aftraptest','slide_type',case when p_blueprint like '%results%' then 'sport_results' else 'sport_program' end,
      'orientation','landscape','selection_mode','latest','template_id',t.id,'template_version_id',t.current_published_version_id,
      'configuration_json',jsonb_build_object('blueprintKey',p_blueprint,'title','Aftraptest',
        'context','{"providerTeamId":"s176-own","competitionSelectionMode":"auto_current","competitionId":null,"phaseId":null,"poolId":null,"seasonId":null}'::jsonb,
        'teamSelection',jsonb_build_object('mode','all','matchLocation',p_location,'teamContexts','[]'::jsonb))))
    )
  from s176_source s cross join lateral (
    select * from public.dynamic_templates where slide_type=case when p_blueprint like '%results%' then 'sport_results' else 'sport_program' end
      and status='published' and orientation='landscape' order by slug limit 1
  ) t
$$;

insert into public.sports_matches(tenant_id,source_connection_id,external_id,starts_at,status,home_team,away_team,competition,pool,scores_published,active)
select s.tenant_id,s.connection_id,f.id,
  case when f.id='at-kickoff' then now() else pg_temp.match_time_today(time '12:00',f.started) end,
  f.status,jsonb_build_object('externalId',f.home,'name',f.home,'score',9),
  jsonb_build_object('externalId',f.away,'name',f.away,'score',8),
  '{"externalId":"comp","period":"phase","season":"2026"}'::jsonb,
  jsonb_build_object('externalId',f.pool),f.published,true
from s176_source s cross join (values
  ('future',false,'scheduled','s176-own','opponent','pool',false),
  ('at-kickoff',true,'scheduled','s176-own','opponent','pool',false),
  ('started-away',true,'scheduled','opponent','s176-own','pool',false),
  ('finished',true,'finished','s176-own','opponent','pool',true),
  ('postponed-future',false,'postponed','s176-own','opponent','pool',false),
  ('postponed-past',true,'postponed','s176-own','opponent','pool',false),
  ('cancelled',true,'cancelled','s176-own','opponent','pool',false),
  ('foreign-pool',true,'scheduled','foreign-home','foreign-away','pool',false),
  ('wrong-pool',true,'scheduled','foreign-home','foreign-away','other-pool',false)
) f(id,started,status,home,away,pool,published);

create function pg_temp.match_ids(p_blueprint text,p_location text default 'both') returns text language sql stable as $$
  select coalesce(string_agg(item->>'id',',' order by item->>'id'),'')
  from jsonb_array_elements(pg_temp.match_snapshot(p_blueprint,p_location)#>'{sport,items}') item
$$;

select is(private.sportlink_match_phase_v1('scheduled','2026-09-12 12:00:00+00','2026-09-12 11:59:59.999+00'),'program','one millisecond before kickoff remains in programme');
select is(private.sportlink_match_phase_v1('scheduled','2026-09-12 12:00:00+00','2026-09-12 14:00:00+02'),'results','exact kickoff and equivalent timezones count as started');
select is(private.sportlink_match_phase_v1('scheduled','2026-09-12 12:00:00+00','2026-09-12 12:00:00.001+00'),'results','after kickoff does not need a provider final-status update');
select is(private.sportlink_match_phase_v1('cancelled',now(),now()),null::text,'cancelled matches do not become results');
select is(private.sportlink_match_phase_v1('postponed',now(),now()),null::text,'postponed matches are not assumed to have started');
select is(private.sportlink_match_phase_v1('scheduled',null,now()),null::text,'missing kickoff has no fabricated phase');
select is(pg_temp.match_ids('sportlink.club_schedule_today'),'future,postponed-future','club programme contains only genuinely upcoming fixtures');
select is(pg_temp.match_ids('sportlink.club_schedule_next_7_days'),'future,postponed-future','seven-day programme also excludes started matches');
select is(pg_temp.match_ids('sportlink.club_results_today'),'at-kickoff,finished,started-away','club results include started home and away fixtures without scores');
select is(pg_temp.match_ids('sportlink.club_results_today','home'),'at-kickoff,finished','home-only identity scope remains intact');
select is(pg_temp.match_ids('sportlink.club_results_today','away'),'started-away','away-only identity scope remains intact');
select is(pg_temp.match_ids('sportlink.pool_results_today'),'at-kickoff,finished,foreign-pool,started-away','exact pool includes started foreign fixtures but never another pool');
select is(pg_temp.match_ids('sportlink.pool_schedule_today'),'future,postponed-future','pool programme keeps the same kickoff cutoff');
select ok((select bool_and(not(item ? 'homeScore') and not(item ? 'awayScore')) from jsonb_array_elements(pg_temp.match_snapshot('sportlink.club_results_today')#>'{sport,items}') item where item->>'id' in ('at-kickoff','started-away')),'unpublished placeholder scores are not exposed as actual results');
select is((select item->>'homeScore' from jsonb_array_elements(pg_temp.match_snapshot('sportlink.club_results_today')#>'{sport,items}') item where item->>'id'='finished'),'9','published final scores remain visible');
select ok((select bool_and(item ? 'kickoffAt') from jsonb_array_elements(pg_temp.match_snapshot('sportlink.club_schedule_today')#>'{sport,items}') item),'absolute kickoff is frozen for the offline player cutoff');
select is(pg_temp.match_snapshot('sportlink.club_results_today','both','10000000-0000-4000-8000-000000001762')#>'{sport,items}','[]'::jsonb,'another tenant cannot select these source fixtures');
select ok(not has_function_privilege('authenticated','public.refresh_sportlink_time_sensitive_slides_v1(uuid)','execute'),'normal Studio users cannot invoke the worker refresh');
select ok(not has_function_privilege('authenticated','private.sportlink_match_phase_v1(text,timestamptz,timestamptz)','execute'),'private phase helper is not an exposed Studio RPC');

select * from finish();
rollback;
