-- Calendar authoring metadata is independent of immutable playback provenance.
alter table public.content_schedules add column calendar_tone text not null default 'green'check(calendar_tone in('green','blue','orange','petrol')),
 add column deleted_at timestamptz;
create index content_schedules_tenant_calendar_idx on public.content_schedules(tenant_id,starts_at,id)where deleted_at is null;
alter function public.mutate_content_schedule_v1(uuid,uuid,bigint,text,jsonb,uuid)rename to mutate_content_schedule_before_sites_v11;
revoke all on function public.mutate_content_schedule_before_sites_v11(uuid,uuid,bigint,text,jsonb,uuid)from public,anon,authenticated,service_role;

-- Re-evaluate only screens affected by a removed schedule, with the existing priority rules.
create function private.apply_removed_schedule_fallback_v1(p_tenant_id uuid,p_schedule_id uuid)returns void
language plpgsql security definer set search_path='' as $$
declare screen public.screens%rowtype;winner public.content_schedules%rowtype;release_id uuid;now_at timestamptz:=clock_timestamp();
begin
 for screen in select *from public.screens where tenant_id=p_tenant_id and active_schedule_id=p_schedule_id order by id for update loop
   select schedule.*into winner from public.content_schedules schedule
    join public.publisher_target_snapshot_screens binding on binding.tenant_id=schedule.tenant_id and binding.snapshot_id=schedule.target_snapshot_id and binding.screen_id=screen.id
    where schedule.tenant_id=p_tenant_id and schedule.deleted_at is null and private.content_schedule_is_due(schedule,now_at)
    order by case schedule.source when 'override'then 3 when 'publisher'then 2 else 1 end desc,
     case schedule.target_kind when 'screen'then 2 else 1 end desc,schedule.priority desc,schedule.starts_at desc,schedule.id limit 1;
   release_id:=coalesce(winner.release_id,screen.default_release_id);
   update public.screens set assigned_playlist_id=coalesce(winner.playlist_id,screen.default_playlist_id),assigned_release_id=release_id,
    active_assignment_source=case when winner.id is null then 'default'when winner.source='override'then 'override'else 'schedule'end,
    active_schedule_id=winner.id,active_target_snapshot_id=winner.target_snapshot_id,schedule_evaluated_at=now_at where tenant_id=p_tenant_id and id=screen.id;
   update public.player_devices set desired_release_id=release_id where tenant_id=p_tenant_id and screen_id=screen.id and status='paired';
   if release_id is not null then insert into public.release_screen_assignments(tenant_id,release_id,screen_id,assignment_kind,assigned_by,target_snapshot_id)
    values(p_tenant_id,release_id,screen.id,case when winner.id is null then 'fallback'else 'scheduled'end,private.current_user_id(),winner.target_snapshot_id);end if;
 end loop;
end $$;
revoke all on function private.apply_removed_schedule_fallback_v1(uuid,uuid)from public,anon,authenticated,service_role;

