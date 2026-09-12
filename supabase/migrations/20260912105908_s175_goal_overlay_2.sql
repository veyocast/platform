-- S175: extend the existing LED Scores identity, publication and targeting chain.
-- No historical release/configuration is rewritten.
alter table public.ledscores_player_identities
  add column manual_photo_media_asset_id uuid,
  add foreign key (tenant_id,manual_photo_media_asset_id) references public.media_assets(tenant_id,id);
create index ledscores_manual_player_photo_idx on public.ledscores_player_identities(tenant_id,manual_photo_media_asset_id);
alter table public.ledscores_connections
  add column provider_club_id text check (length(provider_club_id) between 1 and 120),
  add column provider_club_name text check (length(provider_club_name) between 1 and 160),
  add column sports_club_id uuid,
  add column catalog_synced_at timestamptz,
  add column catalog_observed_at timestamptz,
  add constraint ledscores_local_club_fk foreign key (tenant_id,sports_club_id)
    references public.sports_clubs(tenant_id,id),
  add unique (tenant_id,id,provider_club_id);
create index ledscores_local_club_idx on public.ledscores_connections(tenant_id,sports_club_id);
alter table public.ledscores_team_mappings
  add column active boolean not null default true,
  add column discovery_source text not null default 'manual' check (discovery_source in ('manual','catalog')),
  add column source_name text,
  add column category text check (length(category) <= 80),
  add column last_seen_at timestamptz,
  add column logo_provider_asset_version_id uuid references public.provider_asset_versions(id);
create index ledscores_mapping_logo_idx on public.ledscores_team_mappings(logo_provider_asset_version_id);
alter table public.ledscores_goal_alerts add column is_central_goal_overlay boolean not null default false;
create unique index ledscores_one_goal_overlay_per_tenant on public.ledscores_goal_alerts(tenant_id) where is_central_goal_overlay;

create table public.ledscores_goal_overlay_draft_teams (
  tenant_id uuid not null,
  alert_id uuid not null,
  connection_id uuid not null,
  provider_club_id text not null,
  provider_team_key text not null,
  primary key (tenant_id,alert_id,connection_id,provider_team_key),
  foreign key (tenant_id,alert_id) references public.ledscores_goal_alerts(tenant_id,id),
  foreign key (tenant_id,connection_id,provider_club_id) references public.ledscores_connections(tenant_id,id,provider_club_id),
  foreign key (tenant_id,connection_id,provider_team_key) references public.ledscores_team_mappings(tenant_id,connection_id,provider_team_key) deferrable initially deferred
);
create index ledscores_overlay_draft_connection_idx on public.ledscores_goal_overlay_draft_teams(tenant_id,connection_id,provider_team_key);
create table public.ledscores_goal_overlay_version_teams (
  tenant_id uuid not null,
  alert_version_id uuid not null,
  connection_id uuid not null,
  provider_club_id text not null,
  provider_team_key text not null,
  team_name text not null,
  selected boolean not null,
  logo_provider_asset_version_id uuid references public.provider_asset_versions(id),
  primary key (tenant_id,alert_version_id,connection_id,provider_team_key),
  foreign key (tenant_id,alert_version_id) references public.ledscores_goal_alert_versions(tenant_id,id),
  foreign key (tenant_id,connection_id,provider_club_id) references public.ledscores_connections(tenant_id,id,provider_club_id)
);
create index ledscores_overlay_version_team_idx on public.ledscores_goal_overlay_version_teams(tenant_id,connection_id,provider_team_key,alert_version_id) where selected;
create index ledscores_overlay_version_connection_idx on public.ledscores_goal_overlay_version_teams(tenant_id,connection_id,provider_club_id);
create index ledscores_overlay_version_logo_idx on public.ledscores_goal_overlay_version_teams(logo_provider_asset_version_id);
create trigger ledscores_overlay_version_teams_immutable before update or delete on public.ledscores_goal_overlay_version_teams
for each row execute function private.reject_ledscores_published_version_mutation();
alter table public.ledscores_goal_overlay_draft_teams enable row level security;
alter table public.ledscores_goal_overlay_version_teams enable row level security;
revoke all on public.ledscores_goal_overlay_draft_teams,public.ledscores_goal_overlay_version_teams from public,anon,authenticated;
grant select on public.ledscores_goal_overlay_draft_teams,public.ledscores_goal_overlay_version_teams to authenticated;
grant all on public.ledscores_goal_overlay_draft_teams,public.ledscores_goal_overlay_version_teams to service_role;
create policy goal_overlay_draft_teams_read on public.ledscores_goal_overlay_draft_teams for select to authenticated
using (private.ledscores_feature_enabled_for_actor(tenant_id) and private.has_tenant_capability(tenant_id,'tenant.dynamic_slide.read'));
create policy goal_overlay_version_teams_read on public.ledscores_goal_overlay_version_teams for select to authenticated
using (private.ledscores_feature_enabled_for_actor(tenant_id) and private.has_tenant_capability(tenant_id,'tenant.dynamic_slide.read'));

create function private.guard_ledscores_club_identity_v2() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.provider_club_id is not null and (new.club_slug is distinct from old.club_slug or new.provider_club_id is distinct from old.provider_club_id) then
    raise exception 'linked provider club identity is immutable; create a new connection' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function private.guard_ledscores_club_identity_v2() from public,anon,authenticated,service_role;
create trigger ledscores_club_identity before update on public.ledscores_connections for each row execute function private.guard_ledscores_club_identity_v2();

