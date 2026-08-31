-- A provider baseline may legitimately describe the last match update while it
-- is observed on a healthy websocket now. Keep those clocks separate and order
-- last-known-good state by the provider update before using receipt time.
create or replace function public.upsert_ledscores_live_match_state_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_state jsonb,
  p_source_observed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype :=
    private.require_ledscores_worker_lease_v1(p_connection_id,p_worker_id);
  match_key text := btrim(coalesce(p_state ->> 'matchKey',''));
  source_update_id text := nullif(left(p_state ->> 'sourceUpdateId',200),'');
  source_updated_at timestamptz;
  state_status text := coalesce(p_state ->> 'status','unknown');
  stale_after integer := least(greatest(
    coalesce((p_state ->> 'staleAfter')::integer,10),3
  ),120);
  resulting_sequence bigint;
  affected integer;
begin
  if jsonb_typeof(coalesce(p_state,'null'::jsonb)) <> 'object'
    or p_state ->> 'schemaVersion' is distinct from '1'
    or p_state ->> 'connectionId' is distinct from p_connection_id::text
    or length(match_key) not between 1 and 300
    or state_status not in (
      'pre_match','live','paused','half_time','finished','unknown'
    )
    or exists (
      select 1 from jsonb_object_keys(p_state) top_level(key)
      where top_level.key <> all(array[
        'schemaVersion','connectionId','stateRevision','sourceUpdateId',
        'sourceUpdatedAt','staleAfter','matchKey','status','periodLabel',
        'homeTeamKey','awayTeamKey','home','away','clock','timeline'
      ]::text[])
    )
    or coalesce(jsonb_typeof(p_state -> 'home'),'missing') <> 'object'
    or coalesce(jsonb_typeof(p_state -> 'away'),'missing') <> 'object'
    or coalesce(jsonb_typeof(p_state -> 'timeline'),'missing') <> 'array'
    or jsonb_array_length(p_state -> 'timeline') > 30
    or coalesce(jsonb_typeof(p_state -> 'clock'),'missing')
      not in ('object','null')
    or length(coalesce(p_state ->> 'homeTeamKey','')) not between 1 and 200
    or length(coalesce(p_state ->> 'awayTeamKey','')) not between 1 and 200
    or p_state #>> '{home,teamKey}' is distinct from p_state ->> 'homeTeamKey'
    or p_state #>> '{away,teamKey}' is distinct from p_state ->> 'awayTeamKey'
    or length(coalesce(p_state #>> '{home,name}','')) not between 1 and 160
    or length(coalesce(p_state #>> '{away,name}','')) not between 1 and 160
    or exists (
      select 1
      from jsonb_array_elements(jsonb_build_array(
        p_state -> 'home',p_state -> 'away'
      )) as teams(team_value)
      cross join lateral jsonb_object_keys(teams.team_value) as team_keys(key)
      where team_keys.key <> all(array['teamKey','name','score']::text[])
    )
    or exists (
      select 1
      from jsonb_array_elements(p_state -> 'timeline') as timeline_items(timeline_item)
      where jsonb_typeof(timeline_items.timeline_item) <> 'object'
        or exists (
          select 1
          from jsonb_object_keys(timeline_items.timeline_item) as timeline_keys(key)
          where timeline_keys.key <> all(array[
            'id','kind','label','occurredAt','clockLabel','playerName',
            'side','homeScore','awayScore'
          ]::text[])
        )
    )
    or (
      jsonb_typeof(p_state -> 'clock') = 'object'
      and exists (
        select 1 from jsonb_object_keys(p_state -> 'clock') as clock_keys(key)
        where clock_keys.key <> all(array[
          'anchorAt','anchorSeconds','direction','maxSeconds','running'
        ]::text[])
      )
    )
    or p_state::text ~* 'https?://'
    or pg_column_size(p_state) > 65536
    or p_source_observed_at < clock_timestamp() - interval '10 minutes'
    or p_source_observed_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'invalid LED Scores live match state' using errcode = '22023';
  end if;
  source_updated_at := coalesce(
    nullif(p_state ->> 'sourceUpdatedAt','')::timestamptz,
    p_source_observed_at
  );
  if not isfinite(source_updated_at)
    or source_updated_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'invalid LED Scores source timestamp' using errcode = '22023';
  end if;

  insert into public.ledscores_live_match_states(
    tenant_id,connection_id,match_identity,state_sequence,source_update_id,
    status,state_json,source_updated_at,source_observed_at,stale_after_seconds
  ) values (
    connection_record.tenant_id,p_connection_id,match_key,1,source_update_id,
    state_status,p_state,source_updated_at,p_source_observed_at,stale_after
  ) on conflict (tenant_id,connection_id) do update set
    match_identity = excluded.match_identity,
    state_sequence = public.ledscores_live_match_states.state_sequence + 1,
    source_update_id = excluded.source_update_id,
    status = excluded.status,
    state_json = excluded.state_json,
    source_updated_at = excluded.source_updated_at,
    source_observed_at = excluded.source_observed_at,
    stale_after_seconds = excluded.stale_after_seconds,
    updated_at = now()
  where (
      public.ledscores_live_match_states.match_identity
        is distinct from excluded.match_identity
      or public.ledscores_live_match_states.source_update_id
        is distinct from excluded.source_update_id
    )
    and (
      public.ledscores_live_match_states.source_updated_at
        < excluded.source_updated_at
      or (
        public.ledscores_live_match_states.source_updated_at
          = excluded.source_updated_at
        and public.ledscores_live_match_states.source_observed_at
          <= excluded.source_observed_at
      )
    )
  returning state_sequence into resulting_sequence;
  get diagnostics affected = row_count;
  if affected = 0 then
    select state_sequence into resulting_sequence
    from public.ledscores_live_match_states
    where tenant_id = connection_record.tenant_id
      and connection_id = p_connection_id;
  end if;
  return jsonb_build_object(
    'outcome',case when affected = 0 then 'duplicate' else 'stored' end,
    'stateSequence',resulting_sequence,
    'connectionId',p_connection_id
  );
end;
$$;
revoke all on function public.upsert_ledscores_live_match_state_v1(
  uuid,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.upsert_ledscores_live_match_state_v1(
  uuid,text,jsonb,timestamptz
) to service_role;