create function public.mutate_content_schedule_v2(p_tenant_id uuid,p_schedule_id uuid,p_expected_revision bigint,p_operation text,p_payload jsonb,p_idempotency_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare schedule public.content_schedules%rowtype;request jsonb;replay jsonb;result jsonb;child jsonb;target uuid;targets uuid[];ids uuid[]:='{}';ordinal integer:=0;tone text;
begin
 if private.current_user_id()is null or not private.can_write_playlist(p_tenant_id)then raise exception 'actor cannot mutate schedules for this tenant'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 if p_operation not in('create','create_all','update','enable','disable','delete')or p_expected_revision is null or p_expected_revision<0 or p_idempotency_key is null
  or jsonb_typeof(p_payload)is distinct from 'object'or octet_length(p_payload::text)>32768 then raise exception 'schedule command outside limits'using errcode='22023';end if;
 if p_operation not in('create','create_all')then
  select *into schedule from public.content_schedules where tenant_id=p_tenant_id and id=p_schedule_id for update;
  if not found then raise exception 'content schedule not found'using errcode='P0002';end if;
 else
  if p_schedule_id is not null or p_expected_revision<>0 then raise exception 'new content schedule identity is invalid'using errcode='22023';end if;
 end if;
 request:=jsonb_build_object('scheduleId',p_schedule_id,'expectedRevision',p_expected_revision,'operation',p_operation,'payload',p_payload);
 replay:=private.begin_publisher_command(p_tenant_id,'content_schedule.sites.v2',p_idempotency_key,request);if replay is not null then return replay;end if;
 if schedule.deleted_at is not null then raise exception 'deleted schedule cannot be changed'using errcode='23514';end if;
 if schedule.id is not null and schedule.revision<>p_expected_revision then return private.complete_publisher_command(p_tenant_id,'content_schedule.sites.v2',p_idempotency_key,request,'content_schedules',p_schedule_id,jsonb_build_object('outcome','conflict','scheduleId',p_schedule_id,'actualRevision',schedule.revision),'publisher.content_schedule.conflict','failed');end if;
 tone:=coalesce(p_payload->>'calendarTone',schedule.calendar_tone,'green');
 if tone not in('green','blue','orange','petrol')then raise exception 'calendar tone invalid'using errcode='23514';end if;
 if p_operation='delete'then
  -- Immutable target snapshots keep their historical FK; the authoring row leaves the calendar.
  update public.content_schedules set enabled=false,deleted_at=clock_timestamp(),revision=revision+1,updated_by=private.current_user_id()where tenant_id=p_tenant_id and id=p_schedule_id returning revision into schedule.revision;
  perform private.apply_removed_schedule_fallback_v1(p_tenant_id,p_schedule_id);
  result:=jsonb_build_object('outcome','deleted','scheduleId',p_schedule_id,'actualRevision',schedule.revision);
 elsif p_operation='create_all'then
  select array_agg(id order by id)into targets from public.screens where tenant_id=p_tenant_id and deleted_at is null and status='active';
  if coalesce(cardinality(targets),0)not between 1 and 100 then raise exception 'all-screen schedule requires one through 100 active screens'using errcode='23514';end if;
  perform 1 from public.screens where tenant_id=p_tenant_id and id=any(targets)order by id for update;
  foreach target in array targets loop
   ordinal:=ordinal+1;
   child:=public.mutate_content_schedule_before_sites_v11(p_tenant_id,null,0,'create',(p_payload-'calendarTone')||jsonb_build_object('targetKind','screen','targetId',target),md5(p_idempotency_key::text||':schedule:'||ordinal)::uuid);
   if child->>'outcome'is distinct from 'applied'then raise exception 'schedule batch did not apply; nothing changed'using errcode='40001';end if;
   ids:=array_append(ids,(child->>'scheduleId')::uuid);
   update public.content_schedules set calendar_tone=tone where tenant_id=p_tenant_id and id=(child->>'scheduleId')::uuid;
  end loop;
  result:=jsonb_build_object('outcome','applied','scheduleIds',ids,'targetCount',cardinality(ids),'actualRevision',0);
 else
  result:=public.mutate_content_schedule_before_sites_v11(p_tenant_id,p_schedule_id,p_expected_revision,p_operation,p_payload-'calendarTone',md5(p_idempotency_key::text||':legacy-schedule')::uuid);
  if result->>'outcome'='applied'and p_operation in('create','update')then update public.content_schedules set calendar_tone=tone where tenant_id=p_tenant_id and id=(result->>'scheduleId')::uuid;end if;
 end if;
 return private.complete_publisher_command(p_tenant_id,'content_schedule.sites.v2',p_idempotency_key,request,'content_schedules',p_schedule_id,result,'publisher.content_schedule.'||p_operation,case when result->>'outcome'in('applied','deleted')then 'success'else 'failed'end);
end $$;
revoke all on function public.mutate_content_schedule_v2(uuid,uuid,bigint,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_content_schedule_v2(uuid,uuid,bigint,text,jsonb,uuid)to authenticated;
create function public.mutate_content_schedule_v1(p_tenant_id uuid,p_schedule_id uuid,p_expected_revision bigint,p_operation text,p_payload jsonb,p_idempotency_key uuid)returns jsonb
language sql security definer set search_path='' as $$select public.mutate_content_schedule_v2(p_tenant_id,p_schedule_id,p_expected_revision,p_operation,p_payload,p_idempotency_key)$$;
revoke all on function public.mutate_content_schedule_v1(uuid,uuid,bigint,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.mutate_content_schedule_v1(uuid,uuid,bigint,text,jsonb,uuid)to authenticated;
select pg_catalog.pg_notify('pgrst','reload schema');
