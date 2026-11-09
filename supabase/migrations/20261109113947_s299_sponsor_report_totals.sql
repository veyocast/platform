-- S299: complete, tenant-authorized reporting over accepted PoP records.
-- No change to event acceptance, deduplication, campaign rotation or frozen plans.
create index sponsor_play_events_campaign_period_idx
  on public.sponsor_play_events(tenant_id, campaign_id, happened_at desc, event_id desc);
create index sponsor_play_events_screen_period_idx
  on public.sponsor_play_events(tenant_id, screen_id, happened_at desc, event_id desc);

create table public.sponsor_campaign_report_goals (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  from_date date not null,
  until_date date not null,
  timezone_name text not null,
  target_plays bigint not null check (target_plays between 0 and 9007199254740991),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id,campaign_id,from_date,until_date,timezone_name),
  foreign key (tenant_id,campaign_id) references public.sponsor_campaigns(tenant_id,id) on delete restrict,
  check (until_date > from_date and until_date <= from_date + 3660)
);
alter table public.sponsor_campaign_report_goals enable row level security;
alter table public.sponsor_campaign_report_goals force row level security;
revoke all on public.sponsor_campaign_report_goals from public,anon,authenticated,service_role;
grant select on public.sponsor_campaign_report_goals to authenticated;
create policy sponsor_report_goals_read on public.sponsor_campaign_report_goals
  for select to authenticated using (private.has_tenant_capability(tenant_id,'tenant.sponsor.read') and private.has_tenant_capability(tenant_id,'tenant.sponsor.report'));

-- Operator-maintained evidence only. Absence of a recorded gap never proves
-- that an offline device delivered every play. No automatic event retention
-- currently exists; the 30-day ingress allowance is not a retention guarantee.
create table private.sponsor_report_gaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid,
  screen_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (reason in ('registration_gap','retention')),
  recorded_at timestamptz not null default now(),
  foreign key (tenant_id,campaign_id) references public.sponsor_campaigns(tenant_id,id) on delete cascade,
  foreign key (tenant_id,screen_id) references public.screens(tenant_id,id) on delete cascade,
  check (ends_at > starts_at)
);
create index sponsor_report_gaps_tenant_period_idx on private.sponsor_report_gaps(tenant_id,starts_at,ends_at);
alter table private.sponsor_report_gaps enable row level security;
alter table private.sponsor_report_gaps force row level security;
revoke all on private.sponsor_report_gaps from public,anon,authenticated,service_role;
grant select,insert,update,delete on private.sponsor_report_gaps to service_role;
create policy sponsor_report_gaps_operator on private.sponsor_report_gaps
  for all to service_role using (true) with check (true);

