-- S123 Vector v2: idempotent self-service tenant claim and resumable onboarding.
-- Provisioning is deliberately server-authoritative. Authenticated clients may
-- read their tenant state, but can mutate it only through the validated RPCs.

-- The original guard correctly requires AAL2 for platform lifecycle changes.
-- A confirmed user with no existing platform/tenant scope is the sole narrow
-- exception for the initial launch-default tenant row. RLS still denies direct
-- client inserts; the validated SECURITY DEFINER claim RPC is the write path.
create or replace function private.require_aal2_for_platform_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  is_initial_self_service_claim boolean := false;
begin
  if actor_id is not null and tg_table_name = 'tenants' and tg_op = 'INSERT' then
    is_initial_self_service_claim :=
      (to_jsonb(new) ->> 'status') = 'active'
      and (to_jsonb(new) ->> 'screen_limit')::integer = 50
      and (to_jsonb(new) ->> 'locale') = 'nl-NL'
      and (to_jsonb(new) ->> 'timezone') = 'Europe/Amsterdam'
      and exists (
        select 1 from auth.users auth_user
        where auth_user.id = actor_id and auth_user.email_confirmed_at is not null
      )
      and not exists (
        select 1 from public.tenant_memberships membership
        where membership.user_id = actor_id
      )
      and not private.is_platform_member(null);
  end if;

  if actor_id is not null
    and private.current_aal() <> 'aal2'
    and not is_initial_self_service_claim
    and (
      tg_table_name = 'platform_memberships'
      or tg_op <> 'UPDATE'
      or (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status')
    )
  then
    raise exception 'sensitive platform mutations require aal2' using errcode = '42501';
  end if;

  if actor_id is not null
    and tg_table_name = 'tenants'
    and tg_op = 'UPDATE'
    and (to_jsonb(old) ->> 'status') is not distinct from (to_jsonb(new) ->> 'status')
    and (to_jsonb(old) ->> 'status') <> 'active'
  then
    raise exception 'tenant mutations require an active tenant' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.require_aal2_for_platform_mutation()
  from public, anon, authenticated;

create table public.tenant_onboarding_states (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'complete')),
  current_step text not null default 'organization'
    check (current_step in (
      'organization', 'brand_sources', 'screens', 'pairing',
      'first_release', 'billing', 'complete'
    )),
  organization_type text not null
    check (organization_type in ('sportclub', 'hospitality', 'organization')),
  use_case text not null
    check (use_case in ('club_communication', 'venue_information', 'internal_communication')),
  source_keys text[] not null default '{}'::text[]
    check (source_keys <@ array['sportlink', 'twelve', 'rss', 'own-media', 'sponsors']::text[]),
  setup_intent jsonb not null default '{}'::jsonb
    check (jsonb_typeof(setup_intent) = 'object' and pg_column_size(setup_intent) <= 8192),
  terms_version text not null check (length(terms_version) between 8 and 64),
  terms_accepted_at timestamptz not null,
  completed_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id),
  unique (owner_user_id, idempotency_key),
  foreign key (tenant_id, owner_user_id)
    references public.tenant_memberships(tenant_id, user_id)
    on delete restrict,
  check (
    (status = 'complete' and current_step = 'complete' and completed_at is not null)
    or (status = 'in_progress' and current_step <> 'complete' and completed_at is null)
  )
);

create index tenant_onboarding_states_status_idx
  on public.tenant_onboarding_states(status, updated_at desc);

create trigger tenant_onboarding_states_set_updated_at
before update on public.tenant_onboarding_states
for each row execute function private.set_updated_at();

alter table public.tenant_onboarding_states enable row level security;
alter table public.tenant_onboarding_states force row level security;

revoke all on public.tenant_onboarding_states from public, anon, authenticated;
grant select on public.tenant_onboarding_states to authenticated;

create policy "tenant_onboarding_states_select_by_scope"
on public.tenant_onboarding_states
for select
to authenticated
using (
  private.is_tenant_member(tenant_id)
  or private.is_platform_member(array[
    'platform_owner', 'platform_admin', 'platform_support'
  ]::public.platform_role[])
);

