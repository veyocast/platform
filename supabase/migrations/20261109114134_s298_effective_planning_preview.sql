-- One candidate resolver for assignment, removal recovery and read-only preview.
-- Proposal rows exist only in memory; their target scope is checked by the RPC.
create function private.content_schedule_candidates_s298_v1(
  p_tenant_id uuid, p_screen_id uuid, p_at timestamptz,
  p_proposal public.content_schedules default null
) returns setof public.content_schedules
language sql stable security definer set search_path='' as $$
  select candidate.* from (
    select schedule.* from public.content_schedules schedule
    join public.publisher_target_snapshot_screens binding
      on binding.tenant_id=schedule.tenant_id and binding.snapshot_id=schedule.target_snapshot_id
      and binding.screen_id=p_screen_id
    where schedule.tenant_id=p_tenant_id and schedule.deleted_at is null
      and ((p_proposal).id is null or schedule.id<>(p_proposal).id)
      and private.content_schedule_is_due(schedule,p_at)
    union all
    select (p_proposal).* where (p_proposal).id is not null
      and (p_proposal).tenant_id=p_tenant_id and private.content_schedule_is_due(p_proposal,p_at)
      and (((p_proposal).target_kind='screen' and (p_proposal).target_screen_id=p_screen_id)
        or ((p_proposal).target_kind='screen_group' and exists (
          select 1 from public.screen_group_memberships member
          where member.tenant_id=p_tenant_id and member.screen_id=p_screen_id
            and member.screen_group_id=(p_proposal).target_screen_group_id)))
  ) candidate
  order by case candidate.source when 'override' then 3 when 'publisher' then 2 else 1 end desc,
    case candidate.target_kind when 'screen' then 2 else 1 end desc,
    candidate.priority desc,candidate.starts_at desc,candidate.id
$$;
revoke all on function private.content_schedule_candidates_s298_v1(uuid,uuid,timestamptz,public.content_schedules)
  from public,anon,authenticated,service_role;

-- Enumerate local calendar edges, both copies of an ambiguous wall time and
-- timezone offset transitions. Evaluation at each edge still uses the existing
-- content_schedule_is_due function, including its overnight weekday semantics.
create function private.content_schedule_edges_s298_v1(
  p_schedule public.content_schedules,p_from timestamptz,p_until timestamptz
) returns table(at timestamptz)
language plpgsql stable set search_path='' as $$
declare
  local_day date; day_index integer; wall timestamp; wall_time time;
  canonical timestamptz; sample_at timestamptz; candidate timestamptz;
  offset_value interval; previous_offset interval; next_offset interval;
  lower_second integer; upper_second integer; middle_second integer;
  wall_times time[]:=array['00:00'::time];
begin
  if p_schedule.starts_at>p_from and p_schedule.starts_at<=p_until then
    at:=p_schedule.starts_at; return next;
  end if;
  if p_schedule.ends_at>p_from and p_schedule.ends_at<=p_until then
    at:=p_schedule.ends_at; return next;
  end if;
  if p_schedule.schedule_kind='once' then return; end if;
  begin
    if p_schedule.recurrence_json ? 'startTime' and p_schedule.recurrence_json ? 'endTime' then
      wall_times:=wall_times||array[(p_schedule.recurrence_json->>'startTime')::time,
        (p_schedule.recurrence_json->>'endTime')::time];
    end if;
    local_day:=(p_from at time zone p_schedule.timezone_name)::date-1;
    for day_index in 0..((p_until at time zone p_schedule.timezone_name)::date-local_day+1) loop
      foreach wall_time in array wall_times loop
        wall:=(local_day+day_index)+wall_time;
        canonical:=wall at time zone p_schedule.timezone_name;
        for sample_at in select sample from unnest(array[
          canonical-interval '36 hours',canonical,canonical+interval '36 hours']) sample loop
          offset_value:=(sample_at at time zone p_schedule.timezone_name)-(sample_at at time zone 'UTC');
          candidate:=(wall at time zone 'UTC')-offset_value;
          if candidate>p_from and candidate<=p_until
            and candidate at time zone p_schedule.timezone_name=wall then
            at:=candidate; return next;
          end if;
        end loop;
      end loop;
    end loop;
    sample_at:=date_trunc('hour',p_from)-interval '6 hours';
    while sample_at<p_until loop
      previous_offset:=(sample_at at time zone p_schedule.timezone_name)-(sample_at at time zone 'UTC');
      candidate:=sample_at+interval '6 hours';
      next_offset:=(candidate at time zone p_schedule.timezone_name)-(candidate at time zone 'UTC');
      if previous_offset<>next_offset then
        lower_second:=0; upper_second:=21600;
        while upper_second-lower_second>1 loop
          middle_second:=(lower_second+upper_second)/2;
          candidate:=sample_at+make_interval(secs=>middle_second);
          offset_value:=(candidate at time zone p_schedule.timezone_name)-(candidate at time zone 'UTC');
          if offset_value=previous_offset then lower_second:=middle_second;
          else upper_second:=middle_second; end if;
        end loop;
        candidate:=sample_at+make_interval(secs=>upper_second);
        if candidate>p_from and candidate<=p_until then at:=candidate; return next; end if;
      end if;
      sample_at:=sample_at+interval '6 hours';
    end loop;
  exception when invalid_datetime_format or invalid_parameter_value or invalid_text_representation then
    -- Invalid recurrence is not converted into a fabricated future winner.
    return;
  end;
