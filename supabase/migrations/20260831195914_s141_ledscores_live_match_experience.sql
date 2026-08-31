-- S141 — LED Scores Live Match Experience.
--
-- The existing immutable Goal Alert remains compatible. This migration adds
-- an immutable live-bound playlist slide, append-only match overlays, late
-- scorer enrichment and a bounded last-known match state. Players still never
-- connect to LED Scores directly and the realtime schema is not modified.

alter table public.dynamic_data_sources
  drop constraint dynamic_data_sources_kind_check;
alter table public.dynamic_data_sources
  add constraint dynamic_data_sources_kind_check check (
    kind in ('ledscores','manual_products','twelve_excel','rss','sportlink')
  );

alter table public.dynamic_templates
  drop constraint dynamic_templates_slide_type_check;
alter table public.dynamic_templates
  add constraint dynamic_templates_slide_type_check check (
    slide_type in (
      'menu','price_list','news','ledscores_live_match',
      'sport_program','sport_results','sport_standing',
      'sport_period_standing','sport_match_of_the_day','sport_next_match',
      'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
      'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
      'sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals'
    )
  );

alter table public.dynamic_slides
  drop constraint dynamic_slides_slide_type_check;
alter table public.dynamic_slides
  add constraint dynamic_slides_slide_type_check check (
    slide_type in (
      'menu','price_list','news','ledscores_live_match',
      'sport_program','sport_results','sport_standing',
      'sport_period_standing','sport_match_of_the_day','sport_next_match',
      'sport_cancellations','sport_dressing_rooms','sport_officials','sport_team',
      'sport_sponsor','sport_activities','sport_trainings','sport_volunteers',
      'sport_birthdays','sport_visitor_arrivals','sport_referee_arrivals'
    )
  );

create or replace function private.ledscores_data_source_name_v1(
  p_connection_name text,
  p_connection_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select left('LED Scores · ' || btrim(p_connection_name),81)
    || ' · ' || p_connection_id::text
$$;
revoke all on function private.ledscores_data_source_name_v1(text,uuid)
  from public, anon, authenticated;

alter table public.ledscores_connections
  add column data_source_id uuid;

insert into public.dynamic_data_sources(
  id, tenant_id, name, kind, status, provider_status, config_json,
  last_successful_sync_at, created_by, updated_by
)
select
  gen_random_uuid(), connection.tenant_id,
  private.ledscores_data_source_name_v1(connection.name,connection.id),
  'ledscores',
  case connection.status when 'active' then 'active' else 'paused' end,
  case connection.health_status
    when 'connected' then 'ready'
    when 'error' then 'error'
    else 'not_connected'
  end,
  jsonb_build_object(
    'schemaVersion', 1,
    'ledscoresConnectionId', connection.id,
    'clubSlug', connection.club_slug
  ),
  connection.last_source_message_at, connection.created_by, connection.updated_by
from public.ledscores_connections connection;

update public.ledscores_connections connection
set data_source_id = source.id
from public.dynamic_data_sources source
where source.tenant_id = connection.tenant_id
  and source.kind = 'ledscores'
  and source.config_json ->> 'ledscoresConnectionId' = connection.id::text;

alter table public.ledscores_connections
  alter column data_source_id set not null,
  add constraint ledscores_connections_data_source_fk
    foreign key (tenant_id, data_source_id)
    references public.dynamic_data_sources(tenant_id, id) on delete restrict,
  add constraint ledscores_connections_data_source_uq
    unique (tenant_id, data_source_id);

create or replace function private.ledscores_connection_data_source_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_id uuid;
  source_record public.dynamic_data_sources%rowtype;
begin
  if tg_op = 'INSERT' and new.data_source_id is null then
    insert into public.dynamic_data_sources(
      tenant_id, name, kind, status, provider_status, config_json,
      created_by, updated_by
    ) values (
      new.tenant_id,
      private.ledscores_data_source_name_v1(new.name,new.id),
      'ledscores',
      case new.status when 'active' then 'active' else 'paused' end,
      'not_connected',
      jsonb_build_object(
        'schemaVersion', 1,
        'ledscoresConnectionId', new.id,
        'clubSlug', new.club_slug
      ),
      new.created_by, new.updated_by
    ) returning id into source_id;
    new.data_source_id := source_id;
    return new;
  end if;

  select * into source_record
  from public.dynamic_data_sources source
  where source.tenant_id = new.tenant_id
    and source.id = new.data_source_id
    and source.kind = 'ledscores';
  if not found then
    raise exception 'LED Scores data source mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.ledscores_connection_data_source_v1()
  from public, anon, authenticated;

create trigger ledscores_connection_data_source_before_write
before insert or update of data_source_id
on public.ledscores_connections
for each row execute function private.ledscores_connection_data_source_v1();

create or replace function private.sync_ledscores_data_source_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dynamic_data_sources source set
    name = private.ledscores_data_source_name_v1(new.name,new.id),
    status = case new.status when 'active' then 'active' else 'paused' end,
    provider_status = case new.health_status
      when 'connected' then 'ready'
      when 'error' then 'error'
      else 'not_connected'
    end,
    config_json = jsonb_build_object(
      'schemaVersion', 1,
      'ledscoresConnectionId', new.id,
      'clubSlug', new.club_slug
    ),
    last_successful_sync_at = new.last_source_message_at,
    last_attempt_at = coalesce(new.last_connected_at, source.last_attempt_at),
    last_error_code = case when new.health_status = 'error'
      then 'ledscores_unavailable' else null end,
    last_error_detail = case when new.health_status = 'error'
      then left(new.health_detail, 500) else null end,
    revision = source.revision + 1,
    updated_by = new.updated_by,
    updated_at = now()
  where source.tenant_id = new.tenant_id and source.id = new.data_source_id;
  return null;
end;
$$;
revoke all on function private.sync_ledscores_data_source_v1()
  from public, anon, authenticated;

create trigger ledscores_connection_sync_data_source
after update of name, club_slug, status, health_status, last_source_message_at
on public.ledscores_connections
for each row execute function private.sync_ledscores_data_source_v1();

create table public.ledscores_player_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  provider_team_key text not null check (length(provider_team_key) between 1 and 200),
  provider_player_key text not null check (length(provider_player_key) between 1 and 200),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  shirt_number integer check (shirt_number is null or shirt_number between 0 and 999),
  active boolean not null default true,
  photo_provider_asset_version_id uuid
    references public.provider_asset_versions(id) on delete restrict,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, connection_id, provider_team_key, provider_player_key),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete cascade,
  check (last_seen_at >= first_seen_at)
);
create index ledscores_player_identities_connection_idx
  on public.ledscores_player_identities(
    tenant_id, connection_id, provider_team_key, active, display_name
  );

create table public.ledscores_live_match_states (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  match_identity text not null check (length(match_identity) between 1 and 300),
  state_sequence bigint not null default 1 check (state_sequence > 0),
  source_update_id text check (source_update_id is null or length(source_update_id) <= 200),
  status text not null check (
    status in ('pre_match','live','paused','half_time','finished','unknown')
  ),
  state_json jsonb not null check (
    jsonb_typeof(state_json) = 'object'
    and state_json ->> 'schemaVersion' = '1'
    and pg_column_size(state_json) <= 65536
  ),
  source_updated_at timestamptz not null,
  source_observed_at timestamptz not null,
  stale_after_seconds integer not null default 10
    check (stale_after_seconds between 3 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, connection_id),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete cascade
);
create index ledscores_live_match_states_freshness_idx
  on public.ledscores_live_match_states(tenant_id, source_observed_at desc);

create table public.ledscores_match_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  canonical_key text not null check (canonical_key ~ '^[a-f0-9]{64}$'),
  match_identity text not null check (length(match_identity) between 1 and 300),
  event_type text not null check (
    event_type in (
      'lineup','lineup_clear','match_start','half_time','match_end',
      'period','status','score_correction'
    )
  ),
  source_update_id text check (source_update_id is null or length(source_update_id) <= 200),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536
  ),
  source_observed_at timestamptz not null,
  detected_at timestamptz not null default clock_timestamp(),
  dispatch_status text not null default 'no_targets'
    check (dispatch_status in ('dispatched','no_targets','suppressed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, connection_id, canonical_key),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete restrict
);
create index ledscores_match_events_connection_idx
  on public.ledscores_match_events(tenant_id, connection_id, detected_at desc);

create table public.ledscores_goal_event_enrichments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  connection_id uuid not null,
  goal_event_id uuid not null,
  revision integer not null check (revision > 0),
  source_update_id text check (source_update_id is null or length(source_update_id) <= 200),
  provider_player_key text check (
    provider_player_key is null or length(provider_player_key) between 1 and 200
  ),
  player_identity_id uuid,
  player_name text check (player_name is null or length(btrim(player_name)) <= 160),
  shirt_number integer check (shirt_number is null or shirt_number between 0 and 999),
  photo_provider_asset_version_id uuid
    references public.provider_asset_versions(id) on delete restrict,
  resolution text not null check (
    resolution in ('resolved','unmapped','ambiguous','late','removed')
  ),
  source_observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, goal_event_id, revision),
  foreign key (tenant_id, connection_id)
    references public.ledscores_connections(tenant_id, id) on delete restrict,
  constraint ledscores_goal_event_enrichments_goal_event_fk
    foreign key (tenant_id, goal_event_id)
    references public.ledscores_goal_events(tenant_id, id) on delete cascade,
  foreign key (tenant_id, player_identity_id)
    references public.ledscores_player_identities(tenant_id, id) on delete restrict
);