create function private.sponsor_report_v1(
  p_tenant_id uuid,p_from_date date,p_until_date date,
  p_campaign_id uuid default null,p_screen_id uuid default null,
  p_as_of timestamptz default null,p_before_happened_at timestamptz default null,
  p_before_event_id uuid default null,p_detail_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  report_zone text;
  report_from timestamptz;
  report_until timestamptz;
  report_cut timestamptz := coalesce(p_as_of,statement_timestamp());
  report_result jsonb;
begin
  perform private.require_sponsor_capability(p_tenant_id,'tenant.sponsor.read');
  perform private.require_sponsor_capability(p_tenant_id,'tenant.sponsor.report');
  if p_from_date is null or p_until_date is null or not isfinite(p_from_date)
    or not isfinite(p_until_date) or p_until_date <= p_from_date
    or p_until_date > p_from_date + 3660
    or not isfinite(report_cut) or report_cut > statement_timestamp() + interval '1 minute'
    or p_detail_limit is null or p_detail_limit not between 1 and 100
    or ((p_before_happened_at is null) <> (p_before_event_id is null))
    or (p_before_happened_at is not null and not isfinite(p_before_happened_at)) then
    raise exception using errcode='22023',message='invalid sponsor report period, cutoff or cursor';
  end if;
  if (p_campaign_id is not null and not exists(select 1 from public.sponsor_campaigns where tenant_id=p_tenant_id and id=p_campaign_id))
    or (p_screen_id is not null and not exists(select 1 from public.screens where tenant_id=p_tenant_id and id=p_screen_id)) then
    raise exception using errcode='42501',message='sponsor report filter is not authorized';
  end if;
  select coalesce(s.timezone_name,'Europe/Amsterdam') into report_zone
    from public.tenants t left join public.tenant_settings s on s.tenant_id=t.id where t.id=p_tenant_id;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=report_zone) then
    raise exception using errcode='22023',message='invalid sponsor report timezone';
  end if;
  report_from := p_from_date::timestamp at time zone report_zone;
  report_until := p_until_date::timestamp at time zone report_zone;

  with available as (
    select min(e.happened_at) first_event_at,max(e.happened_at) last_event_at,max(e.received_at) last_received_at
    from public.sponsor_play_events e
    where e.tenant_id=p_tenant_id and e.received_at <= report_cut
      and (p_campaign_id is null or e.campaign_id=p_campaign_id)
      and (p_screen_id is null or e.screen_id=p_screen_id)
  ), selected as materialized (
    select e.event_id,e.campaign_id,e.screen_id,e.plan_revision_id,e.happened_at,e.received_at,e.played_ms
    from public.sponsor_play_events e where e.tenant_id=p_tenant_id and e.received_at <= report_cut
      and e.happened_at >= report_from and e.happened_at < report_until
      and (p_campaign_id is null or e.campaign_id=p_campaign_id)
      and (p_screen_id is null or e.screen_id=p_screen_id)
  ), detail_page as (
    select * from selected
    where p_before_happened_at is null or (happened_at,event_id) < (p_before_happened_at,p_before_event_id)
    order by happened_at desc,event_id desc limit p_detail_limit + 1
  ), details as (
    select * from detail_page order by happened_at desc,event_id desc limit p_detail_limit
  ), grouped as (
    select campaign_id,screen_id,count(*)::text accepted_events,sum(played_ms)::text played_ms
      from selected group by campaign_id,screen_id
  ), gaps as (
    select g.* from private.sponsor_report_gaps g where g.tenant_id=p_tenant_id
      and g.recorded_at <= report_cut and g.starts_at < report_until and g.ends_at > report_from
      and (p_campaign_id is null or g.campaign_id is null or g.campaign_id=p_campaign_id)
      and (p_screen_id is null or g.screen_id is null or g.screen_id=p_screen_id)
  )
  select jsonb_build_object(
    'schemaVersion',1,'asOf',report_cut,'timezone',report_zone,
    'period',jsonb_build_object('fromDate',p_from_date,'untilDate',p_until_date,'from',report_from,'until',report_until),
    'filters',jsonb_build_object('campaignId',p_campaign_id,'screenId',p_screen_id),
    'totals',jsonb_build_object('acceptedEvents',(select count(*)::text from selected),'playedMs',(select coalesce(sum(played_ms),0)::text from selected)),
    'coverage',jsonb_build_object(
      'firstEventAt',(select first_event_at from available),'lastEventAt',(select last_event_at from available),
      'lastReceivedAt',(select last_received_at from available),
      'status',case when exists(select 1 from gaps) then 'partial' else 'unconfirmed' end,
      'automaticRetentionDays',null,'acceptedLateWindowDays',30,
      'gaps',coalesce((select jsonb_agg(jsonb_build_object('from',greatest(starts_at,report_from),'until',least(ends_at,report_until),'reason',reason) order by starts_at,id) from gaps),'[]'::jsonb)),
    'groups',coalesce((select jsonb_agg(jsonb_build_object(
      'campaignId',g.campaign_id,'campaignName',c.name,'screenId',g.screen_id,'screenName',s.name,
      'screenDeleted',s.deleted_at is not null,'acceptedEvents',g.accepted_events,'playedMs',g.played_ms
    ) order by c.name,g.campaign_id,s.name,g.screen_id) from grouped g
      join public.sponsor_campaigns c on c.tenant_id=p_tenant_id and c.id=g.campaign_id
      join public.screens s on s.tenant_id=p_tenant_id and s.id=g.screen_id),'[]'::jsonb),
    'details',coalesce((select jsonb_agg(jsonb_build_object(
      'eventId',d.event_id,'campaignId',d.campaign_id,'campaignName',c.name,
      'screenId',d.screen_id,'screenName',s.name,'screenDeleted',s.deleted_at is not null,
      'planVersion',pr.version,'happenedAt',d.happened_at,'receivedAt',d.received_at,'playedMs',d.played_ms
    ) order by d.happened_at desc,d.event_id desc) from details d
      join public.sponsor_campaigns c on c.tenant_id=p_tenant_id and c.id=d.campaign_id
      join public.screens s on s.tenant_id=p_tenant_id and s.id=d.screen_id
      join public.sponsor_plan_revisions pr on pr.tenant_id=p_tenant_id and pr.id=d.plan_revision_id),'[]'::jsonb),
    'hasMore',(select count(*) > p_detail_limit from detail_page),
    'goals',coalesce((select jsonb_agg(jsonb_build_object('campaignId',g.campaign_id,'campaignName',c.name,'targetPlays',g.target_plays::text) order by c.name,g.campaign_id)
      from public.sponsor_campaign_report_goals g join public.sponsor_campaigns c on c.tenant_id=g.tenant_id and c.id=g.campaign_id
      where g.tenant_id=p_tenant_id and g.from_date=p_from_date and g.until_date=p_until_date and g.timezone_name=report_zone
        and (p_campaign_id is null or g.campaign_id=p_campaign_id)),'[]'::jsonb),
    'filterOptions',jsonb_build_object(
      'campaigns',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from public.sponsor_campaigns where tenant_id=p_tenant_id),'[]'::jsonb),
      'screens',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'deleted',deleted_at is not null) order by name,id) from public.screens where tenant_id=p_tenant_id),'[]'::jsonb)),
    'qrScans',null,'completedPlays',null,'historicalScreenGroupsAvailable',false
  ) into report_result;
  return report_result;
