-- S123 Vector v2: idempotent, tenant-safe Engage operations for Control Mobile.

create table private.engage_command_receipts (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  target_status text not null check (target_status in ('live', 'closed')),
  result_status text not null check (result_status in ('live', 'closed')),
  created_at timestamptz not null default now(),
  primary key (actor_user_id, idempotency_key),
  constraint engage_command_receipts_campaign_fk
    foreign key (tenant_id, campaign_id)
    references public.engage_campaigns(tenant_id, id)
    on delete cascade
);

create index engage_command_receipts_tenant_campaign_idx
  on private.engage_command_receipts(tenant_id, campaign_id, created_at desc);

revoke all on private.engage_command_receipts from public, anon, authenticated;

create function public.get_engage_campaign_metrics_v1(p_tenant_id uuid)
returns table(campaign_id uuid, option_count bigint, total_votes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null
    or not private.tenant_feature_enabled_v1(p_tenant_id, 'engage')
    or not private.has_tenant_capability(p_tenant_id, 'tenant.dynamic_slide.read') then
    raise exception 'engage rollout and read capability required' using errcode = '42501';
  end if;
  return query
    select campaign.id,
      (select count(*) from public.engage_options option
       where option.tenant_id = campaign.tenant_id
         and option.campaign_id = campaign.id),
      (select count(*) from public.engage_votes vote
       where vote.tenant_id = campaign.tenant_id
         and vote.campaign_id = campaign.id)
    from public.engage_campaigns campaign
    where campaign.tenant_id = p_tenant_id
      and campaign.status <> 'archived';
end;
$$;

create function public.transition_engage_campaign_v2(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_target_status text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.require_engage_writer_v1(p_tenant_id);
  current_status text;
  existing private.engage_command_receipts%rowtype;
  outcome text := 'applied';
begin
  if p_idempotency_key is null
    or p_target_status not in ('live', 'closed') then
    raise exception 'invalid engage command' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text || ':' || p_idempotency_key::text, 123)
  );

  select * into existing
  from private.engage_command_receipts receipt
  where receipt.actor_user_id = actor_id
    and receipt.idempotency_key = p_idempotency_key;

  if existing.actor_user_id is not null then
    if existing.tenant_id <> p_tenant_id
      or existing.campaign_id <> p_campaign_id
      or existing.target_status <> p_target_status then
      raise exception 'idempotency key belongs to another engage command'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'campaignId', existing.campaign_id,
      'outcome', 'replayed',
      'status', existing.result_status
    );
  end if;

  select campaign.status into current_status
  from public.engage_campaigns campaign
  where campaign.tenant_id = p_tenant_id
    and campaign.id = p_campaign_id
  for update;

  if current_status is null then
    raise exception 'engage campaign not found' using errcode = 'P0002';
  end if;

  if current_status = p_target_status then
    outcome := 'already_applied';
  elsif not (
    (current_status = 'draft' and p_target_status = 'live')
    or (current_status = 'scheduled' and p_target_status in ('live', 'closed'))
    or (current_status = 'live' and p_target_status = 'closed')
  ) then
    raise exception 'invalid engage lifecycle transition' using errcode = '23514';
  else
    if p_target_status = 'live' and (
      select count(*)
      from public.engage_options option
      where option.tenant_id = p_tenant_id
        and option.campaign_id = p_campaign_id
    ) < 2 then
      raise exception 'at least two options required' using errcode = '23514';
    end if;

    update public.engage_campaigns
    set status = p_target_status,
        updated_by = actor_id
    where tenant_id = p_tenant_id
      and id = p_campaign_id;

    insert into public.engage_audit_events(
      tenant_id,
      campaign_id,
      actor_id,
      action,
      detail_json
    ) values (
      p_tenant_id,
      p_campaign_id,
      actor_id,
      'campaign.transitioned',
      jsonb_build_object(
        'from', current_status,
        'to', p_target_status,
        'channel', 'control_mobile',
        'idempotencyKey', p_idempotency_key
      )
    );
  end if;

  insert into private.engage_command_receipts(
    actor_user_id,
    idempotency_key,
    tenant_id,
    campaign_id,
    target_status,
    result_status
  ) values (
    actor_id,
    p_idempotency_key,
    p_tenant_id,
    p_campaign_id,
    p_target_status,
    p_target_status
  );

  return jsonb_build_object(
    'campaignId', p_campaign_id,
    'outcome', outcome,
    'status', p_target_status
  );
end;
$$;

revoke all on function public.transition_engage_campaign_v2(uuid, uuid, text, uuid)
  from public, anon;
revoke all on function public.get_engage_campaign_metrics_v1(uuid)
  from public, anon;
grant execute on function public.transition_engage_campaign_v2(uuid, uuid, text, uuid)
  to authenticated;
grant execute on function public.get_engage_campaign_metrics_v1(uuid)
  to authenticated;
