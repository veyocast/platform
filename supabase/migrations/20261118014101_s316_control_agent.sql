set lock_timeout = '3s';
set statement_timeout = '30s';

insert into private.tenant_feature_flag_definitions(flag_key)
values ('control_ai_agent') on conflict do nothing;

do $$
declare definition text;
begin
  select pg_catalog.pg_get_constraintdef(oid) into strict definition
  from pg_catalog.pg_constraint where conrelid='public.tenant_feature_flags'::regclass
    and conname='tenant_feature_flags_flag_key_check';
  if definition not like '%sites_authoring_paused%' or definition like '%control_ai_agent%' then
    raise exception 'unexpected feature catalog';
  end if;
  alter table public.tenant_feature_flags drop constraint tenant_feature_flags_flag_key_check;
  execute 'alter table public.tenant_feature_flags add constraint tenant_feature_flags_flag_key_check '
    || replace(definition, 'ARRAY[', 'ARRAY[''control_ai_agent''::text, ');
end $$;

create function private.ai_agent_allowed(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_user_id() is not null
    and private.is_tenant_member(p_tenant_id)
    and exists(select 1 from public.tenants where id=p_tenant_id and status='active')
    and exists(select 1 from public.tenant_feature_flags where tenant_id=p_tenant_id and flag_key='control_ai_agent' and enabled)
    and exists(select 1 from private.tenant_feature_flag_definitions where flag_key='control_ai_agent' and not kill_switch_active);
$$;
revoke all on function private.ai_agent_allowed(uuid) from public, anon, authenticated, service_role;

create function public.get_ai_agent_state_v1(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select private.ai_agent_allowed(p_tenant_id); $$;
revoke all on function public.get_ai_agent_state_v1(uuid) from public, anon, service_role;
grant execute on function public.get_ai_agent_state_v1(uuid) to authenticated;

create table private.ai_provider_config (
  environment text primary key check(environment in ('development','staging','production')),
  encrypted_key jsonb,
  chat_model text not null check(length(chat_model) between 2 and 120),
  image_model text not null check(length(image_model) between 2 and 120),
  revision bigint not null default 1,
  last_tested_at timestamptz,
  connection_status text not null default 'untested' check(connection_status in ('untested','connected','failed','revoked')),
  changed_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table private.ai_provider_config enable row level security;
alter table private.ai_provider_config force row level security;
revoke all on private.ai_provider_config from public, anon, authenticated, service_role;

create function public.get_platform_ai_config_v1(p_environment text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_member(array['platform_owner','platform_admin','platform_viewer']::public.platform_role[]) then
    raise exception 'platform access required' using errcode='42501';
  end if;
  return (select jsonb_build_object('configured',encrypted_key is not null,'chatModel',chat_model,'imageModel',image_model,'revision',revision,'lastTestedAt',last_tested_at,'status',connection_status)
    from private.ai_provider_config where environment=p_environment);
end $$;

create function public.set_platform_ai_config_v1(p_environment text,p_expected_revision bigint,p_encrypted_key jsonb,p_chat_model text,p_image_model text,p_revoke boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_record private.ai_provider_config%rowtype;
begin
  if not private.is_platform_member(array['platform_owner','platform_admin']::public.platform_role[]) then
    raise exception 'platform management required' using errcode='42501';
  end if;
  perform private.require_aal2_command();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai.config:'||p_environment,316));
  select * into current_record from private.ai_provider_config where environment=p_environment for update;
  if coalesce(current_record.revision,0)<>p_expected_revision then raise exception 'configuration changed' using errcode='40001'; end if;
  if p_encrypted_key is not null and (jsonb_typeof(p_encrypted_key)<>'object' or not(p_encrypted_key ?& array['ciphertext','iv','tag'])) then
    raise exception 'encrypted key invalid' using errcode='23514';
  end if;
  insert into private.ai_provider_config(environment,encrypted_key,chat_model,image_model,changed_by,revision,connection_status)
  values(p_environment,case when p_revoke then null else coalesce(p_encrypted_key,current_record.encrypted_key) end,p_chat_model,p_image_model,private.current_user_id(),p_expected_revision+1,case when p_revoke then 'revoked' else 'untested' end)
  on conflict(environment) do update set encrypted_key=excluded.encrypted_key,chat_model=excluded.chat_model,image_model=excluded.image_model,
    changed_by=excluded.changed_by,revision=excluded.revision,connection_status=excluded.connection_status,last_tested_at=null,updated_at=now();
  perform private.audit_event(null,'platform.ai.config','platform_ai_config',null,'success',jsonb_build_object('environment',p_environment,'revision',p_expected_revision+1,'revoked',p_revoke));
  return public.get_platform_ai_config_v1(p_environment);
end $$;

create function public.read_ai_provider_config_v1(p_environment text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('encryptedKey',encrypted_key,'chatModel',chat_model,'imageModel',image_model,'revision',revision)
  from private.ai_provider_config where environment=p_environment and encrypted_key is not null;
$$;

create function public.record_ai_connection_test_v1(p_environment text,p_expected_revision bigint,p_connected boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_member(array['platform_owner','platform_admin']::public.platform_role[]) then raise exception 'platform management required' using errcode='42501'; end if;
  perform private.require_aal2_command();
  update private.ai_provider_config set last_tested_at=now(),connection_status=case when p_connected then 'connected' else 'failed' end
    where environment=p_environment and revision=p_expected_revision and encrypted_key is not null;
  if not found then return false; end if;
  perform private.audit_event(null,'platform.ai.test','platform_ai_config',null,'success',jsonb_build_object('environment',p_environment,'revision',p_expected_revision,'connected',p_connected));
  return true;
end $$;

revoke all on function public.get_platform_ai_config_v1(text),public.set_platform_ai_config_v1(text,bigint,jsonb,text,text,boolean) from public,anon,service_role;
grant execute on function public.get_platform_ai_config_v1(text),public.set_platform_ai_config_v1(text,bigint,jsonb,text,text,boolean) to authenticated;
revoke all on function public.read_ai_provider_config_v1(text) from public,anon,authenticated;
grant execute on function public.read_ai_provider_config_v1(text) to service_role;
revoke all on function public.record_ai_connection_test_v1(text,bigint,boolean) from public,anon,service_role;
grant execute on function public.record_ai_connection_test_v1(text,bigint,boolean) to authenticated;

create table public.ai_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(tenant_id,id)
);
create index ai_conversations_tenant_user_idx on public.ai_conversations(tenant_id,user_id,created_at desc);
alter table public.ai_conversations enable row level security;
revoke all on public.ai_conversations from public, anon, authenticated, service_role;
create policy ai_conversations_read on public.ai_conversations for select to authenticated using(user_id=auth.uid() and private.is_tenant_member(tenant_id));
create policy ai_conversations_create on public.ai_conversations for insert to authenticated with check(user_id=auth.uid() and private.ai_agent_allowed(tenant_id));
grant select,insert on public.ai_conversations to authenticated;
revoke all on public.ai_conversations from anon;
grant execute on function private.ai_agent_allowed(uuid) to authenticated;

create table public.ai_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id),
  plan jsonb not null check(jsonb_typeof(plan)='object'),
  plan_hash text not null check(length(plan_hash)=64),
  status text not null default 'proposed' check(status in ('proposed','approved','cancelled','running','failed','review_required','completed')),
  approved_at timestamptz,
  receipts jsonb not null default '[]' check(jsonb_typeof(receipts)='array'),
  next_step integer not null default 0,
  last_error_code text,
  created_at timestamptz not null default now(),
  foreign key(tenant_id,conversation_id) references public.ai_conversations(tenant_id,id),
  unique(tenant_id,id)
);
create index ai_proposals_tenant_conversation_idx on public.ai_proposals(tenant_id,conversation_id,created_at desc);
alter table public.ai_proposals enable row level security;
revoke all on public.ai_proposals from public, anon, authenticated, service_role;
create policy ai_proposals_read on public.ai_proposals for select to authenticated using(user_id=auth.uid() and private.is_tenant_member(tenant_id));
grant select on public.ai_proposals to authenticated;
revoke all on public.ai_proposals from anon;

create table public.ai_provider_requests (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  operation_id uuid not null,
  environment text not null check(environment in ('development','staging','production')),
  operation text not null check(operation in ('chat','image_generation','image_edit')),
  model text not null,
  status text not null default 'started' check(status in ('started','succeeded','failed','unknown','disabled_after_request')),
  provider_request_id text,
  units jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_provider_requests_tenant_period_idx on public.ai_provider_requests(tenant_id,created_at desc,operation);
create index ai_provider_requests_operation_idx on public.ai_provider_requests(tenant_id,operation_id);
alter table public.ai_provider_requests enable row level security;
revoke all on public.ai_provider_requests from public, anon, authenticated, service_role;
create policy ai_provider_requests_read on public.ai_provider_requests for select to authenticated using(private.has_tenant_capability(tenant_id,'tenant.settings.manage') or private.is_platform_member(array['platform_owner','platform_admin']::public.platform_role[]));
grant select on public.ai_provider_requests to authenticated;
revoke all on public.ai_provider_requests from anon;

create function public.begin_ai_provider_request_v1(p_tenant_id uuid,p_request_id uuid,p_operation_id uuid,p_environment text,p_operation text,p_model text,p_config_revision bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not private.ai_agent_allowed(p_tenant_id) then raise exception 'agent unavailable' using errcode='42501'; end if;
  perform 1 from public.tenant_feature_flags where tenant_id=p_tenant_id and flag_key='control_ai_agent' and enabled for share;
  if not found then raise exception 'agent disabled' using errcode='42501'; end if;
  if p_operation in ('image_generation','image_edit') and (not private.has_tenant_capability(p_tenant_id,'tenant.media.write') or not private.has_tenant_capability(p_tenant_id,'tenant.media.read')) then raise exception 'media rights required' using errcode='42501'; end if;
  if not exists(select 1 from private.ai_provider_config where environment=p_environment and encrypted_key is not null and revision=p_config_revision
    and ((p_operation='chat' and p_model=chat_model) or (p_operation in ('image_generation','image_edit') and p_model=image_model))) then raise exception 'provider unavailable' using errcode='55000'; end if;
  insert into public.ai_provider_requests(id,tenant_id,user_id,operation_id,environment,operation,model)
    values(p_request_id,p_tenant_id,private.current_user_id(),p_operation_id,p_environment,p_operation,p_model) on conflict(id) do nothing;
  return found;
end $$;

create function public.finish_ai_provider_request_v1(p_request_id uuid,p_status text,p_provider_request_id text,p_units jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_provider_requests set status=p_status,provider_request_id=p_provider_request_id,units=p_units,finished_at=now()
    where id=p_request_id and status='started';
  return found;
end $$;
revoke all on function public.begin_ai_provider_request_v1(uuid,uuid,uuid,text,text,text,bigint) from public,anon,service_role;
grant execute on function public.begin_ai_provider_request_v1(uuid,uuid,uuid,text,text,text,bigint) to authenticated;
revoke all on function public.finish_ai_provider_request_v1(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.finish_ai_provider_request_v1(uuid,text,text,jsonb) to service_role;

create function public.create_ai_proposal_v1(p_tenant_id uuid,p_conversation_id uuid,p_plan jsonb,p_replaces_id uuid default null,p_replaces_hash text default null,p_replaces_next_step integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare proposal public.ai_proposals%rowtype; previous public.ai_proposals%rowtype;
begin
  if not private.ai_agent_allowed(p_tenant_id) or not exists(select 1 from public.ai_conversations where tenant_id=p_tenant_id and id=p_conversation_id and user_id=private.current_user_id()) then
    raise exception 'agent unavailable' using errcode='42501';
  end if;
  if jsonb_typeof(p_plan)<>'object' or jsonb_typeof(p_plan->'steps')<>'array' or jsonb_array_length(p_plan->'steps') not between 1 and 20 or pg_catalog.octet_length(p_plan::text)>262144 then
    raise exception 'proposal invalid' using errcode='23514';
  end if;
  perform 1 from public.ai_conversations where id=p_conversation_id and tenant_id=p_tenant_id for update;
  if p_replaces_id is not null then
    select * into previous from public.ai_proposals where id=p_replaces_id and tenant_id=p_tenant_id and user_id=private.current_user_id() and conversation_id=p_conversation_id for update;
    if not found or previous.plan_hash is distinct from p_replaces_hash or previous.next_step is distinct from p_replaces_next_step or previous.status in ('completed','cancelled') then raise exception 'previous proposal changed' using errcode='40001'; end if;
    update public.ai_proposals set status='cancelled' where id=previous.id;
  end if;
  update public.ai_proposals set status='cancelled' where tenant_id=p_tenant_id and conversation_id=p_conversation_id and user_id=private.current_user_id() and status='proposed';
  insert into public.ai_proposals(tenant_id,conversation_id,user_id,plan,plan_hash)
    values(p_tenant_id,p_conversation_id,private.current_user_id(),p_plan,encode(extensions.digest(p_plan::text,'sha256'),'hex')) returning * into proposal;
  return to_jsonb(proposal);
end $$;

create function public.decide_ai_proposal_v1(p_proposal_id uuid,p_plan_hash text,p_approve boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare proposal public.ai_proposals%rowtype;
begin
  select * into proposal from public.ai_proposals where id=p_proposal_id for update;
  if proposal.user_id is distinct from private.current_user_id() or not private.ai_agent_allowed(proposal.tenant_id) then raise exception 'agent unavailable' using errcode='42501'; end if;
  if proposal.plan_hash is distinct from p_plan_hash then raise exception 'proposal changed' using errcode='40001'; end if;
  if p_approve and proposal.status='proposed' then
    update public.ai_proposals set status='approved',approved_at=now() where id=p_proposal_id returning * into proposal;
    perform private.audit_event(proposal.tenant_id,'agent.proposal.approved','ai_proposal',proposal.id,'success',jsonb_build_object('planHash',proposal.plan_hash));
  elsif not p_approve and proposal.status in ('proposed','approved','running','failed','review_required') then
    update public.ai_proposals set status='cancelled' where id=p_proposal_id returning * into proposal;
  end if;
  return to_jsonb(proposal);
end $$;

create table private.ai_execution_checks (
  tenant_id uuid not null references public.tenants(id),
  proposal_id uuid not null,
  step_index integer not null,
  plan_hash text not null,
  actor_id uuid not null references auth.users(id),
  expires_at timestamptz not null,
  primary key(proposal_id,step_index),
  foreign key(tenant_id,proposal_id) references public.ai_proposals(tenant_id,id)
);
create index ai_execution_checks_tenant_idx on private.ai_execution_checks(tenant_id);
alter table private.ai_execution_checks enable row level security;
alter table private.ai_execution_checks force row level security;
revoke all on private.ai_execution_checks from public,anon,authenticated,service_role;

create function public.register_ai_execution_check_v1(p_proposal_id uuid,p_plan_hash text,p_expected_step integer,p_actor_id uuid,p_tenant_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.ai_proposals where id=p_proposal_id and tenant_id=p_tenant_id and user_id=p_actor_id
    and plan_hash=p_plan_hash and next_step=p_expected_step and approved_at is not null and status in ('approved','running','failed')) then return false; end if;
  insert into private.ai_execution_checks(tenant_id,proposal_id,step_index,plan_hash,actor_id,expires_at) values(p_tenant_id,p_proposal_id,p_expected_step,p_plan_hash,p_actor_id,clock_timestamp()+interval '30 seconds')
    on conflict(proposal_id,step_index) do update set plan_hash=excluded.plan_hash,actor_id=excluded.actor_id,expires_at=excluded.expires_at;
  return true;
end $$;
revoke all on function public.register_ai_execution_check_v1(uuid,text,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.register_ai_execution_check_v1(uuid,text,integer,uuid,uuid) to service_role;

create function public.create_playlist_draft_v2(p_tenant_id uuid,p_playlist_id uuid,p_name text,p_description text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare request jsonb; replay jsonb; result jsonb;
begin
  if private.current_user_id() is null or not private.can_write_playlist(p_tenant_id) then raise exception 'playlist write required' using errcode='42501'; end if;
  perform private.require_active_tenant_command(p_tenant_id);
  if length(btrim(p_name)) not between 2 and 120 or length(coalesce(p_description,''))>500 or p_playlist_id is null then raise exception 'invalid playlist details' using errcode='23514'; end if;
  request:=jsonb_build_object('playlistId',p_playlist_id,'name',btrim(p_name),'description',p_description);
  replay:=private.begin_publisher_command(p_tenant_id,'playlist.create.v2',p_idempotency_key,request);
  if replay is not null then return replay; end if;
  insert into public.playlists(id,tenant_id,name,description,status,created_by,updated_by)
    values(p_playlist_id,p_tenant_id,btrim(p_name),nullif(p_description,''),'draft',private.current_user_id(),private.current_user_id());
  result:=jsonb_build_object('playlistId',p_playlist_id,'outcome','created','actualRevision',0);
  return private.complete_publisher_command(p_tenant_id,'playlist.create.v2',p_idempotency_key,request,'playlists',p_playlist_id,result,'publisher.playlist.create','success');
end $$;
revoke all on function public.create_playlist_draft_v2(uuid,uuid,text,text,uuid) from public,anon,service_role;
grant execute on function public.create_playlist_draft_v2(uuid,uuid,text,text,uuid) to authenticated;

create function public.get_ai_playlist_reach_v1(p_playlist_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target_tenant uuid;
begin
  select tenant_id into target_tenant from public.playlists where id=p_playlist_id;
  if not found or not private.ai_agent_allowed(target_tenant) or not private.has_tenant_capability(target_tenant,'tenant.playlist.read') or not private.has_tenant_capability(target_tenant,'tenant.screen.read') then raise exception 'playlist reach unavailable' using errcode='42501'; end if;
  return (
    with planned as materialized(select target_kind,target_screen_id,target_screen_group_id from public.content_schedules where tenant_id=target_tenant and playlist_id=p_playlist_id and enabled and (ends_at is null or ends_at>now())),
    groups as(select id from public.screen_groups where tenant_id=target_tenant and status='active' and default_playlist_id=p_playlist_id union select target_screen_group_id from planned where target_screen_group_id is not null),
    members as(select screen_id from public.screen_group_memberships where tenant_id=target_tenant and screen_group_id in(select id from groups)),
    compositions as(select composition_id from public.screen_composition_bindings where tenant_id=target_tenant and playlist_id=p_playlist_id)
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]'::jsonb)
    from public.screens where tenant_id=target_tenant and deleted_at is null and
      (assigned_playlist_id=p_playlist_id or default_playlist_id=p_playlist_id or composition_id in(select composition_id from compositions)
       or id in(select screen_id from members) or id in(select target_screen_id from planned) or exists(select 1 from planned where target_kind='all'))
  );
end $$;
revoke all on function public.get_ai_playlist_reach_v1(uuid) from public,anon,service_role;
grant execute on function public.get_ai_playlist_reach_v1(uuid) to authenticated;

create function public.get_ai_target_screens_v1(p_tenant_id uuid,p_target_kind text,p_target_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.ai_agent_allowed(p_tenant_id) or not private.has_tenant_capability(p_tenant_id,'tenant.screen.read') then raise exception 'target read denied' using errcode='42501'; end if;
  if p_target_kind not in ('screen','screen_group','all') or (p_target_kind<>'all' and p_target_id is null) then raise exception 'invalid target' using errcode='23514'; end if;
  if p_target_kind='screen_group' and not exists(select 1 from public.screen_groups where tenant_id=p_tenant_id and id=p_target_id and status='active') then raise exception 'group unavailable' using errcode='42501'; end if;
  return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id),'[]'::jsonb) from public.screens where tenant_id=p_tenant_id and deleted_at is null
    and (p_target_kind='all' or (p_target_kind='screen' and id=p_target_id) or (p_target_kind='screen_group' and id in(select screen_id from public.screen_group_memberships where tenant_id=p_tenant_id and screen_group_id=p_target_id))));
end $$;
revoke all on function public.get_ai_target_screens_v1(uuid,text,uuid) from public,anon,service_role;
grant execute on function public.get_ai_target_screens_v1(uuid,text,uuid) to authenticated;

create function public.execute_ai_proposal_step_v1(p_proposal_id uuid,p_plan_hash text,p_expected_step integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  proposal public.ai_proposals%rowtype;
  step jsonb;
  result jsonb;
  args jsonb;
  command_key uuid;
  target_id uuid;
  target_tenant uuid;
  screen_record public.screens%rowtype;
  target_updated_at timestamptz;
  ordered_items uuid[];
  destination integer;
begin
  select * into proposal from public.ai_proposals where id=p_proposal_id for update;
  if proposal.user_id is distinct from private.current_user_id() or not private.ai_agent_allowed(proposal.tenant_id) then raise exception 'agent unavailable' using errcode='42501'; end if;
  perform 1 from public.tenant_feature_flags where tenant_id=proposal.tenant_id and flag_key='control_ai_agent' and enabled for share;
  if not found then raise exception 'agent disabled' using errcode='42501'; end if;
  if proposal.plan_hash is distinct from p_plan_hash or proposal.approved_at is null then raise exception 'exact approval required' using errcode='42501'; end if;
  if proposal.status in ('completed','cancelled','review_required') then return to_jsonb(proposal); end if;
  if proposal.next_step<>p_expected_step then return to_jsonb(proposal); end if;
  if proposal.status not in ('approved','running','failed') then raise exception 'approval required' using errcode='42501'; end if;
  step:=proposal.plan->'steps'->proposal.next_step;
  args:=step->'args';
  command_key:=(step->>'commandKey')::uuid;
  target_id:=nullif(args->>'id','')::uuid;
  begin
    if not private.has_tenant_capability(proposal.tenant_id,case step->>'domain'
      when 'playlist' then case when step->>'operation' in ('archive','restore','delete') then 'tenant.playlist.archive' when step->>'operation'='publish' then 'tenant.playlist.publish' else 'tenant.playlist.write' end
      when 'group' then 'tenant.screen.manage' when 'screen' then 'tenant.screen.manage'
      when 'media' then 'tenant.media.write' when 'attachment' then 'tenant.media.write'
      when 'studio' then case when step->>'operation' in ('create','duplicate') then 'tenant.studio.create' when step->>'operation' in ('archive','restore','delete') then 'tenant.studio.archive' else 'tenant.studio.edit_own' end
      else 'tenant.playlist.write' end)
      and not(step->>'domain'='studio' and step->>'operation' in ('save','rename') and private.has_tenant_capability(proposal.tenant_id,'tenant.studio.edit_all')) then
      raise exception 'current action capability required' using errcode='42501';
    end if;
    case step->>'domain'
      when 'playlist' then select tenant_id into target_tenant from public.playlists where id=target_id for update;
      when 'group' then select tenant_id into target_tenant from public.screen_groups where id=target_id for update;
      when 'media' then select tenant_id,updated_at into target_tenant,target_updated_at from public.media_assets where id=target_id for update;
      when 'screen' then select tenant_id,updated_at into target_tenant,target_updated_at from public.screens where id=target_id for update;
      when 'schedule' then select tenant_id into target_tenant from public.content_schedules where id=target_id for update;
      when 'studio' then select tenant_id into target_tenant from public.studio_projects where id=target_id for update;
      when 'attachment' then select tenant_id into target_tenant from public.ai_attachments where id=target_id and user_id=proposal.user_id and conversation_id=proposal.conversation_id for update;
      else raise exception 'unsupported domain' using errcode='22023';
    end case;
    if target_id is not null and target_tenant is distinct from proposal.tenant_id then raise exception 'target unavailable' using errcode='42501'; end if;
    if step->>'domain' in ('media','screen') and (args->>'updatedAt')::timestamptz is distinct from target_updated_at then raise exception 'target changed' using errcode='40001'; end if;
    if (step->>'domain'='playlist' and step->>'operation'='publish') or (step->>'domain'='schedule' and step->>'operation' in ('create','update','enable')) then
      if not exists(select 1 from private.ai_execution_checks where proposal_id=proposal.id and step_index=proposal.next_step
        and plan_hash=proposal.plan_hash and actor_id=proposal.user_id and expires_at>clock_timestamp()) then
        raise exception 'fresh server preflight required' using errcode='42501';
      end if;
    end if;
    case step->>'domain'
      when 'playlist' then
        if step->>'operation'='create' then
          result:=public.create_playlist_draft_v2(proposal.tenant_id,(args->>'newId')::uuid,args->>'name',args->>'description',command_key);
        elsif step->>'operation'='publish' then
          result:=public.publish_playlist_to_targets_v3(target_id,(args->>'revision')::bigint,array(select jsonb_array_elements_text(args->'screenIds')::uuid),args->>'notes',command_key);
        elsif step->>'operation'='add_dynamic_slide' then
          result:=public.add_dynamic_slide_to_playlist_v2(target_id,(args->>'slideId')::uuid,(args->>'revision')::bigint,(args->>'durationSeconds')::integer,command_key);
        elsif step->>'operation'='move_item' then
          select array_agg(id order by position_key,id) into ordered_items from public.playlist_items where tenant_id=proposal.tenant_id and playlist_id=target_id;
          destination:=array_position(ordered_items,(args#>>'{payload,itemId}')::uuid)-1;
          if destination is null then raise exception 'playlist item unavailable' using errcode='23514'; end if;
          if args->'payload' ? 'targetPosition' then destination:=(args#>>'{payload,targetPosition}')::integer;
          else
            case args#>>'{payload,direction}'
              when 'up' then destination:=greatest(0,destination-1);
              when 'down' then destination:=least(cardinality(ordered_items)-1,destination+1);
              when 'start' then destination:=0;
              when 'end' then destination:=cardinality(ordered_items)-1;
              else raise exception 'playlist movement invalid' using errcode='23514';
            end case;
          end if;
          if destination is null or destination<0 or destination>=cardinality(ordered_items) then raise exception 'playlist destination invalid' using errcode='23514'; end if;
          result:=public.mutate_playlist_draft_v2(target_id,(args->>'revision')::bigint,'move_item',jsonb_build_object('itemId',args#>>'{payload,itemId}','targetPosition',destination),command_key);
        elsif step->>'operation' in ('archive','restore','duplicate') then
          result:=public.mutate_playlist_library_batch_v1(proposal.tenant_id,step->>'operation',jsonb_build_array(jsonb_build_object('id',target_id,'expectedRevision',(args->>'revision')::bigint)),command_key);
        elsif step->>'operation'='delete' then
          if not exists(select 1 from public.playlists where id=target_id and revision=(args->>'revision')::bigint) then raise exception 'playlist changed' using errcode='40001'; end if;
          result:=jsonb_build_object('outcome','deleted','playlistId',target_id,'count',public.delete_playlists_v1(array[target_id]));
        elsif step->>'operation' in ('update_playlist_defaults','update_item_presentation','duplicate_item','replace_item','create_section','update_section','move_section','delete_section','assign_item_section') then
          result:=public.mutate_playlist_draft_v2(target_id,(args->>'revision')::bigint,step->>'operation',args->'payload',command_key);
        else
          select to_jsonb(command) into result from public.mutate_playlist_draft_v1(target_id,(args->>'revision')::bigint,step->>'operation',args->'payload') command;
        end if;
      when 'group' then result:=public.mutate_screen_group_v1(proposal.tenant_id,target_id,(args->>'revision')::bigint,step->>'operation',args->'payload',command_key);
      when 'media' then result:=public.mutate_media_asset_v1(proposal.tenant_id,target_id,step->>'operation',args->'payload',command_key);
      when 'attachment' then
        if step->>'operation'<>'retain' or not private.has_tenant_capability(proposal.tenant_id,'tenant.media.write') then raise exception 'attachment retention denied' using errcode='42501'; end if;
        if not exists(select 1 from public.media_assets where tenant_id=proposal.tenant_id and id=target_id and status='ready' and deleted_at is null) then raise exception 'media is not ready' using errcode='23514'; end if;
        update public.ai_attachments set retained=true where id=target_id and tenant_id=proposal.tenant_id and user_id=proposal.user_id and conversation_id=proposal.conversation_id and cleanup_state='private';
        if not found then raise exception 'attachment unavailable' using errcode='40001'; end if;
        result:=jsonb_build_object('outcome','saved','assetId',target_id);
      when 'schedule' then result:=public.mutate_content_schedule_v2(proposal.tenant_id,target_id,(args->>'revision')::bigint,step->>'operation',args->'payload',command_key);
      when 'studio' then
        if step->>'operation'='create' then
          result:=public.create_studio_project_v1(proposal.tenant_id,args->>'name',args->>'orientation',args->'document',array(select jsonb_array_elements_text(args->'assetIds')::uuid),'design',command_key);
        elsif step->>'operation'='save' then
          if exists(select 1 from public.studio_project_drafts where tenant_id=proposal.tenant_id and project_id=target_id and (document_json ? 'syncPresentation' or document_json ? 'sitesPresentation')) then raise exception 'connected editor required' using errcode='23514'; end if;
          result:=public.save_studio_draft_v1(target_id,(args->>'revision')::bigint,args->'document',array(select jsonb_array_elements_text(args->'assetIds')::uuid),command_key);
        elsif step->>'operation' in ('rename','archive','restore','duplicate','delete') then
          result:=public.mutate_studio_project_v1(target_id,(args->>'revision')::bigint,step->>'operation',args->'payload',command_key);
        else raise exception 'unsupported studio command' using errcode='22023'; end if;
      when 'screen' then
        if step->>'operation'='rename' then
          if not private.has_tenant_capability(proposal.tenant_id,'tenant.screen.manage') then raise exception 'screen rights required' using errcode='42501'; end if;
          perform private.require_active_tenant_command(proposal.tenant_id);
          select * into screen_record from public.screens where id=target_id and tenant_id=proposal.tenant_id and updated_at=(args->>'updatedAt')::timestamptz for update;
          if not found then raise exception 'screen changed' using errcode='40001'; end if;
          perform public.update_screen_v1(proposal.tenant_id,target_id,args->>'name',screen_record.location,screen_record.orientation,screen_record.resolution_width,screen_record.resolution_height,screen_record.status);
          result:=jsonb_build_object('screenId',target_id,'outcome','applied');
        elsif step->>'operation'='groups' then
          result:=jsonb_build_object('outcome','applied','screenId',target_id,'memberships',public.set_screen_group_memberships_v1(proposal.tenant_id,target_id,array(select jsonb_array_elements_text(args->'groupIds')::uuid)));
        else raise exception 'unsupported screen command' using errcode='22023'; end if;
    end case;
    if result is null then raise exception 'command receipt missing' using errcode='PT500'; end if;
    if result->>'outcome'='conflict' then raise exception 'object changed' using errcode='40001'; end if;
    delete from private.ai_execution_checks where proposal_id=proposal.id and step_index=proposal.next_step;
    update public.ai_proposals set next_step=next_step+1,receipts=receipts||jsonb_build_array(jsonb_build_object('step',next_step,'result',result,'completedAt',now())),
      status=case when next_step+1=jsonb_array_length(plan->'steps') then 'completed' else 'running' end,last_error_code=null
      where id=p_proposal_id returning * into proposal;
    perform private.audit_event(proposal.tenant_id,'agent.step.executed','ai_proposal',proposal.id,'success',jsonb_build_object('step',proposal.next_step-1,'planHash',proposal.plan_hash));
  exception when others then
    update public.ai_proposals set status=case when sqlstate in ('40001','PT409') then 'review_required' else 'failed' end,last_error_code=sqlstate
      where id=p_proposal_id returning * into proposal;
  end;
  return to_jsonb(proposal);
end $$;

revoke all on function public.create_ai_proposal_v1(uuid,uuid,jsonb,uuid,text,integer),public.decide_ai_proposal_v1(uuid,text,boolean),public.execute_ai_proposal_step_v1(uuid,text,integer) from public,anon,service_role;
grant execute on function public.create_ai_proposal_v1(uuid,uuid,jsonb,uuid,text,integer),public.decide_ai_proposal_v1(uuid,text,boolean),public.execute_ai_proposal_step_v1(uuid,text,integer) to authenticated;

create table public.ai_attachments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id),
  media_asset_id uuid,
  source_signature text check(source_signature is null or source_signature ~ '^[a-f0-9]{64}$'),
  retained boolean not null default false,
  cleanup_state text not null default 'private' check(cleanup_state in ('private','deleting','discarded','protected')),
  cleanup_token uuid,
  cleanup_expires_at timestamptz,
  cleanup_error_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '7 days'),
  foreign key(tenant_id,conversation_id) references public.ai_conversations(tenant_id,id),
  foreign key(tenant_id,media_asset_id) references public.media_assets(tenant_id,id)
);
create index ai_attachments_tenant_conversation_idx on public.ai_attachments(tenant_id,conversation_id);
create index ai_attachments_expiry_idx on public.ai_attachments(expires_at,id) where not retained and cleanup_state in ('private','deleting');
create index ai_attachments_storage_identity_idx on public.ai_attachments((tenant_id::text),(id::text)) where not retained;
alter table public.ai_attachments enable row level security;
revoke all on public.ai_attachments from public,anon,authenticated,service_role;
create policy ai_attachments_read on public.ai_attachments for select to authenticated using(user_id=auth.uid() and private.is_tenant_member(tenant_id));
grant select on public.ai_attachments to authenticated;

create function private.ai_temporary_asset(p_tenant_id uuid,p_asset_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ai_attachments where tenant_id=p_tenant_id and id=p_asset_id and not retained);
$$;
revoke all on function private.ai_temporary_asset(uuid,uuid) from public,anon,service_role;
grant execute on function private.ai_temporary_asset(uuid,uuid) to authenticated;
create policy media_assets_ai_temporary_hidden on public.media_assets as restrictive for select to authenticated using(not private.ai_temporary_asset(tenant_id,id));
create policy media_variants_ai_temporary_hidden on public.media_variants as restrictive for select to authenticated using(not private.ai_temporary_asset(tenant_id,asset_id));

create function private.ai_temporary_storage_object(p_bucket text,p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_bucket='tenant-media' and split_part(p_name,'/',1)='tenants' and split_part(p_name,'/',3)='assets' and exists(select 1 from public.ai_attachments where not retained and tenant_id::text=split_part(p_name,'/',2) and id::text=split_part(p_name,'/',4)
    and not(user_id=private.current_user_id() and cleanup_state='private' and private.ai_agent_allowed(tenant_id)
      and (private.has_tenant_capability(tenant_id,'tenant.media.read') or private.has_tenant_capability(tenant_id,'tenant.media.write'))));
$$;
revoke all on function private.ai_temporary_storage_object(text,text) from public,anon,service_role;
grant execute on function private.ai_temporary_storage_object(text,text) to authenticated;
create policy storage_ai_temporary_hidden on storage.objects as restrictive for select to authenticated using(not private.ai_temporary_storage_object(bucket_id,name));
create policy storage_ai_temporary_insert on storage.objects as restrictive for insert to authenticated with check(not private.ai_temporary_storage_object(bucket_id,name));
create policy storage_ai_temporary_update on storage.objects as restrictive for update to authenticated using(not private.ai_temporary_storage_object(bucket_id,name)) with check(not private.ai_temporary_storage_object(bucket_id,name));

create function private.ai_owned_storage_object(p_bucket text,p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_bucket='tenant-media' and split_part(p_name,'/',1)='tenants' and split_part(p_name,'/',3)='assets' and exists(select 1 from public.ai_attachments where not retained and cleanup_state='private' and user_id=private.current_user_id()
    and private.ai_agent_allowed(tenant_id) and (private.has_tenant_capability(tenant_id,'tenant.media.read') or private.has_tenant_capability(tenant_id,'tenant.media.write'))
    and tenant_id::text=split_part(p_name,'/',2) and id::text=split_part(p_name,'/',4));
$$;
revoke all on function private.ai_owned_storage_object(text,text) from public,anon,service_role;
grant execute on function private.ai_owned_storage_object(text,text) to authenticated;
create policy storage_ai_owner_read on storage.objects for select to authenticated using(private.ai_owned_storage_object(bucket_id,name));

create function public.reserve_ai_attachment_v1(p_conversation_id uuid,p_attachment_id uuid,p_source_signature text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare conversation public.ai_conversations%rowtype;
begin
  select * into conversation from public.ai_conversations where id=p_conversation_id and user_id=private.current_user_id();
  if not found or not private.ai_agent_allowed(conversation.tenant_id) or not private.has_tenant_capability(conversation.tenant_id,'tenant.media.write') then raise exception 'private upload denied' using errcode='42501'; end if;
  if exists(select 1 from public.media_assets where id=p_attachment_id) and not exists(select 1 from public.ai_attachments where id=p_attachment_id and tenant_id=conversation.tenant_id and user_id=conversation.user_id and conversation_id=conversation.id) then
    raise exception 'existing media cannot become a temporary attachment' using errcode='42501';
  end if;
  if p_source_signature is null or p_source_signature !~ '^[a-f0-9]{64}$' then raise exception 'attachment signature invalid' using errcode='23514'; end if;
  insert into public.ai_attachments(id,tenant_id,conversation_id,user_id,source_signature) values(p_attachment_id,conversation.tenant_id,conversation.id,conversation.user_id,p_source_signature) on conflict(id) do nothing;
  if not exists(select 1 from public.ai_attachments where id=p_attachment_id and tenant_id=conversation.tenant_id and user_id=conversation.user_id and conversation_id=conversation.id and source_signature=p_source_signature and cleanup_state='private') then raise exception 'attachment scope or source changed' using errcode='42501'; end if;
  return p_attachment_id;
end $$;
revoke all on function public.reserve_ai_attachment_v1(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.reserve_ai_attachment_v1(uuid,uuid,text) to authenticated;

create function public.complete_ai_attachment_v1(p_attachment_id uuid,p_tenant_id uuid,p_actor_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_attachments attachment set media_asset_id=attachment.id where attachment.id=p_attachment_id and attachment.tenant_id=p_tenant_id and attachment.user_id=p_actor_id
    and exists(select 1 from public.media_assets where tenant_id=p_tenant_id and id=p_attachment_id);
  return found;
end $$;
revoke all on function public.complete_ai_attachment_v1(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_ai_attachment_v1(uuid,uuid,uuid) to service_role;

create function public.create_ai_video_upload_intent_v1(p_conversation_id uuid,p_tenant_id uuid,p_title text,p_original_file_name text,p_expected_mime_type text,p_expected_size_bytes bigint,p_idempotency_key uuid)
returns table(upload_session_id uuid,storage_path text,expires_at timestamptz,resumed boolean)
language plpgsql security definer set search_path = '' as $$
declare intent record; asset_id uuid;
begin
  if not private.ai_agent_allowed(p_tenant_id) or not exists(select 1 from public.ai_conversations where id=p_conversation_id and tenant_id=p_tenant_id and user_id=private.current_user_id()) then raise exception 'agent upload denied' using errcode='42501'; end if;
  select * into intent from public.create_media_video_upload_intent(p_tenant_id,p_title,p_original_file_name,p_expected_mime_type,p_expected_size_bytes,p_idempotency_key);
  select asset.id into asset_id from public.media_assets asset where asset.tenant_id=p_tenant_id and asset.storage_path=intent.storage_path;
  if asset_id is null then raise exception 'private upload asset missing' using errcode='PT500'; end if;
  if intent.resumed and not exists(select 1 from public.ai_attachments where id=asset_id and conversation_id=p_conversation_id and tenant_id=p_tenant_id and user_id=private.current_user_id() and cleanup_state='private') then
    raise exception 'existing media cannot become a private attachment' using errcode='42501';
  end if;
  if not intent.resumed then
    insert into public.ai_attachments(id,tenant_id,conversation_id,user_id) values(asset_id,p_tenant_id,p_conversation_id,private.current_user_id());
  end if;
  update public.ai_attachments set media_asset_id=asset_id where id=asset_id and tenant_id=p_tenant_id;
  return query select intent.upload_session_id::uuid,intent.storage_path::text,intent.expires_at::timestamptz,intent.resumed::boolean;
end $$;
revoke all on function public.create_ai_video_upload_intent_v1(uuid,uuid,text,text,text,bigint,uuid) from public,anon,service_role;
grant execute on function public.create_ai_video_upload_intent_v1(uuid,uuid,text,text,text,bigint,uuid) to authenticated;

create function public.finalize_ai_video_upload_v1(p_upload_session_id uuid,p_conversation_id uuid) returns table(asset_id uuid,job_id uuid)
language plpgsql security definer set search_path = '' as $$
declare target_tenant uuid;
begin
  select attachment.tenant_id into target_tenant from public.ai_attachments attachment
    join public.media_upload_sessions upload on upload.tenant_id=attachment.tenant_id and upload.asset_id=attachment.id
    where upload.id=p_upload_session_id and attachment.conversation_id=p_conversation_id and attachment.user_id=private.current_user_id();
  if not found or not private.ai_agent_allowed(target_tenant) then raise exception 'agent upload context unavailable' using errcode='42501'; end if;
  return query select completed.asset_id,completed.job_id from public.finalize_media_video_upload_v2(p_upload_session_id) completed;
end $$;
revoke all on function public.finalize_ai_video_upload_v1(uuid,uuid) from public,anon,service_role;
grant execute on function public.finalize_ai_video_upload_v1(uuid,uuid) to authenticated;

create function private.guard_ai_cleanup_asset() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is null and exists(select 1 from public.ai_attachments where tenant_id=old.tenant_id and id=old.id and not retained and cleanup_state in ('deleting','discarded')) then
    raise exception 'temporary attachment is being discarded' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function private.guard_ai_cleanup_asset() from public,anon,authenticated,service_role;
create trigger guard_ai_cleanup_asset before update on public.media_assets for each row execute function private.guard_ai_cleanup_asset();

create function private.guard_ai_asset_reference() returns trigger
language plpgsql security definer set search_path = '' as $$
declare candidate uuid; attachment public.ai_attachments%rowtype;
begin
  candidate:=nullif(to_jsonb(new)->>tg_argv[0],'')::uuid;
  if candidate is null then return new; end if;
  select * into attachment from public.ai_attachments where id=candidate for share;
  if found and not attachment.retained then raise exception 'private attachment requires confirmed retention' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.guard_ai_asset_reference() from public,anon,authenticated,service_role;

do $$
declare reference record;
begin
  for reference in
    select distinct schema.nspname,relation.relname,attribute.attname
    from pg_catalog.pg_constraint constraint_record
    join pg_catalog.pg_class relation on relation.oid=constraint_record.conrelid
    join pg_catalog.pg_namespace schema on schema.oid=relation.relnamespace
    join lateral unnest(constraint_record.conkey,constraint_record.confkey) keys(local_key,remote_key) on true
    join pg_catalog.pg_attribute attribute on attribute.attrelid=relation.oid and attribute.attnum=keys.local_key
    join pg_catalog.pg_attribute target on target.attrelid=constraint_record.confrelid and target.attnum=keys.remote_key
    where constraint_record.contype='f' and constraint_record.confrelid='public.media_assets'::regclass and target.attname='id'
      and relation.oid not in ('public.media_variants'::regclass,'public.media_processing_jobs'::regclass,'public.media_upload_sessions'::regclass,'public.ai_attachments'::regclass)
  loop
    execute pg_catalog.format('create trigger %I before insert or update of %I on %I.%I for each row execute function private.guard_ai_asset_reference(%L)',
      'ai_private_'||reference.attname,reference.attname,reference.nspname,reference.relname,reference.attname);
  end loop;
end $$;

create function public.claim_ai_attachment_cleanup_v1() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  attachment public.ai_attachments%rowtype;
  asset public.media_assets%rowtype;
  reference record;
  referenced boolean;
  paths jsonb;
  token uuid:=extensions.gen_random_uuid();
begin
  select * into attachment from public.ai_attachments where not retained and expires_at<now()
    and (cleanup_state='private' or(cleanup_state='deleting' and cleanup_expires_at<now()))
    order by expires_at,id for update skip locked limit 1;
  if not found then return null; end if;
  perform private.lock_media_metadata_v1(attachment.tenant_id);
  select * into asset from public.media_assets where tenant_id=attachment.tenant_id and id=attachment.id for update;
  if not found then
    update public.ai_attachments set cleanup_state='discarded' where id=attachment.id;
    return jsonb_build_object('outcome','empty');
  end if;
  if asset.status not in ('ready','validation_failed','quarantined') and not(asset.status='uploading'
    and not exists(select 1 from public.media_upload_sessions where tenant_id=attachment.tenant_id and asset_id=asset.id and status='pending' and expires_at>now())
    and not exists(select 1 from public.media_processing_jobs where tenant_id=attachment.tenant_id and asset_id=asset.id and status in ('queued','processing'))) then
    update public.ai_attachments set expires_at=now()+interval '1 day',cleanup_error_code='processing_not_terminal' where id=attachment.id;
    return jsonb_build_object('outcome','deferred');
  end if;
  for reference in
    select schema.nspname,relation.relname,attribute.attname,
      exists(select 1 from pg_catalog.pg_attribute tenant_column where tenant_column.attrelid=relation.oid and tenant_column.attname='tenant_id' and not tenant_column.attisdropped) as tenant_scoped
    from pg_catalog.pg_constraint constraint_record
    join pg_catalog.pg_class relation on relation.oid=constraint_record.conrelid
    join pg_catalog.pg_namespace schema on schema.oid=relation.relnamespace
    join lateral unnest(constraint_record.conkey,constraint_record.confkey) keys(local_key,remote_key) on true
    join pg_catalog.pg_attribute attribute on attribute.attrelid=relation.oid and attribute.attnum=keys.local_key
    join pg_catalog.pg_attribute target on target.attrelid=constraint_record.confrelid and target.attnum=keys.remote_key
    where constraint_record.contype='f' and constraint_record.confrelid='public.media_assets'::regclass and target.attname='id'
      and relation.oid not in ('public.media_variants'::regclass,'public.media_processing_jobs'::regclass,'public.media_upload_sessions'::regclass,'public.ai_attachments'::regclass)
  loop
    execute pg_catalog.format('select exists(select 1 from %I.%I where %I=$1%s)',reference.nspname,reference.relname,reference.attname,case when reference.tenant_scoped then ' and tenant_id=$2' else '' end)
      into referenced using asset.id,attachment.tenant_id;
    if referenced then
      update public.ai_attachments set cleanup_state='protected',cleanup_error_code='referenced_asset' where id=attachment.id;
      return jsonb_build_object('outcome','protected');
    end if;
  end loop;
  if exists(select 1 from public.studio_project_drafts where tenant_id=attachment.tenant_id and position(asset.id::text in document_json::text)>0)
    or exists(select 1 from public.studio_revisions where tenant_id=attachment.tenant_id and position(asset.id::text in document_json::text)>0)
    or exists(select 1 from public.dynamic_slides where tenant_id=attachment.tenant_id and position(asset.id::text in configuration_json::text)>0)
    or exists(select 1 from public.dynamic_slide_versions where tenant_id=attachment.tenant_id and position(asset.id::text in configuration_json::text)>0)
  then
    update public.ai_attachments set cleanup_state='protected',cleanup_error_code='referenced_document' where id=attachment.id;
    return jsonb_build_object('outcome','protected');
  end if;
  select jsonb_agg(distinct jsonb_build_object('bucket',storage_bucket,'path',storage_path)) into paths from (
    select asset.storage_bucket,asset.storage_path union all
    select variant.storage_bucket,variant.storage_path from public.media_variants variant where variant.tenant_id=attachment.tenant_id and variant.asset_id=asset.id
  ) candidates;
  if exists(select 1 from jsonb_array_elements(paths) candidate where candidate->>'bucket'<>'tenant-media' or not starts_with(candidate->>'path','tenants/'||attachment.tenant_id::text||'/assets/'||asset.id::text||'/')) then
    update public.ai_attachments set cleanup_state='protected',cleanup_error_code='unverified_path' where id=attachment.id;
    return jsonb_build_object('outcome','protected');
  end if;
  update public.ai_attachments set cleanup_state='deleting',cleanup_token=token,cleanup_expires_at=now()+interval '15 minutes',cleanup_error_code=null where id=attachment.id;
  update public.media_assets set deleted_at=coalesce(deleted_at,now()) where tenant_id=attachment.tenant_id and id=asset.id;
  return jsonb_build_object('outcome','claimed','attachmentId',attachment.id,'tenantId',attachment.tenant_id,'token',token,'paths',paths);
end $$;

create function public.complete_ai_attachment_cleanup_v1(p_attachment_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare attachment public.ai_attachments%rowtype;
begin
  select * into attachment from public.ai_attachments where id=p_attachment_id and not retained and cleanup_state='deleting' and cleanup_token=p_token for update;
  if not found then return false; end if;
  delete from public.media_variants where tenant_id=attachment.tenant_id and asset_id=attachment.id;
  update public.ai_attachments set cleanup_state='discarded',cleanup_token=null,cleanup_expires_at=null where id=attachment.id;
  return true;
end $$;
revoke all on function public.claim_ai_attachment_cleanup_v1(),public.complete_ai_attachment_cleanup_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_ai_attachment_cleanup_v1(),public.complete_ai_attachment_cleanup_v1(uuid,uuid) to service_role;

reset lock_timeout;
reset statement_timeout;