end;
$$;
revoke all on function private.sponsor_report_v1(uuid,date,date,uuid,uuid,timestamptz,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.sponsor_report_v1(uuid,date,date,uuid,uuid,timestamptz,timestamptz,uuid,integer) to authenticated;

create function public.get_sponsor_report_v1(
  p_tenant_id uuid,p_from_date date,p_until_date date,
  p_campaign_id uuid default null,p_screen_id uuid default null,
  p_as_of timestamptz default null,p_before_happened_at timestamptz default null,
  p_before_event_id uuid default null,p_detail_limit integer default 50
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.sponsor_report_v1(p_tenant_id,p_from_date,p_until_date,p_campaign_id,p_screen_id,p_as_of,p_before_happened_at,p_before_event_id,p_detail_limit);
$$;
revoke all on function public.get_sponsor_report_v1(uuid,date,date,uuid,uuid,timestamptz,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_sponsor_report_v1(uuid,date,date,uuid,uuid,timestamptz,timestamptz,uuid,integer) to authenticated;

create function public.set_sponsor_report_goal_v1(p_tenant_id uuid,p_campaign_id uuid,p_from_date date,p_until_date date,p_target_plays bigint default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; report_zone text;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id,'tenant.sponsor.write');
  if not exists(select 1 from public.tenants where id=p_tenant_id and status='active') then
    raise exception using errcode='42501',message='tenant is not writable';
  end if;
  if not exists(select 1 from public.sponsor_campaigns where tenant_id=p_tenant_id and id=p_campaign_id) then
    raise exception using errcode='42501',message='sponsor goal campaign is not authorized';
  end if;
  if p_from_date is null or p_until_date is null or not isfinite(p_from_date) or not isfinite(p_until_date)
    or p_until_date <= p_from_date or p_until_date > p_from_date+3660
    or (p_target_plays is not null and p_target_plays not between 0 and 9007199254740991) then
    raise exception using errcode='22023',message='invalid sponsor goal period or count';
  end if;
  select coalesce(timezone_name,'Europe/Amsterdam') into report_zone from public.tenant_settings where tenant_id=p_tenant_id;
  if report_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=report_zone) then
    raise exception using errcode='22023',message='invalid sponsor goal timezone';
  end if;
  if p_target_plays is null then
    delete from public.sponsor_campaign_report_goals where tenant_id=p_tenant_id and campaign_id=p_campaign_id and from_date=p_from_date and until_date=p_until_date and timezone_name=report_zone;
  else
    insert into public.sponsor_campaign_report_goals(tenant_id,campaign_id,from_date,until_date,timezone_name,target_plays,updated_by)
    values(p_tenant_id,p_campaign_id,p_from_date,p_until_date,report_zone,p_target_plays,actor_id)
    on conflict(tenant_id,campaign_id,from_date,until_date,timezone_name)
    do update set target_plays=excluded.target_plays,updated_by=excluded.updated_by,updated_at=now();
  end if;
  perform private.audit_sponsor_action(p_tenant_id,actor_id,'report.goal.set','campaign',p_campaign_id,
    jsonb_build_object('fromDate',p_from_date,'untilDate',p_until_date,'timezone',report_zone,'targetPlays',p_target_plays));
end;
$$;
revoke all on function public.set_sponsor_report_goal_v1(uuid,uuid,date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function public.set_sponsor_report_goal_v1(uuid,uuid,date,date,bigint) to authenticated;