alter table public.ledscores_player_deliveries
  add column match_event_id uuid,
  add column sequence integer not null default 0 check (sequence between 0 and 20),
  add constraint ledscores_player_deliveries_match_event_fk
    foreign key (tenant_id, match_event_id)
    references public.ledscores_match_events(tenant_id, id) on delete restrict;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.ledscores_player_deliveries'::regclass
      and constraint_row.contype = 'c'
      and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%message_kind%'
  loop
    execute format(
      'alter table public.ledscores_player_deliveries drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.ledscores_player_deliveries
  add constraint ledscores_player_deliveries_message_kind_v2_check check (
    message_kind in (
      'goal','goal_enrichment','match_overlay','configuration'
    )
  ),
  add constraint ledscores_player_deliveries_binding_v2_check check (
    (message_kind = 'goal'
      and goal_event_id is not null
      and match_event_id is null
      and alert_version_id is not null)
    or (message_kind = 'goal_enrichment'
      and goal_event_id is not null
      and match_event_id is null
      and alert_version_id is not null)
    or (message_kind = 'match_overlay'
      and goal_event_id is null
      and match_event_id is not null
      and alert_version_id is not null)
    or (message_kind = 'configuration'
      and goal_event_id is null
      and match_event_id is null)
  );

create unique index ledscores_player_deliveries_enrichment_screen_uq
  on public.ledscores_player_deliveries(
    tenant_id, goal_event_id, screen_id, sequence
  ) where message_kind = 'goal_enrichment';
create unique index ledscores_player_deliveries_overlay_screen_uq
  on public.ledscores_player_deliveries(tenant_id, match_event_id, screen_id)
  where message_kind = 'match_overlay';

alter table public.ledscores_player_identities enable row level security;
alter table public.ledscores_player_identities force row level security;
alter table public.ledscores_live_match_states enable row level security;
alter table public.ledscores_live_match_states force row level security;
alter table public.ledscores_match_events enable row level security;
alter table public.ledscores_match_events force row level security;
alter table public.ledscores_goal_event_enrichments enable row level security;
alter table public.ledscores_goal_event_enrichments force row level security;

create policy ledscores_player_identities_read
on public.ledscores_player_identities for select to authenticated
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);
create policy ledscores_live_match_states_read
on public.ledscores_live_match_states for select to authenticated
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
);
create policy ledscores_match_events_read
on public.ledscores_match_events for select to authenticated
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);
create policy ledscores_goal_event_enrichments_read
on public.ledscores_goal_event_enrichments for select to authenticated
using (
  private.ledscores_feature_enabled_for_actor(tenant_id)
  and (
    private.has_tenant_capability(tenant_id, 'tenant.data_source.read')
    or private.has_tenant_capability(tenant_id, 'tenant.audit.read')
  )
);

grant select on
  public.ledscores_player_identities,
  public.ledscores_live_match_states,
  public.ledscores_match_events,
  public.ledscores_goal_event_enrichments
to authenticated;
grant select, insert, update, delete on
  public.ledscores_player_identities,
  public.ledscores_live_match_states,
  public.ledscores_match_events,
  public.ledscores_goal_event_enrichments
to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ledscores_live_match_states'
  ) then
    alter publication supabase_realtime
      add table public.ledscores_live_match_states;
  end if;
end;
$$;

-- Extend the existing authoring command without duplicating its established
-- capability, target and media validation. Direct RPC callers receive the
-- same nested live-match contract as the Control form.
alter function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) rename to save_ledscores_goal_alert_before_s141_live_match_v1;
revoke all on function public.save_ledscores_goal_alert_before_s141_live_match_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) from public, anon, authenticated, service_role;

-- S132 used the non-existent variant label `player`. Patch the two installed
-- function bodies in-place to the canonical player-ready variant without
-- rewriting their otherwise locked authorization and immutable publish flow.
do $$
declare
  save_definition text;
  publish_definition text;
begin
  select pg_get_functiondef(
    'public.save_ledscores_goal_alert_before_s141_live_match_v1(uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer)'::regprocedure
  ) into save_definition;
  select pg_get_functiondef(
    'public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid)'::regprocedure
  ) into publish_definition;
  if position('variant.variant_type::text = ''player''' in save_definition) = 0
    or position('player_variant.variant_type::text = ''player''' in publish_definition) = 0 then
    raise exception 'S132 player variant guard no longer matches the expected canon';
  end if;
  execute replace(
    save_definition,
    'variant.variant_type::text = ''player''',
    'variant.variant_type::text = ''player_1080p'''
  );
  execute replace(
    publish_definition,
    'player_variant.variant_type::text = ''player''',
    'player_variant.variant_type::text = ''player_1080p'''
  );
end;
$$;

create or replace function private.validate_ledscores_live_match_config_v1(
  p_config jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  triggers jsonb := coalesce(p_config -> 'overlayTriggers','{}'::jsonb);
  lineup_behavior jsonb := coalesce(p_config -> 'lineupBehavior','{}'::jsonb);
  designs jsonb := coalesce(p_config -> 'overlayDesigns','{}'::jsonb);
  design_key text;
  design jsonb;
  expected_template text;
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    return;
  end if;

  if (p_config ? 'overlayTriggers') and jsonb_typeof(triggers) <> 'object' then
    raise exception 'invalid LED Scores overlay triggers' using errcode = '23514';
  end if;
  if exists (
      select 1 from jsonb_each(triggers) trigger_entry(key,value)
      where trigger_entry.key <> all(array[
        'lineup','start','halfTime','end'
      ]::text[])
        or jsonb_typeof(trigger_entry.value) <> 'boolean'
    ) then
    raise exception 'invalid LED Scores overlay triggers' using errcode = '23514';
  end if;

  if (p_config ? 'lineupBehavior') and jsonb_typeof(lineup_behavior) <> 'object' then
    raise exception 'invalid LED Scores lineup behavior' using errcode = '23514';
  end if;
  if exists (
      select 1 from jsonb_each(lineup_behavior) behavior_entry(key,value)
      where behavior_entry.key <> all(array[
        'selectedOnly','activeFallback','includeOpponent','pageDurationMs'
      ]::text[])
        or (
          behavior_entry.key <> 'pageDurationMs'
          and jsonb_typeof(behavior_entry.value) <> 'boolean'
        )
    ) then
    raise exception 'invalid LED Scores lineup behavior' using errcode = '23514';
  end if;
  if lineup_behavior ? 'pageDurationMs' then
    if jsonb_typeof(lineup_behavior -> 'pageDurationMs') <> 'number'
      or lineup_behavior ->> 'pageDurationMs' !~ '^[0-9]+$'
      or (lineup_behavior ->> 'pageDurationMs')::integer not between 4000 and 10000 then
      raise exception 'invalid LED Scores lineup page duration' using errcode = '23514';
    end if;
  end if;
  if coalesce((lineup_behavior ->> 'includeOpponent')::boolean,false)
    and not coalesce((triggers ->> 'lineup')::boolean,false) then
    raise exception 'opponent roster requires lineup overlay' using errcode = '23514';
  end if;

  if (p_config ? 'overlayDesigns') and jsonb_typeof(designs) <> 'object' then
    raise exception 'invalid LED Scores overlay designs' using errcode = '23514';
  end if;
  if exists (
      select 1 from jsonb_object_keys(designs) design_name(key)
      where design_name.key <> all(array[
        'lineupHome','lineupAway','matchStart','halfTime','matchEnd'
      ]::text[])
    ) then
    raise exception 'invalid LED Scores overlay designs' using errcode = '23514';
  end if;

  foreach design_key in array array[
    'lineupHome','lineupAway','matchStart','halfTime','matchEnd'
  ]::text[]
  loop
    design := designs -> design_key;
    if design is null then continue; end if;
    expected_template := case design_key
      when 'lineupHome' then 'team-grid'
      when 'lineupAway' then 'team-grid'
      when 'matchStart' then 'matchday-impact'
      when 'halfTime' then 'score-focus'
      else 'final-score'
    end;
    if jsonb_typeof(design) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(design) design_field(key)
        where design_field.key <> all(array[
          'template','headline','secondaryText','palette','animation',
          'typography','logoPosition','logoScale','showClock',
          'showPreviousScore','showScorer','durationMs'
        ]::text[])
      )
      or design ->> 'template' is distinct from expected_template
      or length(btrim(coalesce(design ->> 'headline',''))) not between 1 and 80
      or length(coalesce(design ->> 'secondaryText','')) > 160
      or coalesce(design ->> 'palette','') not in (
        'electric-orange','ink-black','signal-red','white'
      )
      or coalesce(design ->> 'animation','') not in (
        'impact','pulse','slide','none'
      )
      or (
        design ? 'typography'
        and coalesce(design ->> 'typography','') not in ('display','body')
      )
      or (
        design ? 'logoPosition'
        and coalesce(design ->> 'logoPosition','') not in ('left','center')
      )
      or (
        design ? 'logoScale'
        and coalesce(design ->> 'logoScale','') not in ('small','medium','large')
      )
      or exists (
        select 1
        from unnest(array['showClock','showPreviousScore','showScorer']) field_name
        where design ? field_name
          and jsonb_typeof(design -> field_name) <> 'boolean'
      ) then
      raise exception 'invalid LED Scores overlay design' using errcode = '23514';
    end if;
    if design ? 'durationMs' then
      if jsonb_typeof(design -> 'durationMs') <> 'number'
        or design ->> 'durationMs' !~ '^[0-9]+$'
        or (design ->> 'durationMs')::integer not between 2000 and 30000 then
        raise exception 'invalid LED Scores overlay duration' using errcode = '23514';
      end if;
    end if;
  end loop;

  if coalesce((triggers ->> 'lineup')::boolean,false)
      and (
        jsonb_typeof(designs -> 'lineupHome') <> 'object'
        or jsonb_typeof(designs -> 'lineupAway') <> 'object'
      )
    or coalesce((triggers ->> 'start')::boolean,false)
      and jsonb_typeof(designs -> 'matchStart') <> 'object'
    or coalesce((triggers ->> 'halfTime')::boolean,false)
      and jsonb_typeof(designs -> 'halfTime') <> 'object'
    or coalesce((triggers ->> 'end')::boolean,false)
      and jsonb_typeof(designs -> 'matchEnd') <> 'object' then
    raise exception 'enabled LED Scores overlay requires a design' using errcode = '23514';
  end if;
