-- S115 Sponsor Hub: tenant-scoped sponsor operations, four-eyes approval,
-- immutable delivery plans and idempotent Proof of Play.

alter table public.tenant_custom_roles
  drop constraint tenant_custom_roles_capabilities_check,
  add constraint tenant_custom_roles_capabilities_check check (
    capabilities <@ array[
      'tenant.media.write', 'tenant.product.write', 'tenant.playlist.write',
      'tenant.playlist.publish', 'tenant.screen.manage', 'tenant.settings.manage',
      'tenant.audit.read', 'tenant.support.export', 'tenant.ticket.write',
      'tenant.studio.read', 'tenant.studio.create', 'tenant.studio.edit_own',
      'tenant.studio.edit_all', 'tenant.studio.archive',
      'tenant.studio.template.manage', 'tenant.studio.motion.edit',
      'tenant.studio.render', 'tenant.studio.job.manage',
      'tenant.dynamic_slide.read', 'tenant.dynamic_slide.write',
      'tenant.data_source.read', 'tenant.data_source.manage',
      'tenant.sponsor.read', 'tenant.sponsor.write', 'tenant.sponsor.approve',
      'tenant.sponsor.publish', 'tenant.sponsor.report'
    ]::text[]
    and ('tenant.media.write' = any(capabilities)) =
        ('tenant.playlist.write' = any(capabilities))
  );

alter function private.builtin_tenant_capabilities(public.tenant_role)
  rename to builtin_tenant_capabilities_before_sponsor_hub;

create function private.builtin_tenant_capabilities(p_role public.tenant_role)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select private.builtin_tenant_capabilities_before_sponsor_hub(p_role) ||
    case
      when p_role in ('tenant_owner', 'tenant_admin') then array[
        'tenant.sponsor.read', 'tenant.sponsor.write', 'tenant.sponsor.approve',
        'tenant.sponsor.publish', 'tenant.sponsor.report'
      ]::text[]
      when p_role = 'tenant_editor' then array[
        'tenant.sponsor.read', 'tenant.sponsor.write', 'tenant.sponsor.report'
      ]::text[]
      else array['tenant.sponsor.read', 'tenant.sponsor.report']::text[]
    end;
$$;

revoke all on function private.builtin_tenant_capabilities(public.tenant_role)
  from public, anon, authenticated;

create or replace function private.current_tenant_capabilities(p_tenant_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when membership.custom_role_id is null
      then private.builtin_tenant_capabilities(membership.role)
    when custom_role.status <> 'active' then '{}'::text[]
    when custom_role.capabilities <@ array[
      'tenant.sponsor.read','tenant.sponsor.write','tenant.sponsor.approve',
      'tenant.sponsor.publish','tenant.sponsor.report'
    ]::text[] then custom_role.capabilities
    else (
      select array_agg(distinct capability order by capability)
      from unnest(
        private.tenant_baseline_capabilities()
        || custom_role.capabilities
        || case when 'tenant.playlist.write'=any(custom_role.capabilities)
          then array['tenant.playlist.archive']::text[] else '{}'::text[] end
      ) capability
    )
  end
  from public.tenant_memberships membership
  left join public.tenant_custom_roles custom_role
    on custom_role.tenant_id=membership.tenant_id
    and custom_role.id=membership.custom_role_id
  where membership.tenant_id=p_tenant_id
    and membership.user_id=private.current_user_id();
$$;

revoke all on function private.current_tenant_capabilities(uuid)
  from public, anon, authenticated;

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 160),
  legal_name text,
  website_url text,
  notes text check (notes is null or length(notes) <= 4000),
  status text not null default 'active' check (status in ('prospect', 'active', 'inactive', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index sponsors_tenant_name_active_uq on public.sponsors(tenant_id, lower(name)) where status <> 'archived';
create index sponsors_tenant_status_idx on public.sponsors(tenant_id, status, updated_at desc);

create table public.sponsor_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sponsor_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 160),
  email text,
  phone text,
  role_label text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete cascade
);
create index sponsor_contacts_tenant_sponsor_idx on public.sponsor_contacts(tenant_id, sponsor_id);

