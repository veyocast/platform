-- S295. Source observations own only their exact covered scope. Immutable
-- configurations/releases and historical match rows remain untouched.
begin;

-- Last complete scope membership determines visible data immediately. The
-- normalized rows retain the established three-observation deactivation guard.
create table private.sportlink_match_observations_s295(
 tenant_id uuid not null,connection_id uuid not null,scope_key text not null,
 scope_json jsonb not null,observed_at timestamptz not null default clock_timestamp(),
 sync_run_id uuid not null references public.sportlink_sync_runs(id),presence_at_json jsonb not null default '{}'::jsonb,source_observations jsonb not null default '[]'::jsonb,
 primary key(tenant_id,connection_id,scope_key),
 foreign key(tenant_id,connection_id)references public.sportlink_connections(tenant_id,id)on delete cascade
);
alter table private.sportlink_match_observations_s295 enable row level security;
alter table private.sportlink_match_observations_s295 force row level security;
revoke all on private.sportlink_match_observations_s295 from public,anon,authenticated,service_role;
create function private.sportlink_match_is_visible_s295_v1(p_match public.sports_matches)
returns boolean language sql stable security definer set search_path='' as $$
 with covered as(select observation.scope_json,
   case when observation.scope_json->'complete'='true'::jsonb then observation.observed_at else(observation.presence_at_json->>p_match.external_id)::timestamptz end observed_at,
   observation.scope_json->'complete'='false'::jsonb or coalesce(case when p_match.status='finished'then observation.scope_json->'resultExternalIds'else observation.scope_json->'programExternalIds'end,'[]'::jsonb)?p_match.external_id present
  from private.sportlink_match_observations_s295 observation
  join public.sportlink_connections connection on connection.tenant_id=observation.tenant_id and connection.id=observation.connection_id
  where observation.tenant_id=p_match.tenant_id and observation.connection_id=p_match.source_connection_id
   and observation.scope_json->>'dataset'=case when p_match.status='finished'then 'results'else 'program'end
   and(observation.scope_json->'complete'='true'::jsonb or observation.presence_at_json?p_match.external_id)
   and(p_match.starts_at at time zone connection.timezone)::date between(observation.scope_json->>'fromDate')::date and(observation.scope_json->>'throughDate')::date
   and case when observation.scope_json->>'scope'='pool'then
    private.sync_sportlink_effective_pool_v1(p_match)=observation.scope_json->>'poolExternalId'
    and(nullif(observation.scope_json->>'competitionExternalId','')is null or private.sportlink_competition_identity_v1(p_match.competition,p_match.pool)=observation.scope_json->>'competitionExternalId')
    and(nullif(observation.scope_json->>'phase','')is null or p_match.competition->>'period'=observation.scope_json->>'phase')
    and(nullif(observation.scope_json->>'season','unknown')is null or p_match.competition->>'season'=observation.scope_json->>'season')
   else exists(select 1 from public.sports_teams team where team.tenant_id=p_match.tenant_id and team.source_connection_id=p_match.source_connection_id and team.active
    and team.external_id in(p_match.home_team->>'externalId',p_match.away_team->>'externalId'))end)
 select coalesce((select bool_or(present)
  from covered where observed_at=(select max(observed_at)from covered)),true)
$$;
revoke all on function private.sportlink_match_is_visible_s295_v1(public.sports_matches)from public,anon,authenticated,service_role;

-- Add the observation only at the leased service-role completion boundary.
-- Existing callers keep their nine-argument API through the versioned wrapper.
alter function public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)
 rename to complete_sportlink_sync_before_s295_v4;