create function public.link_ledscores_club_v2(p_tenant_id uuid,p_connection_id uuid,p_sports_club_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_ledscores_capability(p_tenant_id,'tenant.data_source.manage'); current_revision integer;
begin
  select revision into current_revision from public.ledscores_connections where tenant_id=p_tenant_id and id=p_connection_id for update;
  if not found then raise exception 'connection unavailable' using errcode='P0002'; end if;
  if current_revision<>p_expected_revision then return jsonb_build_object('outcome','conflict'); end if;
  if p_sports_club_id is not null and not exists(select 1 from public.sports_clubs where tenant_id=p_tenant_id and id=p_sports_club_id and active) then
    raise exception 'club unavailable' using errcode='23514';
  end if;
  update public.ledscores_connections set sports_club_id=p_sports_club_id,revision=revision+1,updated_by=actor,updated_at=now() where tenant_id=p_tenant_id and id=p_connection_id;
  perform private.audit_event(p_tenant_id,'ledscores.club.linked','ledscores_connections',p_connection_id,'success',jsonb_build_object('sportsClubId',p_sports_club_id));
  return jsonb_build_object('outcome','saved');
end; $$;
revoke all on function public.link_ledscores_club_v2(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.link_ledscores_club_v2(uuid,uuid,uuid,integer) to authenticated;

create function public.sync_ledscores_club_catalog_v2(p_connection_id uuid,p_worker_id text,p_club_id text,p_club_slug text,p_club_name text,p_teams jsonb,p_observed_at timestamptz default clock_timestamp())
returns integer language plpgsql security definer set search_path = '' as $$
declare c public.ledscores_connections%rowtype; item jsonb; linked_team uuid; linked_category text; logo_id uuid;
begin
  perform private.require_ledscores_worker_lease_v1(p_connection_id,p_worker_id);
  select * into c from public.ledscores_connections where id=p_connection_id for update;
  if p_club_slug is distinct from c.club_slug or coalesce(length(p_club_id),0) not between 1 and 120
    or coalesce(length(btrim(p_club_name)),0) not between 1 and 160
    or (c.provider_club_id is not null and c.provider_club_id<>p_club_id)
    or coalesce(jsonb_typeof(p_teams),'')<>'array' or jsonb_array_length(p_teams)>1000
    or exists(select 1 from jsonb_array_elements(p_teams) t group by t->>'teamKey' having count(*)>1) then
    raise exception 'invalid club catalog identity' using errcode='23514';
  end if;
  if p_observed_at is null or p_observed_at>clock_timestamp()+interval '1 minute' then raise exception 'invalid catalog observation' using errcode='23514'; end if;
  if c.catalog_observed_at>p_observed_at then return 0; end if;
  update public.ledscores_connections set catalog_observed_at=p_observed_at,provider_club_id=p_club_id,provider_club_name=btrim(p_club_name),catalog_synced_at=clock_timestamp() where id=c.id;
  update public.ledscores_team_mappings set active=false where tenant_id=c.tenant_id and connection_id=c.id;
  for item in select value from jsonb_array_elements(p_teams) loop
    if coalesce(length(item->>'teamKey'),0) not between 1 and 120 or coalesce(length(btrim(item->>'teamName')),0) not between 1 and 160
      or coalesce(item->>'side','') not in ('own','opponent') or jsonb_typeof(item->'active') is distinct from 'boolean' then
      raise exception 'invalid catalog team' using errcode='23514';
    end if;
    linked_team:=null; linked_category:=null; logo_id:=nullif(item->>'logoProviderAssetVersionId','')::uuid;
    if c.sports_club_id is not null and nullif(item->>'sportlinkTeamCode','') is not null then
      select team.id,team.category into linked_team,linked_category from public.sports_teams team
      join public.sports_clubs club on club.tenant_id=team.tenant_id and club.source_connection_id=team.source_connection_id
      where club.tenant_id=c.tenant_id and club.id=c.sports_club_id and team.external_id=item->>'sportlinkTeamCode' and team.active;
    end if;
    if logo_id is not null and not exists(select 1 from public.provider_asset_versions v join public.provider_asset_cache cache on cache.id=v.cache_id
      where v.id=logo_id and cache.provider='ledscores' and cache.entity_type='team' and cache.asset_role='team_logo'
      and v.storage_path like 'tenants/'||c.tenant_id::text||'/assets/%') then raise exception 'invalid catalog logo' using errcode='23514'; end if;
    insert into public.ledscores_team_mappings(tenant_id,connection_id,provider_team_key,provider_team_name,source_name,scoring_side,active,discovery_source,category,sports_team_id,last_seen_at,logo_provider_asset_version_id)
    values(c.tenant_id,c.id,item->>'teamKey',btrim(item->>'teamName'),left(item->>'sourceName',160),item->>'side',(item->>'active')::boolean,'catalog',coalesce(linked_category,nullif(item->>'category','')),linked_team,clock_timestamp(),logo_id)
    on conflict(tenant_id,connection_id,provider_team_key) do update set provider_team_name=excluded.provider_team_name,source_name=excluded.source_name,
      scoring_side=excluded.scoring_side,active=excluded.active,discovery_source='catalog',category=coalesce(excluded.category,ledscores_team_mappings.category),
      sports_team_id=excluded.sports_team_id,last_seen_at=excluded.last_seen_at,
      logo_provider_asset_version_id=coalesce(excluded.logo_provider_asset_version_id,ledscores_team_mappings.logo_provider_asset_version_id);
  end loop;
  return jsonb_array_length(p_teams);
end; $$;
revoke all on function public.sync_ledscores_club_catalog_v2(uuid,text,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.sync_ledscores_club_catalog_v2(uuid,text,text,text,text,jsonb,timestamptz) to service_role;

create function private.validate_goal_overlay_v2(p_tenant_id uuid,p_config jsonb) returns void language plpgsql set search_path = '' as $$
declare key text; value text; media_id uuid;
begin
  if p_config is null or jsonb_typeof(p_config)<>'object' or pg_column_size(p_config)>16000
    or p_config->>'schemaVersion' is distinct from '2' or coalesce(p_config->>'themeMode','') not in ('auto','light','dark')
    or coalesce(p_config->>'font','') not in ('display','body') or coalesce(p_config->>'layout','') not in ('centered','player-focus')
    or coalesce(p_config->>'spacing','') not in ('compact','comfortable','generous')
    or coalesce(p_config->>'logoSize','') not in ('small','medium','large') or coalesce(p_config->>'photoSize','') not in ('small','medium','large')
    or coalesce(p_config->>'enterAnimation','') not in ('fade','rise','none') or coalesce(p_config->>'exitAnimation','') not in ('fade','none')
    or coalesce((p_config->>'overlayDurationMs')::integer,0) not between 2000 and 30000
    or coalesce((p_config->>'transitionDurationMs')::integer,-1) not between 0 and 1500 or coalesce((p_config->>'radius')::integer,-1) not between 0 and 64 then
    raise exception 'invalid goal overlay configuration' using errcode='23514';
  end if;
  foreach key in array array['showScorer','showPlayerPhoto','showShirtNumber','showMinute','showTeamNames','showTeamLogos','showCompetition','showMatchName','showRound','showVenue','shadow','introEnabled'] loop
    if jsonb_typeof(p_config->key) is distinct from 'boolean' then raise exception 'invalid goal content setting' using errcode='23514'; end if;
  end loop;
  foreach key in array array['headlineTemplate','subtitleTemplate','goalTextTemplate'] loop
    value:=p_config->>key;
    if value is null or length(value)>(case when key='headlineTemplate' then 80 else 160 end)
      or (key='headlineTemplate' and length(btrim(value))=0)
      or regexp_replace(value,'\{(team|scorer|home_team|away_team|home_score|away_score|minute)\}','','g') ~ '[{}<>[:cntrl:]]' then
      raise exception 'invalid goal template variable' using errcode='23514';
    end if;
  end loop;
  foreach key in array array['lightOuterColor','darkOuterColor','lightCardColor','darkCardColor','lightTextColor','darkTextColor','accentTextColor'] loop
    if p_config->>key is not null and p_config->>key !~* '^#[0-9a-f]{6}$' then raise exception 'invalid goal color' using errcode='23514'; end if;
  end loop;
  foreach key in array array['introLandscapeMediaId','introPortraitMediaId'] loop
    media_id:=nullif(p_config->>key,'')::uuid;
    if media_id is not null and not exists(select 1 from public.media_assets a join public.media_variants v on v.tenant_id=a.tenant_id and v.asset_id=a.id
      where a.tenant_id=p_tenant_id and a.id=media_id and a.kind::text='video' and a.source_kind='user' and a.status::text='ready' and a.deleted_at is null
      and v.variant_type::text='player_1080p' and v.mime_type='video/mp4' and v.checksum_sha256 is not null) then
      raise exception 'intro must be a ready tenant video' using errcode='23514';
    end if;
  end loop;
end; $$;
revoke all on function private.validate_goal_overlay_v2(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.save_ledscores_goal_overlay_v2(p_tenant_id uuid,p_alert_id uuid,p_expected_revision integer,p_config jsonb,p_teams jsonb,p_group_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved jsonb; saved_id uuid; primary_connection uuid; legacy_config jsonb; design jsonb; asset_ids uuid[]; central_id uuid;
begin
  perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');
  -- Serialize creation of the single central configuration within this tenant.
  perform 1 from public.tenants where id=p_tenant_id for update;
  select id into central_id from public.ledscores_goal_alerts where tenant_id=p_tenant_id and is_central_goal_overlay;
  if (central_id is not null and central_id is distinct from p_alert_id) or (p_alert_id is not null and central_id is distinct from p_alert_id) then
    raise exception 'central goal overlay identity mismatch' using errcode='23514';
  end if;
  perform private.validate_goal_overlay_v2(p_tenant_id,p_config);
  if coalesce(jsonb_typeof(p_teams),'')<>'array' or jsonb_array_length(p_teams) not between 1 and 250 then raise exception 'select teams' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_teams) choice left join public.ledscores_connections c on c.tenant_id=p_tenant_id and c.id=(choice->>'connectionId')::uuid and c.provider_club_id=choice->>'clubId' and c.status='active'
    left join public.ledscores_team_mappings m on m.tenant_id=c.tenant_id and m.connection_id=c.id and m.provider_team_key=choice->>'teamKey' and m.scoring_side='own' and m.active where m.id is null) then
    raise exception 'selected team does not belong to the verified club' using errcode='23514';
  end if;
  primary_connection:=(p_teams->0->>'connectionId')::uuid;
  design:=jsonb_build_object('headline',p_config->>'headlineTemplate','palette','ink-black','animation','none','showScorer',true,'showClock',true,'scorerFallback','','secondaryText','','typography','display','logoPosition','center','logoScale','medium','showPreviousScore',false);
  legacy_config:=jsonb_build_object('schemaVersion',1,'goalOverlay',p_config,'ownDesign',design,'opponentDesign',design,'unknownDesign',design,
    'triggerOwn',true,'triggerOpponent',false,'unknownPolicy','suppress','ownTeamKeys','[]'::jsonb,'ownSoundVolume',0,'opponentSoundVolume',0,'sponsorOnlyOwn',false,'activeFrom',null,'activeUntil',null);
  asset_ids:=array(select distinct value::uuid from unnest(array[p_config->>'introLandscapeMediaId',p_config->>'introPortraitMediaId']) value where value is not null);
  saved:=public.save_ledscores_goal_alert_v1(p_tenant_id,p_alert_id,primary_connection,'Goal Overlay',1000,(p_config->>'overlayDurationMs')::integer,'pause',legacy_config,p_group_ids,asset_ids,p_expected_revision);
  if saved->>'outcome'='conflict' then return saved; end if;
  saved_id:=(saved->>'alertId')::uuid;
  update public.ledscores_goal_alerts set is_central_goal_overlay=true where tenant_id=p_tenant_id and id=saved_id;
  delete from public.ledscores_goal_overlay_draft_teams where tenant_id=p_tenant_id and alert_id=saved_id;
  insert into public.ledscores_goal_overlay_draft_teams(tenant_id,alert_id,connection_id,provider_club_id,provider_team_key)
    select distinct p_tenant_id,saved_id,(choice->>'connectionId')::uuid,choice->>'clubId',choice->>'teamKey' from jsonb_array_elements(p_teams) choice;
  return saved;
end; $$;
revoke all on function public.save_ledscores_goal_overlay_v2(uuid,uuid,integer,jsonb,jsonb,uuid[]) from public,anon;
grant execute on function public.save_ledscores_goal_overlay_v2(uuid,uuid,integer,jsonb,jsonb,uuid[]) to authenticated;

-- Validate at publish and freeze the catalog and selected identities together.
alter function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid) rename to publish_ledscores_goal_alert_before_s175_v1;
revoke all on function public.publish_ledscores_goal_alert_before_s175_v1(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
create function public.publish_ledscores_goal_alert_v1(p_tenant_id uuid,p_alert_id uuid,p_expected_revision integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.ledscores_goal_alerts%rowtype; result jsonb; version_id uuid;
begin
  perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');
  select * into a from public.ledscores_goal_alerts where tenant_id=p_tenant_id and id=p_alert_id for update;
  if not found then raise exception 'alert unavailable' using errcode='P0002'; end if;
  if a.is_central_goal_overlay then
    perform private.validate_goal_overlay_v2(p_tenant_id,a.draft_config->'goalOverlay');
    if not exists(select 1 from public.ledscores_goal_overlay_draft_teams where tenant_id=p_tenant_id and alert_id=a.id) then raise exception 'select teams' using errcode='23514'; end if;
    if exists(select 1 from public.ledscores_goal_overlay_draft_teams d join public.ledscores_team_mappings m on m.tenant_id=d.tenant_id and m.connection_id=d.connection_id and m.provider_team_key=d.provider_team_key
      where d.tenant_id=p_tenant_id and d.alert_id=a.id and (not m.active or m.scoring_side<>'own')) then raise exception 'selected team inactive' using errcode='23514'; end if;
  end if;
  result:=public.publish_ledscores_goal_alert_before_s175_v1(p_tenant_id,p_alert_id,p_expected_revision,p_idempotency_key);
  if a.is_central_goal_overlay and result->>'outcome'<>'conflict' then
    select current_published_version_id into version_id from public.ledscores_goal_alerts where tenant_id=p_tenant_id and id=p_alert_id;
    insert into public.ledscores_goal_overlay_version_teams(tenant_id,alert_version_id,connection_id,provider_club_id,provider_team_key,team_name,selected,logo_provider_asset_version_id)
    select m.tenant_id,version_id,m.connection_id,c.provider_club_id,m.provider_team_key,m.provider_team_name,
      exists(select 1 from public.ledscores_goal_overlay_draft_teams d where d.tenant_id=m.tenant_id and d.alert_id=p_alert_id and d.connection_id=m.connection_id and d.provider_team_key=m.provider_team_key),m.logo_provider_asset_version_id
    from public.ledscores_team_mappings m join public.ledscores_connections c on c.tenant_id=m.tenant_id and c.id=m.connection_id
    where m.tenant_id=p_tenant_id and m.active and exists(select 1 from public.ledscores_goal_overlay_draft_teams d where d.tenant_id=m.tenant_id and d.alert_id=p_alert_id and d.connection_id=m.connection_id)
    on conflict do nothing;
  end if;
  return result;
end; $$;
revoke all on function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.publish_ledscores_goal_alert_v1(uuid,uuid,integer,uuid) to authenticated,service_role;

create or replace function private.dispatch_ledscores_goal_v2(
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
  p_scoring_team_key text default null,
  p_test_group_id uuid default null,
  p_test_scorer_id uuid default null,
  p_home_team_key text default null,
  p_away_team_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_record public.ledscores_connections%rowtype;
  created_event_id uuid;
  existing_event public.ledscores_goal_events%rowtype;
  delivery_count integer := 0;
  event_status text := 'no_targets';
  detected_time timestamptz := clock_timestamp();
  resolved_scoreboard_side text := coalesce(
    p_scoreboard_side,
    case when p_home_score > p_previous_home_score then 'home' else 'away' end
  );
  resolved_scoring_team_key text := coalesce(
    nullif(btrim(p_scoring_team_key), ''),
    case when p_home_score > p_previous_home_score then btrim(p_home_team) else btrim(p_away_team) end
  );
begin
  select * into connection_record
  from public.ledscores_connections connection
  where connection.id = p_connection_id;
  if not found or not private.ledscores_feature_enabled(connection_record.tenant_id) then
    raise exception 'active LED Scores connection not found' using errcode = 'P0002';
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    if p_event_kind <> 'live'
      or connection_record.lease_owner <> p_worker_id
      or connection_record.lease_expires_at <= clock_timestamp() - interval '5 seconds' then
      raise exception 'active LED Scores lease required' using errcode = '42501';
    end if;
  elsif p_event_kind = 'synthetic_test' then
    perform private.require_ledscores_capability(
      connection_record.tenant_id, 'tenant.dynamic_slide.write'
    );
    if not private.has_tenant_capability(
      connection_record.tenant_id, 'tenant.playlist.publish'
    ) then
      raise exception 'playlist publish capability required' using errcode = '42501';
    end if;
  else
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_canonical_key is null or p_match_identity is null or p_home_team is null or p_away_team is null or p_previous_home_score is null or p_previous_away_score is null or p_home_score is null or p_away_score is null or p_scoring_side is null or p_event_kind is null or p_source_observed_at is null
    or p_canonical_key !~ '^[a-f0-9]{64}$'
    or length(p_match_identity) not between 1 and 300
    or length(btrim(p_home_team)) not between 1 and 160
    or length(btrim(p_away_team)) not between 1 and 160
    or p_previous_home_score not between 0 and 999
    or p_previous_away_score not between 0 and 999
    or p_home_score not between 0 and 999
    or p_away_score not between 0 and 999
    or resolved_scoreboard_side not in ('home', 'away')
    or length(resolved_scoring_team_key) not between 1 and 200
    or p_scoring_side not in ('own', 'opponent', 'unknown')
    or p_source_observed_at > clock_timestamp() + interval '2 minutes'
    or p_source_observed_at < clock_timestamp() - interval '10 minutes'
    or p_event_kind not in ('live', 'synthetic_test') then
    raise exception 'invalid LED Scores goal event' using errcode = '23514';
  end if;
  if p_event_kind = 'synthetic_test' and exists (
    select 1 from public.ledscores_goal_events event
    where event.tenant_id = connection_record.tenant_id
      and event.event_kind = 'synthetic_test'
      and event.created_at > clock_timestamp() - interval '15 seconds'
  ) then
    raise exception 'synthetic LED Scores test rate limited' using errcode = 'P0004';
  end if;
  if p_event_kind = 'live' and p_scoring_side in ('own', 'opponent') and not exists (
    select 1 from public.ledscores_team_mappings mapping
    where mapping.tenant_id = connection_record.tenant_id
      and mapping.connection_id = p_connection_id
      and lower(mapping.provider_team_key) = lower(resolved_scoring_team_key)
      and mapping.scoring_side = p_scoring_side
      and mapping.active
  ) then
    raise exception 'LED Scores team classification mismatch' using errcode = '23514';
  end if;

  raise log '%',jsonb_build_object('event','goal_event_received','connectionId',p_connection_id,'teamId',resolved_scoring_team_key);
  event_status := case when p_scoring_side = 'unknown'
    then 'suppressed_unknown_side' else 'no_targets' end;
  insert into public.ledscores_goal_events(
    tenant_id, connection_id, canonical_key, source_update_id,
    match_identity, home_team, away_team, previous_home_score,
    previous_away_score, home_score, away_score, scoreboard_side,
    scoring_team_key, scoring_side,
    scorer_name, match_clock, source_observed_at, detected_at,
    event_kind, dispatch_status
  ) values (
    connection_record.tenant_id, p_connection_id, p_canonical_key,
    left(p_source_update_id, 200), left(p_match_identity, 300),
    btrim(p_home_team), btrim(p_away_team), p_previous_home_score,
    p_previous_away_score, p_home_score, p_away_score, resolved_scoreboard_side,
    resolved_scoring_team_key, p_scoring_side,
    nullif(left(btrim(p_scorer_name), 160), ''),
    nullif(left(btrim(p_match_clock), 40), ''), p_source_observed_at,
    detected_time, p_event_kind, event_status
  ) on conflict (tenant_id, connection_id, canonical_key) do nothing
  returning id into created_event_id;
  if created_event_id is null then
    raise log '%',jsonb_build_object('event','goal_event_duplicate','connectionId',p_connection_id);
    select * into existing_event
    from public.ledscores_goal_events event
    where event.tenant_id = connection_record.tenant_id
      and event.connection_id = p_connection_id
      and event.canonical_key = p_canonical_key;
    return jsonb_build_object(
      'outcome', 'duplicate', 'eventId', existing_event.id,
      'dispatchStatus', existing_event.dispatch_status, 'deliveryCount', 0
    );
  end if;

  if p_scoring_side in ('own', 'opponent', 'unknown') then
    with candidates as (
      select
        membership.screen_id,
        version.id as alert_version_id,
        version.config_snapshot,
        alert.is_central_goal_overlay,
        version.priority,
        version.duration_ms,
        version.underlay_policy,
        version.published_at,
        row_number() over (
          partition by membership.screen_id
          order by version.priority desc, version.published_at desc, version.id
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
        and (alert.connection_id = p_connection_id or (alert.is_central_goal_overlay and exists (
          select 1 from public.ledscores_goal_overlay_version_teams selected
          where selected.tenant_id=version.tenant_id and selected.alert_version_id=version.id
            and selected.connection_id=p_connection_id and selected.selected)))
        and (not exists(select 1 from public.ledscores_goal_alerts central where central.tenant_id=alert.tenant_id
          and central.is_central_goal_overlay and central.status in ('published','paused')) or alert.is_central_goal_overlay)
        and (not alert.is_central_goal_overlay or exists (
          select 1 from public.ledscores_goal_overlay_version_teams selected
          where selected.tenant_id=version.tenant_id and selected.alert_version_id=version.id and selected.connection_id=p_connection_id
            and selected.provider_team_key=resolved_scoring_team_key and selected.selected))
        and (p_test_group_id is null or (p_event_kind='synthetic_test' and target.screen_group_id=p_test_group_id))
        and alert.status = 'published'
        and (p_alert_id is null or alert.id = p_alert_id)
        and (
          (p_scoring_side = 'own'
            and coalesce((version.config_snapshot ->> 'triggerOwn')::boolean, true)
            and (
              coalesce(jsonb_array_length(version.config_snapshot -> 'ownTeamKeys'), 0) = 0
              or (version.config_snapshot -> 'ownTeamKeys') ? resolved_scoring_team_key
            ))
          or (p_scoring_side = 'opponent'
            and coalesce((version.config_snapshot ->> 'triggerOpponent')::boolean, true))
          or (p_scoring_side = 'unknown'
            and coalesce(version.config_snapshot ->> 'unknownPolicy', 'suppress') = 'generic')
        )
        and (
          (version.config_snapshot ->> 'activeFrom') is null
          or (version.config_snapshot ->> 'activeFrom')::timestamptz <= detected_time
        )
        and (
          (version.config_snapshot ->> 'activeUntil') is null
          or (version.config_snapshot ->> 'activeUntil')::timestamptz > detected_time
        )
    ), inserted as (
      insert into public.ledscores_player_deliveries(
        tenant_id, screen_id, message_kind, goal_event_id,
        alert_version_id, payload, execute_at, expires_at
      )
      select
        connection_record.tenant_id,
        candidate.screen_id,
        'goal',
        created_event_id,
        candidate.alert_version_id,
        jsonb_build_object(
          'schemaVersion', 1,
          'connectionId', p_connection_id,
          'matchName', left(btrim(p_home_team)||' — '||btrim(p_away_team),240),
          'competition', (select left(t.competition_name,160) from public.ledscores_team_mappings m join public.sports_teams t on t.tenant_id=m.tenant_id and t.id=m.sports_team_id where m.tenant_id=connection_record.tenant_id and m.connection_id=p_connection_id and m.provider_team_key=resolved_scoring_team_key and t.active),
          'goalOverlay', candidate.config_snapshot -> 'goalOverlay',
          'homeTeamKey', coalesce(p_home_team_key,case when resolved_scoreboard_side='home' then resolved_scoring_team_key else connection_record.baseline_json->>'homeTeamId' end),
          'awayTeamKey', coalesce(p_away_team_key,case when resolved_scoreboard_side='away' then resolved_scoring_team_key else connection_record.baseline_json->>'awayTeamId' end),
          'deliveryKind', 'goal',
          'eventId', created_event_id,
          'alertVersionId', candidate.alert_version_id,
          'canonicalKey', p_canonical_key,
          'eventKind', p_event_kind,
          'scoringSide', p_scoring_side,
          'scoreboardSide', resolved_scoreboard_side,
          'homeTeam', btrim(p_home_team),
          'awayTeam', btrim(p_away_team),
          'previousHomeScore', p_previous_home_score,
          'previousAwayScore', p_previous_away_score,
          'homeScore', p_home_score,
          'awayScore', p_away_score,
          'player', (select jsonb_build_object('providerPlayerId',p.provider_player_key,'name',p.display_name,'number',p.shirt_number,'photoProviderAssetVersionId',p.photo_provider_asset_version_id) from public.ledscores_player_identities p where p_event_kind='synthetic_test' and p.tenant_id=connection_record.tenant_id and p.id=p_test_scorer_id and p.connection_id=p_connection_id and p.provider_team_key=resolved_scoring_team_key),
          'scorerName', nullif(left(btrim(p_scorer_name), 160), ''),
          'matchClock', nullif(left(btrim(p_match_clock), 40), ''),
          'sourceObservedAt', p_source_observed_at,
          'detectedAt', detected_time,
          'durationMs', candidate.duration_ms,
          'underlayPolicy', candidate.underlay_policy,
          'logoMediaAssetId', case when p_scoring_side = 'unknown'
            then null else candidate.config_snapshot ->> 'logoMediaAssetId' end,
          'mediaAssetId', candidate.config_snapshot ->> case
            when p_scoring_side = 'own' then 'ownMediaAssetId'
            when p_scoring_side = 'opponent' then 'opponentMediaAssetId'
            else 'unknownMediaAssetId' end,
          'soundMediaAssetId', candidate.config_snapshot ->> case
            when p_scoring_side = 'own' then 'ownSoundMediaAssetId'
            when p_scoring_side = 'opponent' then 'opponentSoundMediaAssetId'
            else 'unknownSoundMediaAssetId' end,
          'soundVolume', coalesce((candidate.config_snapshot ->> case
            when p_scoring_side = 'own' then 'ownSoundVolume'
            else 'opponentSoundVolume' end)::integer, 70),
          'sponsorMediaAssetId', case
            when coalesce((candidate.config_snapshot ->> 'sponsorOnlyOwn')::boolean, false)
              and p_scoring_side <> 'own' then null
            else candidate.config_snapshot ->> 'sponsorMediaAssetId' end,
          'design', candidate.config_snapshot -> case
            when p_scoring_side = 'own' then 'ownDesign'
            when p_scoring_side = 'opponent' then 'opponentDesign'
            else 'unknownDesign' end
        ),
        detected_time + case when candidate.is_central_goal_overlay then interval '150 milliseconds' else interval '750 milliseconds' end,
        case when candidate.is_central_goal_overlay then detected_time + interval '120 seconds'
          else detected_time + make_interval(secs => candidate.duration_ms::double precision / 1000.0) + interval '2750 milliseconds' end
      from candidates candidate
      where candidate.target_rank = 1
      on conflict (tenant_id, goal_event_id, screen_id)
        where message_kind = 'goal' do nothing
      returning id
    )
    select count(*) into delivery_count from inserted;
    if delivery_count > 0 then event_status := 'dispatched'; end if;
    update public.ledscores_goal_events set dispatch_status = event_status
    where tenant_id = connection_record.tenant_id and id = created_event_id;
  end if;

  raise log '%',jsonb_build_object('event',case when delivery_count>0 then 'goal_event_dispatched' when exists(select 1 from public.ledscores_goal_alerts a where a.tenant_id=connection_record.tenant_id and a.is_central_goal_overlay and a.status='published' and not exists(select 1 from public.ledscores_goal_overlay_version_teams t where t.tenant_id=a.tenant_id and t.alert_version_id=a.current_published_version_id and t.connection_id=p_connection_id and t.provider_team_key=resolved_scoring_team_key and t.selected)) then 'goal_event_ignored_team_not_selected' else 'goal_event_no_targets' end,'eventId',created_event_id,'connectionId',p_connection_id,'deliveryCount',delivery_count);

  insert into public.ledscores_connector_events(
    tenant_id, connection_id, event_type, severity, detail
  ) values (
    connection_record.tenant_id, p_connection_id,
    case when p_event_kind = 'synthetic_test' then 'synthetic_goal_test' else 'goal_detected' end,
    case when event_status = 'dispatched' then 'info' else 'warning' end,
    jsonb_build_object(
      'eventId', created_event_id, 'dispatchStatus', event_status,
      'deliveryCount', delivery_count, 'scoringSide', p_scoring_side
    )
  );
  return jsonb_build_object(
    'outcome', 'created', 'eventId', created_event_id,
    'dispatchStatus', event_status, 'deliveryCount', delivery_count,
    'detectedAt', detected_time
  );
end;
$$;
revoke all on function private.dispatch_ledscores_goal_v2(uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,timestamptz,text,uuid,text,text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create or replace function public.dispatch_ledscores_goal_v1(
  p_connection_id uuid,p_worker_id text,p_canonical_key text,p_source_update_id text,p_match_identity text,p_home_team text,p_away_team text,
  p_previous_home_score integer,p_previous_away_score integer,p_home_score integer,p_away_score integer,p_scoring_side text,p_scorer_name text,p_match_clock text,
  p_source_observed_at timestamptz,p_event_kind text default 'live',p_alert_id uuid default null,p_scoreboard_side text default null,p_scoring_team_key text default null
) returns jsonb language sql security definer set search_path = '' as $$
  select private.dispatch_ledscores_goal_v2(p_connection_id,p_worker_id,p_canonical_key,p_source_update_id,p_match_identity,p_home_team,p_away_team,
    p_previous_home_score,p_previous_away_score,p_home_score,p_away_score,p_scoring_side,p_scorer_name,p_match_clock,p_source_observed_at,p_event_kind,p_alert_id,p_scoreboard_side,lower(nullif(btrim(p_scoring_team_key),'')))
$$;
revoke all on function public.dispatch_ledscores_goal_v1(uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,timestamptz,text,uuid,text,text) from public,anon;
grant execute on function public.dispatch_ledscores_goal_v1(uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,timestamptz,text,uuid,text,text) to authenticated,service_role;

create or replace function public.dispatch_ledscores_goal_v2(
  p_connection_id uuid,p_worker_id text,p_canonical_key text,p_source_update_id text,p_match_identity text,p_home_team text,p_away_team text,
  p_previous_home_score integer,p_previous_away_score integer,p_home_score integer,p_away_score integer,p_scoring_side text,p_scorer_name text,p_match_clock text,
  p_source_observed_at timestamptz,p_event_kind text default 'live',p_alert_id uuid default null,p_scoreboard_side text default null,p_scoring_team_key text default null,p_home_team_key text default null,p_away_team_key text default null
) returns jsonb language sql security definer set search_path = '' as $$
  select private.dispatch_ledscores_goal_v2(p_connection_id,p_worker_id,p_canonical_key,p_source_update_id,p_match_identity,p_home_team,p_away_team,
    p_previous_home_score,p_previous_away_score,p_home_score,p_away_score,p_scoring_side,p_scorer_name,p_match_clock,p_source_observed_at,p_event_kind,p_alert_id,p_scoreboard_side,lower(nullif(btrim(p_scoring_team_key),'')),null,null,lower(nullif(btrim(p_home_team_key),'')),lower(nullif(btrim(p_away_team_key),'')))
$$;
revoke all on function public.dispatch_ledscores_goal_v2(uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,timestamptz,text,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.dispatch_ledscores_goal_v2(uuid,text,text,text,text,text,text,integer,integer,integer,integer,text,text,text,timestamptz,text,uuid,text,text,text,text) to service_role;

create function public.run_ledscores_synthetic_goal_v2(
  p_tenant_id uuid,p_alert_id uuid,p_connection_id uuid,p_team_key text,p_group_id uuid,p_scoreboard_side text,p_home_score integer,p_away_score integer,p_scorer_id uuid,p_scorer_name text,p_minute text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.ledscores_goal_alerts%rowtype; team_name text; result jsonb; scorer public.ledscores_player_identities%rowtype;
begin
  perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');
  perform private.require_ledscores_capability(p_tenant_id,'tenant.playlist.publish');
  select * into a from public.ledscores_goal_alerts where tenant_id=p_tenant_id and id=p_alert_id and is_central_goal_overlay and status='published';
  if not found then raise exception 'publish goal overlay first' using errcode='23514'; end if;
  select v.team_name into team_name from public.ledscores_goal_overlay_version_teams v where v.tenant_id=p_tenant_id and v.alert_version_id=a.current_published_version_id
    and v.connection_id=p_connection_id and v.provider_team_key=p_team_key and selected;
  if not found or not exists(select 1 from public.ledscores_goal_alert_version_groups where tenant_id=p_tenant_id and alert_version_id=a.current_published_version_id and screen_group_id=p_group_id) then
    raise exception 'test team or group not published' using errcode='23514';
  end if;
  if p_scoreboard_side is null or p_home_score is null or p_away_score is null or p_scoreboard_side not in ('home','away') or p_home_score not between 0 and 999 or p_away_score not between 0 and 999
    or (p_scoreboard_side='home' and p_home_score=0) or (p_scoreboard_side='away' and p_away_score=0)
    or length(p_scorer_name)>160 or length(p_minute)>40 then raise exception 'invalid test score' using errcode='23514'; end if;
  if p_scorer_id is not null then
    select * into scorer from public.ledscores_player_identities where tenant_id=p_tenant_id and id=p_scorer_id and connection_id=p_connection_id and provider_team_key=p_team_key and active;
    if not found then raise exception 'test scorer not in selected team' using errcode='23514'; end if;
  end if;
  result:=private.dispatch_ledscores_goal_v2(p_connection_id,null,encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),'synthetic-test',gen_random_uuid()::text,
    case when p_scoreboard_side='home' then team_name else 'Testtegenstander' end,case when p_scoreboard_side='away' then team_name else 'Testtegenstander' end,
    p_home_score-case when p_scoreboard_side='home' then 1 else 0 end,p_away_score-case when p_scoreboard_side='away' then 1 else 0 end,
    p_home_score,p_away_score,'own',coalesce(scorer.display_name,nullif(btrim(p_scorer_name),'')),nullif(btrim(p_minute),''),clock_timestamp(),'synthetic_test',a.id,p_scoreboard_side,p_team_key,p_group_id,scorer.id);
  return result;
end; $$;
revoke all on function public.run_ledscores_synthetic_goal_v2(uuid,uuid,uuid,text,uuid,text,integer,integer,uuid,text,text) from public,anon;
grant execute on function public.run_ledscores_synthetic_goal_v2(uuid,uuid,uuid,text,uuid,text,integer,integer,uuid,text,text) to authenticated;

-- Preserve all fresh queued goals on reconnect, not only the newest goal.
do $$ declare definition text; begin
  select pg_get_functiondef('public.get_ledscores_player_bootstrap_v1(text)'::regprocedure) into definition;
  if position('order by delivery.execute_at desc' in definition)=0 or position('limit 1' in definition)=0 then raise exception 'unexpected LED bootstrap'; end if;
  definition:=replace(definition,'order by delivery.execute_at desc','order by delivery.execute_at asc');
  definition:=replace(definition,'limit 1','limit 20');
  execute definition;
end; $$;

-- Catalog identities are source-owned; the legacy four-row editor cannot erase them.
alter function public.save_ledscores_team_mappings_v1(uuid,uuid,jsonb) rename to save_ledscores_team_mappings_before_s175_v1;
revoke all on function public.save_ledscores_team_mappings_before_s175_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.save_ledscores_team_mappings_v1(p_tenant_id uuid,p_connection_id uuid,p_mappings jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_ledscores_capability(p_tenant_id,'tenant.data_source.manage');
  if exists(select 1 from public.ledscores_connections where tenant_id=p_tenant_id and id=p_connection_id and provider_club_id is not null) then raise exception 'catalog identities are managed by the source' using errcode='23514'; end if;
  return public.save_ledscores_team_mappings_before_s175_v1(p_tenant_id,p_connection_id,p_mappings);
end; $$;
revoke all on function public.save_ledscores_team_mappings_v1(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_ledscores_team_mappings_v1(uuid,uuid,jsonb) to authenticated;

create function public.set_ledscores_player_photo_v2(p_tenant_id uuid,p_player_id uuid,p_media_asset_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.write');
  if not private.has_tenant_capability(p_tenant_id,'tenant.media.read') then raise exception 'media permission required' using errcode='42501'; end if;
  if p_media_asset_id is not null and not exists(select 1 from public.media_assets a where a.tenant_id=p_tenant_id and a.id=p_media_asset_id and a.kind::text='image' and a.status::text='ready' and a.source_kind='user' and a.deleted_at is null and a.mime_type in ('image/jpeg','image/png','image/webp')) then raise exception 'ready tenant image required' using errcode='23514'; end if;
  update public.ledscores_player_identities set manual_photo_media_asset_id=p_media_asset_id,updated_at=clock_timestamp() where tenant_id=p_tenant_id and id=p_player_id;
  if not found then raise exception 'player unavailable' using errcode='P0002'; end if;
  perform private.audit_event(p_tenant_id,'ledscores.player.photo_linked','ledscores_player_identities',p_player_id,'success',jsonb_build_object('mediaAssetId',p_media_asset_id));
end; $$;
revoke all on function public.set_ledscores_player_photo_v2(uuid,uuid,uuid) from public,anon;
grant execute on function public.set_ledscores_player_photo_v2(uuid,uuid,uuid) to authenticated;

-- Authorize only catalog logos linked to an accessible tenant. Provider rosters
-- and unrelated cached provider media remain inaccessible to Control.
create function private.can_read_ledscores_team_logo_v2(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ledscores_team_mappings m join public.provider_asset_versions v on v.id=m.logo_provider_asset_version_id
    where v.storage_bucket='provider-assets' and v.storage_path=p_path and v.storage_path like 'tenants/'||m.tenant_id::text||'/assets/%'
      and private.ledscores_feature_enabled(m.tenant_id) and private.has_tenant_capability(m.tenant_id,'tenant.dynamic_slide.read'))
$$;
revoke all on function private.can_read_ledscores_team_logo_v2(text) from public,anon;
grant execute on function private.can_read_ledscores_team_logo_v2(text) to authenticated;
create policy ledscores_team_logo_read on storage.objects for select to authenticated
using (bucket_id='provider-assets' and private.can_read_ledscores_team_logo_v2(name));
create function public.get_ledscores_team_logos_v2(p_tenant_id uuid)
returns table(connection_id uuid,team_key text,storage_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_ledscores_capability(p_tenant_id,'tenant.dynamic_slide.read');
  return query select m.connection_id,m.provider_team_key,v.storage_path from public.ledscores_team_mappings m
    join public.provider_asset_versions v on v.id=m.logo_provider_asset_version_id
    where m.tenant_id=p_tenant_id and v.storage_bucket='provider-assets' and v.storage_path like 'tenants/'||p_tenant_id::text||'/assets/%'
    order by m.connection_id,m.provider_team_key limit 1000;
end; $$;
revoke all on function public.get_ledscores_team_logos_v2(uuid) from public,anon;
grant execute on function public.get_ledscores_team_logos_v2(uuid) to authenticated;