create table public.sponsor_media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sponsor_id uuid not null,
  media_asset_id uuid not null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, sponsor_id, media_asset_id),
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete restrict
);
create index sponsor_media_assets_tenant_sponsor_idx on public.sponsor_media_assets(tenant_id, sponsor_id, created_at desc);

create table public.sponsor_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sponsor_id uuid not null,
  title text not null check (length(btrim(title)) between 2 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  value_cents bigint check (value_cents is null or value_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'terminated')),
  terms_json jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_json) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (ends_at > starts_at),
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete restrict
);
create index sponsor_agreements_tenant_period_idx on public.sponsor_agreements(tenant_id, starts_at, ends_at);

create table public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sponsor_id uuid not null,
  agreement_id uuid,
  name text not null check (length(btrim(name)) between 2 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'published', 'paused', 'ended', 'rejected')),
  weight numeric(10,3) not null default 1 check (weight > 0 and weight <= 1000),
  daily_cap integer check (daily_cap is null or daily_cap > 0),
  cooldown_seconds integer not null default 0 check (cooldown_seconds between 0 and 86400),
  priority integer not null default 0 check (priority between -1000 and 1000),
  revision bigint not null default 1 check (revision > 0),
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (ends_at > starts_at),
  check ((status <> 'submitted') or (submitted_by is not null and submitted_at is not null)),
  check ((status not in ('approved', 'published')) or (approved_by is not null and approved_at is not null)),
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete restrict,
  foreign key (tenant_id, agreement_id) references public.sponsor_agreements(tenant_id, id) on delete restrict
);
create index sponsor_campaigns_tenant_status_period_idx on public.sponsor_campaigns(tenant_id, status, starts_at, ends_at);

create table public.sponsor_creative_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  revision bigint not null default 1 check (revision > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, campaign_id) references public.sponsor_campaigns(tenant_id, id) on delete cascade
);
create index sponsor_creative_sets_campaign_idx on public.sponsor_creative_sets(tenant_id, campaign_id);

create table public.sponsor_creative_families (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  creative_set_id uuid not null,
  name text not null check (length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, creative_set_id) references public.sponsor_creative_sets(tenant_id, id) on delete cascade
);
create index sponsor_creative_families_set_idx on public.sponsor_creative_families(tenant_id, creative_set_id);

create table public.sponsor_creatives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  creative_family_id uuid not null,
  media_asset_id uuid not null,
  media_variant_id uuid,
  orientation text not null check (orientation in ('landscape', 'portrait', 'any')),
  position_key text not null check (position_key in ('fullscreen', 'presented_by', 'footer', 'corner', 'match_sponsor', 'match_ball_sponsor')),
  duration_seconds numeric(10,3) not null default 8 check (duration_seconds > 0 and duration_seconds <= 300),
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  status text not null default 'approved' check (status in ('draft', 'approved', 'rejected', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, creative_family_id) references public.sponsor_creative_families(tenant_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete restrict,
  foreign key (tenant_id, media_variant_id) references public.media_variants(tenant_id, id) on delete restrict
);
create index sponsor_creatives_family_idx on public.sponsor_creatives(tenant_id, creative_family_id, status);

create table public.sponsor_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null check (key in ('fullscreen', 'presented_by', 'footer', 'corner', 'match_sponsor', 'match_ball_sponsor')),
  name text not null,
  mode text not null default 'rotation' check (mode in ('rotation', 'fixed')),
  duration_seconds numeric(10,3) not null default 8 check (duration_seconds > 0 and duration_seconds <= 300),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key)
);
create index sponsor_positions_tenant_enabled_idx on public.sponsor_positions(tenant_id, enabled, key);

create table public.sponsor_campaign_placements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  position_id uuid not null,
  orientation text not null default 'any' check (orientation in ('landscape', 'portrait', 'any')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, campaign_id, position_id, orientation),
  foreign key (tenant_id, campaign_id) references public.sponsor_campaigns(tenant_id, id) on delete cascade,
  foreign key (tenant_id, position_id) references public.sponsor_positions(tenant_id, id) on delete cascade
);
create index sponsor_campaign_placements_tenant_position_idx on public.sponsor_campaign_placements(tenant_id, position_id, enabled);