end;
$$;
revoke all on function private.validate_ledscores_live_match_config_v1(jsonb)
  from public, anon, authenticated;

create or replace function public.save_ledscores_goal_alert_v1(
  p_tenant_id uuid,
  p_alert_id uuid,
  p_connection_id uuid,
  p_name text,
  p_priority integer,
  p_duration_ms integer,
  p_underlay_policy text,
  p_config jsonb,
  p_target_group_ids uuid[],
  p_asset_ids uuid[],
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  logo_media_asset_id uuid;
  normalized_config jsonb := p_config;
begin
  perform private.require_ledscores_capability(
    p_tenant_id,'tenant.dynamic_slide.write'
  );
  perform private.validate_ledscores_live_match_config_v1(p_config);
  if jsonb_typeof(p_config -> 'ownTeamKeys') = 'array' then
    normalized_config := jsonb_set(
      normalized_config,
      '{ownTeamKeys}',
      coalesce((
        select jsonb_agg(team_key order by team_key)
        from (
          select distinct lower(btrim(value)) as team_key
          from jsonb_array_elements_text(p_config -> 'ownTeamKeys') configured(value)
        ) normalized_team_keys
      ),'[]'::jsonb),
      true
    );
  end if;
  if nullif(p_config ->> 'logoMediaAssetId','') is not null then
    begin
      logo_media_asset_id := (p_config ->> 'logoMediaAssetId')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid LED Scores logo asset' using errcode = '23514';
    end;
    if not exists (
      select 1
      from public.media_assets asset
      where asset.tenant_id = p_tenant_id
        and asset.id = logo_media_asset_id
        and asset.kind::text = 'image'
        and asset.status::text = 'ready'
        and asset.deleted_at is null
        and asset.checksum_sha256 is not null
    ) then
      raise exception 'LED Scores logo must be a ready image' using errcode = '23514';
    end if;
  end if;
  return public.save_ledscores_goal_alert_before_s141_live_match_v1(
    p_tenant_id,p_alert_id,p_connection_id,p_name,p_priority,p_duration_ms,
    p_underlay_policy,normalized_config,p_target_group_ids,p_asset_ids,
    p_expected_revision
  );
end;
$$;
revoke all on function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) from public, anon;
grant execute on function public.save_ledscores_goal_alert_v1(
  uuid,uuid,uuid,text,integer,integer,text,jsonb,uuid[],uuid[],integer
) to authenticated, service_role;

alter function public.dispatch_ledscores_goal_v1(
  uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,
  timestamptz,text,uuid,text,text
) rename to dispatch_ledscores_goal_before_s141_live_match_v1;
revoke all on function public.dispatch_ledscores_goal_before_s141_live_match_v1(
  uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,
  timestamptz,text,uuid,text,text
) from public, anon, authenticated, service_role;

create or replace function public.dispatch_ledscores_goal_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_canonical_key text,
  p_source_update_id text,
  p_match_identity text,
  p_home_team text,
  p_away_team text,
  p_previous_home_score integer,
  p_previous_away_score integer,
  p_home_score integer,
  p_away_score integer,
  p_scoring_side text,
  p_scorer_name text,
  p_match_clock text,
  p_source_observed_at timestamptz,
  p_event_kind text default 'live',
  p_alert_id uuid default null,
  p_scoreboard_side text default null,
  p_scoring_team_key text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.dispatch_ledscores_goal_before_s141_live_match_v1(
    p_connection_id,p_worker_id,p_canonical_key,p_source_update_id,
    p_match_identity,p_home_team,p_away_team,p_previous_home_score,
    p_previous_away_score,p_home_score,p_away_score,p_scoring_side,
    p_scorer_name,p_match_clock,p_source_observed_at,p_event_kind,p_alert_id,
    p_scoreboard_side,lower(nullif(btrim(p_scoring_team_key),''))
  )
$$;
revoke all on function public.dispatch_ledscores_goal_v1(
  uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,
  timestamptz,text,uuid,text,text
) from public, anon;
grant execute on function public.dispatch_ledscores_goal_v1(
  uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,
  timestamptz,text,uuid,text,text
) to authenticated, service_role;

-- Locked fallback templates. The HTML/React Player renderer is authoritative;
-- these SVG-safe templates produce the immutable offline poster.
do $$
declare
  shape record;
  template_id uuid;
  version_id uuid;
  markup text;
  css text;
  manifest jsonb;
  sample jsonb;
  checksum text;
