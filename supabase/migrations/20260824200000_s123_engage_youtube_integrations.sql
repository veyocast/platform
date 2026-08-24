-- S123 Vector v2 integrations: Engage campaigns and online-only YouTube sources.
-- Both capabilities are cohort-gated. Engage stores no raw network identifiers;
-- YouTube content is never downloaded, transcoded or inserted as tenant media.

create table public.engage_campaigns (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null default gen_random_uuid() unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('poll', 'motm')),
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'live', 'closed', 'archived')
  ),
  title text not null check (length(btrim(title)) between 2 and 160),
  question text not null check (length(btrim(question)) between 2 and 160),
  result_visibility text not null default 'after_vote' check (
    result_visibility in ('after_vote', 'after_close', 'live')
  ),
  privacy_notice text not null default 'Je stem wordt zonder naam opgeslagen en alleen gebruikt voor deze actie.'
    check (length(btrim(privacy_notice)) between 8 and 500),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index engage_campaigns_tenant_status_idx
  on public.engage_campaigns(tenant_id, status, updated_at desc);
create index engage_campaigns_public_live_idx
  on public.engage_campaigns(public_id, status)
  where status in ('scheduled', 'live', 'closed');
create trigger engage_campaigns_set_updated_at before update on public.engage_campaigns
for each row execute function private.set_updated_at();

create table public.engage_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  label text not null check (length(btrim(label)) between 2 and 160),
  sort_order integer not null check (sort_order between 0 and 100),
  created_at timestamptz not null default now(),
  unique (tenant_id, campaign_id, id),
  unique (tenant_id, campaign_id, sort_order),
  foreign key (tenant_id, campaign_id)
    references public.engage_campaigns(tenant_id, id) on delete cascade
);
create index engage_options_campaign_idx
  on public.engage_options(tenant_id, campaign_id, sort_order);

create table public.engage_votes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  campaign_id uuid not null,
  option_id uuid not null,
  identity_hash text not null check (identity_hash ~ '^[a-f0-9]{64}$'),
  network_hash text not null check (network_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (tenant_id, campaign_id, identity_hash),
  foreign key (tenant_id, campaign_id)
    references public.engage_campaigns(tenant_id, id) on delete cascade,
  foreign key (tenant_id, campaign_id, option_id)
    references public.engage_options(tenant_id, campaign_id, id) on delete restrict
);
create index engage_votes_campaign_option_idx
  on public.engage_votes(tenant_id, campaign_id, option_id);
create index engage_votes_abuse_window_idx
  on public.engage_votes(identity_hash, created_at desc);
create index engage_votes_network_window_idx
  on public.engage_votes(network_hash, created_at desc);

create table public.engage_audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(action) between 3 and 100),
  detail_json jsonb not null default '{}'::jsonb check (jsonb_typeof(detail_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, campaign_id)
    references public.engage_campaigns(tenant_id, id) on delete cascade
);
create index engage_audit_events_tenant_idx
  on public.engage_audit_events(tenant_id, created_at desc);

create table public.youtube_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (length(btrim(title)) between 2 and 160),
  channel_title text check (channel_title is null or length(btrim(channel_title)) between 1 and 240),
  fallback_media_asset_id uuid not null,
  validation_status text not null default 'pending' check (
    validation_status in ('pending', 'verified', 'error')
  ),
  validation_error_code text check (
    validation_error_code is null or validation_error_code ~ '^[a-z0-9_]{3,80}$'
  ),
  embeddable boolean,
  online_only boolean not null default true check (online_only),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, video_id),
  foreign key (tenant_id, fallback_media_asset_id)
    references public.media_assets(tenant_id, id) on delete restrict
);
create index youtube_sources_tenant_status_idx
  on public.youtube_sources(tenant_id, status, updated_at desc);
create trigger youtube_sources_set_updated_at before update on public.youtube_sources
for each row execute function private.set_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'engage_campaigns', 'engage_options', 'engage_votes',
    'engage_audit_events', 'youtube_sources'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
  end loop;
end;
$$;

grant select on public.engage_campaigns, public.engage_options,
  public.engage_audit_events, public.youtube_sources to authenticated;