end $$;
revoke all on function private.content_schedule_edges_s298_v1(public.content_schedules,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;

create function private.content_schedule_winner_s298_v1(
  p_tenant_id uuid,p_screen_id uuid,p_at timestamptz,
  p_proposal public.content_schedules default null,p_default_playlist_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare winner public.content_schedules%rowtype; screen public.screens%rowtype;
  playlist_id uuid; release_id uuid; playlist_name text; release_version integer;
begin
  select * into strict screen from public.screens where tenant_id=p_tenant_id and id=p_screen_id;
  select * into winner from private.content_schedule_candidates_s298_v1(p_tenant_id,p_screen_id,p_at,p_proposal) limit 1;
  playlist_id:=coalesce(winner.playlist_id,p_default_playlist_id,screen.default_playlist_id);
  release_id:=case when winner.id is not null then winner.release_id
    when p_default_playlist_id is not null then null else screen.default_release_id end;
  select name into playlist_name from public.playlists where tenant_id=p_tenant_id and id=playlist_id;
  select version into release_version from public.playlist_releases where tenant_id=p_tenant_id and id=release_id;
  return jsonb_build_object('scheduleId',winner.id,'name',coalesce(winner.name,'Standaardinhoud'),
    'source',coalesce(winner.source,'default'),'targetKind',winner.target_kind,'priority',winner.priority,
    'startsAt',winner.starts_at,'endsAt',winner.ends_at,'targetSnapshotId',winner.target_snapshot_id,
    'playlistId',playlist_id,'playlistName',playlist_name,'releaseId',release_id,'releaseVersion',release_version,
    'draft',case when winner.id is not null then coalesce(winner.id=(p_proposal).id,false) else p_default_playlist_id is not null end);
end $$;
revoke all on function private.content_schedule_winner_s298_v1(uuid,uuid,timestamptz,public.content_schedules,uuid)
  from public,anon,authenticated,service_role;

create function public.preview_effective_planning_v1(
  p_tenant_id uuid,p_screen_ids uuid[],p_at timestamptz default now(),
  p_horizon_days integer default 8,p_proposal jsonb default null,p_default_playlist_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  screen public.screens%rowtype; proposal public.content_schedules%rowtype;
  existing public.content_schedules%rowtype; device public.player_devices%rowtype;
  rows jsonb:='[]'; current_winner jsonb; future_winner jsonb; next_change jsonb;
  alternatives jsonb; alternative_count integer; edge record; checked integer;
  horizon_end timestamptz; searched_until timestamptz; timezone_name text;
  proposed_release public.playlist_releases%rowtype; proposal_tie boolean; proposal_all boolean:=false;
begin
  if private.current_user_id() is null
    or not private.has_tenant_capability(p_tenant_id,'tenant.release.read')
    or not private.has_tenant_capability(p_tenant_id,'tenant.screen.read')
    or not exists(select 1 from public.tenants where id=p_tenant_id and status in('active','paused')) then
    raise exception 'actor cannot preview this tenant planning' using errcode='42501';
  end if;
  if cardinality(p_screen_ids) is null or cardinality(p_screen_ids) not between 1 and 50
    or array_position(p_screen_ids,null) is not null
    or p_at is null or not isfinite(p_at) or p_at<'2000-01-01T00:00Z'::timestamptz
    or p_at>='2100-01-01T00:00Z'::timestamptz
    or p_horizon_days is null or p_horizon_days not between 1 and 31
    or (select count(distinct value) from unnest(p_screen_ids) value)<>cardinality(p_screen_ids) then
    raise exception 'planning preview outside bounded limits' using errcode='22023';
  end if;
  if (select count(*) from public.screens where tenant_id=p_tenant_id and id=any(p_screen_ids) and deleted_at is null)<>cardinality(p_screen_ids) then
    raise exception 'preview screen outside tenant' using errcode='42501';
  end if;
  select coalesce(settings.timezone_name,'Europe/Amsterdam') into timezone_name
    from public.tenant_settings settings where settings.tenant_id=p_tenant_id;
  timezone_name:=coalesce(timezone_name,'Europe/Amsterdam');
  horizon_end:=p_at+make_interval(days=>p_horizon_days);
  if p_default_playlist_id is not null and not exists(select 1 from public.playlists
    where tenant_id=p_tenant_id and id=p_default_playlist_id and status<>'archived') then
    raise exception 'proposed default outside tenant' using errcode='42501';
  end if;
  if p_proposal is not null then
    if jsonb_typeof(p_proposal)<>'object' or octet_length(p_proposal::text)>16384
      or exists(select 1 from jsonb_object_keys(p_proposal) key where key<>all(array[
        'scheduleId','expectedRevision','name','releaseId','targetKind','targetId','startsAt','endsAt',
        'source','priority','scheduleKind','recurrence'])) then
      raise exception 'invalid planning proposal' using errcode='22023';
    end if;
    proposal_all:=coalesce(p_proposal->>'targetKind'='all',false);
    if p_proposal->>'scheduleId' is not null then
      select * into existing from public.content_schedules where tenant_id=p_tenant_id
        and id=(p_proposal->>'scheduleId')::uuid and deleted_at is null;
      if not found then raise exception 'proposal schedule outside tenant' using errcode='42501'; end if;
      if existing.revision is distinct from (p_proposal->>'expectedRevision')::bigint then
        raise exception 'proposal revision changed' using errcode='PT409';
      end if;
      if proposal_all then raise exception 'existing proposal cannot change into a batch' using errcode='22023'; end if;
    end if;
    select * into proposed_release from public.playlist_releases where tenant_id=p_tenant_id
      and id=(p_proposal->>'releaseId')::uuid;
    if not found then raise exception 'proposal release outside tenant' using errcode='42501'; end if;
    proposal:=jsonb_populate_record(null::public.content_schedules,jsonb_build_object(
      'id',coalesce(existing.id,'00000000-0000-4000-8000-000000000001'::uuid),'tenant_id',p_tenant_id,
      'name',p_proposal->>'name','enabled',true,'playlist_id',proposed_release.playlist_id,
      'release_id',proposed_release.id,'timezone_name',timezone_name,
      'target_kind',case when proposal_all then 'screen' else p_proposal->>'targetKind' end,
      'target_screen_id',case when proposal_all then p_screen_ids[1]::text when p_proposal->>'targetKind'='screen' then p_proposal->>'targetId' end,
      'target_screen_group_id',case when p_proposal->>'targetKind'='screen_group' then p_proposal->>'targetId' end,
      'starts_at',p_proposal->>'startsAt','ends_at',p_proposal->>'endsAt',
      'source',p_proposal->>'source','priority',p_proposal->'priority',
      'schedule_kind',p_proposal->>'scheduleKind','recurrence_json',coalesce(p_proposal->'recurrence','{}')));
    if length(coalesce(proposal.name,'')) not between 2 and 120 or proposal.starts_at is null
      or not isfinite(proposal.starts_at) or (proposal.ends_at is not null and
        (not isfinite(proposal.ends_at) or proposal.ends_at<=proposal.starts_at))
      or proposal.source is null or proposal.source not in('publisher','override','fallback')
      or proposal.priority is null or proposal.priority not between 0 and 1000
      or proposal.schedule_kind is null or proposal.schedule_kind not in('once','daily','weekly','custom')
      or jsonb_typeof(proposal.recurrence_json) is distinct from 'object'
      or proposal.target_kind is null or proposal.target_kind not in('screen','screen_group') then
      raise exception 'proposal selection invalid' using errcode='22023';
    end if;
    if (proposal.target_kind='screen' and not exists(select 1 from public.screens where tenant_id=p_tenant_id
        and id=proposal.target_screen_id and deleted_at is null))
      or (proposal.target_kind='screen_group' and not exists(select 1 from public.screen_groups where tenant_id=p_tenant_id
        and id=proposal.target_screen_group_id and status='active')) then
      raise exception 'proposal target outside tenant' using errcode='42501';
    end if;
    if proposal.schedule_kind<>'once' and (
      coalesce(proposal.recurrence_json->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(proposal.recurrence_json->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or proposal.recurrence_json->>'startTime'=proposal.recurrence_json->>'endTime') then
      raise exception 'proposal recurrence time invalid' using errcode='22023';
    end if;
    if proposal.schedule_kind in('weekly','custom') then
      if jsonb_typeof(proposal.recurrence_json->'weekdays') is distinct from 'array'
        or jsonb_array_length(proposal.recurrence_json->'weekdays') not between 1 and 7 then
        raise exception 'proposal weekdays invalid' using errcode='22023';
      end if;
      if exists(select 1 from jsonb_array_elements_text(proposal.recurrence_json->'weekdays') value
        where value !~ '^[1-7]$') then
        raise exception 'proposal weekdays invalid' using errcode='22023';
      end if;
    end if;
  end if;
  for screen in select * from public.screens where tenant_id=p_tenant_id and id=any(p_screen_ids) order by name,id loop
    if proposal_all then proposal.target_screen_id:=screen.id; end if;
    current_winner:=private.content_schedule_winner_s298_v1(p_tenant_id,screen.id,p_at,proposal,p_default_playlist_id);
    select count(*),coalesce(jsonb_agg(item) filter(where ordinal<=5),'[]') into alternative_count,alternatives from (
      select candidate.ordinality ordinal,jsonb_build_object('scheduleId',candidate.id,'name',candidate.name,
        'source',candidate.source,'targetKind',candidate.target_kind,'priority',candidate.priority,
        'startsAt',candidate.starts_at) item
      from private.content_schedule_candidates_s298_v1(p_tenant_id,screen.id,p_at,proposal) with ordinality candidate
    ) ordered;
    proposal_tie:=proposal.id is not null and existing.id is null and exists(
      select 1 from private.content_schedule_candidates_s298_v1(p_tenant_id,screen.id,p_at,proposal) candidate
      where candidate.id=proposal.id) and exists(
      select 1 from private.content_schedule_candidates_s298_v1(p_tenant_id,screen.id,p_at,proposal) other
      where other.id<>proposal.id and other.source=proposal.source and other.target_kind=proposal.target_kind
        and other.priority=proposal.priority and other.starts_at=proposal.starts_at
        and private.content_schedule_is_due(proposal,p_at));
    next_change:=null; checked:=0; searched_until:=horizon_end;
    for edge in
      select distinct point.at from (
        select schedule.* from public.content_schedules schedule
        join public.publisher_target_snapshot_screens binding on binding.tenant_id=schedule.tenant_id
          and binding.snapshot_id=schedule.target_snapshot_id and binding.screen_id=screen.id
        where schedule.tenant_id=p_tenant_id and schedule.enabled and schedule.deleted_at is null
          and schedule.starts_at<=horizon_end and (schedule.ends_at is null or schedule.ends_at>p_at)
          and (proposal.id is null or schedule.id<>proposal.id)
        union all select proposal.* where proposal.id is not null
      ) relevant cross join lateral private.content_schedule_edges_s298_v1(relevant::public.content_schedules,p_at,horizon_end) point
      order by point.at limit 10001
    loop
      checked:=checked+1;
      if checked>10000 then searched_until:=edge.at; exit; end if;
      future_winner:=private.content_schedule_winner_s298_v1(p_tenant_id,screen.id,edge.at,proposal,p_default_playlist_id);
      if (future_winner-'name'-'playlistName'-'releaseVersion'-'startsAt'-'endsAt'-'priority'-'targetKind')
        is distinct from (current_winner-'name'-'playlistName'-'releaseVersion'-'startsAt'-'endsAt'-'priority'-'targetKind') then
        next_change:=jsonb_build_object('at',edge.at,'winner',future_winner); exit;
      end if;
    end loop;
    select * into device from public.player_devices where tenant_id=p_tenant_id and screen_id=screen.id
      and status='paired' order by last_seen_at desc nulls last,id limit 1;
    rows:=rows||jsonb_build_array(jsonb_build_object('screenId',screen.id,'name',screen.name,'status',screen.status,
      'evaluationApplies',screen.status<>'disabled','winner',current_winner,'next',next_change,
      'searchedUntil',searched_until,'searchComplete',checked<=10000,'proposalTieUncertain',proposal_tie,
      'alternatives',alternatives,'candidateCount',alternative_count,
      'desired',jsonb_build_object('releaseId',screen.assigned_release_id,'scheduleId',screen.active_schedule_id),
      'desiredPublication',(select jsonb_build_object('name',playlist.name,'version',release.version)
        from public.playlist_releases release join public.playlists playlist on playlist.tenant_id=release.tenant_id and playlist.id=release.playlist_id
        where release.tenant_id=p_tenant_id and release.id=screen.assigned_release_id),
      'reportedPublication',(select jsonb_build_object('name',playlist.name,'version',release.version)
        from public.playlist_releases release join public.playlists playlist on playlist.tenant_id=release.tenant_id and playlist.id=release.playlist_id
        where release.tenant_id=p_tenant_id and release.id=device.active_release_id),
      'reportedDevice',case when device.id is null then null else jsonb_build_object(
        'active_release_id',device.active_release_id,'desired_release_id',device.desired_release_id,
        'last_seen_at',device.last_seen_at,'last_error_code',device.last_error_code,'status',device.status,
        'current_sync_detail',jsonb_build_object('publicationTrace',jsonb_build_object(
          'releaseId',device.current_sync_detail#>>'{publicationTrace,releaseId}',
          'firstFrameAt',device.current_sync_detail#>>'{publicationTrace,firstFrameAt}'))) end));
  end loop;
  return jsonb_build_object('schemaVersion',1,'evaluatedAt',p_at,'horizonEnd',horizon_end,
    'timezone',timezone_name,'proposal',p_proposal is not null or p_default_playlist_id is not null,'screens',rows);
end $$;
revoke all on function public.preview_effective_planning_v1(uuid,uuid[],timestamptz,integer,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.preview_effective_planning_v1(uuid,uuid[],timestamptz,integer,jsonb,uuid) to authenticated;

-- The lock, assignment, device, audit and snapshot writes below are unchanged.
create or replace function public.apply_due_content_schedules_v1(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  applied_count integer := 0;
  assignment_kind text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'schedule application requires service role' using errcode = '42501';
  end if;
  if p_now is null then
    raise exception 'schedule evaluation time is required' using errcode = '22023';
  end if;

  for target in
    select
      screen.id as screen_id,
      screen.target_revision,
      screen.schedule_evaluated_at,
      screen.tenant_id,
      screen.default_playlist_id,
      screen.default_release_id,
      screen.assigned_playlist_id,
      screen.assigned_release_id,
      screen.active_assignment_source,
      screen.active_schedule_id,
      screen.active_target_snapshot_id,
      null::uuid as schedule_id,
      null::uuid as schedule_playlist_id,
      null::uuid as schedule_release_id,
      null::text as schedule_source,
      null::uuid as target_snapshot_id
    from public.screens screen
    where screen.status <> 'disabled'::public.screen_status
      and exists (
        select 1 from public.tenants tenant
        where tenant.id = screen.tenant_id
          and tenant.status in (
            'active'::public.tenant_status,
            'paused'::public.tenant_status
          )
      )
    order by screen.id
    for update of screen
  loop
    if target.schedule_evaluated_at is not null and target.schedule_evaluated_at > p_now then continue; end if;
    -- Resolve AFTER acquiring the screen lock: a stale lateral query evaluated
    -- before a concurrent Publisher commit must never supply the winner.
    select schedule.id,schedule.playlist_id,schedule.release_id,schedule.source,schedule.target_snapshot_id
    into target.schedule_id,target.schedule_playlist_id,target.schedule_release_id,target.schedule_source,target.target_snapshot_id
    from private.content_schedule_candidates_s298_v1(target.tenant_id,target.screen_id,p_now) schedule
    limit 1;
    update public.screens set schedule_evaluated_at=p_now where tenant_id=target.tenant_id and id=target.screen_id
      and schedule_evaluated_at is distinct from p_now;
    if target.schedule_id is not null then
      assignment_kind := 'scheduled';
      if target.assigned_release_id is not distinct from target.schedule_release_id
        and target.active_schedule_id is not distinct from target.schedule_id
        and target.active_target_snapshot_id is not distinct from target.target_snapshot_id
      then
        continue;
      end if;

      update public.screens
      set assigned_playlist_id = target.schedule_playlist_id,
          assigned_release_id = target.schedule_release_id,
          active_assignment_source = case
            when target.schedule_source = 'override' then 'override'
            else 'schedule'
          end,
          active_schedule_id = target.schedule_id,
          active_target_snapshot_id = target.target_snapshot_id
      where tenant_id = target.tenant_id
        and id = target.screen_id;
    else
      assignment_kind := 'fallback';
      if target.assigned_release_id is not distinct from target.default_release_id
        and target.active_assignment_source = 'default'
        and target.active_schedule_id is null
      then
        continue;
      end if;

      update public.screens
      set assigned_playlist_id = target.default_playlist_id,
          assigned_release_id = target.default_release_id,
          active_assignment_source = 'default',
          active_schedule_id = null,
          active_target_snapshot_id = null
      where tenant_id = target.tenant_id
        and id = target.screen_id;
    end if;

    update public.player_devices
    set desired_release_id = coalesce(
          target.schedule_release_id,
          target.default_release_id
        )
    where tenant_id = target.tenant_id
      and screen_id = target.screen_id
      and status = 'paired'::public.player_device_status;

    if coalesce(target.schedule_release_id, target.default_release_id) is not null then
      insert into public.release_screen_assignments (
        tenant_id,
        release_id,
        screen_id,
        assignment_kind,
        assigned_by,
        target_snapshot_id
      )
      values (
        target.tenant_id,
        coalesce(target.schedule_release_id, target.default_release_id),
        target.screen_id,
        assignment_kind,
        null,
        target.target_snapshot_id
      );
    end if;

    insert into public.audit_events(tenant_id,action,target_type,target_id,result,metadata)
    values(target.tenant_id,case when target.schedule_id is null then 'publisher.schedule.fallback_applied'
      else 'publisher.schedule.applied' end,'screens',target.screen_id,'success',
      jsonb_build_object('systemExecuted',true,'executor','content_scheduler',
        'scheduleId',target.schedule_id,'releaseId',coalesce(target.schedule_release_id,target.default_release_id),
        'evaluatedAt',p_now));
    applied_count := applied_count + 1;
  end loop;

  return applied_count;
end;
$$;

create or replace function private.apply_removed_schedule_fallback_v1(p_tenant_id uuid,p_schedule_id uuid)returns void
language plpgsql security definer set search_path='' as $$
declare screen public.screens%rowtype;winner public.content_schedules%rowtype;release_id uuid;now_at timestamptz:=clock_timestamp();
begin
 for screen in select *from public.screens where tenant_id=p_tenant_id and active_schedule_id=p_schedule_id order by id for update loop
   select schedule.*into winner from private.content_schedule_candidates_s298_v1(p_tenant_id,screen.id,now_at) schedule limit 1;
   release_id:=coalesce(winner.release_id,screen.default_release_id);
   update public.screens set assigned_playlist_id=coalesce(winner.playlist_id,screen.default_playlist_id),assigned_release_id=release_id,
    active_assignment_source=case when winner.id is null then 'default'when winner.source='override'then 'override'else 'schedule'end,
    active_schedule_id=winner.id,active_target_snapshot_id=winner.target_snapshot_id,schedule_evaluated_at=now_at where tenant_id=p_tenant_id and id=screen.id;
   update public.player_devices set desired_release_id=release_id where tenant_id=p_tenant_id and screen_id=screen.id and status='paired';
   if release_id is not null then insert into public.release_screen_assignments(tenant_id,release_id,screen_id,assignment_kind,assigned_by,target_snapshot_id)
    values(p_tenant_id,release_id,screen.id,case when winner.id is null then 'fallback'else 'scheduled'end,private.current_user_id(),winner.target_snapshot_id);end if;
 end loop;
end $$;

select pg_catalog.pg_notify('pgrst','reload schema');