begin
  for shape in
    select * from (values
      ('landscape', 1920, 1080),
      ('portrait', 1080, 1920)
    ) as value(orientation, canvas_width, canvas_height)
  loop
    if exists (
      select 1 from public.dynamic_templates
      where slug = 'ledscores-live-match-' || shape.orientation
    ) then
      continue;
    end if;

    template_id := gen_random_uuid();
    version_id := gen_random_uuid();
    markup := case shape.orientation
      when 'landscape' then
        '<rect class="canvas" width="1920" height="1080"/>' ||
        '<rect class="accent" x="0" y="0" width="1920" height="18"/>' ||
        '<text class="status" x="960" y="132" text-anchor="middle">{{liveMatch.state.statusLabel}}</text>' ||
        '<text class="team home" x="500" y="400" text-anchor="middle">{{liveMatch.state.home.name}}</text>' ||
        '<text class="team away" x="1420" y="400" text-anchor="middle">{{liveMatch.state.away.name}}</text>' ||
        '<text class="score" x="960" y="620" text-anchor="middle">{{liveMatch.state.home.score}} – {{liveMatch.state.away.score}}</text>' ||
        '<text class="clock" x="960" y="790" text-anchor="middle">{{liveMatch.state.clock.label}}</text>' ||
        '<text class="freshness" x="960" y="970" text-anchor="middle">LAATST BEKENDE WEDSTRIJDINFORMATIE</text>'
      else
        '<rect class="canvas" width="1080" height="1920"/>' ||
        '<rect class="accent" x="0" y="0" width="1080" height="18"/>' ||
        '<text class="status" x="540" y="190" text-anchor="middle">{{liveMatch.state.statusLabel}}</text>' ||
        '<text class="team" x="540" y="500" text-anchor="middle">{{liveMatch.state.home.name}}</text>' ||
        '<text class="score" x="540" y="900" text-anchor="middle">{{liveMatch.state.home.score}} – {{liveMatch.state.away.score}}</text>' ||
        '<text class="team" x="540" y="1120" text-anchor="middle">{{liveMatch.state.away.name}}</text>' ||
        '<text class="clock" x="540" y="1400" text-anchor="middle">{{liveMatch.state.clock.label}}</text>' ||
        '<text class="freshness" x="540" y="1760" text-anchor="middle">LAATST BEKENDE WEDSTRIJDINFORMATIE</text>'
    end;
    css :=
      '.canvas{fill:#f4efe6}.accent{fill:#ff5c20}.status{fill:#ff5c20;font:900 30px Arial;letter-spacing:5px}' ||
      '.team{fill:#11110f;font:900 62px Arial}.score{fill:#11110f;font:900 176px Arial;font-variant-numeric:tabular-nums}' ||
      '.clock{fill:#11110f;font:800 68px Arial;font-variant-numeric:tabular-nums}' ||
      '.freshness{fill:#625f57;font:700 19px Arial;letter-spacing:3px}';
    manifest := jsonb_build_object(
      'schemaVersion', 1,
      'engine', 'veyocast-safe-template-v1',
      'slideType', 'ledscores_live_match',
      'canvas', jsonb_build_object(
        'width', shape.canvas_width,
        'height', shape.canvas_height
      ),
      'maxCollectionItems', 10,
      'allowedFields', jsonb_build_array(
        jsonb_build_object('path','liveMatch.state.statusLabel','type','string','required',true),
        jsonb_build_object('path','liveMatch.state.home.name','type','string','required',true),
        jsonb_build_object('path','liveMatch.state.home.score','type','number','required',true),
        jsonb_build_object('path','liveMatch.state.away.name','type','string','required',true),
        jsonb_build_object('path','liveMatch.state.away.score','type','number','required',true),
        jsonb_build_object('path','liveMatch.state.clock.label','type','string','required',true)
      )
    );
    sample := jsonb_build_object(
      'type', 'ledscores_live_match',
      'liveMatch', jsonb_build_object(
        'connectionId', gen_random_uuid(),
        'configuration', jsonb_build_object(
          'template','match_center','showClock',true,'showTimeline',true,
          'timelineLimit',5,'outsideMatchBehavior','last_known',
          'staleBehavior','freeze','accentMode','club'
        ),
        'state', jsonb_build_object(
          'schemaVersion',1,'stateRevision',1,'matchKey','preview',
          'status','live','statusLabel','TWEEDE HELFT',
          'home',jsonb_build_object('id','home','name','Duindorp SV','score',2),
          'away',jsonb_build_object('id','away','name','Bezoekers','score',1),
          'periodLabel','2e helft',
          'clock',jsonb_build_object(
            'anchorSeconds',3812,'anchorAt',now(),'running',false,
            'direction','up','label','63:32'
          ),
          'timeline','[]'::jsonb,'sourceUpdatedAt',now(),'staleAfter',10
        )
      )
    );
    checksum := encode(
      extensions.digest(
        pg_catalog.convert_to(markup || css || manifest::text || sample::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

    insert into public.dynamic_templates(
      id, slug, name, description, category, slide_type, orientation,
      status, current_published_version_id
    ) values (
      template_id,
      'ledscores-live-match-' || shape.orientation,
      'Live wedstrijdcentrum · ' || case shape.orientation
        when 'landscape' then 'liggend' else 'staand' end,
      'Locked VeyoCast live wedstrijdcentrum met een immutable offlineposter.',
      'sports','ledscores_live_match',shape.orientation,'published',null
    );
    insert into public.dynamic_template_versions(
      id, template_id, version, status, markup, css, manifest_json,
      sample_data_json, source_checksum_sha256, published_at
    ) values (
      version_id,template_id,1,'published',markup,css,manifest,sample,checksum,now()
    );
    update public.dynamic_templates
    set current_published_version_id = version_id
    where id = template_id;
  end loop;
end;
$$;

alter function private.build_dynamic_snapshot_data(public.dynamic_slides)
  rename to build_dynamic_snapshot_data_before_s141_live_match;

create or replace function private.build_dynamic_snapshot_data(
  p_slide public.dynamic_slides
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
  state_record public.ledscores_live_match_states%rowtype;
  config jsonb := coalesce(p_slide.configuration_json -> 'liveMatch', '{}'::jsonb);
  state jsonb;
begin
  if p_slide.slide_type <> 'ledscores_live_match' then
    return private.build_dynamic_snapshot_data_before_s141_live_match(p_slide);
  end if;

  select connection.* into connection_record
  from public.ledscores_connections connection
  where connection.tenant_id = p_slide.tenant_id
    and connection.data_source_id = p_slide.data_source_id
    and connection.status <> 'paused';
  if not found then
    raise exception 'active LED Scores source required' using errcode = '23514';
  end if;

  select current_state.* into state_record
  from public.ledscores_live_match_states current_state
  where current_state.tenant_id = connection_record.tenant_id
    and current_state.connection_id = connection_record.id;

  state := coalesce(
    state_record.state_json,
    jsonb_build_object(
      'schemaVersion',1,'stateRevision',0,
      'matchKey','waiting:' || connection_record.id::text,
      'status','unknown','statusLabel','WACHTEN OP WEDSTRIJD',
      'home',jsonb_build_object('id','home','name','Thuisteam','score',0),
      'away',jsonb_build_object('id','away','name','Uitteam','score',0),
      'periodLabel','',
      'clock',jsonb_build_object(
        'anchorSeconds',0,'anchorAt',now(),'running',false,
        'direction','up','label','0:00'
      ),
      'timeline','[]'::jsonb,
      'sourceUpdatedAt',coalesce(connection_record.last_source_message_at,now()),
      'staleAfter',10
    )
  );

  return jsonb_build_object(
    'type','ledscores_live_match',
    'liveMatch',jsonb_build_object(
      'schemaVersion',1,
      'connectionId',connection_record.id,
      'connectionName',connection_record.name,
      'configuration',jsonb_build_object(
        'template',coalesce(config ->> 'template','match_center'),
        'showClock',coalesce((config ->> 'showClock')::boolean,true),
        'showTimeline',coalesce((config ->> 'showTimeline')::boolean,true),
        'timelineLimit',least(greatest(coalesce((config ->> 'timelineLimit')::integer,5),0),10),
        'outsideMatchBehavior',coalesce(config ->> 'outsideMatchBehavior','last_known'),
        'staleBehavior','freeze',
        'accentMode',coalesce(config ->> 'accentMode','club')
      ),
      'state',state
    )
  );
end;
$$;
revoke all on function private.build_dynamic_snapshot_data(public.dynamic_slides)
  from public, anon, authenticated;
revoke all on function private.build_dynamic_snapshot_data_before_s141_live_match(
  public.dynamic_slides
) from public, anon, authenticated;

create or replace function public.create_ledscores_live_match_slide_v1(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_name text,
  p_orientation text,
  p_configuration jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
  template_version_id uuid;
  normalized jsonb;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  slide_id uuid;
begin
  perform private.require_ledscores_capability(
    p_tenant_id,'tenant.dynamic_slide.write'
  );
  perform private.require_active_tenant_command(p_tenant_id);
  if p_idempotency_key is null
    or length(btrim(coalesce(p_name,''))) not between 2 and 120
    or p_orientation not in ('landscape','portrait')
    or jsonb_typeof(coalesce(p_configuration,'{}'::jsonb)) <> 'object' then
    raise exception 'invalid LED Scores live slide' using errcode = '22023';
  end if;

  select * into connection_record
  from public.ledscores_connections connection
  where connection.tenant_id = p_tenant_id
    and connection.id = p_connection_id
    and connection.status = 'active';
  if not found then
    raise exception 'active LED Scores connection not found' using errcode = 'P0002';
  end if;

  normalized := coalesce(p_configuration -> 'liveMatch', p_configuration, '{}'::jsonb);
  normalized := jsonb_build_object(
    'template',case normalized ->> 'template'
      when 'scoreboard' then 'scoreboard' else 'match_center' end,
    'showClock',coalesce((normalized ->> 'showClock')::boolean,true),
    'showTimeline',coalesce((normalized ->> 'showTimeline')::boolean,true),
    'timelineLimit',least(greatest(coalesce((normalized ->> 'timelineLimit')::integer,5),0),10),
    'outsideMatchBehavior',case normalized ->> 'outsideMatchBehavior'
      when 'skip' then 'skip' else 'last_known' end,
    'staleBehavior','freeze',
    'accentMode',case normalized ->> 'accentMode'
      when 'neutral' then 'neutral'
      when 'contrast' then 'contrast'
      else 'club' end
  );
  request_json := jsonb_build_object(
    'connectionId',p_connection_id,'name',btrim(p_name),
    'orientation',p_orientation,'configuration',normalized
  );
  replay := private.begin_publisher_command(
    p_tenant_id,'ledscores.live_match_slide.create',p_idempotency_key,request_json
  );
  if replay is not null then return replay; end if;

  select version.id into template_version_id
  from public.dynamic_templates template
  join public.dynamic_template_versions version
    on version.template_id = template.id
    and version.id = template.current_published_version_id
    and version.status = 'published'
  where template.slug = 'ledscores-live-match-' || p_orientation
    and template.status = 'published';
  if template_version_id is null then
    raise exception 'LED Scores live template unavailable' using errcode = 'P0002';
  end if;

  outcome := public.create_dynamic_slide_v1(
    p_tenant_id,btrim(p_name),template_version_id,
    connection_record.data_source_id,'latest',
    jsonb_build_object('liveMatch',normalized)
  );
  slide_id := (outcome ->> 'slideId')::uuid;
  outcome := outcome || jsonb_build_object(
    'outcome','created','connectionId',p_connection_id,
    'orientation',p_orientation
  );
  return private.complete_publisher_command(
    p_tenant_id,'ledscores.live_match_slide.create',p_idempotency_key,
    request_json,'dynamic_slides',slide_id,outcome,
    'ledscores.live_match_slide.created'
  );
end;
$$;
revoke all on function public.create_ledscores_live_match_slide_v1(
  uuid,uuid,text,text,jsonb,uuid
) from public, anon;
grant execute on function public.create_ledscores_live_match_slide_v1(
  uuid,uuid,text,text,jsonb,uuid
) to authenticated, service_role;

create or replace function private.require_ledscores_service_role_v1()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('role', true), 'none'),
    ''
  );
begin
  if caller_role not in ('service_role','postgres') then
    raise exception 'service role required' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_ledscores_service_role_v1()
  from public, anon, authenticated;
grant execute on function private.require_ledscores_service_role_v1()
  to service_role;

create or replace function private.require_ledscores_worker_lease_v1(
  p_connection_id uuid,
  p_worker_id text
)
returns public.ledscores_connections
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
begin
  perform private.require_ledscores_service_role_v1();
  select * into connection_record
  from public.ledscores_connections connection
  where connection.id = p_connection_id
    and connection.status = 'active'
    and connection.lease_owner = p_worker_id
    and connection.lease_expires_at > clock_timestamp() - interval '5 seconds';
  if not found
    or not private.ledscores_feature_enabled(connection_record.tenant_id) then
    raise exception 'active LED Scores lease required' using errcode = '42501';
  end if;
  return connection_record;
end;
$$;
revoke all on function private.require_ledscores_worker_lease_v1(uuid,text)
  from public, anon, authenticated;
grant execute on function private.require_ledscores_worker_lease_v1(uuid,text)
  to service_role;

create or replace function public.sync_ledscores_players_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_players jsonb,
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
  player jsonb;
  player_count integer := 0;
  accepted_players jsonb := '[]'::jsonb;
  photo_version_id uuid;
  photo_url text;
  include_opponent boolean := false;
begin
  if jsonb_typeof(coalesce(p_players,'[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_players,'[]'::jsonb)) > 100
    or p_source_observed_at < clock_timestamp() - interval '10 minutes'
    or p_source_observed_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'invalid LED Scores player snapshot' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.ledscores_goal_alerts alert
    join public.ledscores_goal_alert_versions version
      on version.tenant_id = alert.tenant_id
      and version.id = alert.current_published_version_id
    where alert.tenant_id = connection_record.tenant_id
      and alert.connection_id = p_connection_id
      and alert.status = 'published'
      and coalesce(
        (version.config_snapshot #>>
          '{lineupBehavior,includeOpponent}')::boolean,
        false
      )
  ) into include_opponent;

  -- A privacy opt-out is also a retention boundary. Redact historical player
  -- details first, then remove identities outside the explicitly allowed
  -- own/opponent roster set. Team/score audit evidence remains intact.
  update public.ledscores_goal_event_enrichments enrichment
  set
    provider_player_key = null,
    player_identity_id = null,
    player_name = null,
    shirt_number = null,
    photo_provider_asset_version_id = null,
    resolution = 'removed'
  from public.ledscores_goal_events goal
  where enrichment.tenant_id = connection_record.tenant_id
    and enrichment.connection_id = p_connection_id
    and goal.tenant_id = enrichment.tenant_id
    and goal.id = enrichment.goal_event_id
    and (
      enrichment.provider_player_key is not null
      or enrichment.player_identity_id is not null
      or enrichment.player_name is not null
      or enrichment.shirt_number is not null
      or enrichment.photo_provider_asset_version_id is not null
      or enrichment.resolution <> 'removed'
    )
    and not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = goal.tenant_id
        and mapping.connection_id = goal.connection_id
        and lower(mapping.provider_team_key) = lower(goal.scoring_team_key)
        and (
          mapping.scoring_side = 'own'
          or (include_opponent and mapping.scoring_side = 'opponent')
        )
    );

  update public.ledscores_goal_events goal
  set scorer_name = null
  where goal.tenant_id = connection_record.tenant_id
    and goal.connection_id = p_connection_id
    and goal.scorer_name is not null
    and not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = goal.tenant_id
        and mapping.connection_id = goal.connection_id
        and lower(mapping.provider_team_key) = lower(goal.scoring_team_key)
        and (
          mapping.scoring_side = 'own'
          or (include_opponent and mapping.scoring_side = 'opponent')
        )
    );

  update public.ledscores_player_deliveries delivery
  set payload = case delivery.message_kind
    when 'goal_enrichment' then
      (delivery.payload - 'player') || jsonb_build_object('redacted',true)
    else delivery.payload - 'scorerName'
  end
  from public.ledscores_goal_events goal
  where delivery.tenant_id = connection_record.tenant_id
    and delivery.goal_event_id = goal.id
    and goal.tenant_id = delivery.tenant_id
    and goal.connection_id = p_connection_id
    and delivery.message_kind in ('goal','goal_enrichment')
    and (
      (delivery.message_kind = 'goal' and delivery.payload ? 'scorerName')
      or (delivery.message_kind = 'goal_enrichment' and delivery.payload ? 'player')
    )
    and not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = goal.tenant_id
        and mapping.connection_id = goal.connection_id
        and lower(mapping.provider_team_key) = lower(goal.scoring_team_key)
        and (
          mapping.scoring_side = 'own'
          or (include_opponent and mapping.scoring_side = 'opponent')
        )
    );

  update public.ledscores_match_events match_event
  set payload = match_event.payload
    - 'selectedPlayers' - 'activePlayers' - 'lineup'
    || jsonb_build_object('redacted',true)
  where match_event.tenant_id = connection_record.tenant_id
    and match_event.connection_id = p_connection_id
    and match_event.event_type = 'lineup'
    and (
      match_event.payload ? 'selectedPlayers'
      or match_event.payload ? 'activePlayers'
      or match_event.payload ? 'lineup'
      or coalesce((match_event.payload ->> 'redacted')::boolean,false) = false
    )
    and not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = match_event.tenant_id
        and mapping.connection_id = match_event.connection_id
        and lower(mapping.provider_team_key) = lower(coalesce(
          match_event.payload ->> 'teamKey',''
        ))
        and (
          mapping.scoring_side = 'own'
          or (include_opponent and mapping.scoring_side = 'opponent')
        )
    );

  update public.ledscores_player_deliveries delivery
  set payload = jsonb_set(
    delivery.payload - 'selectedPlayers' - 'activePlayers',
    '{lineup}','[]'::jsonb,true
  ) || jsonb_build_object('redacted',true)
  from public.ledscores_match_events match_event
  where delivery.tenant_id = connection_record.tenant_id
    and delivery.match_event_id = match_event.id
    and match_event.tenant_id = delivery.tenant_id
    and match_event.connection_id = p_connection_id
    and match_event.event_type = 'lineup'
    and (
      jsonb_array_length(coalesce(delivery.payload -> 'lineup','[]'::jsonb)) > 0
      or delivery.payload ? 'selectedPlayers'
      or delivery.payload ? 'activePlayers'
      or coalesce((delivery.payload ->> 'redacted')::boolean,false) = false
    )
    and not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = match_event.tenant_id
        and mapping.connection_id = match_event.connection_id
        and lower(mapping.provider_team_key) = lower(coalesce(
          match_event.payload ->> 'teamKey',''
        ))
        and (
          mapping.scoring_side = 'own'
          or (include_opponent and mapping.scoring_side = 'opponent')
        )
    );

  update public.ledscores_live_match_states live_state
  set state_json = jsonb_set(
    live_state.state_json,
    '{timeline}',
    coalesce((
      select jsonb_agg(
        case when exists (
          select 1
          from public.ledscores_team_mappings mapping
          where mapping.tenant_id = live_state.tenant_id
            and mapping.connection_id = live_state.connection_id
            and lower(mapping.provider_team_key) = lower(case timeline_item ->> 'side'
              when 'away' then live_state.state_json ->> 'awayTeamKey'
              else live_state.state_json ->> 'homeTeamKey'
            end)
            and (
              mapping.scoring_side = 'own'
              or (include_opponent and mapping.scoring_side = 'opponent')
            )
        ) then timeline_item
        else (timeline_item - 'playerName') || jsonb_build_object(
          'label','Doelpunt','playerName',null
        ) end
        order by timeline_order
      )
      from jsonb_array_elements(live_state.state_json -> 'timeline')
        with ordinality as timeline_items(timeline_item,timeline_order)
    ),'[]'::jsonb),
    true
  )
  where live_state.tenant_id = connection_record.tenant_id
    and live_state.connection_id = p_connection_id
    and exists (
      select 1
      from jsonb_array_elements(live_state.state_json -> 'timeline')
        as current_timeline(timeline_item)
      where current_timeline.timeline_item ->> 'playerName' is not null
        and not exists (
          select 1
          from public.ledscores_team_mappings mapping
          where mapping.tenant_id = live_state.tenant_id
            and mapping.connection_id = live_state.connection_id
            and lower(mapping.provider_team_key) = lower(case
              current_timeline.timeline_item ->> 'side'
              when 'away' then live_state.state_json ->> 'awayTeamKey'
              else live_state.state_json ->> 'homeTeamKey'
            end)
            and (
              mapping.scoring_side = 'own'
              or (include_opponent and mapping.scoring_side = 'opponent')
            )
        )
    );

  delete from public.ledscores_player_identities identity
  where identity.tenant_id = connection_record.tenant_id
    and identity.connection_id = p_connection_id
    and not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = identity.tenant_id
        and mapping.connection_id = identity.connection_id
        and lower(mapping.provider_team_key) = lower(identity.provider_team_key)
        and (
          mapping.scoring_side = 'own'
          or (include_opponent and mapping.scoring_side = 'opponent')
        )
    );

  for player in select value from jsonb_array_elements(coalesce(p_players,'[]'::jsonb))
  loop
    if jsonb_typeof(player) <> 'object'
      or length(btrim(coalesce(player ->> 'teamKey',''))) not between 1 and 200
      or length(btrim(coalesce(player ->> 'playerKey',''))) not between 1 and 200
      or length(btrim(coalesce(player ->> 'name',''))) not between 1 and 160
      or coalesce((player ->> 'number')::integer,0) not between 0 and 999 then
      raise exception 'invalid LED Scores player identity' using errcode = '22023';
    end if;
    photo_url := nullif(player ->> 'photoSourceUrl','');
    if photo_url is not null
      and (length(photo_url) > 2048
        or photo_url !~ '^https://api[.]ledscores[.]score[.]tel/') then
      raise exception 'invalid LED Scores player photo source' using errcode = '22023';
    end if;
    photo_version_id := nullif(player ->> 'photoProviderAssetVersionId','')::uuid;
    if photo_version_id is not null and not exists (
      select 1 from public.provider_asset_versions version
      join public.provider_asset_cache cache on cache.id = version.cache_id
      where version.id = photo_version_id
        and cache.provider = 'ledscores'
        and cache.entity_type = 'player'
        and cache.asset_role = 'player_photo'
    ) then
      raise exception 'invalid LED Scores player photo asset' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.ledscores_team_mappings mapping
      where mapping.tenant_id = connection_record.tenant_id
        and mapping.connection_id = p_connection_id
        and lower(mapping.provider_team_key) = lower(btrim(player ->> 'teamKey'))
        and (
          mapping.scoring_side = 'own'
          or (
            mapping.scoring_side = 'opponent'
            and include_opponent
          )
        )
    ) then
      continue;
    end if;

    insert into public.ledscores_player_identities(
      tenant_id,connection_id,provider_team_key,provider_player_key,
      display_name,shirt_number,active,
      photo_provider_asset_version_id,first_seen_at,last_seen_at
    ) values (
      connection_record.tenant_id,p_connection_id,lower(btrim(player ->> 'teamKey')),
      btrim(player ->> 'playerKey'),btrim(player ->> 'name'),
      nullif(player ->> 'number','')::integer,
      coalesce((player ->> 'active')::boolean,true),photo_version_id,
      p_source_observed_at,p_source_observed_at
    ) on conflict (
      tenant_id,connection_id,provider_team_key,provider_player_key
    ) do update set
      display_name = excluded.display_name,
      shirt_number = excluded.shirt_number,
      active = excluded.active,
      photo_provider_asset_version_id = coalesce(
        excluded.photo_provider_asset_version_id,
        ledscores_player_identities.photo_provider_asset_version_id
      ),
      last_seen_at = greatest(
        ledscores_player_identities.last_seen_at,excluded.last_seen_at
      ),
      updated_at = now();
    player_count := player_count + 1;
    accepted_players := accepted_players || jsonb_build_array(
      jsonb_build_object(
        'teamKey',lower(btrim(player ->> 'teamKey')),
        'playerKey',btrim(player ->> 'playerKey')
      )
    );
  end loop;

  return jsonb_build_object(
    'outcome','synced','playerCount',player_count,
    'acceptedPlayers',accepted_players
  );