create table public.sponsor_context_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  placement_id uuid not null,
  context_kind text not null check (context_kind in ('competition', 'team', 'event', 'match')),
  context_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, placement_id, context_kind, context_id),
  foreign key (tenant_id, placement_id) references public.sponsor_campaign_placements(tenant_id, id) on delete cascade
);
create index sponsor_context_bindings_lookup_idx on public.sponsor_context_bindings(tenant_id, context_kind, context_id);

create table public.sponsor_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sponsor_id uuid,
  campaign_id uuid,
  title text not null check (length(btrim(title)) between 2 and 180),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete cascade,
  foreign key (tenant_id, campaign_id) references public.sponsor_campaigns(tenant_id, id) on delete cascade
);
create index sponsor_tasks_action_idx on public.sponsor_tasks(tenant_id, status, due_at);

create table public.sponsor_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 180),
  stage text not null default 'lead' check (stage in ('lead', 'contacted', 'proposal', 'won', 'lost')),
  estimated_value_cents bigint check (estimated_value_cents is null or estimated_value_cents >= 0),
  sponsor_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete set null (sponsor_id)
);
create index sponsor_opportunities_pipeline_idx on public.sponsor_opportunities(tenant_id, stage, updated_at desc);

create table public.sponsor_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  version integer not null check (version > 0),
  content_release_id uuid,
  plan_hash text not null check (plan_hash ~ '^[a-f0-9]{64}$'),
  plan_json jsonb not null check (jsonb_typeof(plan_json) = 'object'),
  valid_from timestamptz not null default now(),
  expires_at timestamptz not null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, version),
  check (expires_at > valid_from),
  foreign key (tenant_id, content_release_id) references public.playlist_releases(tenant_id, id) on delete restrict
);
create index sponsor_plan_revisions_latest_idx on public.sponsor_plan_revisions(tenant_id, published_at desc);

create table public.sponsor_plan_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_revision_id uuid not null,
  screen_id uuid not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, plan_revision_id, screen_id),
  foreign key (tenant_id, plan_revision_id) references public.sponsor_plan_revisions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, screen_id) references public.screens(tenant_id, id) on delete cascade
);
create index sponsor_plan_targets_screen_idx on public.sponsor_plan_targets(tenant_id, screen_id, created_at desc);

create table public.sponsor_play_events (
  event_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id uuid not null,
  screen_id uuid not null,
  plan_revision_id uuid not null,
  sponsor_id uuid not null,
  campaign_id uuid not null,
  creative_id uuid not null,
  position_id uuid not null,
  happened_at timestamptz not null,
  played_ms integer not null check (played_ms >= 0 and played_ms <= 3600000),
  context_json jsonb not null default '{}'::jsonb check (jsonb_typeof(context_json) = 'object'),
  received_at timestamptz not null default now(),
  foreign key (tenant_id, device_id) references public.player_devices(tenant_id, id) on delete cascade,
  foreign key (tenant_id, screen_id) references public.screens(tenant_id, id) on delete cascade,
  foreign key (tenant_id, plan_revision_id) references public.sponsor_plan_revisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, sponsor_id) references public.sponsors(tenant_id, id) on delete restrict,
  foreign key (tenant_id, campaign_id) references public.sponsor_campaigns(tenant_id, id) on delete restrict,
  foreign key (tenant_id, creative_id) references public.sponsor_creatives(tenant_id, id) on delete restrict,
  foreign key (tenant_id, position_id) references public.sponsor_positions(tenant_id, id) on delete restrict
);
create index sponsor_play_events_reporting_idx on public.sponsor_play_events(tenant_id, happened_at desc, campaign_id);

