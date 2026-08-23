-- S119 Unified Studio: typed Sportlink blueprints, atomic bulk creation and
-- arrival screens. Provider assets continue to use the global S111 cache.

alter table public.dynamic_templates drop constraint dynamic_templates_slide_type_check;
alter table public.dynamic_templates add constraint dynamic_templates_slide_type_check check (
  slide_type in (
    'menu','price_list','news','sport_program','sport_results','sport_standing',
    'sport_period_standing','sport_match_of_the_day','sport_next_match',
    'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
    'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
    'sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals'
  )
);
alter table public.dynamic_slides drop constraint dynamic_slides_slide_type_check;
alter table public.dynamic_slides add constraint dynamic_slides_slide_type_check check (
  slide_type in (
    'menu','price_list','news','sport_program','sport_results','sport_standing',
    'sport_period_standing','sport_match_of_the_day','sport_next_match',
    'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
    'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
    'sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals'
  )
);

do $$
declare source_template record; source_version record; target_type text;
  target_id uuid; target_version_id uuid; target_label text;
begin
  foreach target_type in array array['sport_visitor_arrivals','sport_referee_arrivals'] loop
    target_label := case target_type when 'sport_visitor_arrivals'
      then 'Aankomst bezoekende teams' else 'Aankomst scheidsrechters' end;
    for source_template in
      select * from public.dynamic_templates
      where slide_type = 'sport_dressing_rooms' and status = 'published'
        and slug like 'editorial-arena-%'
    loop
      if exists (select 1 from public.dynamic_templates where slug =
        replace(source_template.slug, 'veld-kleedkamer',
          case target_type when 'sport_visitor_arrivals' then 'bezoekers-aankomst' else 'scheidsrechters-aankomst' end))
      then continue; end if;
      select * into source_version from public.dynamic_template_versions
      where id = source_template.current_published_version_id;
      insert into public.dynamic_templates(
        slug,name,description,category,slide_type,orientation,status
      ) values (
        replace(source_template.slug, 'veld-kleedkamer',
          case target_type when 'sport_visitor_arrivals' then 'bezoekers-aankomst' else 'scheidsrechters-aankomst' end),
        target_label || case source_template.orientation when 'portrait' then ' · staand' else ' · liggend' end,
        'Editorial Arena aankomstslide met deterministische kaarten en paginering.',
        'sports',target_type,source_template.orientation,'published'
      ) returning id into target_id;
      insert into public.dynamic_template_versions(
        template_id,version,status,markup,css,manifest_json,sample_data_json,
        source_checksum_sha256,published_at
      ) values (
        target_id,1,'published',source_version.markup,source_version.css,
        jsonb_set(source_version.manifest_json,'{slideType}',to_jsonb(target_type),true),
        jsonb_build_object('type',target_type,'sport',jsonb_build_object(
          'title',target_label,'items',jsonb_build_array(jsonb_build_object(
            'id','voorbeeld','primary',case target_type when 'sport_visitor_arrivals' then 'Welkom, Bezoekers FC' else 'Alex de Vries' end,
            'secondary','Aanvang 14:30','meta','Kleedkamer 4 · veld 2')))),
        encode(extensions.digest(source_version.markup || source_version.css ||
          jsonb_set(source_version.manifest_json,'{slideType}',to_jsonb(target_type),true)::text,'sha256'),'hex'),now()
      ) returning id into target_version_id;
      update public.dynamic_templates set current_published_version_id=target_version_id where id=target_id;
    end loop;
  end loop;
end $$;

create table public.sportlink_slide_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  data_source_id uuid not null,
  idempotency_key uuid not null,
  result_json jsonb not null default '{}'::jsonb check (jsonb_typeof(result_json)='object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id,idempotency_key),
  foreign key (tenant_id,data_source_id) references public.dynamic_data_sources(tenant_id,id) on delete restrict
);
create index sportlink_slide_batches_tenant_idx on public.sportlink_slide_batches(tenant_id,created_at desc);
alter table public.sportlink_slide_batches enable row level security;
alter table public.sportlink_slide_batches force row level security;
create policy sportlink_slide_batches_select on public.sportlink_slide_batches
for select to authenticated using (private.has_tenant_capability(tenant_id,'tenant.dynamic_slide.read'));
revoke all on public.sportlink_slide_batches from public,anon,authenticated;
grant select on public.sportlink_slide_batches to authenticated;