create or replace function public.provision_self_service_tenant_v1(
  p_name text,
  p_slug text,
  p_organization_type text,
  p_use_case text,
  p_source_keys text[],
  p_setup_intent jsonb,
  p_terms_version text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
  normalized_sources text[];
  existing_state public.tenant_onboarding_states%rowtype;
  new_tenant_id uuid;
  safe_setup_intent jsonb := '{}'::jsonb;
begin
  if actor_id is null then
    raise exception 'tenant claim requires an authenticated user' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = actor_id
      and auth_user.email_confirmed_at is not null
  ) then
    raise exception 'tenant claim requires a confirmed email address' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text, 123)
  );

  select state.* into existing_state
  from public.tenant_onboarding_states state
  where state.owner_user_id = actor_id
  for update;

  if found then
    return jsonb_build_object(
      'created', false,
      'currentStep', existing_state.current_step,
      'tenantId', existing_state.tenant_id
    );
  end if;

  if exists (
    select 1 from public.tenant_memberships membership
    where membership.user_id = actor_id
  ) or private.is_platform_member(null) then
    raise exception 'existing members cannot create a self-service tenant' using errcode = '42501';
  end if;

  if normalized_name is null or length(normalized_name) not between 2 and 120 then
    raise exception 'tenant name must contain 2 to 120 characters' using errcode = '23514';
  end if;
  if normalized_slug is null or normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'tenant slug must contain 3 to 64 lowercase characters' using errcode = '23514';
  end if;
  if p_organization_type not in ('sportclub', 'hospitality', 'organization') then
    raise exception 'organization type is unsupported' using errcode = '23514';
  end if;
  if p_use_case not in ('club_communication', 'venue_information', 'internal_communication') then
    raise exception 'use case is unsupported' using errcode = '23514';
  end if;
  if p_terms_version is null or length(btrim(p_terms_version)) not between 8 and 64 then
    raise exception 'terms version is invalid' using errcode = '23514';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key is required' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct source_key order by source_key), '{}'::text[])
  into normalized_sources
  from unnest(coalesce(p_source_keys, '{}'::text[])) source_key;

  if not normalized_sources <@ array[
    'sportlink', 'twelve', 'rss', 'own-media', 'sponsors'
  ]::text[] then
    raise exception 'one or more content sources are unsupported' using errcode = '23514';
  end if;

  if p_setup_intent is not null and p_setup_intent <> '{}'::jsonb then
    if jsonb_typeof(p_setup_intent) <> 'object'
      or pg_column_size(p_setup_intent) > 8192
      or (p_setup_intent - array[
        'branch', 'modules', 'zones', 'expiresAt', 'grossMonthlyCents',
        'issuedAt', 'pricePerScreenGrossCents', 'screenCount', 'version'
      ]::text[]) <> '{}'::jsonb
    then
      raise exception 'setup intent is invalid' using errcode = '23514';
    end if;
    safe_setup_intent := p_setup_intent;
  end if;

  insert into public.profiles (id, display_name)
  select
    actor_id,
    nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
  from auth.users auth_user
  where auth_user.id = actor_id
  on conflict (id) do nothing;

  insert into public.tenants (
    name, slug, status, screen_limit, locale, timezone, provisioning_status
  ) values (
    normalized_name, normalized_slug, 'active', 50, 'nl-NL',
    'Europe/Amsterdam', 'ready'
  )
  returning id into new_tenant_id;

  insert into public.tenant_memberships (
    tenant_id, user_id, role, created_by
  ) values (
    new_tenant_id, actor_id, 'tenant_owner', actor_id
  );

  insert into public.tenant_settings (tenant_id, updated_by)
  values (new_tenant_id, actor_id);

  insert into public.tenant_onboarding_states (
    tenant_id,
    owner_user_id,
    idempotency_key,
    current_step,
    organization_type,
    use_case,
    source_keys,
    setup_intent,
    terms_version,
    terms_accepted_at,
    updated_by
  ) values (
    new_tenant_id,
    actor_id,
    p_idempotency_key,
    'brand_sources',
    p_organization_type,
    p_use_case,
    normalized_sources,
    safe_setup_intent,
    btrim(p_terms_version),
    now(),
    actor_id
  );

  perform private.audit_event(
    new_tenant_id,
    'tenant.self_service.provisioned',
    'tenants',
    new_tenant_id,
    'success',
    jsonb_build_object(
      'organizationType', p_organization_type,
      'sourceKeys', normalized_sources,
      'termsVersion', btrim(p_terms_version),
      'useCase', p_use_case
    )
  );

  return jsonb_build_object(
    'created', true,
    'currentStep', 'brand_sources',
    'tenantId', new_tenant_id
  );
exception
  when unique_violation then
    if exists (select 1 from public.tenants tenant where tenant.slug = normalized_slug) then
      raise exception 'tenant slug is already in use' using errcode = '23505';
    end if;
    raise;