create policy engage_campaigns_tenant_read on public.engage_campaigns
for select to authenticated using (
  private.tenant_feature_enabled_v1(tenant_id, 'engage')
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy engage_options_tenant_read on public.engage_options
for select to authenticated using (
  private.tenant_feature_enabled_v1(tenant_id, 'engage')
  and private.has_tenant_capability(tenant_id, 'tenant.dynamic_slide.read')
);
create policy engage_audit_tenant_read on public.engage_audit_events
for select to authenticated using (
  private.tenant_feature_enabled_v1(tenant_id, 'engage')
  and private.has_tenant_capability(tenant_id, 'tenant.audit.read')
);
create policy youtube_sources_tenant_read on public.youtube_sources
for select to authenticated using (
  private.tenant_feature_enabled_v1(tenant_id, 'youtube_integration')
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);

create function private.require_engage_writer_v1(p_tenant_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id();
begin
  if actor_id is null
    or not private.tenant_feature_enabled_v1(p_tenant_id, 'engage')
    or not private.has_tenant_capability(p_tenant_id, 'tenant.dynamic_slide.write') then
    raise exception 'engage rollout and write capability required' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;
revoke all on function private.require_engage_writer_v1(uuid)
  from public, anon, authenticated, service_role;

create function private.engage_public_payload_v1(
  p_campaign_id uuid,
  p_include_results boolean
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', campaign.public_id,
    'kind', campaign.kind,
    'status', case when campaign.status = 'closed' then 'closed' else 'live' end,
    'title', campaign.title,
    'question', campaign.question,
    'resultVisibility', campaign.result_visibility,
    'privacyNotice', campaign.privacy_notice,
    'closesAt', campaign.ends_at,
    'tenantName', tenant.name,
    'resultsVisible', p_include_results,
    'totalVotes', case when p_include_results then (
      select count(*) from public.engage_votes vote
      where vote.tenant_id = campaign.tenant_id and vote.campaign_id = campaign.id
    ) else 0 end,
    'options', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', option.id,
        'label', option.label,
        'sortOrder', option.sort_order,
        'voteCount', case when p_include_results then (
          select count(*) from public.engage_votes vote
          where vote.tenant_id = option.tenant_id
            and vote.campaign_id = option.campaign_id
            and vote.option_id = option.id
        ) else null end
      )) order by option.sort_order)
      from public.engage_options option
      where option.tenant_id = campaign.tenant_id and option.campaign_id = campaign.id
    ), '[]'::jsonb)
  )
  from public.engage_campaigns campaign
  join public.tenants tenant on tenant.id = campaign.tenant_id
  where campaign.id = p_campaign_id;
$$;
revoke all on function private.engage_public_payload_v1(uuid, boolean)
  from public, anon, authenticated;