create or replace function public.create_sportlink_slide_batch_v1(
  p_tenant_id uuid,p_data_source_id uuid,p_drafts jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=private.current_user_id(); batch_id uuid; draft jsonb;
  expected_type text; actual_type text; result jsonb; results jsonb:='[]'::jsonb;
  allowed_keys constant text[]:=array[
    'sportlink.club_schedule_today','sportlink.club_schedule_next_7_days',
    'sportlink.club_results_today','sportlink.club_results_previous_7_days',
    'sportlink.pool_schedule_next_7_days','sportlink.pool_results_previous_7_days',
    'sportlink.pool_standings','sportlink.visitor_arrivals','sportlink.referee_arrivals'];
begin
  if actor_id is null or not private.has_tenant_capability(p_tenant_id,'tenant.dynamic_slide.write')
  then raise exception 'actor cannot create Sportlink slides' using errcode='42501'; end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if not exists(select 1 from public.dynamic_data_sources where id=p_data_source_id
    and tenant_id=p_tenant_id and kind='sportlink' and status='active')
  then raise exception 'Sportlink source unavailable' using errcode='23514'; end if;
  if jsonb_typeof(p_drafts)<>'array' or jsonb_array_length(p_drafts) not between 1 and 25
  then raise exception 'invalid Sportlink batch' using errcode='22023'; end if;
  select id,result_json into batch_id,result from public.sportlink_slide_batches
  where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
  if batch_id is not null then return result; end if;
  insert into public.sportlink_slide_batches(tenant_id,data_source_id,idempotency_key,created_by)
  values(p_tenant_id,p_data_source_id,p_idempotency_key,actor_id) returning id into batch_id;
  for draft in select value from jsonb_array_elements(p_drafts) loop
    if draft->>'blueprintKey' <> all(allowed_keys)
      or length(btrim(coalesce(draft->>'name',''))) not between 2 and 120
      or draft->>'orientation' not in ('landscape','portrait')
      or jsonb_typeof(draft->'context')<>'object'
      or length(coalesce(draft#>>'{context,providerTeamId}','')) not between 1 and 200
      or draft#>>'{context,competitionSelectionMode}' not in ('auto_current','pinned')
    then raise exception 'invalid Sportlink draft' using errcode='22023'; end if;
    expected_type:=case
      when draft->>'blueprintKey' in ('sportlink.club_schedule_today','sportlink.club_schedule_next_7_days','sportlink.pool_schedule_next_7_days') then 'sport_program'
      when draft->>'blueprintKey' in ('sportlink.club_results_today','sportlink.club_results_previous_7_days','sportlink.pool_results_previous_7_days') then 'sport_results'
      when draft->>'blueprintKey'='sportlink.pool_standings' then 'sport_standing'
      when draft->>'blueprintKey'='sportlink.visitor_arrivals' then 'sport_visitor_arrivals'
      else 'sport_referee_arrivals' end;
    select template.slide_type into actual_type from public.dynamic_template_versions version
    join public.dynamic_templates template on template.id=version.template_id
    where version.id=(draft->>'templateVersionId')::uuid and version.status='published'
      and template.status='published' and template.orientation=draft->>'orientation';
    if actual_type is distinct from expected_type then
      raise exception 'template does not match Sportlink blueprint' using errcode='23514'; end if;
    if not exists(select 1 from public.sports_teams team join public.sportlink_connections connection
      on connection.id=team.source_connection_id and connection.tenant_id=team.tenant_id
      where team.tenant_id=p_tenant_id and connection.data_source_id=p_data_source_id
        and team.external_id=draft#>>'{context,providerTeamId}' and team.active)
    then raise exception 'Sportlink team unavailable' using errcode='23514'; end if;
    result:=public.create_dynamic_slide_v1(
      p_tenant_id,draft->>'name',(draft->>'templateVersionId')::uuid,p_data_source_id,'latest',
      jsonb_strip_nulls(jsonb_build_object(
        'schemaVersion',1,'blueprintKey',draft->>'blueprintKey','title',draft->>'title',
        'context',draft->'context','arrival',draft->'arrival','maxItems',40)));
    results:=results||jsonb_build_array(jsonb_build_object(
      'slideId',result->>'slideId','snapshotId',result->>'snapshotId',
      'name',draft->>'name','blueprintKey',draft->>'blueprintKey'));
  end loop;
  result:=jsonb_build_object('batchId',batch_id,'slides',results,'count',jsonb_array_length(results));
  update public.sportlink_slide_batches set result_json=result where id=batch_id;
  perform private.audit_event(p_tenant_id,'sportlink.slide_batch.created','sportlink_slide_batches',batch_id,'success',
    jsonb_build_object('count',jsonb_array_length(results),'dataSourceId',p_data_source_id));
  return result;
end $$;
revoke all on function public.create_sportlink_slide_batch_v1(uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.create_sportlink_slide_batch_v1(uuid,uuid,jsonb,uuid) to authenticated;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s119_sportlink_blueprints;

create or replace function private.build_dynamic_snapshot_data(p_slide public.dynamic_slides)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare blueprint text:=p_slide.configuration_json->>'blueprintKey'; context jsonb:=p_slide.configuration_json->'context';
  arrival jsonb:=coalesce(p_slide.configuration_json->'arrival','{}'::jsonb); result jsonb;
  title text:=coalesce(nullif(p_slide.configuration_json->>'title',''),p_slide.name);
  before_minutes integer:=least(greatest(coalesce((arrival->>'minutesBefore')::integer,90),0),720);
  after_minutes integer:=least(greatest(coalesce((arrival->>'minutesAfter')::integer,30),0),360);
begin
  if blueprint is null then return private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide); end if;
  if blueprint='sportlink.pool_standings' then
    select jsonb_build_object('type','sport_standing','sport',jsonb_build_object(
      'title',title,'generatedAt',now(),'competition',standing.metadata->'competition','pool',standing.metadata->'pool',
      'season',standing.season_key,'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',row->>'externalId','position',nullif(row->>'position','')::integer,'teamName',row->>'teamName',
        'played',nullif(row->>'played','')::integer,'won',nullif(row->>'won','')::integer,
        'drawn',nullif(row->>'drawn','')::integer,'lost',nullif(row->>'lost','')::integer,
        'goalsFor',nullif(row->>'goalsFor','')::integer,'goalsAgainst',nullif(row->>'goalsAgainst','')::integer,
        'goalDifference',nullif(row->>'goalDifference','')::integer,'points',nullif(row->>'points','')::integer,
        'selected',row->>'externalId'=context->>'providerTeamId')) order by nullif(row->>'position','')::integer nulls last)
        from jsonb_array_elements(standing.rows_json) row),'[]'::jsonb),
      'emptyStateCode',case when standing.id is null then 'STANDINGS_NOT_PUBLISHED' end)) into result
    from public.sports_standings standing join public.sportlink_connections connection
      on connection.id=standing.source_connection_id and connection.tenant_id=standing.tenant_id
    where standing.tenant_id=p_slide.tenant_id and connection.data_source_id=p_slide.data_source_id and standing.active
      and (context->>'poolId' is null or standing.metadata#>>'{pool,externalId}'=context->>'poolId' or standing.metadata#>>'{pool,poolExternalId}'=context->>'poolId')
      and (context->>'competitionId' is null or standing.metadata#>>'{competition,externalId}'=context->>'competitionId')
      and (context->>'seasonId' is null or standing.season_key=context->>'seasonId')
    order by standing.last_synced_at desc limit 1;
  elsif blueprint in ('sportlink.visitor_arrivals','sportlink.referee_arrivals') then
    with matches as (
      select match.*,connection.timezone from public.sports_matches match join public.sportlink_connections connection
        on connection.id=match.source_connection_id and connection.tenant_id=match.tenant_id
      where match.tenant_id=p_slide.tenant_id and connection.data_source_id=p_slide.data_source_id
        and match.active and match.is_home_match and match.status in ('scheduled','postponed')
        and match.starts_at between now()-make_interval(mins=>after_minutes) and now()+make_interval(mins=>before_minutes)
      order by match.starts_at limit 40
    ), cards as (
      select match.external_id id,match.starts_at,match.away_team->>'name' card_name,
        match.dressing_rooms->>'away' room,match.venue->>'field' field,
        match.competition->>'name' competition,0 person_index from matches match
      where blueprint='sportlink.visitor_arrivals'
      union all
      select match.external_id||':'||official.ordinality,match.starts_at,
        coalesce(official.value->>'displayName',official.value->>'name'),match.dressing_rooms->>'official',
        match.venue->>'field',match.competition->>'name',official.ordinality::integer from matches match
      cross join lateral jsonb_array_elements(match.officials) with ordinality official(value,ordinality)
      where blueprint='sportlink.referee_arrivals'
    )
    select jsonb_build_object('type',case blueprint when 'sportlink.visitor_arrivals' then 'sport_visitor_arrivals' else 'sport_referee_arrivals' end,
      'sport',jsonb_build_object('title',title,'generatedAt',now(),'arrivalConfig',arrival,
        'pageDurationSeconds',coalesce((arrival->>'pageDurationSeconds')::integer,12),
        'items',coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id',id,'primary',card_name,
          'secondary',concat_ws(' · ',
            case when coalesce((arrival->>'showArrivalTime')::boolean,true)
              then 'Aankomst '||to_char((starts_at-make_interval(mins=>before_minutes)) at time zone 'Europe/Amsterdam','HH24:MI') end,
            case when coalesce((arrival->>'showKickoffTime')::boolean,true)
              then 'Aanvang '||to_char(starts_at at time zone 'Europe/Amsterdam','HH24:MI') end),
          'meta',concat_ws(' · ',
            case when coalesce((arrival->>'showDressingRoom')::boolean,true) and coalesce(room,'')<>'' then 'Kleedkamer '||room end,
            case when coalesce((arrival->>'showField')::boolean,true) and coalesce(field,'')<>'' then 'Veld '||field end,
            case when coalesce((arrival->>'showCompetition')::boolean,false) then nullif(competition,'') end,
            nullif(arrival->>'dutyDeskText','')),
          'status',case when coalesce((arrival->>'showWelcome')::boolean,true)
            then coalesce(nullif(arrival->>'welcomeText',''),'Welkom bij {{club}}') else '' end,
          'arrivalAt',starts_at-make_interval(mins=>before_minutes),'kickoffAt',starts_at,
          'name',card_name,'dressingRoom',room,'field',field,'competition',competition,
          'recent',(starts_at-make_interval(mins=>before_minutes)) between now()-make_interval(mins=>coalesce((arrival->>'highlightRecentMinutes')::integer,15)) and now()))
          order by starts_at,person_index),'[]'::jsonb),
        'emptyStateCode',case when count(*)=0 then 'NO_ARRIVALS_IN_WINDOW' end)) into result from cards;
  else
    with filtered as (
      select match.*,connection.timezone from public.sports_matches match join public.sportlink_connections connection
        on connection.id=match.source_connection_id and connection.tenant_id=match.tenant_id
      where match.tenant_id=p_slide.tenant_id and connection.data_source_id=p_slide.data_source_id and match.active
        and (case when blueprint like '%results%' then match.status='finished' and match.scores_published
          else match.status in ('scheduled','postponed') end)
        and (case
          when blueprint like '%today' then (match.starts_at at time zone connection.timezone)::date=(now() at time zone connection.timezone)::date
          when blueprint like '%next_7_days' then (match.starts_at at time zone connection.timezone)::date >= (now() at time zone connection.timezone)::date
            and (match.starts_at at time zone connection.timezone)::date < (now() at time zone connection.timezone)::date+7
          else (match.starts_at at time zone connection.timezone)::date >= (now() at time zone connection.timezone)::date-7
            and (match.starts_at at time zone connection.timezone)::date < (now() at time zone connection.timezone)::date end)
        and (blueprint not like 'sportlink.pool_%' or context->>'poolId' is null
          or match.pool->>'externalId'=context->>'poolId' or match.pool->>'poolExternalId'=context->>'poolId')
      order by case when blueprint like '%results%' then -extract(epoch from match.starts_at) else extract(epoch from match.starts_at) end limit 40
    )
    select jsonb_build_object('type',p_slide.slide_type,'sport',jsonb_build_object(
      'title',title,'generatedAt',now(),'items',coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',external_id,'primary',(home_team->>'name')||' – '||(away_team->>'name'),
        'secondary',to_char(starts_at at time zone timezone,'DD-MM-YYYY HH24:MI'),
        'date',to_char(starts_at at time zone timezone,'DD-MM-YYYY'),'time',to_char(starts_at at time zone timezone,'HH24:MI'),
        'homeTeam',home_team->>'name','awayTeam',away_team->>'name',
        'homeScore',case when home_team->>'score'~'^\d+$' then (home_team->>'score')::integer end,
        'awayScore',case when away_team->>'score'~'^\d+$' then (away_team->>'score')::integer end,
        'competition',competition->>'name','venue',coalesce(venue->>'field',venue->>'name',''),
        'meta',coalesce(venue->>'field',venue->>'name',''),'status',status)) order by starts_at),'[]'::jsonb),
      'emptyStateCode',case when count(*)=0 then case when blueprint like '%results%' then 'RESULTS_NOT_PUBLISHED' else 'NO_ITEMS_IN_PERIOD' end end)) into result from filtered;
  end if;
  return coalesce(result,jsonb_build_object('type',p_slide.slide_type,'sport',jsonb_build_object(
    'title',title,'generatedAt',now(),'items','[]'::jsonb,'emptyStateCode','NO_ITEMS_IN_PERIOD')))
    || jsonb_build_object('brand',coalesce(private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(p_slide)->'brand','{}'::jsonb));