end;
$$;

create or replace function public.update_tenant_onboarding_preferences_v1(
  p_tenant_id uuid,
  p_organization_type text,
  p_use_case text,
  p_source_keys text[]
)
returns public.tenant_onboarding_states
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  normalized_sources text[];
  result public.tenant_onboarding_states%rowtype;
begin
  if actor_id is null or not private.has_tenant_role(
    p_tenant_id,
    array['tenant_owner', 'tenant_admin']::public.tenant_role[]
  ) then
    raise exception 'tenant onboarding management capability required' using errcode = '42501';
  end if;
  if p_organization_type not in ('sportclub', 'hospitality', 'organization')
    or p_use_case not in ('club_communication', 'venue_information', 'internal_communication')
  then
    raise exception 'onboarding preferences are unsupported' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct source_key order by source_key), '{}'::text[])
  into normalized_sources
  from unnest(coalesce(p_source_keys, '{}'::text[])) source_key;
  if not normalized_sources <@ array[
    'sportlink', 'twelve', 'rss', 'own-media', 'sponsors'
  ]::text[] then
    raise exception 'one or more content sources are unsupported' using errcode = '23514';
  end if;

  update public.tenant_onboarding_states state
  set
    organization_type = p_organization_type,
    use_case = p_use_case,
    source_keys = normalized_sources,
    current_step = case
      when state.current_step in ('organization', 'brand_sources') then 'screens'
      else state.current_step
    end,
    updated_by = actor_id
  where state.tenant_id = p_tenant_id
    and state.status = 'in_progress'
  returning state.* into result;

  if not found then
    raise exception 'active tenant onboarding was not found' using errcode = 'P0002';
  end if;

  perform private.audit_event(
    p_tenant_id,
    'tenant.onboarding.preferences_updated',
    'tenant_onboarding_states',
    p_tenant_id,
    'success',
    jsonb_build_object(
      'organizationType', p_organization_type,
      'sourceKeys', normalized_sources,
      'useCase', p_use_case
    )
  );
  return result;
end;
$$;

create or replace function public.refresh_tenant_onboarding_progress_v1(
  p_tenant_id uuid
)
returns public.tenant_onboarding_states
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  has_screen boolean;
  has_pairing boolean;
  has_release boolean;
  next_step text;
  result public.tenant_onboarding_states%rowtype;
begin
  if actor_id is null or not private.is_tenant_member(p_tenant_id) then
    raise exception 'tenant membership required' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.screens screen
    where screen.tenant_id = p_tenant_id and screen.status <> 'disabled'
  ) into has_screen;
  select exists (
    select 1 from public.player_devices device
    where device.tenant_id = p_tenant_id and device.status = 'paired'
  ) into has_pairing;
  select exists (
    select 1 from public.playlist_releases release
    where release.tenant_id = p_tenant_id
  ) into has_release;

  next_step := case
    when not has_screen then 'screens'
    when not has_pairing then 'pairing'
    when not has_release then 'first_release'
    else 'billing'
  end;

  update public.tenant_onboarding_states state
  set current_step = case
      when state.current_step = 'brand_sources' then state.current_step
      else next_step
    end,
    updated_by = actor_id
  where state.tenant_id = p_tenant_id
    and state.status = 'in_progress'
  returning state.* into result;

  if not found then
    raise exception 'active tenant onboarding was not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.provision_self_service_tenant_v1(
  text, text, text, text, text[], jsonb, text, uuid
) from public, anon, authenticated;
grant execute on function public.provision_self_service_tenant_v1(
  text, text, text, text, text[], jsonb, text, uuid
) to authenticated;

revoke all on function public.update_tenant_onboarding_preferences_v1(
  uuid, text, text, text[]
) from public, anon, authenticated;
grant execute on function public.update_tenant_onboarding_preferences_v1(
  uuid, text, text, text[]
) to authenticated;

revoke all on function public.refresh_tenant_onboarding_progress_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_tenant_onboarding_progress_v1(uuid)
  to authenticated;

comment on table public.tenant_onboarding_states is
  'Resumable self-service onboarding preferences; progress is reconciled against real screens, paired devices and immutable releases.';
comment on function public.provision_self_service_tenant_v1(text, text, text, text, text[], jsonb, text, uuid) is
  'Claims exactly one tenant per confirmed self-service user with transactional membership, defaults, terms evidence and audit.';