create table public.sponsor_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail_json jsonb not null default '{}'::jsonb check (jsonb_typeof(detail_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index sponsor_audit_events_tenant_created_idx on public.sponsor_audit_events(tenant_id, created_at desc);

create function private.reject_sponsor_immutable_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'immutable sponsor record cannot be changed';
end;
$$;
create trigger sponsor_plan_revisions_immutable before update or delete on public.sponsor_plan_revisions for each row execute function private.reject_sponsor_immutable_mutation();
create trigger sponsor_play_events_immutable before update or delete on public.sponsor_play_events for each row execute function private.reject_sponsor_immutable_mutation();
create trigger sponsor_audit_events_immutable before update or delete on public.sponsor_audit_events for each row execute function private.reject_sponsor_immutable_mutation();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'sponsors','sponsor_contacts','sponsor_media_assets','sponsor_agreements','sponsor_campaigns',
    'sponsor_creative_sets','sponsor_creative_families','sponsor_creatives',
    'sponsor_positions','sponsor_campaign_placements','sponsor_context_bindings',
    'sponsor_tasks','sponsor_opportunities','sponsor_plan_revisions',
    'sponsor_plan_targets','sponsor_play_events','sponsor_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_tenant_capability(tenant_id, %L))',
      table_name || '_select_by_sponsor_capability', table_name,
      case when table_name = 'sponsor_play_events' then 'tenant.sponsor.report' else 'tenant.sponsor.read' end
    );
  end loop;
end $$;

create trigger sponsors_set_updated_at before update on public.sponsors for each row execute function private.set_updated_at();
create trigger sponsor_agreements_set_updated_at before update on public.sponsor_agreements for each row execute function private.set_updated_at();
create trigger sponsor_campaigns_set_updated_at before update on public.sponsor_campaigns for each row execute function private.set_updated_at();
create trigger sponsor_positions_set_updated_at before update on public.sponsor_positions for each row execute function private.set_updated_at();
create trigger sponsor_opportunities_set_updated_at before update on public.sponsor_opportunities for each row execute function private.set_updated_at();

create function private.require_sponsor_capability(p_tenant_id uuid, p_capability text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare actor_id uuid := private.current_user_id();
begin
  if actor_id is null or not private.has_tenant_capability(p_tenant_id, p_capability) then
    raise exception using errcode = '42501', message = 'missing sponsor capability';
  end if;
  return actor_id;
end;
$$;

create function private.audit_sponsor_action(p_tenant_id uuid, p_actor_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.sponsor_audit_events(tenant_id, actor_id, action, entity_type, entity_id, detail_json)
  values (p_tenant_id, p_actor_id, p_action, p_entity_type, p_entity_id, coalesce(p_detail, '{}'::jsonb));
$$;

revoke all on function private.reject_sponsor_immutable_mutation() from public, anon, authenticated, service_role;
revoke all on function private.require_sponsor_capability(uuid,text) from public, anon, authenticated, service_role;
revoke all on function private.audit_sponsor_action(uuid,uuid,text,text,uuid,jsonb) from public, anon, authenticated, service_role;

create function public.ensure_sponsor_positions_v1(p_tenant_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; inserted_count integer;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  insert into public.sponsor_positions(tenant_id, key, name, mode, duration_seconds)
  values
    (p_tenant_id, 'fullscreen', 'Volledig scherm', 'rotation', 8),
    (p_tenant_id, 'presented_by', 'Mede mogelijk gemaakt door', 'rotation', 8),
    (p_tenant_id, 'footer', 'Voetregel', 'rotation', 8),
    (p_tenant_id, 'corner', 'Hoekpositie', 'rotation', 8),
    (p_tenant_id, 'match_sponsor', 'Wedstrijdsponsor', 'fixed', 8),
    (p_tenant_id, 'match_ball_sponsor', 'Wedstrijdbalsponsor', 'fixed', 8)
  on conflict (tenant_id, key) do nothing;
  get diagnostics inserted_count = row_count;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'positions.ensure', 'sponsor_position', null, jsonb_build_object('inserted', inserted_count));
  return inserted_count;
end;
$$;

create function public.create_sponsor_v1(p_tenant_id uuid, p_name text, p_website_url text default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; sponsor_id uuid;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  insert into public.sponsors(tenant_id, name, website_url, notes, created_by, updated_by)
  values (p_tenant_id, btrim(p_name), nullif(btrim(p_website_url), ''), nullif(btrim(p_notes), ''), actor_id, actor_id)
  returning id into sponsor_id;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'sponsor.create', 'sponsor', sponsor_id);
  return jsonb_build_object('sponsorId', sponsor_id);
end;
$$;

create function public.create_sponsor_campaign_v1(p_tenant_id uuid, p_sponsor_id uuid, p_name text, p_starts_at timestamptz, p_ends_at timestamptz, p_weight numeric default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; campaign_id uuid; creative_set_id uuid;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  insert into public.sponsor_campaigns(tenant_id, sponsor_id, name, starts_at, ends_at, weight, created_by, updated_by)
  values (p_tenant_id, p_sponsor_id, btrim(p_name), p_starts_at, p_ends_at, p_weight, actor_id, actor_id)
  returning id into campaign_id;
  insert into public.sponsor_creative_sets(tenant_id, campaign_id, name, created_by)
  values (p_tenant_id, campaign_id, 'Standaard creatives', actor_id) returning id into creative_set_id;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'campaign.create', 'sponsor_campaign', campaign_id);
  return jsonb_build_object('campaignId', campaign_id, 'creativeSetId', creative_set_id);
end;
$$;

create function public.register_sponsor_media_v1(p_tenant_id uuid, p_sponsor_id uuid, p_media_asset_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; media_id uuid;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  if not exists (select 1 from public.media_assets where tenant_id=p_tenant_id and id=p_media_asset_id and status='ready' and deleted_at is null and checksum_sha256 is not null) then
    raise exception 'ready checksum-pinned media required';
  end if;
  insert into public.sponsor_media_assets(tenant_id,sponsor_id,media_asset_id,approved_by)
  values(p_tenant_id,p_sponsor_id,p_media_asset_id,actor_id)
  on conflict(tenant_id,sponsor_id,media_asset_id) do update set approved_by=excluded.approved_by
  returning id into media_id;
  perform private.audit_sponsor_action(p_tenant_id,actor_id,'media.register','sponsor_media',media_id,jsonb_build_object('sponsorId',p_sponsor_id,'mediaAssetId',p_media_asset_id));
  return jsonb_build_object('sponsorMediaId',media_id);
end;
$$;

create function public.add_sponsor_creative_v1(p_tenant_id uuid, p_campaign_id uuid, p_media_asset_id uuid, p_position_key text, p_orientation text default 'any', p_duration_seconds numeric default 8)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; set_id uuid; family_id uuid; creative_id uuid; asset record; variant record;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  if p_position_key not in ('fullscreen','presented_by','footer','corner','match_sponsor','match_ball_sponsor') then raise exception 'invalid sponsor position'; end if;
  if p_orientation not in ('landscape','portrait','any') then raise exception 'invalid orientation'; end if;
  select id into set_id from public.sponsor_creative_sets where tenant_id = p_tenant_id and campaign_id = p_campaign_id order by created_at limit 1;
  if set_id is null then raise exception 'creative set unavailable'; end if;
  if not exists (
    select 1 from public.sponsor_media_assets sm
    join public.sponsor_campaigns sc on sc.tenant_id=sm.tenant_id and sc.sponsor_id=sm.sponsor_id
    where sm.tenant_id=p_tenant_id and sm.media_asset_id=p_media_asset_id and sc.id=p_campaign_id
  ) then raise exception 'media is not registered for this campaign sponsor'; end if;
  select * into asset from public.media_assets where tenant_id = p_tenant_id and id = p_media_asset_id and status = 'ready' and deleted_at is null;
  if asset.id is null or asset.checksum_sha256 is null then raise exception 'ready checksum-pinned media required'; end if;
  select * into variant from public.media_variants where tenant_id = p_tenant_id and asset_id = p_media_asset_id order by case variant_type when 'player_1080p' then 0 when 'original' then 1 else 2 end limit 1;
  insert into public.sponsor_creative_families(tenant_id, creative_set_id, name)
  values (p_tenant_id, set_id, asset.title) returning id into family_id;
  insert into public.sponsor_creatives(tenant_id, creative_family_id, media_asset_id, media_variant_id, orientation, position_key, duration_seconds, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256, width, height, created_by)
  values (p_tenant_id, family_id, asset.id, variant.id, p_orientation, p_position_key, p_duration_seconds,
    coalesce(variant.storage_bucket, asset.storage_bucket), coalesce(variant.storage_path, asset.storage_path),
    coalesce(variant.mime_type, asset.mime_type), coalesce(variant.file_size_bytes, asset.file_size_bytes),
    coalesce(variant.checksum_sha256, asset.checksum_sha256), coalesce(variant.width, asset.width), coalesce(variant.height, asset.height), actor_id)
  returning id into creative_id;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'creative.add', 'sponsor_creative', creative_id, jsonb_build_object('campaignId', p_campaign_id));
  return jsonb_build_object('creativeId', creative_id);
end;
$$;

create function public.place_sponsor_campaign_v1(p_tenant_id uuid, p_campaign_id uuid, p_position_id uuid, p_orientation text default 'any')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; placement_id uuid;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  insert into public.sponsor_campaign_placements(tenant_id, campaign_id, position_id, orientation)
  values (p_tenant_id, p_campaign_id, p_position_id, p_orientation)
  on conflict (tenant_id, campaign_id, position_id, orientation) do update set enabled = true
  returning id into placement_id;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'placement.upsert', 'sponsor_placement', placement_id);
  return jsonb_build_object('placementId', placement_id);
end;
$$;

create function public.submit_sponsor_campaign_v1(p_tenant_id uuid, p_campaign_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.write');
  if not exists (select 1 from public.sponsor_creatives cr join public.sponsor_creative_families f on f.tenant_id=cr.tenant_id and f.id=cr.creative_family_id join public.sponsor_creative_sets s on s.tenant_id=f.tenant_id and s.id=f.creative_set_id where s.tenant_id=p_tenant_id and s.campaign_id=p_campaign_id and cr.status='approved') then raise exception 'approved creative required'; end if;
  if not exists (select 1 from public.sponsor_campaign_placements where tenant_id=p_tenant_id and campaign_id=p_campaign_id and enabled) then raise exception 'placement required'; end if;
  update public.sponsor_campaigns set status='submitted', submitted_by=actor_id, submitted_at=now(), approved_by=null, approved_at=null, updated_by=actor_id where tenant_id=p_tenant_id and id=p_campaign_id and status in ('draft','rejected','paused');
  if not found then raise exception 'campaign cannot be submitted'; end if;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'campaign.submit', 'sponsor_campaign', p_campaign_id);
end;
$$;

create function public.approve_sponsor_campaign_v1(p_tenant_id uuid, p_campaign_id uuid, p_approve boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; submitted_actor uuid;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.approve');
  select submitted_by into submitted_actor from public.sponsor_campaigns where tenant_id=p_tenant_id and id=p_campaign_id and status='submitted' for update;
  if submitted_actor is null then raise exception 'submitted campaign required'; end if;
  if submitted_actor = actor_id then raise exception using errcode='42501', message='four-eyes approval requires another user'; end if;
  update public.sponsor_campaigns set status=case when p_approve then 'approved' else 'rejected' end, approved_by=case when p_approve then actor_id else null end, approved_at=case when p_approve then now() else null end, updated_by=actor_id where tenant_id=p_tenant_id and id=p_campaign_id;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, case when p_approve then 'campaign.approve' else 'campaign.reject' end, 'sponsor_campaign', p_campaign_id);
end;
$$;

create function public.publish_sponsor_plan_v1(p_tenant_id uuid, p_screen_ids uuid[] default null, p_valid_days integer default 14)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; next_version integer; plan_id uuid := gen_random_uuid(); generated_at timestamptz := now(); expires_at timestamptz; placements jsonb; plan jsonb; plan_hash text; target_count integer;
begin
  actor_id := private.require_sponsor_capability(p_tenant_id, 'tenant.sponsor.publish');
  if p_valid_days < 1 or p_valid_days > 31 then raise exception 'plan validity must be 1-31 days'; end if;
  expires_at := generated_at + make_interval(days => p_valid_days);
  select coalesce(max(version),0)+1 into next_version from public.sponsor_plan_revisions where tenant_id=p_tenant_id;
  select coalesce(jsonb_agg(payload order by payload->>'positionKey', payload->>'campaignId'), '[]'::jsonb) into placements
  from (
    select jsonb_build_object(
      'campaignId', c.id, 'sponsorId', c.sponsor_id, 'positionId', p.id, 'positionKey', p.key,
      'orientation', cp.orientation,
      'weight', c.weight, 'dailyCap', c.daily_cap, 'cooldownSeconds', c.cooldown_seconds,
      'priority', c.priority, 'context', coalesce(ctx.context_json, '{}'::jsonb),
      'creatives', coalesce(cr.creatives_json, '[]'::jsonb)
    ) payload
    from public.sponsor_campaigns c
    join public.sponsors sp on sp.tenant_id=c.tenant_id and sp.id=c.sponsor_id and sp.status='active'
    join public.sponsor_campaign_placements cp on cp.tenant_id=c.tenant_id and cp.campaign_id=c.id and cp.enabled
    join public.sponsor_positions p on p.tenant_id=cp.tenant_id and p.id=cp.position_id and p.enabled
    join lateral (
      select jsonb_agg(jsonb_build_object(
        'creativeId', x.id, 'creativeFamilyId', x.creative_family_id, 'campaignId', c.id,
        'sponsorId', c.sponsor_id, 'sponsorName', sp.name, 'durationSeconds', x.duration_seconds,
        'url', 'storage://' || x.storage_bucket || '/' || x.storage_path,
        'mimeType', x.mime_type, 'bytes', x.file_size_bytes, 'checksumSha256', x.checksum_sha256,
        'width', x.width, 'height', x.height
      ) order by x.created_at) creatives_json
      from public.sponsor_creatives x
      join public.sponsor_creative_families f on f.tenant_id=x.tenant_id and f.id=x.creative_family_id
      join public.sponsor_creative_sets s on s.tenant_id=f.tenant_id and s.id=f.creative_set_id and s.campaign_id=c.id
      where x.tenant_id=c.tenant_id and x.status='approved' and x.position_key=p.key and (x.orientation=cp.orientation or x.orientation='any' or cp.orientation='any')
    ) cr on jsonb_array_length(cr.creatives_json) > 0
    left join lateral (
      select jsonb_object_agg(
        case b.context_kind when 'competition' then 'competitionId' when 'team' then 'teamId' when 'event' then 'eventId' else 'matchId' end,
        b.context_id
      ) context_json from public.sponsor_context_bindings b where b.tenant_id=cp.tenant_id and b.placement_id=cp.id
    ) ctx on true
    where c.tenant_id=p_tenant_id and c.status in ('approved','published') and c.starts_at <= expires_at and c.ends_at >= generated_at
  ) compiled;
  plan := jsonb_build_object('schemaVersion',1,'tenantId',p_tenant_id,'revisionId',plan_id,'version',next_version,'generatedAt',generated_at,'expiresAt',expires_at,'placements',placements,'houseFallback',null);
  plan_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(plan::text,'UTF8'),'sha256'),
    'hex'
  );
  plan := plan || jsonb_build_object('planHash', plan_hash);
  insert into public.sponsor_plan_revisions(id,tenant_id,version,plan_hash,plan_json,valid_from,expires_at,published_by) values(plan_id,p_tenant_id,next_version,plan_hash,plan,generated_at,expires_at,actor_id);
  insert into public.sponsor_plan_targets(tenant_id,plan_revision_id,screen_id)
    select p_tenant_id, plan_id, s.id from public.screens s where s.tenant_id=p_tenant_id and s.deleted_at is null and s.status='active' and (p_screen_ids is null or s.id=any(p_screen_ids));
  get diagnostics target_count = row_count;
  if target_count = 0 then raise exception 'at least one active target screen required'; end if;
  update public.sponsor_campaigns set status='published', updated_by=actor_id where tenant_id=p_tenant_id and status='approved' and starts_at <= expires_at and ends_at >= generated_at;
  perform private.audit_sponsor_action(p_tenant_id, actor_id, 'plan.publish', 'sponsor_plan_revision', plan_id, jsonb_build_object('version',next_version,'targets',target_count,'hash',plan_hash));
  return jsonb_build_object('planRevisionId',plan_id,'version',next_version,'planHash',plan_hash,'targetCount',target_count);