create function public.complete_sportlink_sync_v5(
 p_run_id uuid,p_worker_id text,p_club jsonb default '{}'::jsonb,
 p_club_logo jsonb default '{}'::jsonb,p_team_logos jsonb default '[]'::jsonb,
 p_teams jsonb default '[]'::jsonb,p_matches jsonb default '[]'::jsonb,
 p_activities jsonb default '[]'::jsonb,p_standings jsonb default '[]'::jsonb,
 p_match_observation jsonb default '{}'::jsonb
)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;run_record public.sportlink_sync_runs%rowtype;observation jsonb;prior text;observed_at timestamptz:=clock_timestamp();
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service_role_required'using errcode='42501';end if;
 select *into run_record from public.sportlink_sync_runs where id=p_run_id and status='running'and worker_id=p_worker_id for update;
 if not found then raise exception 'sportlink_sync_lease_not_owned'using errcode='42501';end if;
 observation:=coalesce(p_match_observation,'{}'::jsonb);
 if observation<>'{}'::jsonb and(jsonb_typeof(observation)is distinct from'object'or observation->>'schemaVersion'is distinct from'1'
  or coalesce(observation->>'kind','')not in('full','details')or jsonb_typeof(observation->'scopes')is distinct from'array'
  or jsonb_array_length(observation->'scopes')>400)then raise exception 'invalid_match_observation'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(observation->'scopes','[]'::jsonb))scope
  where coalesce(scope->>'scope','')not in('club','pool')or jsonb_typeof(scope->'complete')is distinct from'boolean'
   or coalesce(scope->>'fromDate','')!~'^\d{4}-\d{2}-\d{2}$'or coalesce(scope->>'throughDate','')!~'^\d{4}-\d{2}-\d{2}$'
   or(scope->>'throughDate')::date<(scope->>'fromDate')::date
   or(scope->>'throughDate')::date-(scope->>'fromDate')::date>42
   or jsonb_typeof(scope->'resultExternalIds')is distinct from'array'or jsonb_typeof(scope->'programExternalIds')is distinct from'array'
   or(scope?'resultsComplete'and jsonb_typeof(scope->'resultsComplete')is distinct from'boolean')
   or(scope?'programComplete'and jsonb_typeof(scope->'programComplete')is distinct from'boolean')
   or(scope?'programFromDate'and coalesce(scope->>'programFromDate','')!~'^\d{4}-\d{2}-\d{2}$')
   or(scope?'programThroughDate'and coalesce(scope->>'programThroughDate','')!~'^\d{4}-\d{2}-\d{2}$')
   or coalesce(scope->>'programThroughDate',scope->>'throughDate')::date<coalesce(scope->>'programFromDate',scope->>'fromDate')::date
   or coalesce(scope->>'programThroughDate',scope->>'throughDate')::date-coalesce(scope->>'programFromDate',scope->>'fromDate')::date>42
   or(scope->>'scope'='pool'and nullif(scope->>'poolExternalId','')is null))then
  raise exception 'invalid_match_observation_scope'using errcode='22023';end if;
 -- A legacy detail caller has no scope metadata; it is still never a full feed.
 if run_record.dataset_group='match_details'then observation:=jsonb_build_object('schemaVersion',1,'kind','details','scopes','[]'::jsonb);
 elsif run_record.dataset_group<>'matches'then observation:='{}'::jsonb;end if;
 if run_record.dataset_group='matches'and observation->>'kind'='full'then
  insert into private.sportlink_match_observations_s295(tenant_id,connection_id,scope_key,scope_json,observed_at,sync_run_id,source_observations,presence_at_json)
  select run_record.tenant_id,run_record.connection_id,
   encode(extensions.digest(jsonb_build_array(scope->>'scope',scope->>'poolExternalId',scope->>'competitionExternalId',scope->>'season',scope->>'phase',dataset,case when coalesce(scope->case when dataset='results'then 'resultsComplete'else 'programComplete'end,scope->'complete')='true'::jsonb then 'complete'else 'positive'end)::text,'sha256'),'hex'),
   scope||jsonb_build_object('dataset',dataset,'complete',coalesce(scope->case when dataset='results'then 'resultsComplete'else 'programComplete'end,scope->'complete')='true'::jsonb,
    'fromDate',case when dataset='program'then coalesce(scope->>'programFromDate',scope->>'fromDate')else scope->>'fromDate'end,
    'throughDate',case when dataset='program'then coalesce(scope->>'programThroughDate',scope->>'throughDate')else scope->>'throughDate'end),observed_at,p_run_id,coalesce((select jsonb_agg(jsonb_build_object(
    'articleKey',left(trace->>'articleKey',80),'correlationId',left(trace->>'correlationId',120),'observedAt',left(trace->>'observedAt',40),
    'recordCount',case when trace->>'recordCount'~'^[0-9]{1,8}$'then(trace->>'recordCount')::integer end,
    'normalizedCount',case when trace->>'normalizedCount'~'^[0-9]{1,8}$'then(trace->>'normalizedCount')::integer end,
    'durationMs',case when trace->>'durationMs'~'^[0-9]{1,8}$'then(trace->>'durationMs')::integer end,
    'complete',trace->'complete'='true'::jsonb))from jsonb_array_elements(case when jsonb_typeof(observation->'sourceObservations')='array'then observation->'sourceObservations'else '[]'::jsonb end)trace
    where (trace->>'poolExternalId')is not distinct from(scope->>'poolExternalId')
     and trace->>'articleKey'=case when dataset='results'then case when scope->>'scope'='pool'then 'pouleuitslagen'else 'uitslagen'end else case when scope->>'scope'='pool'then 'poule-programma'else 'programma'end end),'[]'::jsonb),
   coalesce((select jsonb_object_agg(value,observed_at)from jsonb_array_elements_text(scope->case when dataset='results'then 'resultExternalIds'else 'programExternalIds'end)),'{}'::jsonb)
  from jsonb_array_elements(coalesce(observation->'scopes','[]'::jsonb))scope cross join(values('results'),('program'))k(dataset)
  where coalesce(scope->case when dataset='results'then 'resultsComplete'else 'programComplete'end,scope->'complete')='true'::jsonb
   or jsonb_array_length(coalesce(scope->case when dataset='results'then 'resultExternalIds'else 'programExternalIds'end,'[]'::jsonb))>0
  on conflict(tenant_id,connection_id,scope_key)do update set scope_json=excluded.scope_json,observed_at=excluded.observed_at,sync_run_id=excluded.sync_run_id,source_observations=excluded.source_observations,
   presence_at_json=coalesce((select jsonb_object_agg(key,value)from jsonb_each(private.sportlink_match_observations_s295.presence_at_json||excluded.presence_at_json)where(value#>>'{}')::timestamptz>=now()-interval '45 days'),'{}'::jsonb);
 end if;
 prior:=current_setting('veyocast.sportlink_match_observation',true);
 perform set_config('veyocast.sportlink_match_observation',observation::text,true);
 result:=public.complete_sportlink_sync_before_s295_v4(p_run_id,p_worker_id,p_club,p_club_logo,p_team_logos,p_teams,p_matches,p_activities,p_standings);
 perform set_config('veyocast.sportlink_match_observation',coalesce(prior,''),true);
 return result;
end;$$;
revoke all on function public.complete_sportlink_sync_before_s295_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
revoke all on function public.complete_sportlink_sync_v5(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.complete_sportlink_sync_v5(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)to service_role;

create function public.complete_sportlink_sync_v4(
 p_run_id uuid,p_worker_id text,p_club jsonb default '{}'::jsonb,
 p_club_logo jsonb default '{}'::jsonb,p_team_logos jsonb default '[]'::jsonb,
 p_teams jsonb default '[]'::jsonb,p_matches jsonb default '[]'::jsonb,
 p_activities jsonb default '[]'::jsonb,p_standings jsonb default '[]'::jsonb
)returns jsonb language sql security definer set search_path='' as $$
 select public.complete_sportlink_sync_v5(p_run_id,p_worker_id,p_club,p_club_logo,p_team_logos,p_teams,p_matches,p_activities,p_standings,'{}'::jsonb)
$$;
revoke all on function public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.complete_sportlink_sync_v4(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)to service_role;

-- Keep the established normalization/completion wrappers. Replace only the
-- underlying write semantics, with explicit predecessor checks.
do $migration$
declare definition text;before text;protect text;
begin
 definition:=pg_get_functiondef('public.record_sportlink_sync_pre_context_v1(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
 before:='source_id uuid; read_count integer := 0; affected_count integer := 0;';
 if position(before in definition)=0 then raise exception 'S295 record declaration predecessor mismatch';end if;
 definition:=replace(definition,before,before||$m$
  observation jsonb:=coalesce(nullif(current_setting('veyocast.sportlink_match_observation',true),'')::jsonb,'{}'::jsonb);
  detail_only boolean:=coalesce(observation->>'kind'='details',false);$m$);
 before:=$m$(item->'homeTeam'->'score') is not null$m$;
 if position(before in definition)=0 then raise exception 'S295 score predecessor mismatch';end if;
 definition:=replace(definition,before,$m$coalesce((jsonb_typeof(item#>'{homeTeam,score}')='number'and jsonb_typeof(item#>'{awayTeam,score}')='number'),false)$m$);
 before:=$m$starts_at=excluded.starts_at,status=excluded.status,home_team=excluded.home_team,
    away_team=excluded.away_team,competition=excluded.competition,pool=excluded.pool,
    venue=excluded.venue,dressing_rooms=excluded.dressing_rooms,officials=excluded.officials,
    cancellation_reason=excluded.cancellation_reason,scores_published=excluded.scores_published,
    expires_at=excluded.expires_at,last_synced_at=now(),active=true,missing_sync_count=0;$m$;
 if position(before in definition)=0 then raise exception 'S295 match upsert predecessor mismatch';end if;
 protect:=$m$(detail_only or(sports_matches.status='finished'and sports_matches.scores_published and excluded.status='scheduled'and not coalesce(excluded.scores_published,false)))$m$;
 definition:=replace(definition,before,replace($m$
    starts_at=case when detail_only then sports_matches.starts_at else excluded.starts_at end,
    status=case when PROTECT then sports_matches.status else excluded.status end,
    home_team=(case when detail_only then excluded.home_team||sports_matches.home_team else sports_matches.home_team||excluded.home_team end)||case when PROTECT then jsonb_build_object('score',sports_matches.home_team->'score')else '{}'::jsonb end,
    away_team=(case when detail_only then excluded.away_team||sports_matches.away_team else sports_matches.away_team||excluded.away_team end)||case when PROTECT then jsonb_build_object('score',sports_matches.away_team->'score')else '{}'::jsonb end,
    competition=case when detail_only then excluded.competition||sports_matches.competition else excluded.competition end,
    pool=case when detail_only then excluded.pool||sports_matches.pool else excluded.pool end,
    venue=sports_matches.venue||excluded.venue,dressing_rooms=sports_matches.dressing_rooms||excluded.dressing_rooms,
    officials=case when detail_only and excluded.officials='[]'::jsonb then sports_matches.officials else excluded.officials end,
    cancellation_reason=case when PROTECT then sports_matches.cancellation_reason else excluded.cancellation_reason end,
    scores_published=case when PROTECT then sports_matches.scores_published else coalesce(excluded.scores_published,false)end,
    expires_at=excluded.expires_at,last_synced_at=now(),
    active=case when detail_only then sports_matches.active else true end,
    missing_sync_count=case when detail_only or PROTECT then sports_matches.missing_sync_count else 0 end;$m$,'PROTECT',protect));
 before:=$m$if jsonb_array_length(coalesce(p_matches,'[]'::jsonb)) > 0 then
    update public.sports_matches match
    set missing_sync_count=match.missing_sync_count+1,
      active=case when match.missing_sync_count+1 >= 3 then false else match.active end
    where match.tenant_id=connection.tenant_id
      and match.source_connection_id=connection.id
      and match.starts_at >= now()-interval '14 days'
      and not exists (
        select 1 from jsonb_array_elements(p_matches) item
        where item->>'externalId'=match.external_id
      );
  end if;$m$;
 if position(before in definition)=0 then raise exception 'S295 match absence predecessor mismatch';end if;
 definition:=replace(definition,before,$m$
  if observation->>'kind'='full'and not detail_only then
    update public.sports_matches match
    set missing_sync_count=match.missing_sync_count+1,
      active=case when match.missing_sync_count+1>=3 then false else match.active end
    where match.tenant_id=connection.tenant_id and match.source_connection_id=connection.id and match.active
      -- Presence in any actual observation wins over overlapping absence.
      and not exists(select 1 from jsonb_array_elements(coalesce(observation->'scopes','[]'::jsonb))seen
        where coalesce(case when match.status='finished'then seen->'resultExternalIds'else seen->'programExternalIds'end,'[]'::jsonb)?match.external_id)
      and exists(select 1 from jsonb_array_elements(coalesce(observation->'scopes','[]'::jsonb))scope
        where coalesce(scope->case when match.status='finished'then 'resultsComplete'else 'programComplete'end,scope->'complete')='true'::jsonb
          and(match.starts_at at time zone connection.timezone)::date between
           (case when match.status='finished'then scope->>'fromDate'else coalesce(scope->>'programFromDate',scope->>'fromDate')end)::date and
           (case when match.status='finished'then scope->>'throughDate'else coalesce(scope->>'programThroughDate',scope->>'throughDate')end)::date
          and(case when scope->>'scope'='pool'then
            private.sync_sportlink_effective_pool_v1(match)=scope->>'poolExternalId'
            and(nullif(scope->>'competitionExternalId','')is null or private.sportlink_competition_identity_v1(match.competition,match.pool)=scope->>'competitionExternalId')
            and(nullif(scope->>'phase','')is null or match.competition->>'period'=scope->>'phase')
            and(nullif(scope->>'season','unknown')is null or match.competition->>'season'=scope->>'season')
          else exists(select 1 from public.sports_teams team where team.tenant_id=connection.tenant_id and team.source_connection_id=connection.id and team.active
            and team.external_id in(match.home_team->>'externalId',match.away_team->>'externalId'))end)
          and not(coalesce(case when match.status='finished'then scope->'resultExternalIds'else scope->'programExternalIds'end,'[]'::jsonb)?match.external_id));
  end if;$m$);
 execute definition;
end;$migration$;

-- Own programme/results keep their exact team and home/away selection. A
-- separate, context-checked block supplies the rest of the same pool.
do $migration$
declare definition text;before text;
begin
 definition:=pg_get_functiondef('private.build_sync_sport_snapshot_s291_v1(public.dynamic_slides)'::regprocedure);
 -- Choose the latest official observation in the exact resolved context
 -- before checking publication or own-row identity. An explicit empty/private
 -- observation must never fall back to an older published provider identity.
 before:='candidate.active and candidate.scores_published';
 if position(before in definition)=0 then raise exception 'S295 official standing publication predecessor mismatch';end if;
 definition:=replace(definition,before,'candidate.active');
 before:=$m$and exists(select 1 from jsonb_array_elements(candidate.rows_json)row where private.sportlink_standing_row_matches_team_v1(row,standing_identity))$m$;
 if position(before in definition)=0 then raise exception 'S295 official standing identity predecessor mismatch';end if;
 definition:=replace(definition,before,'');
 before:='order by candidate.last_synced_at desc,candidate.id limit 1;';
 if position(before in definition)=0 then raise exception 'S295 official standing latest predecessor mismatch';end if;
 definition:=replace(definition,before,before||$m$
  if standing.id is not null and(not coalesce(standing.scores_published,false)
   or not exists(select 1 from jsonb_array_elements(standing.rows_json)row where private.sportlink_standing_row_matches_team_v1(row,standing_identity)))then
   standing.rows_json:='[]'::jsonb;
  end if;$m$);
 definition:=replace(definition,'rich_matchday jsonb;','rich_matchday jsonb;pool_result_items jsonb;local_today date;connection_timezone text;');
 before:=$m$if scope_context->>'competitionId'is null or scope_context->>'poolId'is null then$m$;
 if position(before in definition)=0 then raise exception 'S295 matchday context predecessor mismatch';end if;
 definition:=replace(definition,before,$m$select timezone into connection_timezone from public.sportlink_connections where id=connection_id and tenant_id=p_slide.tenant_id;
  local_today:=(now()at time zone connection_timezone)::date;
  if scope_context->>'competitionId'is null or scope_context->>'poolId'is null then$m$);
 before:=$m$and match.active and match.scores_published and(match.expires_at is null or match.expires_at>now())$m$;
 if position(before in definition)=0 then raise exception 'S295 matchday expiry predecessor mismatch';end if;
 definition:=replace(definition,before,$m$and match.active
   and((match.status='finished'and match.scores_published and(match.starts_at at time zone connection_timezone)::date between local_today-7 and local_today)
    or(match.status='scheduled'and match.starts_at>now()))$m$);
 before:=$m$ctx:=scope_context||jsonb_build_object('tenantId',p_slide.tenant_id);$m$;
 if position(before in definition)=0 then raise exception 'S295 pool results predecessor mismatch';end if;
 definition:=replace(definition,before,$m$
  select coalesce(jsonb_agg(private.sync_onzetrots_fixture_v1(match,own_club_id)||jsonb_build_object(
    'tenantId',p_slide.tenant_id,'sourceConnectionId',connection_id,
    'competitionId',scope_context->>'competitionId','poolId',scope_context->>'poolId',
    'seasonId',scope_context->>'seasonId','phaseId',resolved_context->>'phaseId')order by match.starts_at desc,match.external_id),'[]'::jsonb)
   into pool_result_items
  from public.sports_matches match where match.tenant_id=p_slide.tenant_id and match.source_connection_id=connection_id
   and match.active and match.status='finished'and match.scores_published
   and(match.starts_at at time zone connection_timezone)::date between local_today-7 and local_today
   and private.sportlink_competition_identity_v1(match.competition,match.pool)=scope_context->>'competitionId'
   and private.sync_sportlink_effective_pool_v1(match)=scope_context->>'poolId'
   and nullif(match.competition->>'season','unknown')is not distinct from nullif(scope_context->>'seasonId','unknown')
   and(resolved_context->>'phaseId'is null or match.competition->>'period'=resolved_context->>'phaseId');
  if jsonb_array_length(pool_result_items)>200 then raise exception 'Complete matchday pool exceeds 200 records'using errcode='23514';end if;
  ctx:=scope_context||jsonb_build_object('tenantId',p_slide.tenant_id);$m$);
 before:=$m$'results',jsonb_build_object('context',ctx,'items',result_items),$m$;
 if position(before in definition)=0 then raise exception 'S295 pool block predecessor mismatch';end if;
 definition:=replace(definition,before,before||$m$
   'poolResults',jsonb_build_object('context',ctx,'sourceConnectionId',connection_id,'phaseId',resolved_context->>'phaseId','items',pool_result_items),$m$);
 execute definition;
end;$migration$;

do $migration$
declare definition text;before text;
begin
 definition:=pg_get_functiondef('private.build_dynamic_snapshot_data_before_s159_theme_runtime_v2(public.dynamic_slides)'::regprocedure);
 before:='and fixture.active';
 if position(before in definition)=0 then raise exception 'S295 blueprint membership predecessor mismatch';end if;
 execute replace(definition,before,before||' and private.sportlink_match_is_visible_s295_v1(fixture)');
 definition:=pg_get_functiondef('private.build_sync_sport_snapshot_s291_v1(public.dynamic_slides)'::regprocedure);
 before:='and match.active';
 if position(before in definition)=0 then raise exception 'S295 matchday membership predecessor mismatch';end if;
 execute replace(definition,before,before||' and private.sportlink_match_is_visible_s295_v1(match)');
end;$migration$;

-- Historical snapshot/hash contracts remain byte-compatible. At the live PDD
-- boundary only, an observation-only legacy projection keeps its installed
-- bytes/hash/revision; the existing write still advances checked/source state.
do $migration$
declare definition text;before text:='hash:=private.published_data_hash_v1(dataset);';
begin
 definition:=pg_get_functiondef('private.complete_published_data_before_binary_v1(uuid,uuid,uuid)'::regprocedure);
 if position(before in definition)=0 then raise exception 'S295 legacy live identity predecessor mismatch';end if;
 execute replace(definition,before,before||$m$
      if dataset->'syncPlaybackProtocol'is distinct from'2'::jsonb
       and private.sync_dom_semantic_data_v2(dataset)=private.sync_dom_semantic_data_v2(binding.data_json)then
        hash:=binding.content_hash;
      end if;$m$);
end;$migration$;

-- Date selection must advance even if the provider has not changed or fails.
-- The existing worker polls this leased queue: at most twenty current live
-- bindings enter once per connection-local midnight, without a source call.
create function private.enqueue_due_sportlink_windows_s295_v1(p_at timestamptz default clock_timestamp())
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 insert into private.published_data_refresh_queue(tenant_id,snapshot_id,data_source_id)
 select data.tenant_id,data.snapshot_id,data.data_source_id from public.published_dynamic_data data
 join public.sportlink_connections connection on connection.tenant_id=data.tenant_id and connection.data_source_id=data.data_source_id and connection.status='active'
 where data.checked_at<(date_trunc('day',p_at at time zone connection.timezone)at time zone connection.timezone)
  and not exists(select 1 from private.published_data_refresh_queue queued where queued.tenant_id=data.tenant_id and queued.snapshot_id=data.snapshot_id)
  and exists(select 1 from public.playlist_release_items item
   join private.referenced_publication_releases_v1(data.tenant_id)used on used.release_id=item.release_id
   where item.tenant_id=data.tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled)
 order by data.checked_at,data.tenant_id,data.snapshot_id limit 20
 on conflict(tenant_id,snapshot_id)do nothing;
 get diagnostics affected=row_count;return affected;
end;$$;
revoke all on function private.enqueue_due_sportlink_windows_s295_v1(timestamptz)from public,anon,authenticated,service_role;
do $migration$
declare definition text;before text:=$m$select * into claimed from private.published_data_refresh_queue$m$;
begin
 definition:=pg_get_functiondef('public.claim_published_data_refresh_v1(text,integer)'::regprocedure);
 if position(before in definition)=0 then raise exception 'S295 clock claim predecessor mismatch';end if;
 execute replace(definition,before,$m$perform private.enqueue_due_sportlink_windows_s295_v1();
  select * into claimed from private.published_data_refresh_queue$m$);
end;$migration$;
-- Wake the existing queue lane at midnight without turning a read-only hint
-- into a source request or mutation. The leased claim owns the enqueue.
do $migration$
declare definition text;before text:='select (public.get_worker_queue_hint_v2(p_max_attempts)&27)';
begin
 definition:=pg_get_functiondef('public.get_worker_queue_hint_v3(integer)'::regprocedure);
 if position(before in definition)=0 then raise exception 'S295 clock hint predecessor mismatch';end if;
 execute replace(definition,before,before||$m$
 |case when exists(select 1 from public.published_dynamic_data data
  join public.sportlink_connections connection on connection.tenant_id=data.tenant_id and connection.data_source_id=data.data_source_id and connection.status='active'
  where data.checked_at<(date_trunc('day',statement_timestamp()at time zone connection.timezone)at time zone connection.timezone)
   and not exists(select 1 from private.published_data_refresh_queue queued where queued.tenant_id=data.tenant_id and queued.snapshot_id=data.snapshot_id)
   and exists(select 1 from public.playlist_release_items item join private.referenced_publication_releases_v1(data.tenant_id)used on used.release_id=item.release_id
    where item.tenant_id=data.tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled))then 8 else 0 end$m$);
end;$migration$;

-- A per-policy live bound is optional: NULL keeps only the ordinary cadence.
-- The existing frequency, enabled flag and provider leases remain authoritative.
alter table public.sportlink_sync_policies add column live_max_staleness_seconds integer default 3600
 check(live_max_staleness_seconds between 300 and 86400);
create function public.update_sportlink_live_sync_policy_v1(p_connection_id uuid,p_dataset_group text,p_max_staleness_seconds integer)
returns void language plpgsql security definer set search_path='' as $$
declare connection public.sportlink_connections%rowtype;
begin
 select *into connection from public.sportlink_connections where id=p_connection_id;
 if connection.id is null then raise exception 'sportlink_connection_not_found'using errcode='P0002';end if;
 if not private.has_tenant_capability(connection.tenant_id,'tenant.data_source.manage')and not private.is_platform_member(array['platform_owner','platform_admin']::public.platform_role[])then
  raise exception 'sportlink_policy_manage_required'using errcode='42501';end if;
 if not exists(select 1 from public.tenants where id=connection.tenant_id and status='active')then raise exception 'active_tenant_required'using errcode='42501';end if;
 if coalesce(p_dataset_group,'')not in('matches','competitions')or(p_max_staleness_seconds is not null and p_max_staleness_seconds not between 300 and 86400)then
  raise exception 'sportlink_live_policy_invalid'using errcode='22023';end if;
 update public.sportlink_sync_policies set live_max_staleness_seconds=p_max_staleness_seconds where tenant_id=connection.tenant_id and connection_id=connection.id and dataset_group=p_dataset_group;
 perform private.audit_event(connection.tenant_id,'sportlink.sync_policy.live_updated','sportlink_connections',connection.id,'success',jsonb_build_object('datasetGroup',p_dataset_group,'maxStalenessSeconds',p_max_staleness_seconds));
end;$$;
revoke all on function public.update_sportlink_live_sync_policy_v1(uuid,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.update_sportlink_live_sync_policy_v1(uuid,text,integer)to authenticated;

-- A published matchday gets bounded central catch-up when a legacy daily
-- policy leaves either block beyond its configured live bound. Preserve frequency,
-- disabled policies, running leases, cooldown and failed-attempt backoff.
create function private.request_due_published_sportlink_s295_v1()
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 with due as(select policy.id from public.sportlink_sync_policies policy
  join public.sportlink_connections connection on connection.tenant_id=policy.tenant_id and connection.id=policy.connection_id and connection.status='active'
  where policy.enabled and policy.dataset_group in('matches','competitions')and policy.live_max_staleness_seconds is not null and policy.next_sync_at>now()
   and coalesce(policy.last_success_at,'-infinity'::timestamptz)<now()-make_interval(secs=>policy.live_max_staleness_seconds)
   and coalesce(policy.last_attempt_at,'-infinity'::timestamptz)<now()-make_interval(secs=>policy.live_max_staleness_seconds)
   and(policy.manual_cooldown_until is null or policy.manual_cooldown_until<=now())
   and not exists(select 1 from public.sportlink_sync_runs run where run.connection_id=policy.connection_id and run.dataset_group=policy.dataset_group and run.status='running')
   and exists(select 1 from public.published_dynamic_data data join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=data.tenant_id and snapshot.id=data.snapshot_id
    join public.dynamic_slide_versions version on version.tenant_id=snapshot.tenant_id and version.id=snapshot.dynamic_slide_version_id
    where data.tenant_id=policy.tenant_id and data.data_source_id=connection.data_source_id and version.slide_type='sport_match_of_the_day'
     and exists(select 1 from public.playlist_release_items item join private.referenced_publication_releases_v1(data.tenant_id)used on used.release_id=item.release_id
      where item.tenant_id=data.tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled))
  order by policy.last_success_at nulls first,policy.id for update of policy skip locked limit 10)
 update public.sportlink_sync_policies policy set next_sync_at=now()from due where due.id=policy.id;
 get diagnostics affected=row_count;return affected;
end;$$;
revoke all on function private.request_due_published_sportlink_s295_v1()from public,anon,authenticated,service_role;
do $migration$
declare definition text;before text:='select policy.*';
begin
 definition:=pg_get_functiondef('public.claim_due_sportlink_sync_v1(text,integer)'::regprocedure);
 if position(before in definition)=0 then raise exception 'S295 source claim predecessor mismatch';end if;
 execute replace(definition,before,$m$perform private.request_due_published_sportlink_s295_v1();
  select policy.*$m$);
end;$migration$;
notify pgrst,'reload schema';
commit;