create function public.save_engage_campaign_v1(
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
  if p_kind not in ('poll', 'motm')
    or p_result_visibility not in ('after_vote', 'after_close', 'live')
    or length(btrim(p_title)) not between 2 and 160
    or length(btrim(p_question)) not between 2 and 160
    or jsonb_typeof(p_options) <> 'array'
    or jsonb_array_length(p_options) not between 2 and 24
    or (p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid engage campaign input' using errcode = '23514';
  end if;
  if p_campaign_id is not null and not exists (
    select 1 from public.engage_campaigns
    where tenant_id = p_tenant_id and id = p_campaign_id and status = 'draft'
  ) then raise exception 'only a tenant draft can be edited' using errcode = '42501'; end if;

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

  delete from public.engage_options where tenant_id = p_tenant_id and campaign_id = saved_id;
  option_count := 0;
  for option in select value from jsonb_array_elements(p_options) loop
    if length(btrim(option->>'label')) not between 2 and 160 then
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

create function public.transition_engage_campaign_v1(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_target_status text
) returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.require_engage_writer_v1(p_tenant_id); current_status text;
begin
  select status into current_status from public.engage_campaigns
  where tenant_id = p_tenant_id and id = p_campaign_id for update;
  if current_status is null or not (
    (current_status = 'draft' and p_target_status in ('scheduled','live','archived')) or
    (current_status = 'scheduled' and p_target_status in ('live','closed','archived')) or
    (current_status = 'live' and p_target_status = 'closed') or
    (current_status = 'closed' and p_target_status = 'archived')
  ) then raise exception 'invalid engage lifecycle transition' using errcode = '23514'; end if;
  if p_target_status in ('scheduled','live') and (
    select count(*) from public.engage_options
    where tenant_id = p_tenant_id and campaign_id = p_campaign_id
  ) < 2 then raise exception 'at least two options required' using errcode = '23514'; end if;
  update public.engage_campaigns set status = p_target_status, updated_by = actor_id
  where tenant_id = p_tenant_id and id = p_campaign_id;
  insert into public.engage_audit_events(tenant_id,campaign_id,actor_id,action,detail_json)
  values(p_tenant_id,p_campaign_id,actor_id,'campaign.transitioned',jsonb_build_object('from',current_status,'to',p_target_status));
end;
$$;

create function public.get_engage_campaign_public_v1(p_public_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare campaign_record public.engage_campaigns%rowtype; include_results boolean;
begin
  select campaign.* into campaign_record
  from public.engage_campaigns campaign
  where campaign.public_id = p_public_id
    and exists(select 1 from public.tenant_feature_flags flag
      where flag.tenant_id=campaign.tenant_id and flag.flag_key='engage' and flag.enabled)
    and campaign.status in ('live','closed')
    and (campaign.starts_at is null or campaign.starts_at <= now())
    and (campaign.status = 'closed' or campaign.ends_at is null or campaign.ends_at > now());
  if campaign_record.id is null then return null; end if;
  include_results := campaign_record.result_visibility = 'live'
    or campaign_record.status = 'closed';
  return private.engage_public_payload_v1(campaign_record.id, include_results);
end;
$$;

create function public.get_engage_campaign_for_identity_v1(
  p_public_id uuid,
  p_identity_hash text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare campaign_record public.engage_campaigns%rowtype; has_voted boolean;
begin
  if p_identity_hash !~ '^[a-f0-9]{64}$' then return null; end if;
  select campaign.* into campaign_record from public.engage_campaigns campaign
  where campaign.public_id = p_public_id
    and exists(select 1 from public.tenant_feature_flags flag
      where flag.tenant_id=campaign.tenant_id and flag.flag_key='engage' and flag.enabled)
    and campaign.status in ('live','closed');
  if campaign_record.id is null then return null; end if;
  select exists(select 1 from public.engage_votes vote
    where vote.tenant_id=campaign_record.tenant_id and vote.campaign_id=campaign_record.id
      and vote.identity_hash=p_identity_hash) into has_voted;
  return private.engage_public_payload_v1(campaign_record.id,
    campaign_record.result_visibility='live' or campaign_record.status='closed' or has_voted);
end;
$$;

create function public.submit_engage_vote_v1(
  p_public_id uuid,
  p_option_id uuid,
  p_identity_hash text,
  p_network_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare campaign_record public.engage_campaigns%rowtype; inserted_count integer;
begin
  if p_identity_hash !~ '^[a-f0-9]{64}$' or p_network_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid voter identity' using errcode = '23514';
  end if;
  select campaign.* into campaign_record from public.engage_campaigns campaign
  where campaign.public_id = p_public_id
    and exists(select 1 from public.tenant_feature_flags flag
      where flag.tenant_id=campaign.tenant_id and flag.flag_key='engage' and flag.enabled)
    and campaign.status = 'live'
    and (campaign.starts_at is null or campaign.starts_at <= now())
    and (campaign.ends_at is null or campaign.ends_at > now()) for update;
  if campaign_record.id is null then
    return jsonb_build_object('accepted',false,'reason','closed','campaign',null);
  end if;
  if (select count(*) from public.engage_votes
      where identity_hash=p_identity_hash and created_at > now()-interval '1 hour') >= 30 then
    raise exception 'engage vote rate exceeded' using errcode = 'P0001';
  end if;
  if (select count(*) from public.engage_votes
      where network_hash=p_network_hash and created_at > now()-interval '1 hour') >= 10 then
    raise exception 'engage network rate exceeded' using errcode = 'P0001';
  end if;
  if not exists(select 1 from public.engage_options where tenant_id=campaign_record.tenant_id
    and campaign_id=campaign_record.id and id=p_option_id) then
    return jsonb_build_object('accepted',false,'reason','invalid','campaign',
      private.engage_public_payload_v1(campaign_record.id,false));
  end if;
  insert into public.engage_votes(tenant_id,campaign_id,option_id,identity_hash,network_hash)
  values(campaign_record.tenant_id,campaign_record.id,p_option_id,p_identity_hash,p_network_hash)
  on conflict(tenant_id,campaign_id,identity_hash) do nothing;
  get diagnostics inserted_count = row_count;
  return jsonb_build_object(
    'accepted', inserted_count=1,
    'reason', case when inserted_count=1 then 'accepted' else 'already_voted' end,
    'campaign', private.engage_public_payload_v1(campaign_record.id,true)
  );
end;
$$;

create function public.save_youtube_source_v1(
  p_tenant_id uuid,
  p_source_id uuid,
  p_video_id text,
  p_title text,
  p_channel_title text,
  p_fallback_media_asset_id uuid,
  p_embeddable boolean,
  p_validation_status text,
  p_validation_error_code text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id(); saved_id uuid := coalesce(p_source_id,gen_random_uuid());
begin
  if actor_id is null
    or not private.tenant_feature_enabled_v1(p_tenant_id,'youtube_integration')
    or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.manage') then
    raise exception 'youtube rollout and source management required' using errcode='42501';
  end if;
  if p_video_id !~ '^[A-Za-z0-9_-]{11}$' or length(btrim(p_title)) not between 2 and 160
    or p_validation_status not in ('pending','verified','error')
    or not exists(select 1 from public.media_assets asset where asset.tenant_id=p_tenant_id
      and asset.id=p_fallback_media_asset_id and asset.status='ready' and asset.deleted_at is null) then
    raise exception 'invalid youtube source input' using errcode='23514';
  end if;
  insert into public.youtube_sources(id,tenant_id,video_id,title,channel_title,
    fallback_media_asset_id,embeddable,validation_status,validation_error_code,created_by,updated_by)
  values(saved_id,p_tenant_id,p_video_id,btrim(p_title),nullif(btrim(p_channel_title),''),
    p_fallback_media_asset_id,p_embeddable,p_validation_status,p_validation_error_code,actor_id,actor_id)
  on conflict(id) do update set video_id=excluded.video_id,title=excluded.title,
    channel_title=excluded.channel_title,fallback_media_asset_id=excluded.fallback_media_asset_id,
    embeddable=excluded.embeddable,validation_status=excluded.validation_status,
    validation_error_code=excluded.validation_error_code,updated_by=actor_id
  where youtube_sources.tenant_id=p_tenant_id;
  perform private.audit_event(p_tenant_id,'youtube.source.saved','youtube_sources',saved_id,
    'success',jsonb_build_object('videoId',p_video_id,'onlineOnly',true,'hasFallback',true));
  return saved_id;
end;
$$;

revoke all on function public.save_engage_campaign_v1(uuid,uuid,text,text,text,text,timestamptz,timestamptz,jsonb) from public,anon;
revoke all on function public.transition_engage_campaign_v1(uuid,uuid,text) from public,anon;
revoke all on function public.get_engage_campaign_public_v1(uuid) from public;
revoke all on function public.get_engage_campaign_for_identity_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.submit_engage_vote_v1(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.save_youtube_source_v1(uuid,uuid,text,text,text,uuid,boolean,text,text) from public,anon;

grant execute on function public.save_engage_campaign_v1(uuid,uuid,text,text,text,text,timestamptz,timestamptz,jsonb) to authenticated;
grant execute on function public.transition_engage_campaign_v1(uuid,uuid,text) to authenticated;
grant execute on function public.get_engage_campaign_public_v1(uuid) to anon,authenticated,service_role;
grant execute on function public.get_engage_campaign_for_identity_v1(uuid,text) to service_role;
grant execute on function public.submit_engage_vote_v1(uuid,uuid,text,text) to service_role;
grant execute on function public.save_youtube_source_v1(uuid,uuid,text,text,text,uuid,boolean,text,text) to authenticated;