end;
$$;

create function public.record_sponsor_play_events_v1(p_token_hash text, p_events jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare device_record record; inserted_count integer;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 100 then raise exception 'invalid proof of play batch'; end if;
  select d.id,d.tenant_id,d.screen_id into device_record from public.player_devices d where d.token_hash=p_token_hash and d.status='paired';
  if device_record.id is null then raise exception using errcode='42501', message='invalid device token'; end if;
  insert into public.sponsor_play_events(event_id,tenant_id,device_id,screen_id,plan_revision_id,sponsor_id,campaign_id,creative_id,position_id,happened_at,played_ms,context_json)
  select (e->>'eventId')::uuid, device_record.tenant_id, device_record.id, device_record.screen_id,
    (e->>'planRevisionId')::uuid,(e->>'sponsorId')::uuid,(e->>'campaignId')::uuid,(e->>'creativeId')::uuid,(e->>'positionId')::uuid,
    (e->>'happenedAt')::timestamptz,(e->>'playedMs')::integer,coalesce(e->'context','{}'::jsonb)
  from jsonb_array_elements(p_events) e
  join public.sponsor_plan_targets t on t.tenant_id=device_record.tenant_id and t.screen_id=device_record.screen_id and t.plan_revision_id=(e->>'planRevisionId')::uuid
  join public.sponsor_plan_revisions pr on pr.tenant_id=t.tenant_id and pr.id=t.plan_revision_id
  join public.sponsor_campaigns c on c.tenant_id=device_record.tenant_id and c.id=(e->>'campaignId')::uuid and c.sponsor_id=(e->>'sponsorId')::uuid
  join public.sponsor_creatives cr on cr.tenant_id=device_record.tenant_id and cr.id=(e->>'creativeId')::uuid
  join public.sponsor_creative_families cf on cf.tenant_id=cr.tenant_id and cf.id=cr.creative_family_id
  join public.sponsor_creative_sets cs on cs.tenant_id=cf.tenant_id and cs.id=cf.creative_set_id and cs.campaign_id=c.id
  join public.sponsor_positions p on p.tenant_id=device_record.tenant_id and p.id=(e->>'positionId')::uuid
  where (e->>'happenedAt')::timestamptz between now()-interval '30 days' and now()+interval '10 minutes'
    and (e->>'playedMs')::integer between 0 and 3600000
    and exists (
      select 1 from jsonb_array_elements(pr.plan_json->'placements') placement
      cross join jsonb_array_elements(placement->'creatives') creative
      where (placement->>'campaignId')::uuid=c.id
        and (placement->>'positionId')::uuid=p.id
        and (creative->>'creativeId')::uuid=cr.id
    )
  on conflict (event_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.ensure_sponsor_positions_v1(uuid)',
    'public.create_sponsor_v1(uuid,text,text,text)',
    'public.create_sponsor_campaign_v1(uuid,uuid,text,timestamptz,timestamptz,numeric)',
    'public.register_sponsor_media_v1(uuid,uuid,uuid)',
    'public.add_sponsor_creative_v1(uuid,uuid,uuid,text,text,numeric)',
    'public.place_sponsor_campaign_v1(uuid,uuid,uuid,text)',
    'public.submit_sponsor_campaign_v1(uuid,uuid)',
    'public.approve_sponsor_campaign_v1(uuid,uuid,boolean)',
    'public.publish_sponsor_plan_v1(uuid,uuid[],integer)',
    'public.record_sponsor_play_events_v1(text,jsonb)'
  ] loop execute 'revoke all on function ' || signature || ' from public, anon, authenticated'; end loop;
end $$;

grant execute on function public.ensure_sponsor_positions_v1(uuid) to authenticated;
grant execute on function public.create_sponsor_v1(uuid,text,text,text) to authenticated;
grant execute on function public.create_sponsor_campaign_v1(uuid,uuid,text,timestamptz,timestamptz,numeric) to authenticated;
grant execute on function public.register_sponsor_media_v1(uuid,uuid,uuid) to authenticated;
grant execute on function public.add_sponsor_creative_v1(uuid,uuid,uuid,text,text,numeric) to authenticated;
grant execute on function public.place_sponsor_campaign_v1(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.submit_sponsor_campaign_v1(uuid,uuid) to authenticated;
grant execute on function public.approve_sponsor_campaign_v1(uuid,uuid,boolean) to authenticated;
grant execute on function public.publish_sponsor_plan_v1(uuid,uuid[],integer) to authenticated;
grant execute on function public.record_sponsor_play_events_v1(text,jsonb) to anon, authenticated;
