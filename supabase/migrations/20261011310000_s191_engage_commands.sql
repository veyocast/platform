-- S191: serialized draft editing and replayable CAS; live votes/options stay immutable.
alter table public.engage_campaigns add column revision bigint not null default 0 check(revision>=0);
create function private.advance_engage_revision_v1() returns trigger
language plpgsql set search_path='' as $$begin new.revision:=old.revision+1;return new;end;$$;
revoke all on function private.advance_engage_revision_v1() from public,anon,authenticated,service_role;
create trigger engage_campaign_revision before update on public.engage_campaigns
for each row execute function private.advance_engage_revision_v1();

create or replace function public.save_engage_campaign_v1(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_kind text,
  p_title text,
  p_question text,
  p_result_visibility text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_options jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.require_engage_writer_v1(p_tenant_id);
  saved_id uuid := coalesce(p_campaign_id, gen_random_uuid());
  saved_public_id uuid;
  option jsonb;
  option_count integer;
begin
  perform private.require_active_tenant_command(p_tenant_id);
  if p_kind is null or p_kind not in ('poll', 'motm')
    or p_result_visibility is null or p_result_visibility not in ('after_vote', 'after_close', 'live')
    or p_title is null or length(btrim(p_title)) not between 2 and 160
    or p_question is null or length(btrim(p_question)) not between 2 and 160
    or p_options is null or jsonb_typeof(p_options) <> 'array'
    or jsonb_array_length(p_options) not between 2 and 24
    or (p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid engage campaign input' using errcode = '23514';
  end if;
  if p_campaign_id is not null then
    -- Serialize editing against lifecycle transitions and votes, before touching options.
    perform 1 from public.engage_campaigns
    where tenant_id=p_tenant_id and id=p_campaign_id and status='draft' for update;
    if not found then
      raise exception 'only a tenant draft can be edited' using errcode='42501';
    end if;
  end if;

  insert into public.engage_campaigns (
    id, tenant_id, kind, title, question, result_visibility,
    starts_at, ends_at, created_by, updated_by
  ) values (
    saved_id, p_tenant_id, p_kind, btrim(p_title), btrim(p_question),
    p_result_visibility, p_starts_at, p_ends_at, actor_id, actor_id
  ) on conflict (id) do update set
    kind = excluded.kind, title = excluded.title, question = excluded.question,
    result_visibility = excluded.result_visibility, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, updated_by = actor_id
  where engage_campaigns.tenant_id = p_tenant_id and engage_campaigns.status = 'draft'
  returning public_id into saved_public_id;

  if saved_public_id is null then
    raise exception 'only a tenant draft can be edited' using errcode='42501';
  end if;

  delete from public.engage_options where tenant_id = p_tenant_id and campaign_id = saved_id;
  option_count := 0;
  for option in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(option)<>'object' or option->>'label' is null or length(btrim(option->>'label')) not between 2 and 160 then
      raise exception 'invalid engage option' using errcode = '23514';
    end if;
    insert into public.engage_options(tenant_id, campaign_id, label, sort_order)
    values (p_tenant_id, saved_id, btrim(option->>'label'), option_count);
    option_count := option_count + 1;
  end loop;
  insert into public.engage_audit_events(tenant_id, campaign_id, actor_id, action)
  values (p_tenant_id, saved_id, actor_id, 'campaign.saved');
  return jsonb_build_object('campaignId', saved_id, 'publicId', saved_public_id);
end;
$$;

create function public.save_engage_campaign_v2(
 p_tenant_id uuid,p_campaign_id uuid,p_expected_revision bigint,p_payload jsonb,p_idempotency_key uuid
)returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor_id uuid:=private.require_engage_writer_v1(p_tenant_id);
 campaign public.engage_campaigns%rowtype; request_json jsonb; receipt jsonb; saved jsonb; outcome jsonb;
begin
 perform private.require_active_tenant_command(p_tenant_id);
 if p_expected_revision is null or p_expected_revision<0 or p_payload is null
   or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768
   or not(p_payload ?& array['kind','title','question','resultVisibility','options'])
   or exists(select 1 from jsonb_object_keys(p_payload) key where key<>all(array['kind','title','question','resultVisibility','startsAt','endsAt','options']))
   or jsonb_typeof(p_payload->'options')<>'array' then
   raise exception 'invalid engage draft command' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'options') option
   where jsonb_typeof(option)<>'object' or not(option ? 'label')
     or jsonb_typeof(option->'label')<>'string' or (option-'label')<>'{}'::jsonb)
   or exists(select 1 from unnest(array['kind','title','question','resultVisibility']) key
     where jsonb_typeof(p_payload->key)<>'string')
   or exists(select 1 from unnest(array['startsAt','endsAt']) key
     where p_payload ? key and jsonb_typeof(p_payload->key) not in('string','null')) then
   raise exception 'invalid engage draft fields' using errcode='22023';
 end if;
 request_json:=jsonb_build_object('campaignId',p_campaign_id,'expectedRevision',p_expected_revision,'payload',p_payload);
 receipt:=private.begin_publisher_command(p_tenant_id,'engage.draft.save.v2',p_idempotency_key,request_json);
 if receipt is not null then return receipt;end if;
 if p_campaign_id is not null then
   select * into campaign from public.engage_campaigns
     where tenant_id=p_tenant_id and id=p_campaign_id for update;
   if not found then raise exception 'tenant campaign unavailable' using errcode='42501';end if;
   if campaign.revision<>p_expected_revision then
     outcome:=jsonb_build_object('outcome','conflict','campaignId',campaign.id,'publicId',campaign.public_id,'actualRevision',campaign.revision);
     return private.complete_publisher_command(p_tenant_id,'engage.draft.save.v2',p_idempotency_key,request_json,'engage_campaign',campaign.id,outcome,'engage.draft.conflict','failed');
   end if;
   if campaign.status<>'draft' then raise exception 'only a tenant draft can be edited' using errcode='42501';end if;
 elsif p_expected_revision<>0 then
   raise exception 'new campaign revision must be zero' using errcode='22023';
 end if;
 saved:=public.save_engage_campaign_v1(p_tenant_id,p_campaign_id,p_payload->>'kind',p_payload->>'title',p_payload->>'question',p_payload->>'resultVisibility',(p_payload->>'startsAt')::timestamptz,(p_payload->>'endsAt')::timestamptz,p_payload->'options');
 select * into campaign from public.engage_campaigns where tenant_id=p_tenant_id and id=(saved->>'campaignId')::uuid;
 outcome:=saved||jsonb_build_object('outcome',case when p_campaign_id is null then 'created' else 'applied' end,'actualRevision',campaign.revision);
 return private.complete_publisher_command(p_tenant_id,'engage.draft.save.v2',p_idempotency_key,request_json,'engage_campaign',campaign.id,outcome,'engage.draft.saved');
end;$$;
revoke all on function public.save_engage_campaign_v2(uuid,uuid,bigint,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_engage_campaign_v2(uuid,uuid,bigint,jsonb,uuid) to authenticated;