end $$;
revoke all on function private.build_dynamic_snapshot_data(public.dynamic_slides) from public,anon,authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_s119_sportlink_blueprints(public.dynamic_slides) from public,anon,authenticated;

-- The worker calls this after every successful observation. Time-dependent
-- arrival windows are therefore re-evaluated even when provider content hashes
-- are unchanged; the existing content hash still deduplicates identical output.
create or replace function public.refresh_sportlink_time_sensitive_slides_v1(p_connection_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare connection public.sportlink_connections%rowtype; queued integer:=0;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select * into connection from public.sportlink_connections where id=p_connection_id;
  if connection.id is null then raise exception 'connection not found' using errcode='P0002'; end if;
  perform private.queue_latest_dynamic_snapshots_v2(connection.tenant_id,connection.data_source_id,
    array['sport_visitor_arrivals','sport_referee_arrivals'],'sportlink_time_window');
  select count(*) into queued from public.dynamic_slides where tenant_id=connection.tenant_id
    and data_source_id=connection.data_source_id and status<>'archived'
    and slide_type in ('sport_visitor_arrivals','sport_referee_arrivals');
  return queued;
end $$;
revoke all on function public.refresh_sportlink_time_sensitive_slides_v1(uuid) from public,anon,authenticated;
grant execute on function public.refresh_sportlink_time_sensitive_slides_v1(uuid) to service_role;