end;
$$;
revoke all on function public.sync_ledscores_players_v1(
  uuid,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.sync_ledscores_players_v1(
  uuid,text,jsonb,timestamptz
) to service_role;

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
  if source_updated_at > clock_timestamp() + interval '2 minutes'
    or source_updated_at < clock_timestamp() - interval '1 day' then
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
  where public.ledscores_live_match_states.match_identity
      is distinct from excluded.match_identity
    or (
      public.ledscores_live_match_states.source_update_id
        is distinct from excluded.source_update_id
      and public.ledscores_live_match_states.source_observed_at
        <= excluded.source_observed_at
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

create or replace function public.dispatch_ledscores_match_overlay_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_canonical_key text,
  p_event_type text,
  p_source_update_id text,
  p_payload jsonb,
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
  match_key text := btrim(coalesce(p_payload ->> 'matchKey',''));
  created_event_id uuid;
  existing_event_id uuid;
  delivery_count integer := 0;
  detected_time timestamptz := clock_timestamp();
  event_status text := 'no_targets';
begin
  if p_canonical_key !~ '^[a-f0-9]{64}$'
    or p_event_type not in (
      'lineup','lineup_clear','match_start','half_time','match_end'
    )
    or jsonb_typeof(coalesce(p_payload,'null'::jsonb)) <> 'object'
    or p_payload ->> 'schemaVersion' is distinct from '1'
    or length(match_key) not between 1 and 300
    or p_payload::text ~* 'https?://'
    or (
      p_event_type = 'lineup'
      and (
        coalesce(jsonb_typeof(p_payload -> 'selectedPlayers'),'missing') <> 'array'
        or coalesce(jsonb_typeof(p_payload -> 'activePlayers'),'missing') <> 'array'
        or jsonb_array_length(p_payload -> 'selectedPlayers') > 30
        or jsonb_array_length(p_payload -> 'activePlayers') > 30
        or exists (
          select 1
          from jsonb_array_elements(
            (p_payload -> 'selectedPlayers') || (p_payload -> 'activePlayers')
          ) as lineup_players(player)
          where jsonb_typeof(lineup_players.player) <> 'object'
            or exists (
              select 1
              from jsonb_object_keys(lineup_players.player) as player_keys(key)
              where player_keys.key <> all(array[
                'id','name','number','photoProviderAssetVersionId'
              ]::text[])
            )
        )
      )
    )
    or pg_column_size(p_payload) > 65536
    or p_source_observed_at < clock_timestamp() - interval '10 minutes'
    or p_source_observed_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'invalid LED Scores match overlay' using errcode = '22023';
  end if;

  insert into public.ledscores_match_events(
    tenant_id,connection_id,canonical_key,match_identity,event_type,
    source_update_id,payload,source_observed_at,detected_at,dispatch_status
  ) values (
    connection_record.tenant_id,p_connection_id,p_canonical_key,match_key,
    p_event_type,nullif(left(p_source_update_id,200),''),p_payload,
    p_source_observed_at,detected_time,'no_targets'
  ) on conflict (tenant_id,connection_id,canonical_key) do nothing
  returning id into created_event_id;
  if created_event_id is null then
    select event.id into existing_event_id
    from public.ledscores_match_events event
    where event.tenant_id = connection_record.tenant_id
      and event.connection_id = p_connection_id
      and event.canonical_key = p_canonical_key;
    return jsonb_build_object(
      'outcome','duplicate','eventId',existing_event_id,'deliveryCount',0
    );
  end if;

  with raw_candidates as (
    select
      membership.screen_id,
      version.id as alert_version_id,
      version.config_snapshot,
      version.priority,
      version.underlay_policy,
      version.published_at,
      coalesce((
        select jsonb_agg(
          own_logo_mapping.provider_team_key
          order by own_logo_mapping.provider_team_key
        )
        from public.ledscores_team_mappings own_logo_mapping
        where own_logo_mapping.tenant_id = connection_record.tenant_id
          and own_logo_mapping.connection_id = p_connection_id
          and own_logo_mapping.scoring_side = 'own'
          and lower(own_logo_mapping.provider_team_key) in (
            lower(coalesce(
              p_payload ->> 'homeTeamKey',
              p_payload #>> '{home,teamKey}',
              ''
            )),
            lower(coalesce(
              p_payload ->> 'awayTeamKey',
              p_payload #>> '{away,teamKey}',
              ''
            ))
          )
          and (
            coalesce(
              jsonb_array_length(version.config_snapshot -> 'ownTeamKeys'),0
            ) = 0
            or exists (
              select 1
              from jsonb_array_elements_text(
                version.config_snapshot -> 'ownTeamKeys'
              ) configured_team(team_key)
              where lower(btrim(configured_team.team_key)) =
                lower(own_logo_mapping.provider_team_key)
            )
          )
      ),'[]'::jsonb) as own_team_keys,
      case p_event_type
        when 'lineup' then coalesce(
          (version.config_snapshot #>> array[
            'overlayDesigns',case p_payload ->> 'side'
              when 'away' then 'lineupAway' else 'lineupHome' end,
            'durationMs'
          ])::integer,
          12000
        )
        when 'lineup_clear' then 2000
        when 'match_start' then coalesce(
          (version.config_snapshot #>> '{overlayDesigns,matchStart,durationMs}')::integer,
          8000
        )
        when 'half_time' then coalesce(
          (version.config_snapshot #>> '{overlayDesigns,halfTime,durationMs}')::integer,
          8000
        )
        else coalesce(
          (version.config_snapshot #>> '{overlayDesigns,matchEnd,durationMs}')::integer,
          12000
        )
      end as base_duration_ms,
      least(greatest(coalesce(
        (version.config_snapshot #>>
          '{lineupBehavior,pageDurationMs}')::integer,
        6000
      ),4000),10000) as lineup_page_duration_ms,
      case
        when p_event_type <> 'lineup' then '[]'::jsonb
        when coalesce(
          (version.config_snapshot #>>
            '{lineupBehavior,selectedOnly}')::boolean,
          true
        )
          and jsonb_typeof(p_payload -> 'selectedPlayers') = 'array'
          and jsonb_array_length(p_payload -> 'selectedPlayers') > 0
          then p_payload -> 'selectedPlayers'
        when coalesce(
          (version.config_snapshot #>>
            '{lineupBehavior,selectedOnly}')::boolean,
          true
        )
          and coalesce(
            (version.config_snapshot #>>
              '{lineupBehavior,activeFallback}')::boolean,
            false
          )
          and jsonb_typeof(p_payload -> 'activePlayers') = 'array'
          then p_payload -> 'activePlayers'
        when not coalesce(
          (version.config_snapshot #>>
            '{lineupBehavior,selectedOnly}')::boolean,
          true
        )
          and jsonb_typeof(p_payload -> 'activePlayers') = 'array'
          then p_payload -> 'activePlayers'
        when jsonb_typeof(p_payload -> 'lineup') = 'array'
          then p_payload -> 'lineup'
        else '[]'::jsonb
      end as resolved_lineup,
      row_number() over (
        partition by membership.screen_id
        order by version.priority desc,version.published_at desc,version.id
      ) as target_rank
    from public.ledscores_goal_alerts alert
    join public.ledscores_goal_alert_versions version
      on version.tenant_id = alert.tenant_id
      and version.id = alert.current_published_version_id
    join public.ledscores_goal_alert_version_groups target
      on target.tenant_id = version.tenant_id
      and target.alert_version_id = version.id
    join public.screen_group_memberships membership
      on membership.tenant_id = target.tenant_id
      and membership.screen_group_id = target.screen_group_id
    join public.screens screen
      on screen.tenant_id = membership.tenant_id
      and screen.id = membership.screen_id
      and screen.status = 'active'
      and screen.deleted_at is null
    where alert.tenant_id = connection_record.tenant_id
      and alert.connection_id = p_connection_id
      and alert.status = 'published'
      and exists (
        select 1
        from public.ledscores_team_mappings own_mapping
        where own_mapping.tenant_id = connection_record.tenant_id
          and own_mapping.connection_id = p_connection_id
          and own_mapping.scoring_side = 'own'
          and lower(own_mapping.provider_team_key) in (
            lower(coalesce(
              p_payload ->> 'homeTeamKey',
              p_payload #>> '{home,teamKey}',
              ''
            )),
            lower(coalesce(
              p_payload ->> 'awayTeamKey',
              p_payload #>> '{away,teamKey}',
              ''
            ))
          )
          and (
            coalesce(
              jsonb_array_length(version.config_snapshot -> 'ownTeamKeys'),0
            ) = 0
            or exists (
              select 1
              from jsonb_array_elements_text(
                version.config_snapshot -> 'ownTeamKeys'
              ) configured_team(team_key)
              where lower(btrim(configured_team.team_key)) =
                lower(own_mapping.provider_team_key)
            )
          )
      )
      and (
        p_event_type not in ('lineup','lineup_clear')
        or exists (
          select 1
          from public.ledscores_team_mappings display_mapping
          where display_mapping.tenant_id = connection_record.tenant_id
            and display_mapping.connection_id = p_connection_id
            and lower(display_mapping.provider_team_key) = lower(coalesce(
              p_payload ->> 'teamKey',
              p_payload #>> '{team,teamKey}',
              p_payload ->> 'previousTeamKey',
              ''
            ))
            and (
              display_mapping.scoring_side = 'own'
              or (
                display_mapping.scoring_side = 'opponent'
                and coalesce(
                  (version.config_snapshot #>>
                    '{lineupBehavior,includeOpponent}')::boolean,
                  false
                )
              )
            )
        )
      )
      and (
        (version.config_snapshot ->> 'activeFrom') is null
        or (version.config_snapshot ->> 'activeFrom')::timestamptz
          <= detected_time
      )
      and (
        (version.config_snapshot ->> 'activeUntil') is null
        or (version.config_snapshot ->> 'activeUntil')::timestamptz
          > detected_time
      )
      and case p_event_type
        when 'lineup' then coalesce(
          (version.config_snapshot #>> '{overlayTriggers,lineup}')::boolean,false
        )
        when 'lineup_clear' then coalesce(
          (version.config_snapshot #>> '{overlayTriggers,lineup}')::boolean,false
        )
        when 'match_start' then coalesce(
          (version.config_snapshot #>> '{overlayTriggers,start}')::boolean,false
        )
        when 'half_time' then coalesce(
          (version.config_snapshot #>> '{overlayTriggers,halfTime}')::boolean,false
        )
        else coalesce(
          (version.config_snapshot #>> '{overlayTriggers,end}')::boolean,false
        )
      end
  ), candidates as (
    select
      raw_candidate.*,
      case when p_event_type = 'lineup' then greatest(
        raw_candidate.base_duration_ms,
        ceil(
          jsonb_array_length(raw_candidate.resolved_lineup)::numeric / 8
        )::integer * raw_candidate.lineup_page_duration_ms
      ) else raw_candidate.base_duration_ms end as event_duration_ms
    from raw_candidates raw_candidate
  ), inserted as (
    insert into public.ledscores_player_deliveries(
      tenant_id,screen_id,message_kind,match_event_id,alert_version_id,
      sequence,payload,execute_at,expires_at
    )
    select
      connection_record.tenant_id,candidate.screen_id,'match_overlay',
      created_event_id,candidate.alert_version_id,0,
      (p_payload - 'selectedPlayers' - 'activePlayers' - 'lineup')
      || jsonb_strip_nulls(jsonb_build_object(
        'deliveryKind','match_overlay',
        'overlayKind',p_event_type,
        'eventId',created_event_id,
        'homeTeamKey',nullif(lower(btrim(coalesce(
          p_payload ->> 'homeTeamKey',p_payload #>> '{home,teamKey}',''
        ))),''),
        'awayTeamKey',nullif(lower(btrim(coalesce(
          p_payload ->> 'awayTeamKey',p_payload #>> '{away,teamKey}',''
        ))),''),
        'teamKey',nullif(lower(btrim(coalesce(
          p_payload ->> 'teamKey',p_payload #>> '{team,teamKey}',
          p_payload ->> 'previousTeamKey',''
        ))),''),
        'lineup',candidate.resolved_lineup,
        'lineupPageDurationMs',candidate.lineup_page_duration_ms,
        'logoMediaAssetId',candidate.config_snapshot ->> 'logoMediaAssetId',
        'ownTeamKeys',candidate.own_team_keys,
        'durationMs',least(greatest(candidate.event_duration_ms,2000),30000),
        'underlayPolicy',candidate.underlay_policy,
        'design',case p_event_type
          when 'lineup' then candidate.config_snapshot #> array[
            'overlayDesigns',case p_payload ->> 'side'
              when 'away' then 'lineupAway' else 'lineupHome' end
          ]
          when 'match_start' then candidate.config_snapshot #> '{overlayDesigns,matchStart}'
          when 'half_time' then candidate.config_snapshot #> '{overlayDesigns,halfTime}'
          when 'match_end' then candidate.config_snapshot #> '{overlayDesigns,matchEnd}'
          else '{}'::jsonb
        end
      )),
      detected_time + interval '250 milliseconds',
      detected_time
        + make_interval(secs => least(greatest(candidate.event_duration_ms,2000),30000)::double precision / 1000.0)
        + interval '3 seconds'
    from candidates candidate
    where candidate.target_rank = 1
      and (
        p_event_type <> 'lineup'
        or jsonb_array_length(candidate.resolved_lineup) > 0
      )
    on conflict (tenant_id,match_event_id,screen_id)
      where message_kind = 'match_overlay' do nothing
    returning id
  ) select count(*) into delivery_count from inserted;

  if delivery_count > 0 then event_status := 'dispatched'; end if;
  update public.ledscores_match_events
  set dispatch_status = event_status
  where tenant_id = connection_record.tenant_id and id = created_event_id;
  insert into public.ledscores_connector_events(
    tenant_id,connection_id,event_type,severity,detail
  ) values (
    connection_record.tenant_id,p_connection_id,'match_overlay_dispatched',
    case when delivery_count > 0 then 'info' else 'warning' end,
    jsonb_build_object(
      'eventId',created_event_id,'overlayKind',p_event_type,
      'deliveryCount',delivery_count,'dispatchStatus',event_status
    )
  );
  return jsonb_build_object(
    'outcome','created','eventId',created_event_id,
    'deliveryCount',delivery_count,'dispatchStatus',event_status
  );
end;
$$;
revoke all on function public.dispatch_ledscores_match_overlay_v1(
  uuid,text,text,text,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.dispatch_ledscores_match_overlay_v1(
  uuid,text,text,text,text,jsonb,timestamptz
) to service_role;

create or replace function public.enrich_ledscores_goal_v1(
  p_connection_id uuid,
  p_worker_id text,
  p_goal_canonical_key text,
  p_source_update_id text,
  p_provider_player_key text,
  p_player_name text,
  p_shirt_number integer,
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
  goal_record public.ledscores_goal_events%rowtype;
  player_record public.ledscores_player_identities%rowtype;
  next_revision integer;
  enrichment_id uuid;
  delivery_count integer := 0;
  observed_name text := nullif(left(btrim(coalesce(p_player_name,'')),160),'');
begin
  if p_goal_canonical_key !~ '^[a-f0-9]{64}$'
    or (p_provider_player_key is not null
      and length(p_provider_player_key) not between 1 and 200)
    or (observed_name is not null and length(observed_name) > 160)
    or (p_shirt_number is not null and p_shirt_number not between 0 and 999)
    or p_source_observed_at < clock_timestamp() - interval '10 minutes'
    or p_source_observed_at > clock_timestamp() + interval '2 minutes' then
    raise exception 'invalid LED Scores scorer enrichment' using errcode = '22023';
  end if;
  select * into goal_record
  from public.ledscores_goal_events goal
  where goal.tenant_id = connection_record.tenant_id
    and goal.connection_id = p_connection_id
    and goal.canonical_key = p_goal_canonical_key
  for update;
  if not found then
    return jsonb_build_object('outcome','goal_not_found','deliveryCount',0);
  end if;
  if exists (
    select 1 from public.ledscores_goal_event_enrichments enrichment
    where enrichment.tenant_id = connection_record.tenant_id
      and enrichment.goal_event_id = goal_record.id
      and enrichment.source_update_id is not distinct from nullif(left(p_source_update_id,200),'')
      and enrichment.provider_player_key is not distinct from nullif(p_provider_player_key,'')
  ) then
    return jsonb_build_object(
      'outcome','duplicate','goalEventId',goal_record.id,'deliveryCount',0
    );
  end if;

  select * into player_record
  from public.ledscores_player_identities player
  where player.tenant_id = connection_record.tenant_id
    and player.connection_id = p_connection_id
    and lower(player.provider_team_key) = lower(goal_record.scoring_team_key)
    and player.provider_player_key = p_provider_player_key
  order by player.last_seen_at desc
  limit 1;
  select coalesce(max(revision),0)+1 into next_revision
  from public.ledscores_goal_event_enrichments
  where tenant_id = connection_record.tenant_id and goal_event_id = goal_record.id;

  insert into public.ledscores_goal_event_enrichments(
    tenant_id,connection_id,goal_event_id,revision,source_update_id,
    provider_player_key,player_identity_id,player_name,shirt_number,
    photo_provider_asset_version_id,resolution,source_observed_at
  ) values (
    connection_record.tenant_id,p_connection_id,goal_record.id,next_revision,
    nullif(left(p_source_update_id,200),''),nullif(p_provider_player_key,''),
    player_record.id,coalesce(player_record.display_name,observed_name),
    coalesce(player_record.shirt_number,p_shirt_number),
    player_record.photo_provider_asset_version_id,
    case when player_record.id is null then 'unmapped' else 'resolved' end,
    p_source_observed_at
  ) returning id into enrichment_id;
  update public.ledscores_goal_events
  set scorer_name = coalesce(player_record.display_name,observed_name)
  where tenant_id = connection_record.tenant_id and id = goal_record.id;

  with inserted as (
    insert into public.ledscores_player_deliveries(
      tenant_id,screen_id,message_kind,goal_event_id,alert_version_id,
      sequence,payload,execute_at,expires_at
    )
    select
      original.tenant_id,original.screen_id,'goal_enrichment',goal_record.id,
      original.alert_version_id,next_revision,
      jsonb_build_object(
        'schemaVersion',1,'deliveryKind','goal_enrichment',
        'eventId',goal_record.id,'enrichmentId',enrichment_id,
        'sequence',next_revision,
        'player',jsonb_build_object(
          'providerPlayerId',nullif(p_provider_player_key,''),
          'name',coalesce(player_record.display_name,observed_name),
          'number',coalesce(player_record.shirt_number,p_shirt_number),
          'photoProviderAssetVersionId',player_record.photo_provider_asset_version_id
        ),
        'sourceObservedAt',p_source_observed_at
      ),
      clock_timestamp() + interval '100 milliseconds',
      clock_timestamp() + interval '60 seconds'
    from public.ledscores_player_deliveries original
    where original.tenant_id = connection_record.tenant_id
      and original.goal_event_id = goal_record.id
      and original.message_kind = 'goal'
    on conflict (tenant_id,goal_event_id,screen_id,sequence)
      where message_kind = 'goal_enrichment' do nothing
    returning id
  ) select count(*) into delivery_count from inserted;
  return jsonb_build_object(
    'outcome','enriched','goalEventId',goal_record.id,
    'enrichmentId',enrichment_id,'revision',next_revision,
    'deliveryCount',delivery_count
  );
end;
$$;
revoke all on function public.enrich_ledscores_goal_v1(
  uuid,text,text,text,text,text,integer,timestamptz
) from public, anon, authenticated;
grant execute on function public.enrich_ledscores_goal_v1(
  uuid,text,text,text,text,text,integer,timestamptz
) to service_role;

create or replace function public.get_ledscores_match_player_bootstrap_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  device_record public.player_devices%rowtype;
  selected_release_id uuid;
  bindings jsonb;
  pending_deliveries jsonb;
begin
  perform private.require_ledscores_service_role_v1();
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid player credential' using errcode = '22023';
  end if;
  select * into device_record
  from public.player_devices device
  where device.token_hash = p_token_hash and device.status = 'paired';
  if not found then return jsonb_build_object('authorized',false); end if;
  if not private.ledscores_feature_enabled(device_record.tenant_id) then
    return jsonb_build_object(
      'authorized',true,'enabled',false,
      'tenantId',device_record.tenant_id,'screenId',device_record.screen_id,
      'bindings','[]'::jsonb,'pendingDeliveries','[]'::jsonb
    );
  end if;
  selected_release_id := coalesce(
    device_record.active_release_id,device_record.desired_release_id
  );

  select coalesce(jsonb_agg(binding order by binding ->> 'connectionId'),'[]'::jsonb)
  into bindings
  from (
    select distinct on (connection.id)
      jsonb_build_object(
        'connectionId',connection.id,
        'dynamicSnapshotId',snapshot.id,
        'configuration',snapshot.snapshot_data_json #> '{liveMatch,configuration}',
        'stateSequence',coalesce(current_state.state_sequence,0),
        'state',coalesce(
          current_state.state_json,
          snapshot.snapshot_data_json #> '{liveMatch,state}'
        ),
        'sourceObservedAt',current_state.source_observed_at,
        'staleAfterSeconds',coalesce(current_state.stale_after_seconds,10)
      ) as binding
    from public.playlist_release_items item
    join public.dynamic_slide_snapshots snapshot
      on snapshot.tenant_id = item.tenant_id
      and snapshot.id = item.dynamic_snapshot_id
      and snapshot.snapshot_data_json ->> 'type' = 'ledscores_live_match'
    join public.ledscores_connections connection
      on connection.tenant_id = item.tenant_id
      and connection.id = nullif(
        snapshot.snapshot_data_json #>> '{liveMatch,connectionId}',''
      )::uuid
    left join public.ledscores_live_match_states current_state
      on current_state.tenant_id = connection.tenant_id
      and current_state.connection_id = connection.id
    where item.tenant_id = device_record.tenant_id
      and item.release_id = selected_release_id
    order by connection.id,item.sort_order
  ) active_bindings;

  select coalesce(jsonb_agg(delivery_payload order by execute_at),'[]'::jsonb)
  into pending_deliveries
  from (
    select delivery.execute_at,jsonb_build_object(
      'id',delivery.id,'screen_id',delivery.screen_id,
      'message_kind',delivery.message_kind,
      'alert_version_id',delivery.alert_version_id,
      'payload',delivery.payload,'execute_at',delivery.execute_at,
      'expires_at',delivery.expires_at
    ) as delivery_payload
    from public.ledscores_player_deliveries delivery
    where delivery.tenant_id = device_record.tenant_id
      and delivery.screen_id = device_record.screen_id
      and delivery.message_kind in ('goal_enrichment','match_overlay')
      and delivery.status in ('pending','received')
      and delivery.expires_at > clock_timestamp()
    order by delivery.execute_at desc
    limit 5
  ) pending;
  return jsonb_build_object(
    'authorized',true,'enabled',true,
    'tenantId',device_record.tenant_id,'screenId',device_record.screen_id,
    'bindings',bindings,'pendingDeliveries',pending_deliveries
  );
end;
$$;
revoke all on function public.get_ledscores_match_player_bootstrap_v1(text)
  from public, anon, authenticated;
grant execute on function public.get_ledscores_match_player_bootstrap_v1(text)
  to service_role;

-- Preserve the S132 retention contract while deleting S141 dependants in a
-- safe order. Goal enrichments follow their canonical goal by FK cascade.
create or replace function public.cleanup_ledscores_runtime_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_count integer;
  goal_count integer;
  match_event_count integer;
  connector_event_count integer;
  inactive_player_count integer;
begin
  perform private.require_ledscores_service_role_v1();
  delete from public.ledscores_player_deliveries
  where expires_at < clock_timestamp() - interval '7 days';
  get diagnostics delivery_count = row_count;
  delete from public.ledscores_goal_events
  where created_at < clock_timestamp() - interval '30 days';
  get diagnostics goal_count = row_count;
  delete from public.ledscores_match_events
  where created_at < clock_timestamp() - interval '30 days';
  get diagnostics match_event_count = row_count;
  delete from public.ledscores_connector_events
  where occurred_at < clock_timestamp() - interval '30 days';
  get diagnostics connector_event_count = row_count;
  delete from public.ledscores_player_identities player
  where not player.active
    and player.last_seen_at < clock_timestamp() - interval '90 days'
    and not exists (
      select 1
      from public.ledscores_goal_event_enrichments enrichment
      where enrichment.tenant_id = player.tenant_id
        and enrichment.player_identity_id = player.id
    );
  get diagnostics inactive_player_count = row_count;
  return jsonb_build_object(
    'deliveriesDeleted',delivery_count,
    'goalEventsDeleted',goal_count,
    'matchEventsDeleted',match_event_count,
    'connectorEventsDeleted',connector_event_count,
    'inactivePlayersDeleted',inactive_player_count
  );
end;
$$;
revoke all on function public.cleanup_ledscores_runtime_v1()
  from public, anon, authenticated;
grant execute on function public.cleanup_ledscores_runtime_v1()
  to service_role;
