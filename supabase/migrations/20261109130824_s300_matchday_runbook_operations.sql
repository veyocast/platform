-- S300: opt-in operational matchdays. Published configuration, concrete targets
-- and action facts are immutable. Runtime heads and delivery evidence are
-- separate, and ordinary Publisher precedence remains authoritative.
create table public.matchday_settings (
 tenant_id uuid primary key references public.tenants(id) on delete restrict,
 enabled boolean not null default false,
 revision bigint not null default 0 check(revision>=0),
 updated_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table public.matchday_runbooks (
 id uuid primary key, tenant_id uuid not null references public.tenants(id) on delete restrict,
 configuration_json jsonb not null check(jsonb_typeof(configuration_json)='object' and pg_column_size(configuration_json)<=262144),
 revision bigint not null default 0 check(revision>=0),
 current_publication_id uuid,
 created_by uuid references public.profiles(id) on delete set null,
 updated_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_id,id)
);
create table public.matchday_publications (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,
 runbook_id uuid not null,version integer not null check(version>0),draft_revision bigint not null check(draft_revision>=0),
 configuration_json jsonb not null check(jsonb_typeof(configuration_json)='object' and pg_column_size(configuration_json)<=262144),
 starts_at timestamptz not null,ends_at timestamptz not null,timezone_name text not null,
 published_by uuid references public.profiles(id) on delete set null,published_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,runbook_id,version),
 foreign key(tenant_id,runbook_id)references public.matchday_runbooks(tenant_id,id)on delete restrict,
 check(ends_at>starts_at and ends_at<=starts_at+interval '48 hours')
);
alter table public.matchday_runbooks add foreign key(tenant_id,current_publication_id)
 references public.matchday_publications(tenant_id,id)on delete restrict;
create table public.matchday_runs (
 tenant_id uuid not null,publication_id uuid primary key,
 revision bigint not null default 0 check(revision>=0),
 status text not null default 'scheduled' check(status in('scheduled','active','closed','cancelled')),
 phase text not null default 'before' check(phase in('before','playing','halftime','resumed','finished','postponed','cancelled')),
 phase_actor_id uuid references public.profiles(id)on delete set null,
 phase_changed_at timestamptz not null default now(),ended_at timestamptz,
 unique(tenant_id,publication_id),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict
);
create table public.matchday_publication_targets (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,publication_id uuid not null,
 screen_id uuid not null,screen_name text not null,role text not null check(role in('entrance','clubwall','canteen','led')),
 target_snapshot_id uuid not null,default_release_id uuid not null,phase_release_ids jsonb not null default '{}',
 player_id uuid not null,orientation text not null check(orientation in('landscape','portrait')),
 width integer not null check(width between 1 and 16384),height integer not null check(height between 1 and 16384),
 composition_id uuid,composition_revision bigint not null default 0 check(composition_revision>=0),
 expiry_capability text not null default 'matchday-expiry-v1'check(expiry_capability='matchday-expiry-v1'),
 unique(tenant_id,id),unique(tenant_id,publication_id,screen_id),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict,
 foreign key(tenant_id,screen_id)references public.screens(tenant_id,id)on delete restrict,
 foreign key(tenant_id,screen_id,composition_id)references public.screen_compositions(tenant_id,screen_id,id)on delete restrict,
 foreign key(tenant_id,target_snapshot_id)references public.publisher_target_snapshots(tenant_id,id)on delete restrict,
 foreign key(tenant_id,default_release_id)references public.playlist_releases(tenant_id,id)on delete restrict,
 foreign key(tenant_id,player_id)references public.player_devices(tenant_id,id)on delete restrict
);
create table public.matchday_actions (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,publication_id uuid not null,
 object_key text not null check(length(object_key)between 1 and 500),revision bigint not null check(revision>0),
 kind text not null check(kind in('field','phase','postponed','cancelled','sold_out','available')),
 payload_json jsonb not null check(jsonb_typeof(payload_json)='object'and pg_column_size(payload_json)<=16384),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),
 starts_at timestamptz not null,ends_at timestamptz not null,
 actor_id uuid references public.profiles(id)on delete set null,reason text not null check(length(reason)between 2 and 300),
 supersedes_action_id uuid,request_id uuid not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,publication_id,object_key,revision),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict,
 foreign key(tenant_id,supersedes_action_id)references public.matchday_actions(tenant_id,id)on delete restrict,
 check(ends_at>starts_at)
);
create table public.matchday_object_states (
 tenant_id uuid not null,publication_id uuid not null,object_key text not null check(length(object_key)between 1 and 500),
 revision bigint not null default 0 check(revision>=0),current_action_id uuid,
 primary key(tenant_id,publication_id,object_key),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict,
 foreign key(tenant_id,current_action_id)references public.matchday_actions(tenant_id,id)on delete restrict
);
create table public.matchday_action_lifecycle (
 tenant_id uuid not null,action_id uuid primary key,
 status text not null default 'active'check(status in('active','ended','superseded','cancelled')),
 ended_at timestamptz,ended_by uuid references public.profiles(id)on delete set null,
 unique(tenant_id,action_id),
 foreign key(tenant_id,action_id)references public.matchday_actions(tenant_id,id)on delete restrict
);
create table public.matchday_owned_schedules (
 tenant_id uuid not null,publication_id uuid not null,target_id uuid not null,schedule_id uuid primary key,
 action_id uuid,phase text not null,
 unique(tenant_id,schedule_id),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict,
 foreign key(tenant_id,target_id)references public.matchday_publication_targets(tenant_id,id)on delete restrict,
 foreign key(tenant_id,schedule_id)references public.content_schedules(tenant_id,id)on delete restrict,
 foreign key(tenant_id,action_id)references public.matchday_actions(tenant_id,id)on delete restrict
);
create table public.matchday_delegations (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,publication_id uuid not null,
 user_id uuid not null references public.profiles(id)on delete restrict,
 screen_ids uuid[] not null,object_ids text[] not null,action_kinds text[] not null,
 ends_at timestamptz not null,revision bigint not null default 0 check(revision>=0),revoked_at timestamptz,
 granted_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,publication_id,user_id),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict,
 check(cardinality(screen_ids)between 1 and 200 and cardinality(object_ids)between 1 and 100 and cardinality(action_kinds)between 1 and 6),
 check(action_kinds<@array['field','phase','postponed','cancelled','sold_out','available']::text[])
);
create table public.matchday_preflights (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,runbook_id uuid not null,
 actor_id uuid not null references public.profiles(id)on delete restrict,draft_revision bigint not null,
 fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),result_json jsonb not null,
 expires_at timestamptz not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,runbook_id)references public.matchday_runbooks(tenant_id,id)on delete restrict
);
create table public.matchday_deliveries (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,publication_id uuid not null,target_id uuid not null,
 action_id uuid,schedule_id uuid,action_revision bigint not null check(action_revision>=0),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),device_id uuid not null,
 status text not null default 'queued'check(status in('scheduled','queued','received','prepared','rendered','restoring','restored','expired','overridden','skipped','failed','unknown')),
 offered_at timestamptz,received_at timestamptz,prepared_at timestamptz,rendered_at timestamptz,restored_at timestamptz,
 confirmed_release_id uuid,detail text check(detail is null or length(detail)<=300),
 window_offers_json jsonb not null default '[]'check(jsonb_typeof(window_offers_json)='array'and jsonb_array_length(window_offers_json)<=8 and pg_column_size(window_offers_json)<=16384),
 created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,action_id,target_id),
 foreign key(tenant_id,publication_id)references public.matchday_publications(tenant_id,id)on delete restrict,
 foreign key(tenant_id,target_id)references public.matchday_publication_targets(tenant_id,id)on delete restrict,
 foreign key(tenant_id,action_id)references public.matchday_actions(tenant_id,id)on delete restrict,
 foreign key(tenant_id,schedule_id)references public.content_schedules(tenant_id,id)on delete restrict,
 foreign key(tenant_id,device_id)references public.player_devices(tenant_id,id)on delete restrict,
 foreign key(tenant_id,confirmed_release_id)references public.playlist_releases(tenant_id,id)on delete restrict
);
create table public.matchday_device_receipts (
 tenant_id uuid not null,device_id uuid not null,request_id uuid not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),result_json jsonb not null,created_at timestamptz not null default now(),
 primary key(tenant_id,device_id,request_id),
 foreign key(tenant_id,device_id)references public.player_devices(tenant_id,id)on delete restrict
);
create index matchday_runbooks_tenant_updated_idx on public.matchday_runbooks(tenant_id,updated_at desc,id);
create index matchday_publications_window_idx on public.matchday_publications(tenant_id,starts_at,ends_at);
create index matchday_targets_screen_idx on public.matchday_publication_targets(tenant_id,screen_id,publication_id);
create index matchday_owned_publication_idx on public.matchday_owned_schedules(tenant_id,publication_id,target_id);
create index matchday_actions_publication_idx on public.matchday_actions(tenant_id,publication_id,created_at desc,id);
create index matchday_delegations_actor_idx on public.matchday_delegations(tenant_id,user_id,publication_id)where revoked_at is null;
create index matchday_deliveries_device_idx on public.matchday_deliveries(tenant_id,device_id,target_id,created_at desc);
create index matchday_preflights_expiry_idx on public.matchday_preflights(expires_at);

-- RPC-only access: no implicit Supabase default grants/direct browser writes.
do $$declare relation text;begin
 foreach relation in array array['matchday_settings','matchday_runbooks','matchday_publications','matchday_runs',
 'matchday_publication_targets','matchday_actions','matchday_object_states','matchday_action_lifecycle','matchday_owned_schedules',
 'matchday_delegations','matchday_preflights','matchday_deliveries','matchday_device_receipts']loop
  execute format('alter table public.%I enable row level security',relation);
  execute format('revoke all on table public.%I from public,anon,authenticated,service_role',relation);
 end loop;
end$$;



create function private.matchday_reject_frozen_s300_v1()returns trigger
language plpgsql set search_path=''as $$begin
 raise exception 'published matchday facts are immutable'using errcode='55000';end$$;
create trigger matchday_publications_frozen before update or delete on public.matchday_publications
 for each row execute function private.matchday_reject_frozen_s300_v1();
create trigger matchday_targets_frozen before update or delete on public.matchday_publication_targets
 for each row execute function private.matchday_reject_frozen_s300_v1();
create trigger matchday_actions_frozen before update or delete on public.matchday_actions
 for each row execute function private.matchday_reject_frozen_s300_v1();
create trigger matchday_owned_schedules_frozen before update or delete on public.matchday_owned_schedules
 for each row execute function private.matchday_reject_frozen_s300_v1();

create function private.matchday_now_s300_v1()returns timestamptz
language sql volatile set search_path=''as $$select clock_timestamp()$$;

create function private.matchday_hash_s300_v1(p_value jsonb)returns text
language sql immutable set search_path=''as $$
 select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')
$$;
create function private.matchday_keys_s300_v1(p_value jsonb,p_allowed text[],p_required text[]default null)
returns void language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(p_value)is distinct from'object'or exists(select 1 from jsonb_object_keys(p_value)key where not key=any(p_allowed))
  or not p_value?&coalesce(p_required,p_allowed)then raise exception 'invalid matchday input shape'using errcode='22023';end if;
end$$;
create function private.matchday_uuid_s300_v1(p_value jsonb)returns uuid
language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(p_value)is distinct from'string'or length(p_value#>>'{}')<>36 then
  raise exception 'explicit UUID required'using errcode='22023';end if;
 return(p_value#>>'{}')::uuid;
end$$;
create function private.matchday_actor_s300_v1(p_tenant_id uuid,p_capability text default null,p_write boolean default false)
returns uuid language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=private.current_user_id();begin
 if actor is null or not exists(select 1 from public.tenants where id=p_tenant_id and status in('active','paused'))
  or(p_capability is not null and not private.has_tenant_capability(p_tenant_id,p_capability))then
  raise exception 'matchday operation is not authorized'using errcode='42501';end if;
 if p_write then perform private.require_active_tenant_command(p_tenant_id);end if;
 return actor;
end$$;
create function private.matchday_context_s300_v1(p_tenant_id uuid,p_value jsonb,p_require_active boolean default true)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare connection public.sportlink_connections%rowtype;source public.dynamic_data_sources%rowtype;resolved jsonb;canonical jsonb;begin
 perform private.matchday_keys_s300_v1(p_value,array['sourceId','connectionId','teamId','competitionId','poolId','seasonId','phaseId','selectionMode']);
 if jsonb_typeof(p_value->'sourceId')<>'string'or jsonb_typeof(p_value->'connectionId')<>'string'
  or jsonb_typeof(p_value->'teamId')<>'string'or length(btrim(p_value->>'teamId'))not between 1 and 200
  or jsonb_typeof(p_value->'competitionId')<>'string'or length(btrim(p_value->>'competitionId'))not between 1 and 200
  or jsonb_typeof(p_value->'poolId')<>'string'or length(btrim(p_value->>'poolId'))not between 1 and 200
  or jsonb_typeof(p_value->'seasonId')not in('string','null')or jsonb_typeof(p_value->'phaseId')not in('string','null')
  or coalesce(p_value->>'selectionMode','')not in('auto_current','pinned')then
  raise exception 'exact matchday context is required'using errcode='22023';end if;
 select *into connection from public.sportlink_connections where tenant_id=p_tenant_id and id=private.matchday_uuid_s300_v1(p_value->'connectionId')
  and data_source_id=private.matchday_uuid_s300_v1(p_value->'sourceId');
 select *into source from public.dynamic_data_sources where tenant_id=p_tenant_id and id=connection.data_source_id and kind='sportlink';
 if connection.id is null or source.id is null or(p_require_active and(connection.status<>'active'or source.status<>'active'))then
  raise exception 'matchday source context is unavailable'using errcode='42501';end if;
 canonical:=jsonb_build_object('providerTeamId',p_value->>'teamId','competitionSelectionMode',p_value->>'selectionMode',
  'competitionId',p_value->'competitionId','poolId',p_value->'poolId','seasonId',p_value->'seasonId','phaseId',p_value->'phaseId');
 resolved:=private.sync_resolve_sportlink_pool_context_v1(p_tenant_id,source.id,canonical,'sportlink.pool_standings');
 if resolved is null or resolved->>'sourceConnectionId'is distinct from connection.id::text
  or resolved->>'poolId'is distinct from p_value->>'poolId'
  or resolved->>'competitionId'is distinct from p_value->>'competitionId'
  or resolved->>'seasonId'is distinct from p_value->>'seasonId'
  or resolved->>'phaseId'is distinct from p_value->>'phaseId'then
  raise exception 'matchday context differs from the exact normalized resolver'using errcode='42501';end if;
 return p_value;
end$$;

create function private.matchday_match_s300_v1(p_tenant_id uuid,p_match_id uuid,p_context jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare match public.sports_matches%rowtype;context jsonb;last_success timestamptz;begin
 context:=private.matchday_context_s300_v1(p_tenant_id,p_context);
 select *into match from public.sports_matches where tenant_id=p_tenant_id and id=p_match_id
  and source_connection_id=(context->>'connectionId')::uuid and active;
 if match.id is null or not(context->>'teamId'in(match.home_team->>'externalId',match.away_team->>'externalId'))
  or private.sync_sportlink_effective_pool_v1(match)is distinct from context->>'poolId'
  or private.sportlink_competition_identity_v1(match.competition,match.pool)is distinct from context->>'competitionId'
  or nullif(match.competition->>'season','unknown')is distinct from context->>'seasonId'
  or match.competition->>'period'is distinct from context->>'phaseId'then
  raise exception 'matchday match is outside its exact source identity'using errcode='42501';end if;
 select last_success_at into last_success from public.sportlink_sync_policies where tenant_id=p_tenant_id
  and connection_id=match.source_connection_id and dataset_group='matches';
 return jsonb_build_object('id',match.id,'matchCode',match.external_id,'context',context,
  'homeTeamId',match.home_team->>'externalId','awayTeamId',match.away_team->>'externalId',
  'homeTeamName',left(match.home_team->>'name',200),'awayTeamName',left(match.away_team->>'name',200),'kickoffAt',match.starts_at,
  'field',left(match.venue->>'field',120),'status',case when match.status in('scheduled','live','finished','cancelled','postponed')then match.status else'unknown'end,
  'observedAt',match.last_synced_at,'lastSuccessfulSyncAt',last_success);
end$$;

-- Parse every draft field server-side. Display/provider values for matches and
-- menu products are replaced by canonical scoped facts, never trusted input.
create function private.matchday_configuration_s300_v1(p_tenant_id uuid,p_value jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare result jsonb:=p_value;context jsonb;match_value jsonb;matches jsonb:='[]';role_value jsonb;window_value jsonb;
 starts timestamptz;ends timestamptz;previous_end timestamptz;phase_key text;target jsonb;begin
 perform private.matchday_keys_s300_v1(p_value,array['schemaVersion','name','timezone','startsAt','endsAt','context','matches','mainMatchId','roles','overlapDecisions','phaseWindows']);
 if p_value->'schemaVersion'<>'1'::jsonb or jsonb_typeof(p_value->'name')<>'string'
  or length(btrim(p_value->>'name'))not between 2 and 120 or pg_column_size(p_value)>262144
  or not exists(select 1 from pg_timezone_names where name=p_value->>'timezone')
  or jsonb_typeof(p_value->'matches')<>'array'or jsonb_array_length(p_value->'matches')>100
  or jsonb_typeof(p_value->'roles')<>'array'or jsonb_array_length(p_value->'roles')>4
  or jsonb_typeof(p_value->'overlapDecisions')<>'array'or jsonb_array_length(p_value->'overlapDecisions')>200
  or jsonb_typeof(p_value->'phaseWindows')<>'array'or jsonb_array_length(p_value->'phaseWindows')>20
  or jsonb_typeof(p_value->'mainMatchId')not in('string','null')then
  raise exception 'invalid matchday draft configuration'using errcode='22023';end if;
 if p_value->>'timezone'is distinct from coalesce((select timezone_name from public.tenant_settings where tenant_id=p_tenant_id),'Europe/Amsterdam')then
  raise exception 'matchday timezone must equal the canonical tenant timezone'using errcode='22023';end if;
 starts:=private.screen_frame_timestamp_s296_v1(p_value->>'startsAt');ends:=private.screen_frame_timestamp_s296_v1(p_value->>'endsAt');
 if starts is null or ends is null or not(ends>starts and ends<=starts+interval '48 hours')
  or starts<'2000-01-01'::timestamptz or ends>='2100-01-01'::timestamptz then
  raise exception 'matchday requires an explicit finite half-open window'using errcode='22023';end if;
 if p_value->'context'<>'null'::jsonb then
  if not private.has_tenant_capability(p_tenant_id,'tenant.data_source.read')then raise exception 'source context is not authorized'using errcode='42501';end if;
  context:=private.matchday_context_s300_v1(p_tenant_id,p_value->'context');
 elsif jsonb_array_length(p_value->'matches')>0 then raise exception 'selected matches need source context'using errcode='22023';end if;
 for match_value in select value from jsonb_array_elements(p_value->'matches')loop
  perform private.matchday_keys_s300_v1(match_value,array['id','matchCode','context','homeTeamId','awayTeamId','homeTeamName','awayTeamName','kickoffAt','field','status','observedAt','lastSuccessfulSyncAt']);
  if match_value#>>'{context,sourceId}'is distinct from context->>'sourceId'
   or match_value#>>'{context,connectionId}'is distinct from context->>'connectionId'then
   raise exception 'park matches require the same authorized source connection'using errcode='42501';end if;
  if match_value->>'id'=p_value->>'mainMatchId'and exists(select 1 from unnest(array['sourceId','connectionId','teamId','competitionId','poolId','seasonId','phaseId'])key
   where match_value#>array['context',key]is distinct from context->key)then
   raise exception 'main match requires the exact selected context tuple'using errcode='42501';end if;
  match_value:=private.matchday_match_s300_v1(p_tenant_id,private.matchday_uuid_s300_v1(match_value->'id'),match_value->'context');
  if exists(select 1 from jsonb_array_elements(matches)old where old->>'id'=match_value->>'id'or old->>'matchCode'=match_value->>'matchCode')then
   raise exception 'an exact match appears more than once'using errcode='22023';end if;
  matches:=matches||jsonb_build_array(match_value);
 end loop;
 if p_value->>'mainMatchId'is not null and not exists(select 1 from jsonb_array_elements(matches)item where item->>'id'=p_value->>'mainMatchId')then
  raise exception 'main match must be explicitly selected'using errcode='22023';end if;
 if(select count(distinct value->>'role')from jsonb_array_elements(p_value->'roles'))<>jsonb_array_length(p_value->'roles')then
  raise exception 'duplicate matchday roles'using errcode='22023';end if;
 for role_value in select value from jsonb_array_elements(p_value->'roles')loop
  perform private.matchday_keys_s300_v1(role_value,array['role','targets','defaultReleaseId','phaseReleaseIds','menuFallbacks','ledBinding']);
  if coalesce(role_value->>'role','')not in('entrance','clubwall','canteen','led')or jsonb_typeof(role_value->'targets')<>'array'
   or jsonb_array_length(role_value->'targets')not between 1 and 20 or jsonb_typeof(role_value->'menuFallbacks')<>'array'
   or jsonb_array_length(role_value->'menuFallbacks')>100 then raise exception 'invalid matchday role'using errcode='22023';end if;
  perform private.matchday_keys_s300_v1(role_value->'phaseReleaseIds',array['before','playing','halftime','resumed','finished','postponed','cancelled'],'{}');
  perform private.matchday_uuid_s300_v1(role_value->'defaultReleaseId');
  for target in select value from jsonb_each(role_value->'phaseReleaseIds')loop perform private.matchday_uuid_s300_v1(target);end loop;
  if(select count(distinct value)from jsonb_array_elements(role_value->'targets'))<>jsonb_array_length(role_value->'targets')then
   raise exception 'duplicate explicit role targets'using errcode='22023';end if;
  for target in select value from jsonb_array_elements(role_value->'targets')loop
   perform private.matchday_keys_s300_v1(target,array['kind','id']);perform private.matchday_uuid_s300_v1(target->'id');
   if coalesce(target->>'kind','')not in('screen','screen_group')then raise exception 'invalid target kind'using errcode='22023';end if;
   if target->>'kind'='screen'and not exists(select 1 from public.screens where tenant_id=p_tenant_id and id=(target->>'id')::uuid and deleted_at is null)
    or target->>'kind'='screen_group'and not exists(select 1 from public.screen_groups where tenant_id=p_tenant_id and id=(target->>'id')::uuid and status='active')then
    raise exception 'target outside tenant'using errcode='42501';end if;
  end loop;
  if role_value->>'role'<>'canteen'and jsonb_array_length(role_value->'menuFallbacks')>0 then raise exception 'menu placement requires canteen role'using errcode='22023';end if;
  for target in select value from jsonb_array_elements(role_value->'menuFallbacks')loop
   perform private.matchday_keys_s300_v1(target,array['menuSnapshotId','placementId','productId','productLabel','unavailableReleaseId']);
   perform private.matchday_uuid_s300_v1(target->'menuSnapshotId');perform private.matchday_uuid_s300_v1(target->'productId');perform private.matchday_uuid_s300_v1(target->'unavailableReleaseId');
   if length(btrim(target->>'placementId'))not between 1 and 200 or length(btrim(target->>'productLabel'))not between 1 and 200 then
    raise exception 'invalid exact menu placement'using errcode='22023';end if;
  end loop;
  if role_value->'ledBinding'<>'null'::jsonb then
   perform private.matchday_keys_s300_v1(role_value->'ledBinding',array['connectionId','alertVersionId','providerMatchId','maximumSourceAgeSeconds']);
   perform private.matchday_uuid_s300_v1(role_value#>'{ledBinding,connectionId}');perform private.matchday_uuid_s300_v1(role_value#>'{ledBinding,alertVersionId}');
   if role_value->>'role'<>'led'or jsonb_typeof(role_value#>'{ledBinding,providerMatchId}')<>'string'
    or length(btrim(role_value#>>'{ledBinding,providerMatchId}'))not between 1 and 200
    or jsonb_typeof(role_value#>'{ledBinding,maximumSourceAgeSeconds}')<>'number'
    or(role_value#>>'{ledBinding,maximumSourceAgeSeconds}')::integer not between 5 and 300 then
    raise exception 'invalid LED role binding'using errcode='22023';end if;
  end if;
 end loop;
 for target in select value from jsonb_array_elements(p_value->'overlapDecisions')loop
  perform private.matchday_keys_s300_v1(target,array['screenId','role']);perform private.matchday_uuid_s300_v1(target->'screenId');
  if not exists(select 1 from jsonb_array_elements(p_value->'roles')role where role->>'role'=target->>'role')then
   raise exception 'overlap decision has no configured role'using errcode='22023';end if;
 end loop;
 if(select count(distinct value->>'screenId')from jsonb_array_elements(p_value->'overlapDecisions'))<>jsonb_array_length(p_value->'overlapDecisions')then
  raise exception 'duplicate overlap decision'using errcode='22023';end if;
 for window_value in select value from jsonb_array_elements(p_value->'phaseWindows')order by value->>'startsAt'loop
  perform private.matchday_keys_s300_v1(window_value,array['phase','startsAt','endsAt']);
  if coalesce(window_value->>'phase','')not in('before','playing','halftime','resumed','finished','postponed','cancelled')
   or private.screen_frame_timestamp_s296_v1(window_value->>'startsAt')is null
   or private.screen_frame_timestamp_s296_v1(window_value->>'endsAt')is null
   or(window_value->>'startsAt')::timestamptz<starts or(window_value->>'endsAt')::timestamptz>ends
   or(window_value->>'endsAt')::timestamptz<=(window_value->>'startsAt')::timestamptz
   or(previous_end is not null and(window_value->>'startsAt')::timestamptz<previous_end)then
   raise exception 'phase windows overlap or exceed the runbook window'using errcode='22023';end if;
  previous_end:=(window_value->>'endsAt')::timestamptz;
 end loop;
 return jsonb_set(jsonb_set(result,'{name}',to_jsonb(btrim(p_value->>'name'))),'{matches}',matches);
end$$;

create function private.matchday_receipt_s300_v1(p_tenant_id uuid,p_input jsonb,p_command text,p_outcome text,
 p_runbook_id uuid,p_publication_id uuid,p_action_id uuid,p_revision bigint,p_message text)returns jsonb
language plpgsql security definer set search_path=''as $$declare result jsonb;begin
 result:=jsonb_build_object('outcome',p_outcome,'requestId',p_input->'requestId','runbookId',p_runbook_id,
  'publicationId',p_publication_id,'actionId',p_action_id,'actualRevision',p_revision,'message',left(p_message,500));
 return private.complete_publisher_command(p_tenant_id,p_command,(p_input->>'requestId')::uuid,p_input,
  'matchday_runbooks',coalesce(p_runbook_id,p_tenant_id),result,'publisher.'||p_command,
  case when p_outcome in('conflict','blocked')then'failed'else'success'end);
end$$;

create function public.get_matchday_availability_s300_v1(p_tenant_id uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare actor uuid;begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id);
 if not private.has_tenant_capability(p_tenant_id,'tenant.release.read')and not private.has_tenant_capability(p_tenant_id,'tenant.settings.manage')
  and not exists(select 1 from public.tenant_memberships where tenant_id=p_tenant_id and user_id=actor)then
  raise exception 'matchday availability outside tenant'using errcode='42501';end if;
 return jsonb_build_object('schemaVersion',1,'enabled',coalesce((select enabled from public.matchday_settings where tenant_id=p_tenant_id),false),
  'canManageFeature',private.has_tenant_capability(p_tenant_id,'tenant.settings.manage'),
  'canOpen',private.has_tenant_capability(p_tenant_id,'tenant.release.read')or private.has_tenant_capability(p_tenant_id,'tenant.settings.manage')
   or exists(select 1 from public.matchday_delegations delegation join public.matchday_publications publication
    on publication.tenant_id=delegation.tenant_id and publication.id=delegation.publication_id
    join public.matchday_runs run on run.tenant_id=publication.tenant_id and run.publication_id=publication.id
    where delegation.tenant_id=p_tenant_id and delegation.user_id=actor and delegation.revoked_at is null
     and delegation.ends_at>private.matchday_now_s300_v1()and publication.ends_at>private.matchday_now_s300_v1()and run.status not in('closed','cancelled')));
end$$;

create function public.mutate_matchday_draft_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;runbook public.matchday_runbooks%rowtype;configuration jsonb;replay jsonb;begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.write',true);
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','expectedRevision','requestId','configuration']);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'requestId');
 if jsonb_typeof(p_input->'expectedRevision')<>'number'or(p_input->>'expectedRevision')::numeric not between 0 and 9007199254740991
  or(p_input->>'expectedRevision')::numeric<>trunc((p_input->>'expectedRevision')::numeric)then raise exception 'invalid draft revision'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.draft.save',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||(p_input->>'runbookId'),300));
 select *into runbook from public.matchday_runbooks where tenant_id=p_tenant_id and id=(p_input->>'runbookId')::uuid for update;
 if runbook.id is null and exists(select 1 from public.matchday_runbooks where id=(p_input->>'runbookId')::uuid)then
  raise exception 'runbook outside tenant'using errcode='42501';end if;
 if(runbook.id is null and(p_input->>'expectedRevision')::bigint<>0)or(runbook.id is not null and runbook.revision<>(p_input->>'expectedRevision')::bigint)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.draft.save','conflict',(p_input->>'runbookId')::uuid,null,null,
   coalesce(runbook.revision,0),'Het concept is ondertussen gewijzigd. Controleer de huidige versie.');end if;
 configuration:=private.matchday_configuration_s300_v1(p_tenant_id,p_input->'configuration');
 insert into public.matchday_runbooks(id,tenant_id,configuration_json,revision,created_by,updated_by)
 values((p_input->>'runbookId')::uuid,p_tenant_id,configuration,1,actor,actor)
 on conflict(id)do update set configuration_json=excluded.configuration_json,revision=matchday_runbooks.revision+1,
  updated_by=actor,updated_at=private.matchday_now_s300_v1()returning *into runbook;
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.draft.save','applied',runbook.id,null,null,runbook.revision,'Concept opgeslagen. Gepubliceerde versies blijven behouden.');
end$$;

create function private.matchday_release_s300_v1(p_tenant_id uuid,p_release_id uuid,p_screen_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare release public.playlist_releases%rowtype;screen public.screens%rowtype;items integer;ready boolean;compatible boolean:=true;
 width integer;height integer;orientation text;label text;begin
 select *into release from public.playlist_releases where tenant_id=p_tenant_id and id=p_release_id;
 if release.id is null then return null;end if;
 select count(*)::integer,bool_and(item.checksum_sha256~'^[a-f0-9]{64}$'and item.file_size_bytes>0
  and item.storage_path like('tenants/'||p_tenant_id||'/%')and asset.id is not null
  and(item.dynamic_snapshot_id is null or snapshot.status='ready')),
  max(item.width),max(item.height)into items,ready,width,height
 from public.playlist_release_items item left join public.media_assets asset on asset.tenant_id=item.tenant_id
  and asset.id=item.media_asset_id and asset.status='ready'and asset.deleted_at is null
 left join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
 where item.tenant_id=p_tenant_id and item.release_id=release.id and item.enabled;
 ready:=coalesce(ready,false)and items>0;
 orientation:=case when width is not null and height is not null then case when width>=height then'landscape'else'portrait'end end;
 if p_screen_id is not null then
  select *into screen from public.screens where tenant_id=p_tenant_id and id=p_screen_id and deleted_at is null;
  compatible:=screen.id is not null and screen.status='active'and screen.orientation::text in('landscape','portrait')
   and not exists(select 1 from public.playlist_release_items item
    left join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
    left join public.dynamic_template_versions version on version.id=snapshot.template_version_id
    left join public.dynamic_templates template on template.id=version.template_id
    where item.tenant_id=p_tenant_id and item.release_id=release.id and item.enabled
     and(item.dynamic_snapshot_id is not null and template.orientation::text is distinct from screen.orientation::text
      or(item.width is not null and item.height is not null and case when item.width>=item.height then'landscape'else'portrait'end<>screen.orientation::text)));
 end if;
 select left(name||' · v'||release.version,300)into label from public.playlists where tenant_id=p_tenant_id and id=release.playlist_id;
 return jsonb_build_object('id',release.id,'playlistId',release.playlist_id,'label',label,'version',release.version,
  'orientation',coalesce(orientation,'landscape'),'width',coalesce(width,1920),'height',coalesce(height,1080),
  'ready',ready,'compatible',compatible,'manifestHash',release.manifest_hash);
end$$;

create function private.matchday_menu_placements_s300_v1(p_tenant_id uuid,p_release_ids uuid[]default null)
returns setof jsonb language sql stable security definer set search_path=''as $$
 select distinct jsonb_build_object('menuSnapshotId',snapshot.id,'placementId',node.value->>'id',
  'productId',product.id,'productLabel',left(coalesce(nullif(node.value->>'nameOverride',''),node.value#>>'{snapshotFallback,name}',product.name),200),
  'menuLabel',left(slide.name,200))
 from public.dynamic_slide_snapshots snapshot join public.dynamic_slides slide
  on slide.tenant_id=snapshot.tenant_id and slide.id=snapshot.dynamic_slide_id
 cross join lateral jsonb_path_query(snapshot.snapshot_data_json,'$.menuDocument.** ? (@.kind == "product" && exists(@.productRef.productId))')node(value)
 join public.tenant_products product on product.tenant_id=snapshot.tenant_id and product.id::text=node.value#>>'{productRef,productId}'
 where snapshot.tenant_id=p_tenant_id and snapshot.status='ready'
  and exists(select 1 from public.playlist_release_items item where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=snapshot.id
   and item.enabled and(p_release_ids is null or item.release_id=any(p_release_ids)))
 order by 1 limit 200
$$;

create function private.matchday_led_options_s300_v1(p_tenant_id uuid,p_main_match_id uuid default null)
returns setof jsonb language sql stable security definer set search_path=''as $$
 -- A team-name/date guess cannot bridge independent providers. Only the
 -- observed exact provider code plus both normalized team mappings qualifies.
 select jsonb_build_object('connectionId',connection.id,'alertVersionId',version.id,'providerMatchId',match.external_id,
  'matchId',match.id,'label',left(alert.name||' · '||(match.home_team->>'name')||' – '||(match.away_team->>'name'),200),
  'maximumSourceAgeSeconds',least(300,greatest(5,state.stale_after_seconds)))
 from public.ledscores_connections connection join public.ledscores_goal_alerts alert
  on alert.tenant_id=connection.tenant_id and alert.connection_id=connection.id and alert.status='published'
 join public.ledscores_goal_alert_versions version on version.tenant_id=alert.tenant_id and version.id=alert.current_published_version_id
 join public.ledscores_live_match_states state on state.tenant_id=connection.tenant_id and state.connection_id=connection.id
 join public.sports_matches match on match.tenant_id=connection.tenant_id and match.external_id=state.state_json->>'matchId'
  and match.active and(p_main_match_id is null or match.id=p_main_match_id)
 where connection.tenant_id=p_tenant_id and connection.status='active'and private.ledscores_feature_enabled(p_tenant_id)and state.match_identity='match:'||match.external_id
  and exists(select 1 from public.ledscores_team_mappings mapping join public.sports_teams team
   on team.tenant_id=mapping.tenant_id and team.id=mapping.sports_team_id and team.active
   where mapping.tenant_id=p_tenant_id and mapping.connection_id=connection.id and mapping.active
    and team.source_connection_id=match.source_connection_id and team.external_id=match.home_team->>'externalId'
    and mapping.provider_team_key=state.state_json->>'homeTeamId')
  and exists(select 1 from public.ledscores_team_mappings mapping join public.sports_teams team
   on team.tenant_id=mapping.tenant_id and team.id=mapping.sports_team_id and team.active
   where mapping.tenant_id=p_tenant_id and mapping.connection_id=connection.id and mapping.active
    and team.source_connection_id=match.source_connection_id and team.external_id=match.away_team->>'externalId'
    and mapping.provider_team_key=state.state_json->>'awayTeamId')
 order by connection.id,version.id,match.id limit 100
$$;

create function private.matchday_normal_target_s300_v1(p_tenant_id uuid,p_screen_id uuid,p_at timestamptz)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare candidate public.content_schedules%rowtype;screen public.screens%rowtype;release_id uuid;begin
 select *into strict screen from public.screens where tenant_id=p_tenant_id and id=p_screen_id and deleted_at is null;
 select(jsonb_populate_record(null::public.content_schedules,to_jsonb(ordered))).*into candidate from private.content_schedule_candidates_s298_v1(p_tenant_id,p_screen_id,p_at,null)with ordinality ordered
 where not exists(select 1 from public.matchday_owned_schedules owned where owned.tenant_id=p_tenant_id and owned.schedule_id=ordered.id)
 order by ordered.ordinality limit 1;
 release_id:=coalesce(candidate.release_id,screen.default_release_id);
 return jsonb_build_object('releaseId',release_id,'scheduleId',candidate.id,'name',coalesce(candidate.name,'Standaardinhoud'),
  'source',coalesce(candidate.source,'default'),'composition',private.screen_composition_json_v1(p_tenant_id,screen.composition_id));
end$$;

create function private.matchday_target_data_key_s300_v1(p_tenant_id uuid,p_release_id uuid,p_composition jsonb)
returns text language sql stable security definer set search_path=''as $$
 select coalesce(string_agg(data.snapshot_id||':'||data.data_revision||':'||data.content_hash,','order by data.snapshot_id),'')
 from public.published_dynamic_data data where data.tenant_id=p_tenant_id and exists(
  select 1 from public.playlist_release_items item where item.tenant_id=p_tenant_id and item.dynamic_snapshot_id=data.snapshot_id
   and item.live_data_enabled and(item.release_id=p_release_id or exists(select 1 from jsonb_array_elements(coalesce(p_composition->'bindings','[]'))binding
    where binding->>'zoneId'<>'main'and item.release_id::text in(binding->>'releaseId',binding->>'fallbackReleaseId'))))
$$;

create function private.matchday_schedule_id_s300_v1(p_publication_id uuid,p_screen_id uuid,p_key text)returns uuid
language sql immutable set search_path=''as $$
 select(substr(hash,1,8)||'-'||substr(hash,9,4)||'-4'||substr(hash,14,3)||'-8'||substr(hash,18,3)||'-'||substr(hash,21,12))::uuid
 from(select private.matchday_hash_s300_v1(jsonb_build_array(p_publication_id,p_screen_id,p_key))hash)value
$$;

create function private.matchday_plan_s300_v1(p_tenant_id uuid,p_runbook_id uuid,p_publication_id uuid,
 p_screen_id uuid,p_role jsonb,p_configuration jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare starts timestamptz:=(p_configuration->>'startsAt')::timestamptz;ends timestamptz:=(p_configuration->>'endsAt')::timestamptz;
 edge timestamptz;next_edge timestamptz;edges timestamptz[];phase jsonb;proposal public.content_schedules%rowtype;
 winner public.content_schedules%rowtype;release public.playlist_releases%rowtype;screen public.screens%rowtype;
 result jsonb:='[]';chosen_release uuid;window_key text;begin
 select *into strict screen from public.screens where tenant_id=p_tenant_id and id=p_screen_id;
 select array_agg(distinct at order by at)into edges from(
  select starts at union all select ends
  union all select(value->>'startsAt')::timestamptz from jsonb_array_elements(p_configuration->'phaseWindows')
  union all select(value->>'endsAt')::timestamptz from jsonb_array_elements(p_configuration->'phaseWindows')
  union all select boundary.at from public.content_schedules schedule
   join public.publisher_target_snapshot_screens target on target.tenant_id=schedule.tenant_id and target.snapshot_id=schedule.target_snapshot_id and target.screen_id=p_screen_id
   cross join lateral private.content_schedule_edges_s298_v1(schedule,starts,ends)boundary
   where schedule.tenant_id=p_tenant_id and schedule.enabled and schedule.deleted_at is null
 )boundaries where at>=starts and at<=ends;
 if cardinality(edges)>40 then raise exception 'matchday planning exceeds forty explicit boundaries'using errcode='54000';end if;
 for edge in select unnest(edges)loop
  select min(value)into next_edge from unnest(edges)value where value>edge;
  proposal:=null;
  if edge<ends then
   select value into phase from jsonb_array_elements(p_configuration->'phaseWindows')with ordinality
    where(value->>'startsAt')::timestamptz<=edge and(value->>'endsAt')::timestamptz>edge;
   window_key:=case when phase is null then'default'else'phase:'||(phase->>'phase')||':'||(phase->>'startsAt')end;
   chosen_release:=coalesce((p_role#>>array['phaseReleaseIds',phase->>'phase'])::uuid,(p_role->>'defaultReleaseId')::uuid);
   select *into strict release from public.playlist_releases where tenant_id=p_tenant_id and id=chosen_release;
   proposal:=jsonb_populate_record(null::public.content_schedules,jsonb_build_object(
    'id',private.matchday_schedule_id_s300_v1(p_publication_id,p_screen_id,window_key),'tenant_id',p_tenant_id,
    'name',left('Wedstrijddag: '||(p_configuration->>'name')||case when phase is null then''else' · '||(phase->>'phase')end,120),
    'target_kind','screen','target_screen_id',p_screen_id,'playlist_id',release.playlist_id,'release_id',release.id,
    'timezone_name',p_configuration->>'timezone','schedule_kind','once','recurrence_json','{}'::jsonb,
    'starts_at',coalesce(phase->>'startsAt',p_configuration->>'startsAt'),'ends_at',coalesce(phase->>'endsAt',p_configuration->>'endsAt'),
    'source','publisher','priority',case when phase is null then 100 else 101 end,'enabled',true,'revision',0));
  end if;
  select(jsonb_populate_record(null::public.content_schedules,to_jsonb(candidate))).*into winner from private.content_schedule_candidates_s298_v1(p_tenant_id,p_screen_id,edge,proposal)with ordinality candidate
   where not exists(select 1 from public.matchday_owned_schedules owned join public.matchday_publications publication
    on publication.tenant_id=owned.tenant_id and publication.id=owned.publication_id
    where owned.tenant_id=p_tenant_id and owned.schedule_id=candidate.id and publication.runbook_id=p_runbook_id)
   order by candidate.ordinality limit 1;
  result:=result||jsonb_build_array(jsonb_build_object('at',edge,'until',next_edge,
   'winnerName',coalesce(winner.name,'Standaardinhoud'),'source',coalesce(winner.source,'default'),
   'releaseId',coalesce(winner.release_id,screen.default_release_id),'scheduleId',winner.id,
   'restoresAt',case when winner.id=proposal.id then proposal.ends_at end));
 end loop;
 return result;
end$$;

create function private.matchday_preflight_s300_v1(p_tenant_id uuid,p_runbook_id uuid,p_expected_revision bigint,p_proposal_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare runbook public.matchday_runbooks%rowtype;configuration jsonb;role_value jsonb;screen public.screens%rowtype;device public.player_devices%rowtype;
 candidates jsonb:='[]';targets jsonb:='[]';issues jsonb:='[]';fingerprints jsonb:='[]';roles jsonb;chosen text;
 target_id uuid;release_id uuid;release_check jsonb;release_ids uuid[];ready boolean;reason text;planning jsonb;normal jsonb;
 placement jsonb;canonical_placement jsonb;led_option jsonb;starts timestamptz;ends timestamptz;begin
 select *into runbook from public.matchday_runbooks where tenant_id=p_tenant_id and id=p_runbook_id;
 if runbook.id is null then raise exception 'runbook outside tenant'using errcode='42501';end if;
 if runbook.revision is distinct from p_expected_revision then raise exception 'matchday draft revision changed'using errcode='40001';end if;
 configuration:=private.matchday_configuration_s300_v1(p_tenant_id,runbook.configuration_json);
 starts:=(configuration->>'startsAt')::timestamptz;ends:=(configuration->>'endsAt')::timestamptz;
 if configuration->>'mainMatchId'is null or configuration->'context'='null'::jsonb then
  issues:=issues||jsonb_build_array(jsonb_build_object('screenId',null,'role',null,'code','EXACT_MATCH_REQUIRED','message','Kies een exacte hoofdwedstrijd met gevalideerde broncontext.'));
 end if;
 if ends<=private.matchday_now_s300_v1()then issues:=issues||jsonb_build_array(jsonb_build_object('screenId',null,'role',null,'code','WINDOW_EXPIRED','message','Het draaiboekvenster is verstreken.'));
 end if;
 if not coalesce((select enabled from public.matchday_settings where tenant_id=p_tenant_id),false)then
  issues:=issues||jsonb_build_array(jsonb_build_object('screenId',null,'role',null,'code','FEATURE_DISABLED','message','Wedstrijddag staat voor deze vereniging nog uit.'));
 end if;
 for role_value in select value from jsonb_array_elements(configuration->'roles')loop
  for target_id in select distinct selected.screen_id from(
   select(value->>'id')::uuid screen_id from jsonb_array_elements(role_value->'targets')where value->>'kind'='screen'
   union all select member.screen_id from jsonb_array_elements(role_value->'targets')selection join public.screen_group_memberships member
    on member.tenant_id=p_tenant_id and member.screen_group_id=(selection->>'id')::uuid where selection->>'kind'='screen_group')selected
  loop candidates:=candidates||jsonb_build_array(jsonb_build_object('screenId',target_id,'role',role_value->>'role'));end loop;
 end loop;
 if jsonb_array_length(candidates)>800 then raise exception 'too many expanded matchday targets'using errcode='22023';end if;
 for target_id in select distinct(value->>'screenId')::uuid from jsonb_array_elements(candidates)order by 1 loop
  select jsonb_agg(value->>'role')into roles from jsonb_array_elements(candidates)where value->>'screenId'=target_id::text;
  if jsonb_array_length(roles)=1 then chosen:=roles->>0;else
   select value->>'role'into chosen from jsonb_array_elements(configuration->'overlapDecisions')where value->>'screenId'=target_id::text;
   if chosen is null or not roles?chosen then
    issues:=issues||jsonb_build_array(jsonb_build_object('screenId',target_id,'role',null,'code','OVERLAPPING_ROLES','message','Dit scherm staat in meerdere rollen. Bevestig één bestemming of pas de doelen aan.'));
    continue;
   end if;
  end if;
  select value into role_value from jsonb_array_elements(configuration->'roles')where value->>'role'=chosen;
  select *into screen from public.screens where tenant_id=p_tenant_id and id=target_id and deleted_at is null;
  select *into device from public.player_devices where tenant_id=p_tenant_id and screen_id=target_id and status='paired'order by paired_at desc,id limit 1;
  ready:=true;reason:=null;
  if screen.id is null or screen.status<>'active'then ready:=false;reason:='Het scherm is niet actief.';
  elsif device.id is null or device.capabilities->>'matchdayExpiry'<>'matchday-expiry-v1'or device.capabilities->>'matchdayExpiry'is null then
   ready:=false;reason:='Deze Player ondersteunt lokaal vervallen en veilig hervatten nog niet (matchday-expiry-v1 ontbreekt).';
  end if;
  select array_agg(distinct id)into release_ids from(select(role_value->>'defaultReleaseId')::uuid id
   union all select value::uuid from jsonb_each_text(role_value->'phaseReleaseIds')
   union all select(value->>'unavailableReleaseId')::uuid from jsonb_array_elements(role_value->'menuFallbacks'))required;
  for release_id in select unnest(release_ids)loop
   release_check:=private.matchday_release_s300_v1(p_tenant_id,release_id,target_id);
   if release_check is null or not coalesce((release_check->>'ready')::boolean,false)or not coalesce((release_check->>'compatible')::boolean,false)then
    ready:=false;reason:='Een gekozen publicatie is niet gereed of past niet bij dit schermprofiel.';
   end if;
   fingerprints:=fingerprints||jsonb_build_array(jsonb_build_object('screenId',target_id,'release',release_check-'label'));
  end loop;
  normal:=private.matchday_normal_target_s300_v1(p_tenant_id,target_id,ends);
  release_check:=private.matchday_release_s300_v1(p_tenant_id,(normal->>'releaseId')::uuid,target_id);
  if release_check is null or not coalesce((release_check->>'ready')::boolean,false)or not coalesce((release_check->>'compatible')::boolean,false)then
   ready:=false;reason:='De gewone planning na afloop heeft nog geen geldige, compatibele herstelpublicatie.';
  end if;
  if chosen='led'then
   select value into led_option from private.matchday_led_options_s300_v1(p_tenant_id,(configuration->>'mainMatchId')::uuid)value
    where value->>'connectionId'=role_value#>>'{ledBinding,connectionId}'and value->>'alertVersionId'=role_value#>>'{ledBinding,alertVersionId}'
     and value->>'providerMatchId'=role_value#>>'{ledBinding,providerMatchId}';
   if led_option is null then ready:=false;reason:='Een aantoonbare exacte koppeling tussen de LED-configuratie en hoofdwedstrijd ontbreekt.';end if;
   if not exists(select 1 from public.ledscores_live_match_states led_state where led_state.tenant_id=p_tenant_id
    and led_state.connection_id=(role_value#>>'{ledBinding,connectionId}')::uuid
    and led_state.match_identity='match:'||(role_value#>>'{ledBinding,providerMatchId}')
    and led_state.source_observed_at<=private.matchday_now_s300_v1()
    and led_state.source_observed_at>=private.matchday_now_s300_v1()-make_interval(secs=>(role_value#>>'{ledBinding,maximumSourceAgeSeconds}')::int))then
    ready:=false;reason:='De exacte LED-bronwaarneming is niet recent genoeg. Controleer de verbinding voordat je deze rol publiceert.';end if;
   if not exists(select 1 from public.ledscores_goal_alert_version_groups led_group join public.screen_group_memberships member
    on member.tenant_id=led_group.tenant_id and member.screen_group_id=led_group.screen_group_id and member.screen_id=target_id
    where led_group.tenant_id=p_tenant_id and led_group.alert_version_id=(role_value#>>'{ledBinding,alertVersionId}')::uuid)then
    ready:=false;reason:='De bestaande LED-configuratie is niet voor dit concrete scherm gepubliceerd.';end if;
  end if;
  for placement in select value from jsonb_array_elements(role_value->'menuFallbacks')loop
   select value into canonical_placement from private.matchday_menu_placements_s300_v1(p_tenant_id,release_ids)value
    where value->>'menuSnapshotId'=placement->>'menuSnapshotId'and value->>'placementId'=placement->>'placementId'and value->>'productId'=placement->>'productId';
   if canonical_placement is null or canonical_placement->>'productLabel'is distinct from placement->>'productLabel'then
    ready:=false;reason:='De exacte gepubliceerde menuplaatsing of productnaam is gewijzigd of niet beschikbaar.';end if;
  end loop;
  planning:=private.matchday_plan_s300_v1(p_tenant_id,runbook.id,p_proposal_id,target_id,role_value,configuration);
  targets:=targets||jsonb_build_array(jsonb_build_object('screenId',target_id,'screenName',left(screen.name,200),'role',chosen,
   'ready',ready,'reason',reason,'defaultReleaseId',role_value->'defaultReleaseId','planning',planning));
  if not ready then issues:=issues||jsonb_build_array(jsonb_build_object('screenId',target_id,'role',chosen,'code','TARGET_NOT_READY','message',reason));end if;
  fingerprints:=fingerprints||jsonb_build_array(jsonb_build_object('screenId',target_id,'role',chosen,'playerId',device.id,
   'playerCapability',device.capabilities->'matchdayExpiry','screenTargetRevision',screen.target_revision,
   'orientation',screen.orientation,'width',screen.resolution_width,'height',screen.resolution_height,
   'compositionId',screen.composition_id,'compositionRevision',screen.composition_revision,'normal',normal-'name',
   'planning',(select jsonb_agg(value-'winnerName'order by ordinality)from jsonb_array_elements(planning)with ordinality)));
 end loop;
 if jsonb_array_length(targets)=0 or jsonb_array_length(targets)>200 then
  issues:=issues||jsonb_build_array(jsonb_build_object('screenId',null,'role',null,'code','NO_COMPATIBLE_TARGET','message','Kies één tot tweehonderd concrete compatibele doelschermen.'));
 end if;
 return jsonb_build_object('runbookId',runbook.id,'draftRevision',runbook.revision,'canPublish',jsonb_array_length(issues)=0,
  'targets',targets,'issues',issues,'fingerprint',private.matchday_hash_s300_v1(jsonb_build_object('draft',runbook.id,
   'revision',runbook.revision,'configuration',configuration-'matches','matches',(select coalesce(jsonb_agg(value-array['observedAt','lastSuccessfulSyncAt']order by ordinality),'[]')
    from jsonb_array_elements(configuration->'matches')with ordinality),'targets',fingerprints)));
end$$;

create function public.preview_matchday_publication_s300_v1(p_tenant_id uuid,p_runbook_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid;result jsonb;proof_id uuid:=gen_random_uuid();expires timestamptz:=private.matchday_now_s300_v1()+interval '5 minutes';begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.publish',true);
 if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991 then raise exception 'invalid draft revision'using errcode='22023';end if;
 result:=private.matchday_preflight_s300_v1(p_tenant_id,p_runbook_id,p_expected_revision,proof_id);
 result:=(result-'fingerprint')||jsonb_build_object('id',proof_id,'expiresAt',expires);
 insert into public.matchday_preflights(id,tenant_id,runbook_id,actor_id,draft_revision,fingerprint,result_json,expires_at)
 values(proof_id,p_tenant_id,p_runbook_id,actor,p_expected_revision,
  private.matchday_preflight_s300_v1(p_tenant_id,p_runbook_id,p_expected_revision,proof_id)->>'fingerprint',result,expires);
 return result;
end$$;

-- Only this narrow writer may create S300-owned Publisher rows. Its IDs and
-- target/release/window facts derive from an immutable publication or action.
create function private.matchday_write_schedule_s300_v1(p_tenant_id uuid,p_target_id uuid,p_key text,
 p_release_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_action_id uuid default null)
returns uuid language plpgsql security definer set search_path=''as $$
declare target public.matchday_publication_targets%rowtype;publication public.matchday_publications%rowtype;
 action public.matchday_actions%rowtype;release public.playlist_releases%rowtype;role_value jsonb;phase jsonb;
 schedule_id uuid;snapshot_id uuid;valid boolean:=false;begin
 select *into strict target from public.matchday_publication_targets where tenant_id=p_tenant_id and id=p_target_id;
 select *into strict publication from public.matchday_publications where tenant_id=p_tenant_id and id=target.publication_id;
 select value into role_value from jsonb_array_elements(publication.configuration_json->'roles')where value->>'role'=target.role;
 if p_starts_at<publication.starts_at or p_ends_at>publication.ends_at or p_ends_at<=p_starts_at then
  raise exception 'owned schedule outside its publication window'using errcode='22023';end if;
 if p_action_id is null then
  if p_key='default'then valid:=p_release_id=target.default_release_id and p_starts_at=publication.starts_at and p_ends_at=publication.ends_at;
  else
   select value into phase from jsonb_array_elements(publication.configuration_json->'phaseWindows')
    where p_key='phase:'||(value->>'phase')||':'||(value->>'startsAt')
     and(value->>'startsAt')::timestamptz=p_starts_at and(value->>'endsAt')::timestamptz=p_ends_at;
   valid:=phase is not null and p_release_id=coalesce((target.phase_release_ids->>(phase->>'phase'))::uuid,target.default_release_id);
  end if;
 else
  select *into action from public.matchday_actions where tenant_id=p_tenant_id and id=p_action_id and publication_id=publication.id;
  if action.id is not null and p_key='action:'||action.id and action.payload_json->'screenIds'?target.screen_id::text
   and p_starts_at=action.starts_at and p_ends_at=action.ends_at then
   if action.kind='phase'then valid:=p_release_id=coalesce((target.phase_release_ids->>(action.payload_json->>'phase'))::uuid,target.default_release_id);
   elsif action.kind='sold_out'then valid:=exists(select 1 from jsonb_array_elements(role_value->'menuFallbacks')placement
    where placement->>'menuSnapshotId'=action.payload_json->>'menuSnapshotId'and placement->>'placementId'=action.payload_json->>'placementId'
     and placement->>'productId'=action.payload_json->>'productId'and(placement->>'unavailableReleaseId')::uuid=p_release_id);
   end if;
  end if;
 end if;
 if not coalesce(valid,false)then raise exception 'owned schedule facts are not authorized by the frozen publication'using errcode='42501';end if;
 select *into release from public.playlist_releases where tenant_id=p_tenant_id and id=p_release_id;
 if release.id is null then raise exception 'owned schedule release unavailable'using errcode='23514';end if;
 schedule_id:=private.matchday_schedule_id_s300_v1(publication.id,target.screen_id,p_key);
 if exists(select 1 from public.content_schedules where id=schedule_id)then
  raise exception 'owned schedule identity already exists; review again'using errcode='23505';end if;
 insert into public.content_schedules(id,tenant_id,name,target_kind,target_screen_id,playlist_id,release_id,timezone_name,
  schedule_kind,starts_at,ends_at,recurrence_json,priority,source,enabled,created_by,updated_by)
 values(schedule_id,p_tenant_id,left('Wedstrijddag: '||(publication.configuration_json->>'name')||case when p_key='default'then''else' · '||split_part(p_key,':',2)end,120),
  'screen',target.screen_id,release.playlist_id,release.id,publication.timezone_name,'once',p_starts_at,p_ends_at,'{}',
  case when p_action_id is not null then 102 when p_key='default'then 100 else 101 end,'publisher',true,private.current_user_id(),private.current_user_id());
 snapshot_id:=private.create_publisher_target_snapshot(p_tenant_id,release.id,schedule_id,'screen',target.screen_id,array[target.screen_id],private.current_user_id());
 update public.content_schedules set target_snapshot_id=snapshot_id where tenant_id=p_tenant_id and id=schedule_id;
 insert into public.matchday_owned_schedules(tenant_id,publication_id,target_id,schedule_id,action_id,phase)
 values(p_tenant_id,publication.id,target.id,schedule_id,p_action_id,case when p_action_id is null then coalesce(phase->>'phase','before')else action.kind end);
 insert into public.matchday_deliveries(tenant_id,publication_id,target_id,action_id,schedule_id,action_revision,content_hash,device_id,status)
 values(p_tenant_id,publication.id,target.id,p_action_id,schedule_id,coalesce(action.revision,0),
  private.matchday_hash_s300_v1(jsonb_build_object('publicationId',publication.id,'targetId',target.id,'windowId',schedule_id,
   'releaseId',release.id,'manifestHash',release.manifest_hash,'startsAt',p_starts_at,'endsAt',p_ends_at,'actionHash',action.content_hash)),
  target.player_id,case when p_starts_at>private.matchday_now_s300_v1()then'scheduled'else'queued'end);
 return schedule_id;
end$$;

create function private.matchday_sync_scoped_targets_s300_v1(p_tenant_id uuid,p_publication_id uuid,p_screen_ids uuid[])returns void
language plpgsql security definer set search_path=''as $$
declare screen public.screens%rowtype;winner public.content_schedules%rowtype;release_id uuid;at_time timestamptz:=private.matchday_now_s300_v1();begin
 -- Screen -> device is the existing Publisher lock order. Only the explicitly
 -- frozen targets of this publication can be evaluated or restored here.
 for screen in select selected_screen.*from public.screens selected_screen join public.matchday_publication_targets target
  on target.tenant_id=selected_screen.tenant_id and target.screen_id=selected_screen.id
  where target.tenant_id=p_tenant_id and target.publication_id=p_publication_id and(p_screen_ids is null or selected_screen.id=any(p_screen_ids))
   and selected_screen.status='active'and selected_screen.deleted_at is null
  order by selected_screen.id for update of selected_screen loop
  select candidate.*into winner from private.content_schedule_candidates_s298_v1(p_tenant_id,screen.id,at_time)candidate limit 1;
  release_id:=coalesce(winner.release_id,screen.default_release_id);
  if screen.assigned_release_id is distinct from release_id or screen.active_schedule_id is distinct from winner.id
   or screen.active_target_snapshot_id is distinct from winner.target_snapshot_id then
   update public.screens set assigned_playlist_id=coalesce(winner.playlist_id,screen.default_playlist_id),assigned_release_id=release_id,
    active_assignment_source=case when winner.id is null then'default'when winner.source='override'then'override'else'schedule'end,
    active_schedule_id=winner.id,active_target_snapshot_id=winner.target_snapshot_id,schedule_evaluated_at=at_time
    where tenant_id=p_tenant_id and id=screen.id;
   update public.player_devices set desired_release_id=release_id where tenant_id=p_tenant_id and screen_id=screen.id and status='paired';
   if release_id is not null then insert into public.release_screen_assignments(tenant_id,release_id,screen_id,assignment_kind,assigned_by,target_snapshot_id)
    values(p_tenant_id,release_id,screen.id,case when winner.id is null then'fallback'else'scheduled'end,private.current_user_id(),winner.target_snapshot_id);end if;
  end if;
 end loop;
end$$;

create function private.matchday_sync_targets_s300_v1(p_tenant_id uuid,p_publication_id uuid)returns void
language sql security definer set search_path=''as $$select private.matchday_sync_scoped_targets_s300_v1(p_tenant_id,p_publication_id,null)$$;

create function private.matchday_end_publication_s300_v1(p_tenant_id uuid,p_publication_id uuid,p_status text)returns void
language plpgsql security definer set search_path=''as $$begin
 if p_status not in('closed','cancelled')or not exists(select 1 from public.matchday_publications where tenant_id=p_tenant_id and id=p_publication_id)then
  raise exception 'invalid owned publication lifecycle'using errcode='42501';end if;
 update public.content_schedules schedule set enabled=false,revision=revision+1,updated_by=private.current_user_id()
  where schedule.tenant_id=p_tenant_id and schedule.enabled and exists(select 1 from public.matchday_owned_schedules owned
   where owned.tenant_id=p_tenant_id and owned.publication_id=p_publication_id and owned.schedule_id=schedule.id);
 update public.matchday_action_lifecycle lifecycle set status='cancelled',ended_at=private.matchday_now_s300_v1(),ended_by=private.current_user_id()
  where lifecycle.tenant_id=p_tenant_id and lifecycle.status='active'and exists(select 1 from public.matchday_actions action
   where action.tenant_id=p_tenant_id and action.id=lifecycle.action_id and action.publication_id=p_publication_id);
 update public.matchday_runs set status=p_status,revision=revision+1,ended_at=private.matchday_now_s300_v1()
  where tenant_id=p_tenant_id and publication_id=p_publication_id and status not in('closed','cancelled');
 perform private.matchday_sync_targets_s300_v1(p_tenant_id,p_publication_id);
end$$;

create function public.set_matchday_enabled_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare actor uuid;setting public.matchday_settings%rowtype;publication_id uuid;replay jsonb;begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id,'tenant.settings.manage',true);
 perform private.matchday_keys_s300_v1(p_input,array['enabled','expectedRevision','requestId','reason']);
 perform private.matchday_uuid_s300_v1(p_input->'requestId');
 if jsonb_typeof(p_input->'enabled')<>'boolean'or jsonb_typeof(p_input->'expectedRevision')<>'number'
  or(p_input->>'expectedRevision')::numeric not between 0 and 9007199254740991
  or(p_input->>'expectedRevision')::numeric<>trunc((p_input->>'expectedRevision')::numeric)
  or jsonb_typeof(p_input->'reason')<>'string'or length(btrim(p_input->>'reason'))not between 2 and 300 then
  raise exception 'invalid matchday feature command'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.feature',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,300));
 select *into setting from public.matchday_settings where tenant_id=p_tenant_id for update;
 if coalesce(setting.revision,0)<>(p_input->>'expectedRevision')::bigint then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.feature','conflict',null,null,null,coalesce(setting.revision,0),'De instelling is ondertussen gewijzigd.');end if;
 insert into public.matchday_settings(tenant_id,enabled,revision,updated_by)values(p_tenant_id,(p_input->>'enabled')::boolean,1,actor)
 on conflict(tenant_id)do update set enabled=excluded.enabled,revision=matchday_settings.revision+1,updated_by=actor,updated_at=private.matchday_now_s300_v1()
 returning *into setting;
 if not setting.enabled then
  for publication_id in select run.publication_id from public.matchday_runs run where run.tenant_id=p_tenant_id and run.status not in('closed','cancelled')order by run.publication_id for update loop
   perform private.matchday_end_publication_s300_v1(p_tenant_id,publication_id,'cancelled');end loop;
 end if;
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.feature','applied',null,null,null,setting.revision,
  case when setting.enabled then'Wedstrijddag ingeschakeld. Bestaande content en planning blijven beschikbaar.'else'Wedstrijddag uitgezet; tijdelijke opdrachten beëindigd en gewone planning opnieuw bepaald.'end);
end$$;

create function public.publish_matchday_runbook_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;runbook public.matchday_runbooks%rowtype;proof public.matchday_preflights%rowtype;check_result jsonb;
 configuration jsonb;target_value jsonb;role_value jsonb;window_value jsonb;target_id uuid;snapshot_id uuid;schedule_id uuid;player_id uuid;
 screen public.screens%rowtype;previous_publication uuid;version_number integer;replay jsonb;begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.publish',true);
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','expectedRevision','requestId','preflightId']);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'requestId');perform private.matchday_uuid_s300_v1(p_input->'preflightId');
 if jsonb_typeof(p_input->'expectedRevision')<>'number'or(p_input->>'expectedRevision')::numeric not between 0 and 9007199254740991
  or(p_input->>'expectedRevision')::numeric<>trunc((p_input->>'expectedRevision')::numeric)then raise exception 'invalid publication revision'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.publish',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||(p_input->>'runbookId'),300));
 select *into runbook from public.matchday_runbooks where tenant_id=p_tenant_id and id=(p_input->>'runbookId')::uuid for update;
 if runbook.id is null then raise exception 'runbook outside tenant'using errcode='42501';end if;
 if runbook.revision<>(p_input->>'expectedRevision')::bigint then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.publish','conflict',runbook.id,null,null,runbook.revision,'Het concept is ondertussen gewijzigd. Controleer opnieuw.');end if;
 select *into proof from public.matchday_preflights where tenant_id=p_tenant_id and id=(p_input->>'preflightId')::uuid
  and runbook_id=runbook.id and actor_id=actor and draft_revision=runbook.revision and expires_at>private.matchday_now_s300_v1()for share;
 if proof.id is null or exists(select 1 from public.matchday_publications where id=proof.id)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.publish','blocked',runbook.id,null,null,runbook.revision,'De controle is verlopen of gebruikt. Controleer opnieuw voordat je publiceert.');end if;
 perform 1 from public.screens where tenant_id=p_tenant_id and id in(select(value->>'screenId')::uuid from jsonb_array_elements(proof.result_json->'targets'))order by id for update;
 perform 1 from public.player_devices where tenant_id=p_tenant_id and screen_id in(select(value->>'screenId')::uuid from jsonb_array_elements(proof.result_json->'targets'))and status='paired'order by id for share;
 check_result:=private.matchday_preflight_s300_v1(p_tenant_id,runbook.id,runbook.revision,proof.id);
 if not(check_result->>'canPublish')::boolean or check_result->>'fingerprint'is distinct from proof.fingerprint then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.publish','blocked',runbook.id,null,null,runbook.revision,'Doelen, broncontext, ondersteuning of planning zijn gewijzigd. Controleer opnieuw.');end if;
 configuration:=private.matchday_configuration_s300_v1(p_tenant_id,runbook.configuration_json);
 previous_publication:=runbook.current_publication_id;
 if previous_publication is not null then perform private.matchday_end_publication_s300_v1(p_tenant_id,previous_publication,'closed');end if;
 select coalesce(max(version),0)+1 into version_number from public.matchday_publications where tenant_id=p_tenant_id and runbook_id=runbook.id;
 insert into public.matchday_publications(id,tenant_id,runbook_id,version,draft_revision,configuration_json,starts_at,ends_at,timezone_name,published_by)
 values(proof.id,p_tenant_id,runbook.id,version_number,runbook.revision,configuration,(configuration->>'startsAt')::timestamptz,
  (configuration->>'endsAt')::timestamptz,configuration->>'timezone',actor);
 insert into public.matchday_runs(tenant_id,publication_id,status,phase_actor_id)values(p_tenant_id,proof.id,
  case when(configuration->>'startsAt')::timestamptz>private.matchday_now_s300_v1()then'scheduled'else'active'end,actor);
 for target_value in select value from jsonb_array_elements(check_result->'targets')order by value->>'screenId'loop
  select *into strict screen from public.screens where tenant_id=p_tenant_id and id=(target_value->>'screenId')::uuid;
  select id into strict player_id from public.player_devices where tenant_id=p_tenant_id and screen_id=screen.id and status='paired'order by paired_at desc,id limit 1;
  select value into role_value from jsonb_array_elements(configuration->'roles')where value->>'role'=target_value->>'role';
  target_id:=gen_random_uuid();snapshot_id:=private.create_publisher_target_snapshot(p_tenant_id,(role_value->>'defaultReleaseId')::uuid,null,'direct',proof.id,array[screen.id],actor);
  insert into public.matchday_publication_targets(id,tenant_id,publication_id,screen_id,screen_name,role,target_snapshot_id,
   default_release_id,phase_release_ids,player_id,orientation,width,height,composition_id,composition_revision)
  values(target_id,p_tenant_id,proof.id,screen.id,left(screen.name,200),target_value->>'role',snapshot_id,
   (role_value->>'defaultReleaseId')::uuid,role_value->'phaseReleaseIds',player_id,screen.orientation::text,screen.resolution_width,screen.resolution_height,screen.composition_id,screen.composition_revision);
  schedule_id:=private.matchday_write_schedule_s300_v1(p_tenant_id,target_id,'default',(role_value->>'defaultReleaseId')::uuid,
   (configuration->>'startsAt')::timestamptz,(configuration->>'endsAt')::timestamptz);
  for window_value in select value from jsonb_array_elements(configuration->'phaseWindows')loop
   schedule_id:=private.matchday_write_schedule_s300_v1(p_tenant_id,target_id,'phase:'||(window_value->>'phase')||':'||(window_value->>'startsAt'),
    coalesce((role_value#>>array['phaseReleaseIds',window_value->>'phase'])::uuid,(role_value->>'defaultReleaseId')::uuid),
    (window_value->>'startsAt')::timestamptz,(window_value->>'endsAt')::timestamptz);
  end loop;
 end loop;
 update public.matchday_runbooks set current_publication_id=proof.id,revision=revision+1,updated_by=actor,updated_at=private.matchday_now_s300_v1()
  where tenant_id=p_tenant_id and id=runbook.id returning *into runbook;
 perform private.matchday_sync_targets_s300_v1(p_tenant_id,proof.id);
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.publish','applied',runbook.id,proof.id,null,runbook.revision,
  'Draaiboekversie gepubliceerd voor de gecontroleerde concrete schermen. Weergave wacht op passend Playerbewijs.');
end$$;

create function private.matchday_can_operate_s300_v1(p_tenant_id uuid,p_publication_id uuid,p_kind text,
 p_object_key text,p_screen_ids uuid[],p_until timestamptz)returns boolean
language sql stable security definer set search_path=''as $$
 select private.has_tenant_capability(p_tenant_id,'tenant.playlist.publish')or exists(
  select 1 from public.matchday_delegations delegation join public.tenant_memberships membership
   on membership.tenant_id=delegation.tenant_id and membership.user_id=delegation.user_id
  where delegation.tenant_id=p_tenant_id and delegation.publication_id=p_publication_id and delegation.user_id=private.current_user_id()
   and delegation.revoked_at is null and delegation.ends_at>=p_until and delegation.ends_at>private.matchday_now_s300_v1()
   and p_kind=any(delegation.action_kinds)and p_object_key=any(delegation.object_ids)and p_screen_ids<@delegation.screen_ids)
$$;
create function private.matchday_can_read_s300_v1(p_tenant_id uuid,p_publication_id uuid)returns boolean
language sql stable security definer set search_path=''as $$
 select private.has_tenant_capability(p_tenant_id,'tenant.release.read')or exists(
  select 1 from public.matchday_delegations delegation join public.tenant_memberships membership
   on membership.tenant_id=delegation.tenant_id and membership.user_id=delegation.user_id
  join public.matchday_publications publication on publication.tenant_id=delegation.tenant_id and publication.id=delegation.publication_id
  where delegation.tenant_id=p_tenant_id and delegation.publication_id=p_publication_id and delegation.user_id=private.current_user_id()
   and delegation.revoked_at is null and delegation.ends_at>private.matchday_now_s300_v1()and publication.ends_at>private.matchday_now_s300_v1())
$$;

create function private.matchday_publication_json_s300_v1(p_tenant_id uuid,p_publication_id uuid)returns jsonb
language sql stable security definer set search_path=''as $$
 select jsonb_build_object('id',publication.id,'runbookId',publication.runbook_id,'version',publication.version,
  'draftRevision',publication.draft_revision,'configuration',publication.configuration_json,'publishedAt',publication.published_at,
  'status',case when run.status in('closed','cancelled')then run.status when publication.ends_at<=private.matchday_now_s300_v1()then'closed'
   when publication.starts_at>private.matchday_now_s300_v1()then'scheduled'else'active'end,'phase',run.phase,
  'phaseActor',left(coalesce(actor.display_name,'Bevoegde beheerder'),200),'phaseChangedAt',run.phase_changed_at,
  'targets',(select coalesce(jsonb_agg(jsonb_build_object('screenId',target.screen_id,'screenName',target.screen_name,'role',target.role,
   'targetSnapshotId',target.target_snapshot_id,'defaultReleaseId',target.default_release_id,'phaseReleaseIds',target.phase_release_ids,
   'orientation',target.orientation,'width',target.width,'height',target.height,'expiryCapability',target.expiry_capability,'playerId',target.player_id)
   order by target.screen_id),'[]')from public.matchday_publication_targets target where target.tenant_id=p_tenant_id and target.publication_id=publication.id))
 from public.matchday_publications publication join public.matchday_runs run on run.tenant_id=publication.tenant_id and run.publication_id=publication.id
 left join public.profiles actor on actor.id=run.phase_actor_id where publication.tenant_id=p_tenant_id and publication.id=p_publication_id
$$;

create function private.matchday_action_json_s300_v1(p_action public.matchday_actions)returns jsonb
language sql stable security definer set search_path=''as $$
 select jsonb_build_object('id',p_action.id,'publicationId',p_action.publication_id,'revision',p_action.revision,'objectKey',p_action.object_key,
  'kind',p_action.kind,'matchId',p_action.payload_json->'matchId','productId',p_action.payload_json->'productId',
  'menuSnapshotId',p_action.payload_json->'menuSnapshotId','placementId',p_action.payload_json->'placementId',
  'value',left(case p_action.kind when'field'then p_action.payload_json->>'field'when'phase'then p_action.payload_json->>'phase'
   when'postponed'then coalesce(p_action.payload_json->>'newKickoffAt','Uitgesteld')when'cancelled'then'Afgelast'
   when'sold_out'then'Uitverkocht: '||(p_action.payload_json->>'productLabel')else'Weer beschikbaar: '||(p_action.payload_json->>'productLabel')end,500),
  'actorLabel',left(coalesce(actor.display_name,'Bevoegde vrijwilliger'),200),'startsAt',p_action.starts_at,'endsAt',p_action.ends_at,
  'status',case when lifecycle.status<>'active'then lifecycle.status when p_action.ends_at<=private.matchday_now_s300_v1()then'expired'else'active'end,
  'contentHash',p_action.content_hash,'screenIds',p_action.payload_json->'screenIds')
 from public.matchday_action_lifecycle lifecycle left join public.profiles actor on actor.id=p_action.actor_id
 where lifecycle.tenant_id=p_action.tenant_id and lifecycle.action_id=p_action.id
$$;

create function private.matchday_context_projection_s300_v1(p_tenant_id uuid,p_source_id uuid,p_connection_id uuid,p_context jsonb)
returns jsonb language plpgsql stable security definer set search_path=''as $$declare value jsonb;begin
 value:=jsonb_build_object('sourceId',p_source_id,'connectionId',p_connection_id,'teamId',p_context->>'providerTeamId',
  'competitionId',p_context->'competitionId','poolId',p_context->'poolId','seasonId',p_context->'seasonId','phaseId',p_context->'phaseId','selectionMode','pinned');
 return private.matchday_context_s300_v1(p_tenant_id,value);
exception when insufficient_privilege or invalid_parameter_value then return null;
end$$;

-- This projection is deliberately not a writer or a replacement publication.
-- Delegates see only assigned objects/screens; server commands always read the
-- original immutable configuration and recheck the complete grant themselves.
create function private.matchday_delegate_configuration_s300_v1(p_configuration jsonb,p_screens uuid[],p_objects text[],p_frozen_targets jsonb)
returns jsonb language plpgsql immutable set search_path=''as $$declare result jsonb:=p_configuration;matches jsonb;roles jsonb;context jsonb;main_id text;begin
 select coalesce(jsonb_agg(value order by ordinality),'[]')into matches from jsonb_array_elements(p_configuration->'matches')with ordinality
  where exists(select 1 from unnest(p_objects)object where object in('match:'||(value->>'id')||':field','match:'||(value->>'id')||':phase'));
 main_id:=case when exists(select 1 from jsonb_array_elements(matches)value where value->>'id'=p_configuration->>'mainMatchId')then p_configuration->>'mainMatchId'end;
 context:=case when main_id is not null then p_configuration->'context'when jsonb_array_length(matches)>0 then matches#>'{0,context}'else'null'::jsonb end;
 select coalesce(jsonb_agg(role.value||jsonb_build_object('targets',targets.items,'menuFallbacks',menus.items,'ledBinding',case when main_id is not null then role.value->'ledBinding'else'null'::jsonb end)order by role.ordinality)
  filter(where jsonb_array_length(targets.items)>0),'[]')into roles
 from jsonb_array_elements(p_configuration->'roles')with ordinality role
 cross join lateral(select coalesce(jsonb_agg(jsonb_build_object('kind','screen','id',screen)order by screen),'[]')items
  from(select(value->>'screenId')::uuid screen from jsonb_array_elements(p_frozen_targets)
   where(value->>'screenId')::uuid=any(p_screens)and value->>'role'=role.value->>'role')allowed)targets
 cross join lateral(select coalesce(jsonb_agg(menu),'[]')items from jsonb_array_elements(role.value->'menuFallbacks')menu
  where('menu:'||(menu->>'menuSnapshotId')||':'||(menu->>'placementId')||':'||(menu->>'productId'))=any(p_objects))menus;
 result:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(result,'{matches}',matches),'{mainMatchId}',coalesce(to_jsonb(main_id),'null')),'{context}',context),'{roles}',roles);
 return jsonb_set(result,'{overlapDecisions}','[]');
end$$;

create function public.get_matchday_workspace_s300_v1(p_tenant_id uuid,p_runbook_id uuid default null,p_day text default null)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare actor uuid;full_read boolean;can_edit boolean;can_publish boolean;can_manage boolean;selected jsonb;runbook public.matchday_runbooks%rowtype;
 publication jsonb;configuration jsonb;delegation public.matchday_delegations%rowtype;screen_ids uuid[];objects text[];
 contexts jsonb:='[]';matches jsonb:='[]';screens jsonb:='[]';groups jsonb:='[]';releases jsonb:='[]';members jsonb:='[]';menus jsonb:='[]';led jsonb:='[]';
 runbooks jsonb:='[]';actions jsonb:='[]';deliveries jsonb:='[]';delegations jsonb:='[]';permitted jsonb:='[]';revisions jsonb:='[]';audit jsonb:='[]';
 context_value jsonb;item record;day date;selected_publication_id uuid;run_revision bigint;kind text;object_key text;until_time timestamptz;allowed_screens uuid[];begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id);
 full_read:=private.has_tenant_capability(p_tenant_id,'tenant.release.read');
 can_edit:=private.has_tenant_capability(p_tenant_id,'tenant.playlist.write');can_publish:=private.has_tenant_capability(p_tenant_id,'tenant.playlist.publish');
 can_manage:=private.has_tenant_capability(p_tenant_id,'tenant.settings.manage');
 if not full_read and not can_manage and not exists(select 1 from public.matchday_delegations grant_row
  join public.tenant_memberships membership on membership.tenant_id=grant_row.tenant_id and membership.user_id=grant_row.user_id
  where grant_row.tenant_id=p_tenant_id and grant_row.user_id=actor and grant_row.revoked_at is null and grant_row.ends_at>private.matchday_now_s300_v1())then
  raise exception 'matchday workspace is not authorized'using errcode='42501';end if;
 if p_day is not null and p_day!~'^\d{4}-\d{2}-\d{2}$'then raise exception 'invalid matchday date'using errcode='22023';end if;
 day:=coalesce(p_day::date,(private.matchday_now_s300_v1()at time zone coalesce((select timezone_name from public.tenant_settings where tenant_id=p_tenant_id),'Europe/Amsterdam'))::date);
 if day<'2000-01-01'::date or day>='2100-01-01'::date then raise exception 'matchday date outside supported bounds'using errcode='22023';end if;
 select coalesce(jsonb_agg(value order by updated_at desc,id),'[]')into runbooks from(
  select book.id,book.updated_at,jsonb_build_object('id',book.id,'name',book.configuration_json->>'name','draftRevision',book.revision,
   'startsAt',book.configuration_json->'startsAt','endsAt',book.configuration_json->'endsAt','currentPublicationId',book.current_publication_id,
   'status',coalesce(private.matchday_publication_json_s300_v1(p_tenant_id,book.current_publication_id)->>'status','draft'))value
  from public.matchday_runbooks book where book.tenant_id=p_tenant_id and(full_read or private.matchday_can_read_s300_v1(p_tenant_id,book.current_publication_id))
  order by book.updated_at desc,book.id limit 100)visible;
 if p_runbook_id is not null then
  select *into runbook from public.matchday_runbooks where tenant_id=p_tenant_id and id=p_runbook_id;
  if runbook.id is null or not(full_read or private.matchday_can_read_s300_v1(p_tenant_id,runbook.current_publication_id))then
   raise exception 'runbook outside authorized workspace'using errcode='42501';end if;
  selected_publication_id:=runbook.current_publication_id;configuration:=runbook.configuration_json;
  publication:=private.matchday_publication_json_s300_v1(p_tenant_id,selected_publication_id);
  if selected_publication_id is not null then
   select revision into run_revision from public.matchday_runs where tenant_id=p_tenant_id and matchday_runs.publication_id=selected_publication_id;
   if not full_read then
    select *into strict delegation from public.matchday_delegations where tenant_id=p_tenant_id and matchday_delegations.publication_id=selected_publication_id
     and user_id=actor and revoked_at is null and ends_at>private.matchday_now_s300_v1();
    screen_ids:=delegation.screen_ids;objects:=delegation.object_ids;configuration:=private.matchday_delegate_configuration_s300_v1(publication->'configuration',screen_ids,objects,publication->'targets');
    publication:=jsonb_set(jsonb_set(publication,'{configuration}',configuration),'{targets}',
     (select coalesce(jsonb_agg(value),'[]')from jsonb_array_elements(publication->'targets')where(value->>'screenId')::uuid=any(screen_ids)));
   else
    select array_agg(screen_id order by screen_id)into screen_ids from public.matchday_publication_targets where tenant_id=p_tenant_id and matchday_publication_targets.publication_id=selected_publication_id;
   end if;
   select coalesce(jsonb_agg(value order by created_at desc,id),'[]')into actions from(
    select action.id,action.created_at,private.matchday_action_json_s300_v1(row(action.*)::public.matchday_actions)||jsonb_build_object('screenIds',
     (select jsonb_agg(value)from jsonb_array_elements(action.payload_json->'screenIds')where full_read or(value#>>'{}')::uuid=any(screen_ids)))value
    from public.matchday_actions action where action.tenant_id=p_tenant_id and action.publication_id=selected_publication_id
     and(full_read or(action.object_key=any(objects)and exists(select 1 from jsonb_array_elements_text(action.payload_json->'screenIds')target
      where target::uuid=any(screen_ids))))order by action.created_at desc,action.id limit 200)visible;
   select coalesce(jsonb_agg(value order by created_at desc,id),'[]')into deliveries from(
    select delivery.id,delivery.created_at,jsonb_build_object('id',delivery.id,'publicationId',delivery.publication_id,'actionId',delivery.action_id,
     'actionRevision',delivery.action_revision,'screenId',target.screen_id,'screenName',target.screen_name,'deviceId',delivery.device_id,
     'status',case when delivery.restored_at is not null then'restored'when delivery.status in('skipped','failed')then delivery.status
      when schedule.id is not null and(not schedule.enabled or schedule.ends_at<=private.matchday_now_s300_v1())then'restoring'
      when delivery.action_id is not null and(action.ends_at<=private.matchday_now_s300_v1()or lifecycle.status<>'active')then'restoring'
      else delivery.status end,'receivedAt',delivery.received_at,'renderedAt',delivery.rendered_at,'contentHash',delivery.content_hash,
     'confirmedReleaseId',delivery.confirmed_release_id,'detail',delivery.detail)value
    from public.matchday_deliveries delivery join public.matchday_publication_targets target on target.tenant_id=delivery.tenant_id and target.id=delivery.target_id
    left join public.matchday_actions action on action.tenant_id=delivery.tenant_id and action.id=delivery.action_id
    left join public.matchday_action_lifecycle lifecycle on lifecycle.tenant_id=action.tenant_id and lifecycle.action_id=action.id
    left join public.content_schedules schedule on schedule.tenant_id=delivery.tenant_id and schedule.id=delivery.schedule_id
    where delivery.tenant_id=p_tenant_id and delivery.publication_id=selected_publication_id
     and(full_read or(target.screen_id=any(screen_ids)and(delivery.action_id is null or action.object_key=any(objects))))
    order by delivery.created_at desc,delivery.id limit 500)visible;
   select coalesce(jsonb_agg(jsonb_build_object('key',state.object_key,'revision',state.revision)order by state.object_key),'[]')into revisions
    from public.matchday_object_states state where state.tenant_id=p_tenant_id and state.publication_id=selected_publication_id and(full_read or state.object_key=any(objects));
   if full_read then revisions:=revisions||jsonb_build_array(jsonb_build_object('key','publication:'||selected_publication_id,'revision',run_revision));end if;
   select coalesce(jsonb_agg(value order by created_at desc,id),'[]')into audit from(
    select event.id,event.created_at,jsonb_build_object('id',event.id,'action',left(event.action,120),'actorLabel',left(coalesce(profile.display_name,'Bevoegde vrijwilliger'),200),
     'at',event.created_at,'beforeText',case when previous.id is not null and(full_read or exists(select 1 from jsonb_array_elements_text(previous.payload_json->'screenIds')target where target::uuid=any(screen_ids)))
      then private.matchday_action_json_s300_v1(row(previous.*)::public.matchday_actions)->>'value'end,'afterText',private.matchday_action_json_s300_v1(row(action.*)::public.matchday_actions)->>'value','requestId',action.request_id)value
    from public.matchday_actions action join public.audit_events event on event.tenant_id=action.tenant_id and event.target_id=action.id and event.target_type='matchday_actions'and event.action='matchday.action.value'
    left join public.matchday_actions previous on previous.tenant_id=action.tenant_id and previous.id=action.supersedes_action_id
    left join public.profiles profile on profile.id=event.actor_user_id
    where action.tenant_id=p_tenant_id and action.publication_id=selected_publication_id
     and(full_read or(action.object_key=any(objects)and exists(select 1 from jsonb_array_elements_text(action.payload_json->'screenIds')target where target::uuid=any(screen_ids))))
    order by event.created_at desc,event.id limit 200)visible;
   if can_publish then select coalesce(jsonb_agg(jsonb_build_object('id',grant_row.id,'userId',grant_row.user_id,'userLabel',left(profile.display_name,200),
    'screenIds',grant_row.screen_ids,'objectIds',grant_row.object_ids,'actionKinds',grant_row.action_kinds,'endsAt',grant_row.ends_at,'revision',grant_row.revision)order by grant_row.id),'[]')into delegations
    from public.matchday_delegations grant_row join public.profiles profile on profile.id=grant_row.user_id
    where grant_row.tenant_id=p_tenant_id and grant_row.publication_id=selected_publication_id and grant_row.revoked_at is null;end if;
   for context_value in select value from jsonb_array_elements(coalesce(publication#>'{configuration,matches}','[]'))loop
    foreach kind in array array['field','phase','postponed','cancelled']loop
     object_key:='match:'||(context_value->>'id')||case when kind='field'then':field'else':phase'end;
     until_time:=least((publication#>>'{configuration,endsAt}')::timestamptz,coalesce(delegation.ends_at,'infinity'::timestamptz));
     if can_publish or(not full_read and kind=any(delegation.action_kinds)and object_key=any(objects))then
      allowed_screens:=screen_ids;
      if kind in('phase','postponed','cancelled')and context_value->>'id'=publication#>>'{configuration,mainMatchId}'
       and not can_publish and cardinality(screen_ids)<>(select count(*)from public.matchday_publication_targets where tenant_id=p_tenant_id and matchday_publication_targets.publication_id=selected_publication_id)then continue;end if;
      if kind='phase'and context_value->>'id'is distinct from publication#>>'{configuration,mainMatchId}'then continue;end if;
      permitted:=permitted||jsonb_build_array(jsonb_build_object('kind',kind,'objectId',object_key,'screenIds',allowed_screens,'endsAt',until_time));
     end if;
    end loop;
   end loop;
  end if;
  selected:=jsonb_build_object('id',runbook.id,'readScope',case when full_read then'full'else'delegated'end,'draftRevision',runbook.revision,
   'configuration',configuration,'publication',publication,'actions',actions,'deliveries',deliveries,'delegations',delegations,
   'permittedActions',permitted,'objectRevisions',revisions,'audit',audit);
 end if;
 if full_read then
  if private.has_tenant_capability(p_tenant_id,'tenant.data_source.read')then
   for item in select connection.id,connection.data_source_id,option.value->'context'context
    from public.sportlink_connections connection cross join lateral jsonb_array_elements(private.sportlink_season_contexts_s301_v1(p_tenant_id,connection.id))option
    where connection.tenant_id=p_tenant_id and connection.status='active'order by connection.id,option.value::text limit 100 loop
    context_value:=private.matchday_context_projection_s300_v1(p_tenant_id,item.data_source_id,item.id,item.context);
    if context_value is not null then contexts:=contexts||jsonb_build_array(context_value);end if;
   end loop;
   select coalesce(jsonb_agg(value order by starts_at,id),'[]')into matches from(
    select distinct on(match.id)match.id,match.starts_at,private.matchday_match_s300_v1(p_tenant_id,match.id,context.value)value
    from public.sports_matches match join public.sportlink_connections connection on connection.tenant_id=match.tenant_id and connection.id=match.source_connection_id
    cross join lateral jsonb_array_elements(contexts)context(value)
    where match.tenant_id=p_tenant_id and match.active and match.source_connection_id::text=context.value->>'connectionId'
     and context.value->>'teamId'in(match.home_team->>'externalId',match.away_team->>'externalId')
     and private.sync_sportlink_effective_pool_v1(match)=context.value->>'poolId'
     and private.sportlink_competition_identity_v1(match.competition,match.pool)=context.value->>'competitionId'
     and nullif(match.competition->>'season','unknown')is not distinct from context.value->>'seasonId'
     and match.competition->>'period'is not distinct from context.value->>'phaseId'
     and match.starts_at>=(day::timestamp at time zone connection.timezone)and match.starts_at<((day+1)::timestamp at time zone connection.timezone)
    order by match.id,(context.value->>'teamId'=configuration#>>'{context,teamId}')desc,context.value::text limit 200)visible;
   select coalesce(jsonb_agg(value),'[]')into menus from private.matchday_menu_placements_s300_v1(p_tenant_id)value;
   select coalesce(jsonb_agg(value),'[]')into led from private.matchday_led_options_s300_v1(p_tenant_id,(configuration->>'mainMatchId')::uuid)value;
  end if;
  if private.has_tenant_capability(p_tenant_id,'tenant.screen.read')then
   select coalesce(jsonb_agg(value order by name,id),'[]')into screens from(
    select screen.id,screen.name,jsonb_build_object('id',screen.id,'name',left(screen.name,200),'status',screen.status,'orientation',screen.orientation,
     'width',screen.resolution_width,'height',screen.resolution_height,'playerId',device.id,
     'expiryCapability',coalesce(device.capabilities->>'matchdayExpiry'='matchday-expiry-v1',false),'lastSeenAt',device.last_seen_at,
     'confirmedReleaseId',case when frame.frame_at is not null and device.current_sync_detail#>>'{publicationTrace,releaseId}'=device.active_release_id::text
      and frame.frame_at<=device.last_seen_at and device.last_seen_at<=private.matchday_now_s300_v1()then device.active_release_id end,
     'confirmedAt',case when frame.frame_at is not null and device.current_sync_detail#>>'{publicationTrace,releaseId}'=device.active_release_id::text
      and frame.frame_at<=device.last_seen_at and device.last_seen_at<=private.matchday_now_s300_v1()then frame.frame_at end)value
    from public.screens screen left join lateral(select *from public.player_devices where tenant_id=p_tenant_id and screen_id=screen.id and status='paired'order by paired_at desc,id limit 1)device on true
    cross join lateral(select private.screen_frame_timestamp_s296_v1(device.current_sync_detail#>>'{publicationTrace,firstFrameAt}')frame_at)frame
    where screen.tenant_id=p_tenant_id and screen.deleted_at is null order by screen.name,screen.id limit 200)visible;
   select coalesce(jsonb_agg(value order by name,id),'[]')into groups from(
    select group_row.id,group_row.name,jsonb_build_object('id',group_row.id,'name',left(group_row.name,200),'screenIds',coalesce(jsonb_agg(member.screen_id order by member.screen_id)filter(where member.screen_id is not null),'[]'))value
    from public.screen_groups group_row left join public.screen_group_memberships member on member.tenant_id=group_row.tenant_id and member.screen_group_id=group_row.id
    where group_row.tenant_id=p_tenant_id and group_row.status='active'and not group_row.is_internal
    group by group_row.id having count(member.screen_id)<=200 order by group_row.name,group_row.id limit 100)visible;
  end if;
  select coalesce(jsonb_agg(value order by published_at desc,id),'[]')into releases from(
   select release.id,release.published_at,private.matchday_release_s300_v1(p_tenant_id,release.id)-array['compatible','manifestHash']value
   from public.playlist_releases release where release.tenant_id=p_tenant_id order by release.published_at desc,release.id limit 200)visible;
  if can_publish then select coalesce(jsonb_agg(value order by label,id),'[]')into members from(
   select profile.id,left(profile.display_name,200)label,jsonb_build_object('id',profile.id,'label',left(profile.display_name,200))value
   from public.tenant_memberships membership join public.profiles profile on profile.id=membership.user_id
   where membership.tenant_id=p_tenant_id order by profile.display_name,profile.id limit 200)visible;end if;
 end if;
 return jsonb_build_object('schemaVersion',1,'generatedAt',private.matchday_now_s300_v1(),'enabled',coalesce((select enabled from public.matchday_settings where tenant_id=p_tenant_id),false),
  'settingsRevision',coalesce((select revision from public.matchday_settings where tenant_id=p_tenant_id),0),
  'permissions',jsonb_build_object('canManageFeature',can_manage,'canEdit',full_read and can_edit,'canPublish',full_read and can_publish,'canDelegate',full_read and can_publish),
  'runbooks',runbooks,'selected',selected,'options',jsonb_build_object('contexts',contexts,'matches',matches,'screens',screens,'groups',groups,
   'releases',releases,'members',members,'menuPlacements',menus,'ledConfigurations',led));
end$$;

create function private.matchday_revision_s300_v1(p_value jsonb)returns bigint
language plpgsql immutable set search_path=''as $$begin
 if jsonb_typeof(p_value)is distinct from'number'or(p_value#>>'{}')::numeric not between 0 and 9007199254740991
  or(p_value#>>'{}')::numeric<>trunc((p_value#>>'{}')::numeric)then raise exception 'invalid matchday revision'using errcode='22023';end if;
 return(p_value#>>'{}')::bigint;
end$$;

create function private.matchday_member_actor_s300_v1(p_tenant_id uuid)returns uuid
language plpgsql stable security definer set search_path=''as $$declare actor uuid;begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id,null,true);
 if not private.has_tenant_capability(p_tenant_id,'tenant.playlist.publish')and not exists(select 1 from public.tenant_memberships
  where tenant_id=p_tenant_id and user_id=actor)then raise exception 'matchday operator outside tenant'using errcode='42501';end if;
 return actor;
end$$;

create function public.apply_matchday_action_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;publication public.matchday_publications%rowtype;run public.matchday_runs%rowtype;head public.matchday_object_states%rowtype;
 action public.matchday_actions%rowtype;target public.matchday_publication_targets%rowtype;previous public.matchday_actions%rowtype;
 kind text:=p_input->>'kind';operation_key text;expected bigint;screen_ids uuid[];until_time timestamptz;at_time timestamptz:=private.matchday_now_s300_v1();
 match_value jsonb;payload jsonb;role_value jsonb;placement jsonb;release_check jsonb;release_id uuid;global_main boolean;valid_transition boolean;
 replay jsonb;new_action_id uuid:=gen_random_uuid();schedule_id uuid;reason text;begin
 actor:=private.matchday_member_actor_s300_v1(p_tenant_id);
 if kind not in('field','phase','postponed','cancelled','sold_out','available')or kind is null then raise exception 'invalid action kind'using errcode='22023';end if;
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','publicationId','expectedRevision','requestId','screenIds','endsAt','reason','kind']||
  case kind when'field'then array['matchId','field']when'phase'then array['matchId','phase']when'postponed'then array['matchId','newKickoffAt']
   when'cancelled'then array['matchId']else array['productId','menuSnapshotId','placementId']end);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'publicationId');perform private.matchday_uuid_s300_v1(p_input->'requestId');
 expected:=private.matchday_revision_s300_v1(p_input->'expectedRevision');
 if jsonb_typeof(p_input->'screenIds')<>'array'or jsonb_array_length(p_input->'screenIds')not between 1 and 200
  or jsonb_typeof(p_input->'reason')<>'string'or length(btrim(p_input->>'reason'))not between 2 and 300 then raise exception 'invalid action targets or reason'using errcode='22023';end if;
 select array_agg(private.matchday_uuid_s300_v1(value)order by value#>>'{}')into screen_ids from jsonb_array_elements(p_input->'screenIds');
 if(select count(distinct value)from unnest(screen_ids)value)<>cardinality(screen_ids)then raise exception 'duplicate action targets'using errcode='22023';end if;
 until_time:=private.screen_frame_timestamp_s296_v1(p_input->>'endsAt');
 if until_time is null then raise exception 'finite action expiry required'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.action',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 select *into publication from public.matchday_publications where tenant_id=p_tenant_id and id=(p_input->>'publicationId')::uuid
  and runbook_id=(p_input->>'runbookId')::uuid;
 if publication.id is null then raise exception 'action publication outside tenant or runbook'using errcode='42501';end if;
 select *into strict run from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id for update;
 if until_time<=at_time or until_time>publication.ends_at or publication.starts_at>at_time or publication.ends_at<=at_time
  or run.status in('closed','cancelled')or not coalesce((select enabled from public.matchday_settings where tenant_id=p_tenant_id),false)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,run.revision,'Deze uitvoering of vervaltijd is niet meer actief.');end if;
 if(select count(*)from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screen_ids))<>cardinality(screen_ids)then
  raise exception 'action target outside frozen publication'using errcode='42501';end if;
 if kind in('sold_out','available')then
  perform private.matchday_uuid_s300_v1(p_input->'productId');perform private.matchday_uuid_s300_v1(p_input->'menuSnapshotId');
  if jsonb_typeof(p_input->'placementId')<>'string'or length(btrim(p_input->>'placementId'))not between 1 and 200 then raise exception 'invalid placement'using errcode='22023';end if;
  operation_key:='menu:'||(p_input->>'menuSnapshotId')||':'||(p_input->>'placementId')||':'||(p_input->>'productId');
  select role into reason from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screen_ids)and role<>'canteen'limit 1;
  if found then raise exception 'menu action outside canteen targets'using errcode='42501';end if;
  select value into role_value from jsonb_array_elements(publication.configuration_json->'roles')where value->>'role'='canteen';
  select value into placement from jsonb_array_elements(role_value->'menuFallbacks')where value->>'productId'=p_input->>'productId'
   and value->>'menuSnapshotId'=p_input->>'menuSnapshotId'and value->>'placementId'=p_input->>'placementId';
  if placement is null then raise exception 'menu action has no frozen compatible placement'using errcode='42501';end if;
  payload:=p_input||jsonb_build_object('productLabel',placement->>'productLabel');
 else
  perform private.matchday_uuid_s300_v1(p_input->'matchId');
  select value into match_value from jsonb_array_elements(publication.configuration_json->'matches')where value->>'id'=p_input->>'matchId';
  if match_value is null then raise exception 'action match outside frozen publication'using errcode='42501';end if;
  operation_key:='match:'||(p_input->>'matchId')||case when kind='field'then':field'else':phase'end;
  if kind='field'and(jsonb_typeof(p_input->'field')<>'string'or length(btrim(p_input->>'field'))not between 1 and 120)then raise exception 'invalid field value'using errcode='22023';end if;
  if kind='postponed'and p_input->'newKickoffAt'<>'null'::jsonb and private.screen_frame_timestamp_s296_v1(p_input->>'newKickoffAt')is null then
   raise exception 'invalid explicit proposed kick-off'using errcode='22023';end if;
  payload:=p_input||jsonb_build_object('matchCode',match_value->>'matchCode','homeTeamName',match_value->>'homeTeamName','awayTeamName',match_value->>'awayTeamName');
 end if;
 if not private.matchday_can_operate_s300_v1(p_tenant_id,publication.id,kind,operation_key,screen_ids,until_time)then
  raise exception 'action outside explicit object, action, targets or grant expiry'using errcode='42501';end if;
 global_main:=kind in('phase','postponed','cancelled')and p_input->>'matchId'=publication.configuration_json->>'mainMatchId';
 if global_main and cardinality(screen_ids)<>(select count(*)from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,run.revision,
   'Deze hoofdwedstrijdactie geldt voor alle draaiboekdoelen; vraag een volledig bevoegde wedstrijddienst om bevestiging');end if;
 if kind='phase'then
  valid_transition:=global_main and case run.phase
   when'before'then p_input->>'phase'in('playing','postponed','cancelled')when'playing'then p_input->>'phase'in('halftime','finished','postponed','cancelled')
   when'halftime'then p_input->>'phase'in('resumed','finished','postponed','cancelled')when'resumed'then p_input->>'phase'in('halftime','finished','postponed','cancelled')
   when'postponed'then p_input->>'phase'in('before','cancelled')else false end;
  if not coalesce(valid_transition,false)then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,run.revision,'Deze faseovergang is niet geldig voor de hoofdwedstrijd.');end if;
 end if;
 insert into public.matchday_object_states(tenant_id,publication_id,object_key)values(p_tenant_id,publication.id,operation_key)on conflict do nothing;
 select state.*into head from public.matchday_object_states state where state.tenant_id=p_tenant_id and state.publication_id=publication.id and state.object_key=operation_key for update;
 if head.revision<>expected then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','conflict',publication.runbook_id,publication.id,head.current_action_id,head.revision,'Een andere operator wijzigde dit object. Controleer de huidige waarde voordat je opnieuw bevestigt.');end if;
 perform 1 from public.screens where tenant_id=p_tenant_id and id=any(screen_ids)order by id for update;
 perform 1 from public.player_devices where tenant_id=p_tenant_id and screen_id=any(screen_ids)and status='paired'order by id for share;
 if exists(select 1 from public.matchday_publication_targets target_row where target_row.tenant_id=p_tenant_id and target_row.publication_id=publication.id and target_row.screen_id=any(screen_ids)
  and not exists(select 1 from public.player_devices device join public.screens target_screen
   on target_screen.tenant_id=device.tenant_id and target_screen.id=device.screen_id and target_screen.status='active'and target_screen.deleted_at is null
   where device.tenant_id=p_tenant_id and device.id=target_row.player_id and device.screen_id=target_row.screen_id and device.status='paired'and device.capabilities->>'matchdayExpiry'='matchday-expiry-v1'
    and target_screen.orientation::text=target_row.orientation and target_screen.resolution_width=target_row.width and target_screen.resolution_height=target_row.height
    and target_screen.composition_id is not distinct from target_row.composition_id and target_screen.composition_revision=target_row.composition_revision))then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,head.revision,'Een gekoppelde Player of zijn vervalondersteuning is gewijzigd. Publiceer eerst opnieuw na controle.');end if;
 if kind in('field','postponed','cancelled')and exists(select 1 from public.matchday_deliveries delivery join public.matchday_actions current_action
  on current_action.tenant_id=delivery.tenant_id and current_action.id=delivery.action_id join public.matchday_action_lifecycle lifecycle
  on lifecycle.tenant_id=current_action.tenant_id and lifecycle.action_id=current_action.id
  join public.matchday_publication_targets target_row on target_row.tenant_id=delivery.tenant_id and target_row.id=delivery.target_id
  where delivery.tenant_id=p_tenant_id and delivery.publication_id=publication.id and target_row.screen_id=any(screen_ids)
   and lifecycle.status='active'and current_action.kind in('field','postponed','cancelled')and current_action.ends_at>at_time and current_action.object_key<>operation_key
  group by target_row.screen_id having count(*)>=10)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,head.revision,'Er zijn al tien gelijktijdige meldingen op een doelscherm. Beëindig eerst een melding.');end if;
 if kind='sold_out'and exists(select 1 from public.matchday_owned_schedules owned join public.content_schedules schedule on schedule.tenant_id=owned.tenant_id and schedule.id=owned.schedule_id
  join public.matchday_actions current_action on current_action.tenant_id=owned.tenant_id and current_action.id=owned.action_id
  join public.matchday_publication_targets target_row on target_row.tenant_id=owned.tenant_id and target_row.id=owned.target_id
  where owned.tenant_id=p_tenant_id and owned.publication_id=publication.id and target_row.screen_id=any(screen_ids)
   and current_action.kind='sold_out'and current_action.object_key<>operation_key and schedule.enabled and schedule.ends_at>at_time)then
  return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','blocked',publication.runbook_id,publication.id,null,head.revision,'Een ander product gebruikt al de tijdelijke vervangpublicatie op dit scherm. Beëindig die eerst.');end if;
 if head.current_action_id is not null then
  select *into previous from public.matchday_actions where tenant_id=p_tenant_id and id=head.current_action_id;
  update public.matchday_action_lifecycle set status='superseded',ended_at=at_time,ended_by=actor where tenant_id=p_tenant_id and action_id=previous.id and status='active';
  update public.content_schedules schedule set enabled=false,revision=revision+1,updated_by=actor where schedule.tenant_id=p_tenant_id and schedule.enabled
   and exists(select 1 from public.matchday_owned_schedules owned where owned.tenant_id=p_tenant_id and owned.action_id=previous.id and owned.schedule_id=schedule.id);
 end if;
 insert into public.matchday_actions(id,tenant_id,publication_id,object_key,revision,kind,payload_json,content_hash,starts_at,ends_at,actor_id,reason,supersedes_action_id,request_id)
 values(new_action_id,p_tenant_id,publication.id,operation_key,head.revision+1,kind,payload,private.matchday_hash_s300_v1(payload-array['requestId','reason']),at_time,until_time,actor,btrim(p_input->>'reason'),head.current_action_id,(p_input->>'requestId')::uuid)returning *into action;
 insert into public.matchday_action_lifecycle(tenant_id,action_id)values(p_tenant_id,action.id);
 update public.matchday_object_states state set current_action_id=action.id,revision=action.revision where state.tenant_id=p_tenant_id and state.publication_id=publication.id and state.object_key=operation_key;
 if global_main then
  update public.matchday_runs set phase=case when kind='phase'then p_input->>'phase'else kind end,phase_actor_id=actor,phase_changed_at=at_time where tenant_id=p_tenant_id and publication_id=publication.id;
  if kind in('postponed','cancelled')or p_input->>'phase'in('postponed','cancelled')then
   update public.content_schedules schedule set enabled=false,revision=revision+1,updated_by=actor where schedule.tenant_id=p_tenant_id and schedule.enabled
    and exists(select 1 from public.matchday_owned_schedules owned join public.matchday_publication_targets target_row on target_row.tenant_id=owned.tenant_id and target_row.id=owned.target_id
     where owned.tenant_id=p_tenant_id and owned.publication_id=publication.id and owned.schedule_id=schedule.id and owned.action_id is null
      and schedule.id<>private.matchday_schedule_id_s300_v1(publication.id,target_row.screen_id,'default'));
  end if;
 end if;
 for target in select *from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screen_ids)order by screen_id loop
  if kind in('phase','sold_out')then
   if kind='phase'then release_id:=coalesce((target.phase_release_ids->>(p_input->>'phase'))::uuid,target.default_release_id);
   else release_id:=(placement->>'unavailableReleaseId')::uuid;end if;
   release_check:=private.matchday_release_s300_v1(p_tenant_id,release_id,target.screen_id);
   if release_check is null or not coalesce((release_check->>'ready')::boolean,false)or not coalesce((release_check->>'compatible')::boolean,false)then
    raise exception 'frozen replacement release is no longer ready'using errcode='23514';end if;
   schedule_id:=private.matchday_write_schedule_s300_v1(p_tenant_id,target.id,'action:'||action.id,release_id,at_time,until_time,action.id);
  else
   insert into public.matchday_deliveries(tenant_id,publication_id,target_id,action_id,action_revision,content_hash,device_id)
   values(p_tenant_id,publication.id,target.id,action.id,action.revision,action.content_hash,target.player_id);
  end if;
 end loop;
 update public.matchday_runs set revision=revision+1 where tenant_id=p_tenant_id and publication_id=publication.id;
 perform private.matchday_sync_scoped_targets_s300_v1(p_tenant_id,publication.id,screen_ids);
 perform private.audit_event(p_tenant_id,'matchday.action.value','matchday_actions',action.id,'success',jsonb_build_object(
  'objectKey',operation_key,'beforeActionId',head.current_action_id,'afterActionId',action.id,'screenIds',screen_ids,'expiresAt',until_time,
  'requestId',p_input->'requestId','reason',btrim(p_input->>'reason')));
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action','applied',publication.runbook_id,publication.id,action.id,action.revision,'Opdracht klaargezet voor de geselecteerde schermen. Weergave wacht op passend Playerbewijs.');
end$$;

create function public.grant_matchday_operation_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;publication public.matchday_publications%rowtype;grant_row public.matchday_delegations%rowtype;
 screens uuid[];objects text[];kinds text[];expires timestamptz;expected bigint;replay jsonb;item text;begin
 actor:=private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.publish',true);
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','publicationId','userId','expectedRevision','requestId','screenIds','objectIds','actionKinds','endsAt','revoke']);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'publicationId');
 perform private.matchday_uuid_s300_v1(p_input->'userId');perform private.matchday_uuid_s300_v1(p_input->'requestId');expected:=private.matchday_revision_s300_v1(p_input->'expectedRevision');
 if jsonb_typeof(p_input->'screenIds')<>'array'or jsonb_array_length(p_input->'screenIds')not between 1 and 200
  or jsonb_typeof(p_input->'objectIds')<>'array'or jsonb_array_length(p_input->'objectIds')not between 1 and 100
  or jsonb_typeof(p_input->'actionKinds')<>'array'or jsonb_array_length(p_input->'actionKinds')not between 1 and 6
  or jsonb_typeof(p_input->'revoke')<>'boolean'then raise exception 'invalid explicit delegation scope'using errcode='22023';end if;
 select array_agg(private.matchday_uuid_s300_v1(value)order by value#>>'{}')into screens from jsonb_array_elements(p_input->'screenIds');
 if exists(select 1 from jsonb_array_elements(p_input->'objectIds')where jsonb_typeof(value)<>'string'or length(btrim(value#>>'{}'))not between 1 and 500)
  or exists(select 1 from jsonb_array_elements(p_input->'actionKinds')where jsonb_typeof(value)<>'string')then raise exception 'invalid delegation object or kind'using errcode='22023';end if;
 select array_agg(value order by value)into objects from jsonb_array_elements_text(p_input->'objectIds')value;
 select array_agg(value order by value)into kinds from jsonb_array_elements_text(p_input->'actionKinds')value;
 if(select count(distinct value)from unnest(screens)value)<>cardinality(screens)
  or(select count(distinct value)from unnest(objects)value)<>cardinality(objects)
  or(select count(distinct value)from unnest(kinds)value)<>cardinality(kinds)
  or not kinds<@array['field','phase','postponed','cancelled','sold_out','available']::text[]then raise exception 'duplicate or invalid delegation scope'using errcode='22023';end if;
 expires:=private.screen_frame_timestamp_s296_v1(p_input->>'endsAt');
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.delegation',(p_input->>'requestId')::uuid,p_input);if replay is not null then return replay;end if;
 select *into publication from public.matchday_publications where tenant_id=p_tenant_id and id=(p_input->>'publicationId')::uuid and runbook_id=(p_input->>'runbookId')::uuid;
 if publication.id is null or not exists(select 1 from public.tenant_memberships where tenant_id=p_tenant_id and user_id=(p_input->>'userId')::uuid)then
  raise exception 'delegation actor or publication outside tenant'using errcode='42501';end if;
 perform 1 from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id for update;
 if expires is null or expires>publication.ends_at or(not(p_input->>'revoke')::boolean and expires<=private.matchday_now_s300_v1())then
  raise exception 'delegation exceeds publication expiry'using errcode='22023';end if;
 if(select count(*)from public.matchday_publication_targets where tenant_id=p_tenant_id and publication_id=publication.id and screen_id=any(screens))<>cardinality(screens)then
  raise exception 'delegation targets outside frozen publication'using errcode='42501';end if;
 foreach item in array objects loop
  if not exists(select 1 from jsonb_array_elements(publication.configuration_json->'matches')match
   where item in('match:'||(match->>'id')||':field','match:'||(match->>'id')||':phase'))
   and not exists(select 1 from jsonb_array_elements(publication.configuration_json->'roles')role
    cross join lateral jsonb_array_elements(role->'menuFallbacks')placement
    where item='menu:'||(placement->>'menuSnapshotId')||':'||(placement->>'placementId')||':'||(placement->>'productId'))then
   raise exception 'delegation object outside frozen publication'using errcode='42501';end if;
 end loop;
 select *into grant_row from public.matchday_delegations where tenant_id=p_tenant_id and publication_id=publication.id and user_id=(p_input->>'userId')::uuid for update;
 if coalesce(grant_row.revision,0)<>expected then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.delegation','conflict',publication.runbook_id,publication.id,null,
  coalesce(grant_row.revision,0),'De toewijzing is ondertussen gewijzigd. Controleer de huidige bevoegdheid.');end if;
 insert into public.matchday_delegations(tenant_id,publication_id,user_id,screen_ids,object_ids,action_kinds,ends_at,revision,revoked_at,granted_by)
 values(p_tenant_id,publication.id,(p_input->>'userId')::uuid,screens,objects,kinds,expires,1,
  case when(p_input->>'revoke')::boolean then private.matchday_now_s300_v1()end,actor)
 on conflict(tenant_id,publication_id,user_id)do update set screen_ids=excluded.screen_ids,object_ids=excluded.object_ids,action_kinds=excluded.action_kinds,
  ends_at=excluded.ends_at,revision=matchday_delegations.revision+1,revoked_at=excluded.revoked_at,granted_by=actor returning *into grant_row;
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.delegation','applied',publication.runbook_id,publication.id,null,grant_row.revision,
  case when(p_input->>'revoke')::boolean then'Begrensde bevoegdheid ingetrokken.'else'Bevoegdheid vastgelegd voor uitsluitend de gekozen objecten, acties, schermen en eindtijd.'end);
end$$;

create function public.end_matchday_action_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;publication public.matchday_publications%rowtype;action public.matchday_actions%rowtype;head public.matchday_object_states%rowtype;
 screen_ids uuid[];expected bigint;replay jsonb;begin
 actor:=private.matchday_member_actor_s300_v1(p_tenant_id);
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','publicationId','actionId','expectedRevision','requestId','reason']);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'publicationId');
 perform private.matchday_uuid_s300_v1(p_input->'actionId');perform private.matchday_uuid_s300_v1(p_input->'requestId');expected:=private.matchday_revision_s300_v1(p_input->'expectedRevision');
 if jsonb_typeof(p_input->'reason')<>'string'or length(btrim(p_input->>'reason'))not between 2 and 300 then raise exception 'explicit reason required'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.action.end',(p_input->>'requestId')::uuid,p_input);if replay is not null then return replay;end if;
 select *into publication from public.matchday_publications where tenant_id=p_tenant_id and id=(p_input->>'publicationId')::uuid and runbook_id=(p_input->>'runbookId')::uuid;
 select *into action from public.matchday_actions where tenant_id=p_tenant_id and publication_id=publication.id and id=(p_input->>'actionId')::uuid;
 if publication.id is null or action.id is null then raise exception 'action outside exact runbook publication'using errcode='42501';end if;
 select array_agg(value::uuid order by value)into screen_ids from jsonb_array_elements_text(action.payload_json->'screenIds')value;
 if not private.matchday_can_operate_s300_v1(p_tenant_id,publication.id,action.kind,action.object_key,screen_ids,least(action.ends_at,private.matchday_now_s300_v1()+interval '1 second'))then
  raise exception 'action end outside current bounded grant'using errcode='42501';end if;
 perform 1 from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id for update;
 select *into strict head from public.matchday_object_states where tenant_id=p_tenant_id and publication_id=publication.id and object_key=action.object_key for update;
 if head.revision<>expected or head.current_action_id is distinct from action.id then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action.end','conflict',publication.runbook_id,publication.id,
  action.id,head.revision,'Een nieuwere correctie bestaat. Deze opdracht kan die niet beëindigen.');end if;
 update public.matchday_action_lifecycle set status='ended',ended_at=private.matchday_now_s300_v1(),ended_by=actor where tenant_id=p_tenant_id and action_id=action.id and status='active';
 update public.content_schedules schedule set enabled=false,revision=revision+1,updated_by=actor where schedule.tenant_id=p_tenant_id and schedule.enabled
  and exists(select 1 from public.matchday_owned_schedules owned where owned.tenant_id=p_tenant_id and owned.action_id=action.id and owned.schedule_id=schedule.id);
 update public.matchday_object_states set revision=revision+1 where tenant_id=p_tenant_id and publication_id=publication.id and object_key=action.object_key returning *into head;
 update public.matchday_runs set revision=revision+1 where tenant_id=p_tenant_id and publication_id=publication.id;
 perform private.matchday_sync_scoped_targets_s300_v1(p_tenant_id,publication.id,screen_ids);
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.action.end','applied',publication.runbook_id,publication.id,action.id,head.revision,
  'Tijdelijke opdracht beëindigd. Herstel volgt de nu geldende planning; een vervangen melding komt niet terug.');
end$$;

create function public.close_matchday_publication_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare publication public.matchday_publications%rowtype;run public.matchday_runs%rowtype;expected bigint;replay jsonb;begin
 perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.publish',true);
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','publicationId','expectedRevision','requestId','operation','reason']);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'publicationId');perform private.matchday_uuid_s300_v1(p_input->'requestId');
 expected:=private.matchday_revision_s300_v1(p_input->'expectedRevision');
 if coalesce(p_input->>'operation','')not in('close','cancel')or jsonb_typeof(p_input->'reason')<>'string'or length(btrim(p_input->>'reason'))not between 2 and 300 then
  raise exception 'invalid publication lifecycle command'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.publication.end',(p_input->>'requestId')::uuid,p_input);if replay is not null then return replay;end if;
 select *into publication from public.matchday_publications where tenant_id=p_tenant_id and id=(p_input->>'publicationId')::uuid and runbook_id=(p_input->>'runbookId')::uuid;
 if publication.id is null then raise exception 'publication outside exact runbook'using errcode='42501';end if;
 select *into strict run from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id for update;
 if run.revision<>expected then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.publication.end','conflict',publication.runbook_id,publication.id,null,run.revision,
  'De uitvoering is ondertussen gewijzigd. Controleer de operationele revisie, niet het vaste publicatienummer.');end if;
 perform private.matchday_end_publication_s300_v1(p_tenant_id,publication.id,case when p_input->>'operation'='cancel'then'cancelled'else'closed'end);
 select revision into expected from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id;
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.publication.end','applied',publication.runbook_id,publication.id,null,expected,
  'Uitvoering beëindigd. Alle toekomstige eigen fases zijn gestopt en de gewone planning is opnieuw bepaald.');
end$$;

create function private.matchday_retarget_bootstrap_s300_v1(p_base jsonb,p_tenant_id uuid,p_release_id uuid,
 p_composition jsonb,p_source text)returns jsonb
language sql stable security definer set search_path=''as $$
 select(p_base-array['matchday_window','matchday_key'])||jsonb_build_object('desired_release_id',release.id,
  'publication_id',release.playlist_id,'config_revision',release.version::text,'composition',p_composition,
  'desired_composition_id',p_composition->'id','assignment_source',p_source,
  'data_key',private.matchday_target_data_key_s300_v1(p_tenant_id,release.id,p_composition))
 from public.playlist_releases release where release.tenant_id=p_tenant_id and release.id=p_release_id
$$;

create function private.matchday_bootstrap_s300_v1(p_token_hash text,p_base jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare device public.player_devices%rowtype;screen public.screens%rowtype;candidate public.content_schedules%rowtype;
 owned public.matchday_owned_schedules%rowtype;publication public.matchday_publications%rowtype;target public.matchday_publication_targets%rowtype;
 delivery public.matchday_deliveries%rowtype;normal_now jsonb;normal_end jsonb;now_check jsonb;end_check jsonb;result jsonb;window_metadata jsonb;begin
 select *into device from public.player_devices where id=(p_base->>'device_id')::uuid and token_hash=lower(btrim(p_token_hash))and status='paired';
 select *into screen from public.screens where tenant_id=device.tenant_id and id=device.screen_id and status='active'and deleted_at is null;
 if device.id is null or screen.id is null then return null;end if;
 select value.*into candidate from private.content_schedule_candidates_s298_v1(screen.tenant_id,screen.id,private.matchday_now_s300_v1())value limit 1;
 select *into owned from public.matchday_owned_schedules where tenant_id=screen.tenant_id and schedule_id=candidate.id;
 if owned.schedule_id is null and not exists(select 1 from public.matchday_owned_schedules where tenant_id=screen.tenant_id and schedule_id=screen.active_schedule_id)then
  return p_base;end if;
 normal_now:=private.matchday_normal_target_s300_v1(screen.tenant_id,screen.id,private.matchday_now_s300_v1());
 now_check:=private.matchday_release_s300_v1(screen.tenant_id,(normal_now->>'releaseId')::uuid,screen.id);
 if owned.schedule_id is not null then
  select *into publication from public.matchday_publications where tenant_id=screen.tenant_id and id=owned.publication_id;
  select *into target from public.matchday_publication_targets where tenant_id=screen.tenant_id and id=owned.target_id and screen_id=screen.id and player_id=device.id;
  select *into delivery from public.matchday_deliveries where tenant_id=screen.tenant_id and schedule_id=candidate.id and device_id=device.id and target_id=target.id;
 end if;
 if owned.schedule_id is null or target.id is null or delivery.id is null
  or not exists(select 1 from public.tenants where id=screen.tenant_id and status='active')
  or device.capabilities->>'matchdayExpiry'is distinct from'matchday-expiry-v1'
  or screen.orientation::text is distinct from target.orientation or screen.resolution_width is distinct from target.width or screen.resolution_height is distinct from target.height
  or screen.composition_id is distinct from target.composition_id or screen.composition_revision is distinct from target.composition_revision
  or not coalesce((select enabled from public.matchday_settings where tenant_id=screen.tenant_id),false)
  or not exists(select 1 from public.matchday_runs where tenant_id=screen.tenant_id and publication_id=publication.id and status not in('closed','cancelled'))then
  return private.matchday_retarget_bootstrap_s300_v1(p_base,screen.tenant_id,(normal_now->>'releaseId')::uuid,normal_now->'composition',normal_now->>'source');
 end if;
 normal_end:=private.matchday_normal_target_s300_v1(screen.tenant_id,screen.id,candidate.ends_at);
 end_check:=private.matchday_release_s300_v1(screen.tenant_id,(normal_end->>'releaseId')::uuid,screen.id);
 if now_check is null or end_check is null or not coalesce((now_check->>'ready')::boolean,false)
  or not coalesce((end_check->>'ready')::boolean,false)or not coalesce((now_check->>'compatible')::boolean,false)
  or not coalesce((end_check->>'compatible')::boolean,false)then
  return private.matchday_retarget_bootstrap_s300_v1(p_base,screen.tenant_id,(normal_now->>'releaseId')::uuid,normal_now->'composition',normal_now->>'source');
 end if;
 result:=private.matchday_retarget_bootstrap_s300_v1(p_base,screen.tenant_id,candidate.release_id,p_base->'composition','schedule');
 window_metadata:=jsonb_build_object('schema_version',1,'publication_id',publication.id,'target_id',target.id,'window_id',candidate.id,
  'starts_at',candidate.starts_at,'expires_at',candidate.ends_at,'content_hash',delivery.content_hash,'server_time',private.matchday_now_s300_v1(),
  'composition_hash',case when jsonb_typeof(result->'composition')='object'then private.matchday_hash_s300_v1(result->'composition')end,
  'fallback_release_id',normal_end->'releaseId','fallback_composition',normal_end->'composition',
  'fallback_composition_hash',case when jsonb_typeof(normal_end->'composition')='object'then private.matchday_hash_s300_v1(normal_end->'composition')end,
  'fallback_data_key',private.matchday_target_data_key_s300_v1(screen.tenant_id,(normal_end->>'releaseId')::uuid,normal_end->'composition'),
  'unsupported_release_id',normal_now->'releaseId','unsupported_composition',normal_now->'composition',
  'unsupported_composition_hash',case when jsonb_typeof(normal_now->'composition')='object'then private.matchday_hash_s300_v1(normal_now->'composition')end,
  'unsupported_data_key',private.matchday_target_data_key_s300_v1(screen.tenant_id,(normal_now->>'releaseId')::uuid,normal_now->'composition'));
 return result||jsonb_build_object('matchday_window',window_metadata,'matchday_key',private.matchday_hash_s300_v1(window_metadata-array['server_time']));
end$$;

-- Ordinary bootstrap reads remain byte-compatible and read-only. Only an
-- effective, owned temporal target gains the bounded metadata above.
alter function public.get_player_effective_target_v1(text)rename to get_player_effective_target_before_matchday_s300_v1;
create function public.get_player_effective_target_v1(p_token_hash text)returns jsonb
language sql stable security definer set search_path=''as $$
 select private.matchday_bootstrap_s300_v1(p_token_hash,base)
 from public.get_player_effective_target_before_matchday_s300_v1(p_token_hash)base
$$;
revoke all on function public.get_player_effective_target_v1(text)from public,anon,authenticated,service_role;
grant execute on function public.get_player_effective_target_v1(text)to service_role;

create function public.record_player_matchday_window_offer_s300_v1(p_token_hash text,p_input jsonb)returns boolean
language plpgsql security definer set search_path=''as $$
declare device public.player_devices%rowtype;delivery public.matchday_deliveries%rowtype;bootstrap jsonb;window_metadata jsonb;identity jsonb;begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 perform private.matchday_keys_s300_v1(p_input,array['publicationId','targetId','windowId','contentHash','fallbackReleaseId','fallbackCompositionId','fallbackCompositionRevision','fallbackCompositionHash']);
 perform private.matchday_uuid_s300_v1(p_input->'publicationId');perform private.matchday_uuid_s300_v1(p_input->'targetId');
 perform private.matchday_uuid_s300_v1(p_input->'windowId');perform private.matchday_uuid_s300_v1(p_input->'fallbackReleaseId');
 if p_input->>'contentHash'!~'^[a-f0-9]{64}$'or jsonb_typeof(p_input->'contentHash')<>'string'then raise exception 'invalid window hash'using errcode='22023';end if;
 if p_input->'fallbackCompositionId'='null'::jsonb then
  if p_input->'fallbackCompositionRevision'<>'null'::jsonb or p_input->'fallbackCompositionHash'<>'null'::jsonb then raise exception 'composition identity is inconsistent'using errcode='22023';end if;
 else
  perform private.matchday_uuid_s300_v1(p_input->'fallbackCompositionId');perform private.matchday_revision_s300_v1(p_input->'fallbackCompositionRevision');
  if jsonb_typeof(p_input->'fallbackCompositionHash')<>'string'or p_input->>'fallbackCompositionHash'!~'^[a-f0-9]{64}$'then raise exception 'invalid composition hash'using errcode='22023';end if;
 end if;
 select *into device from public.player_devices where token_hash=lower(btrim(p_token_hash))and status='paired';
 if device.id is null then raise exception 'invalid player credential'using errcode='42501';end if;
 perform 1 from public.screens where tenant_id=device.tenant_id and id=device.screen_id and status='active'and deleted_at is null for share;
 select *into device from public.player_devices where id=device.id and token_hash=lower(btrim(p_token_hash))and status='paired'for share;
 bootstrap:=public.get_player_effective_target_v1(p_token_hash);window_metadata:=bootstrap->'matchday_window';
 if window_metadata is null or window_metadata->>'publication_id'is distinct from p_input->>'publicationId'
  or window_metadata->>'target_id'is distinct from p_input->>'targetId'or window_metadata->>'window_id'is distinct from p_input->>'windowId'
  or window_metadata->>'content_hash'is distinct from p_input->>'contentHash'or window_metadata->>'fallback_release_id'is distinct from p_input->>'fallbackReleaseId'
  or window_metadata#>>'{fallback_composition,id}'is distinct from p_input->>'fallbackCompositionId'
  or coalesce(window_metadata#>'{fallback_composition,revision}','null'::jsonb)is distinct from p_input->'fallbackCompositionRevision'
  or window_metadata->>'fallback_composition_hash'is distinct from p_input->>'fallbackCompositionHash'then return false;end if;
 select *into delivery from public.matchday_deliveries where tenant_id=device.tenant_id and device_id=device.id
  and target_id=(p_input->>'targetId')::uuid and schedule_id=(p_input->>'windowId')::uuid and publication_id=(p_input->>'publicationId')::uuid
  and content_hash=p_input->>'contentHash'for update;
 if delivery.id is null then raise exception 'window was not issued to this device'using errcode='42501';end if;
 identity:=jsonb_build_object('releaseId',p_input->'fallbackReleaseId','compositionId',p_input->'fallbackCompositionId',
  'compositionRevision',p_input->'fallbackCompositionRevision','compositionHash',p_input->'fallbackCompositionHash');
 if delivery.window_offers_json@>jsonb_build_array(identity)then return true;end if;
 if jsonb_array_length(delivery.window_offers_json)>=8 then raise exception 'MATCHDAY_FALLBACK_OFFER_LIMIT'using errcode='54000';end if;
 update public.matchday_deliveries set window_offers_json=window_offers_json||jsonb_build_array(identity),offered_at=coalesce(offered_at,private.matchday_now_s300_v1())
  where tenant_id=device.tenant_id and id=delivery.id;
 return true;
end$$;

create function public.get_player_matchday_actions_s300_v1(p_token_hash text,p_publication_ids uuid[],p_request_id uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare device public.player_devices%rowtype;bootstrap jsonb;window_metadata jsonb;offers jsonb:='[]';issued_publication uuid;begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 if p_request_id is null or p_publication_ids is null or cardinality(p_publication_ids)>1 or array_position(p_publication_ids,null)is not null then
  raise exception 'invalid bounded action request'using errcode='22023';end if;
 select *into device from public.player_devices where token_hash=lower(btrim(p_token_hash))and status='paired';
 if device.id is null then raise exception 'invalid player credential'using errcode='42501';end if;
 perform 1 from public.screens where tenant_id=device.tenant_id and id=device.screen_id and status='active'and deleted_at is null for share;
 if not found then raise exception 'inactive player screen'using errcode='42501';end if;
 select *into device from public.player_devices where id=device.id and token_hash=lower(btrim(p_token_hash))and status='paired'for share;
 if device.id is null then raise exception 'invalid player credential'using errcode='42501';end if;
 bootstrap:=public.get_player_effective_target_v1(p_token_hash);window_metadata:=bootstrap->'matchday_window';
 if cardinality(p_publication_ids)=1 and window_metadata->>'publication_id'=p_publication_ids[1]::text then
  issued_publication:=p_publication_ids[1];
  select coalesce(jsonb_agg(value order by starts_at,id),'[]')into offers from(
   select action.id,action.starts_at,jsonb_build_object('schemaVersion',1,'deliveryId',delivery.id,'actionId',action.id,
    'runbookId',publication.runbook_id,'publicationId',publication.id,'targetId',target.id,'screenId',target.screen_id,'deviceId',device.id,
    'actionRevision',action.revision,'contentHash',action.content_hash,'startsAt',action.starts_at,'expiresAt',action.ends_at,
    'matchId',action.payload_json->'matchId','matchCode',action.payload_json->'matchCode','homeTeamName',action.payload_json->'homeTeamName','awayTeamName',action.payload_json->'awayTeamName',
    'kind',action.kind)||case action.kind when'field'then jsonb_build_object('field',action.payload_json->>'field')
     when'postponed'then jsonb_build_object('newKickoffAt',action.payload_json->'newKickoffAt')else'{}'::jsonb end value
   from public.matchday_deliveries delivery join public.matchday_actions action on action.tenant_id=delivery.tenant_id and action.id=delivery.action_id
   join public.matchday_publications publication on publication.tenant_id=action.tenant_id and publication.id=action.publication_id
   join public.matchday_runs run on run.tenant_id=publication.tenant_id and run.publication_id=publication.id and run.status not in('closed','cancelled')
   join public.matchday_publication_targets target on target.tenant_id=delivery.tenant_id and target.id=delivery.target_id and target.screen_id=device.screen_id and target.player_id=device.id
   join public.matchday_object_states head on head.tenant_id=action.tenant_id and head.publication_id=action.publication_id and head.object_key=action.object_key and head.current_action_id=action.id
   join public.matchday_action_lifecycle lifecycle on lifecycle.tenant_id=action.tenant_id and lifecycle.action_id=action.id and lifecycle.status='active'
   where delivery.tenant_id=device.tenant_id and delivery.device_id=device.id and delivery.publication_id=issued_publication
    and target.id::text=window_metadata->>'target_id'and action.kind in('field','postponed','cancelled')
    and action.starts_at<=private.matchday_now_s300_v1()and action.ends_at>private.matchday_now_s300_v1()
   order by action.starts_at,action.id limit 10)eligible;
  update public.matchday_deliveries set offered_at=private.matchday_now_s300_v1()where tenant_id=device.tenant_id and device_id=device.id and offered_at is null
   and id in(select(value->>'deliveryId')::uuid from jsonb_array_elements(offers));
 end if;
 return jsonb_build_object('schemaVersion',1,'requestId',p_request_id,'serverTime',private.matchday_now_s300_v1(),
  'deviceId',device.id,'screenId',device.screen_id,'publicationId',issued_publication,'actions',offers);
end$$;

create function public.ack_player_matchday_action_s300_v1(p_token_hash text,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$
declare device public.player_devices%rowtype;delivery public.matchday_deliveries%rowtype;target public.matchday_publication_targets%rowtype;
 publication public.matchday_publications%rowtype;action public.matchday_actions%rowtype;receipt public.matchday_device_receipts%rowtype;
 request_hash text;phase text:=p_input->>'phase';reported timestamptz;bootstrap jsonb;current_release uuid;historical_restore boolean:=false;result jsonb;begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
 perform private.matchday_keys_s300_v1(p_input,array['schemaVersion','requestId','deliveryId','actionId','runbookId','publicationId','targetId','actionRevision','contentHash','phase','reportedAt','activeReleaseId','reasonCode']);
 perform private.matchday_uuid_s300_v1(p_input->'requestId');perform private.matchday_uuid_s300_v1(p_input->'deliveryId');perform private.matchday_uuid_s300_v1(p_input->'actionId');
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'publicationId');perform private.matchday_uuid_s300_v1(p_input->'targetId');
 perform private.matchday_uuid_s300_v1(p_input->'activeReleaseId');perform private.matchday_revision_s300_v1(p_input->'actionRevision');
 reported:=private.screen_frame_timestamp_s296_v1(p_input->>'reportedAt');
 if p_input->'schemaVersion'<>'1'::jsonb or phase is null or phase not in('received','prepared','rendered','restored','skipped','failed')
  or jsonb_typeof(p_input->'contentHash')<>'string'or p_input->>'contentHash'!~'^[a-f0-9]{64}$'or reported is null
  or not(p_input->'reasonCode'='null'::jsonb or p_input->>'reasonCode'in('EXPIRED','ENDED','OVERRIDDEN','FRAME_UNAVAILABLE','PLAYBACK_FAILED'))then
  raise exception 'invalid device action acknowledgement'using errcode='22023';end if;
 select *into device from public.player_devices where token_hash=lower(btrim(p_token_hash))and status='paired';
 if device.id is null then raise exception 'invalid player credential'using errcode='42501';end if;
 perform 1 from public.screens where tenant_id=device.tenant_id and id=device.screen_id and status='active'and deleted_at is null for share;
 if not found then raise exception 'inactive player screen'using errcode='42501';end if;
 select *into device from public.player_devices where id=device.id and token_hash=lower(btrim(p_token_hash))and status='paired'for share;
 if device.id is null then raise exception 'invalid player credential'using errcode='42501';end if;
 request_hash:=private.matchday_hash_s300_v1(p_input);
 perform pg_advisory_xact_lock(hashtextextended(device.id::text||':'||(p_input->>'requestId'),300));
 select *into receipt from public.matchday_device_receipts where tenant_id=device.tenant_id and device_id=device.id and request_id=(p_input->>'requestId')::uuid;
 if receipt.request_id is not null then
  if receipt.request_hash<>request_hash then raise exception 'device acknowledgement nonce body conflict'using errcode='23505';end if;
  return receipt.result_json||jsonb_build_object('replayed',true);end if;
 select *into delivery from public.matchday_deliveries where tenant_id=device.tenant_id and id=(p_input->>'deliveryId')::uuid and device_id=device.id for update;
 select *into target from public.matchday_publication_targets where tenant_id=device.tenant_id and id=delivery.target_id and screen_id=device.screen_id and player_id=device.id;
 select *into publication from public.matchday_publications where tenant_id=device.tenant_id and id=delivery.publication_id;
 select *into action from public.matchday_actions where tenant_id=device.tenant_id and id=delivery.action_id and publication_id=publication.id;
 if delivery.id is null or delivery.offered_at is null or action.id is null or target.id is null
  or action.kind not in('field','postponed','cancelled')or action.id::text<>p_input->>'actionId'
  or publication.runbook_id::text<>p_input->>'runbookId'or publication.id::text<>p_input->>'publicationId'
  or target.id::text<>p_input->>'targetId'or action.revision<>(p_input->>'actionRevision')::bigint
  or action.content_hash<>p_input->>'contentHash'then raise exception 'acknowledgement outside exact issued action target'using errcode='42501';end if;
 if reported>private.matchday_now_s300_v1()or reported<delivery.offered_at then
  raise exception 'acknowledgement time outside issued window'using errcode='40001';end if;
 bootstrap:=public.get_player_effective_target_v1(p_token_hash);current_release:=(bootstrap->>'desired_release_id')::uuid;
 if phase='rendered'then
  if action.ends_at<=private.matchday_now_s300_v1()or reported>=action.ends_at
   or bootstrap#>>'{matchday_window,publication_id}'is distinct from publication.id::text
   or current_release::text is distinct from p_input->>'activeReleaseId'
   or not exists(select 1 from public.matchday_object_states head join public.matchday_action_lifecycle lifecycle
    on lifecycle.tenant_id=head.tenant_id and lifecycle.action_id=head.current_action_id and lifecycle.status='active'
    where head.tenant_id=device.tenant_id and head.publication_id=publication.id and head.object_key=action.object_key and head.current_action_id=action.id)then
   raise exception 'obsolete or overridden action cannot be confirmed as current rendered'using errcode='40001';end if;
 elsif phase='restored'then
  if action.ends_at>private.matchday_now_s300_v1()and exists(select 1 from public.matchday_action_lifecycle where tenant_id=device.tenant_id and action_id=action.id and status='active')then
   raise exception 'active action cannot already be restored'using errcode='40001';end if;
  if reported<least(action.ends_at,coalesce((select ended_at from public.matchday_action_lifecycle where tenant_id=device.tenant_id and action_id=action.id),action.ends_at))then
   raise exception 'restored frame precedes the action end'using errcode='40001';end if;
  if current_release::text is distinct from p_input->>'activeReleaseId'then
   historical_restore:=exists(select 1 from public.matchday_deliveries window_delivery
    cross join lateral jsonb_array_elements(window_delivery.window_offers_json)offer
    where window_delivery.tenant_id=device.tenant_id and window_delivery.device_id=device.id and window_delivery.target_id=target.id
     and offer->>'releaseId'=p_input->>'activeReleaseId');
   if not historical_restore then raise exception 'restored release was never authorized for this device target'using errcode='42501';end if;
  end if;
 end if;
 update public.matchday_deliveries set received_at=case when phase='received'then coalesce(received_at,reported)else received_at end,
  prepared_at=case when phase='prepared'then coalesce(prepared_at,reported)else prepared_at end,
  rendered_at=case when phase='rendered'then coalesce(rendered_at,reported)else rendered_at end,
  restored_at=case when phase='restored'then coalesce(restored_at,reported)else restored_at end,
  confirmed_release_id=case when phase in('rendered','restored')then(p_input->>'activeReleaseId')::uuid else confirmed_release_id end,
  status=case when phase='restored'then'restored'when restored_at is not null then'restored'
   when phase in('rendered','skipped','failed')then phase when rendered_at is not null then'rendered'
   when prepared_at is not null and phase='received'then'prepared'else phase end,
  detail=case when historical_restore then'Eerder aangeboden herstelpublicatie getoond; de actuele planning kan inmiddels anders zijn.'else p_input->>'reasonCode'end
  where tenant_id=device.tenant_id and id=delivery.id;
 result:=jsonb_build_object('accepted',true,'replayed',false,'deliveryId',delivery.id,'phase',phase);
 insert into public.matchday_device_receipts(tenant_id,device_id,request_id,request_hash,result_json)
 values(device.tenant_id,device.id,(p_input->>'requestId')::uuid,request_hash,result);
 insert into public.audit_events(tenant_id,actor_device_id,action,target_type,target_id,result,metadata)
 values(device.tenant_id,device.id,'matchday.delivery.'||phase,'matchday_deliveries',delivery.id,'success',
  jsonb_build_object('requestId',p_input->'requestId','publicationId',publication.id,'actionId',action.id,'revision',action.revision,
   'contentHash',action.content_hash,'reportedAt',reported,'releaseId',p_input->'activeReleaseId'));
 return result;
end$$;

-- A heartbeat is evidence only for an identity that this server actually offered.
-- Invalid or stale optional reports never prevent the ordinary heartbeat.
create function private.matchday_window_receipt_s300_v1()returns trigger
language plpgsql security definer set search_path=''as $$
declare report jsonb:=new.current_sync_detail->'matchdayWindow';delivery public.matchday_deliveries%rowtype;
 target public.matchday_publication_targets%rowtype;publication public.matchday_publications%rowtype;window_row public.content_schedules%rowtype;
 reported timestamptz;frame_at timestamptz;seen_at timestamptz;phase text;identity jsonb;expected_composition jsonb;
 bootstrap jsonb;effective_end timestamptz;historical boolean:=false;begin
 if report is null or report is not distinct from old.current_sync_detail->'matchdayWindow'or new.status<>'paired'then return new;end if;
 perform private.matchday_keys_s300_v1(report,array['schemaVersion','publicationId','targetId','windowId','contentHash','releaseId','phase','reportedAt','compositionId','compositionRevision','compositionHash']);
 if report->'schemaVersion'is distinct from'1'::jsonb or coalesce(report->>'phase','')not in('received','prepared','rendered','restored')
  or jsonb_typeof(report->'contentHash')is distinct from'string'or report->>'contentHash'!~'^[a-f0-9]{64}$'then return new;end if;
 perform private.matchday_uuid_s300_v1(report->'publicationId');perform private.matchday_uuid_s300_v1(report->'targetId');
 perform private.matchday_uuid_s300_v1(report->'windowId');perform private.matchday_uuid_s300_v1(report->'releaseId');
 if report->'compositionId'='null'::jsonb then
  if report->'compositionRevision'<>'null'::jsonb or report->'compositionHash'<>'null'::jsonb then return new;end if;
 else
  perform private.matchday_uuid_s300_v1(report->'compositionId');perform private.matchday_revision_s300_v1(report->'compositionRevision');
  if jsonb_typeof(report->'compositionHash')is distinct from'string'or report->>'compositionHash'!~'^[a-f0-9]{64}$'then return new;end if;
 end if;
 reported:=private.screen_frame_timestamp_s296_v1(report->>'reportedAt');seen_at:=new.last_seen_at;
 if reported is null or seen_at is null or reported>seen_at or seen_at>private.matchday_now_s300_v1()then return new;end if;
 select *into delivery from public.matchday_deliveries where tenant_id=new.tenant_id and device_id=new.id
  and publication_id=(report->>'publicationId')::uuid and target_id=(report->>'targetId')::uuid
  and schedule_id=(report->>'windowId')::uuid and content_hash=report->>'contentHash'for update;
 if delivery.id is null or delivery.offered_at is null or reported<delivery.offered_at then return new;end if;
 select *into target from public.matchday_publication_targets where tenant_id=new.tenant_id and id=delivery.target_id and screen_id=new.screen_id and player_id=new.id;
 select *into publication from public.matchday_publications where tenant_id=new.tenant_id and id=delivery.publication_id;
 select *into window_row from public.content_schedules where tenant_id=new.tenant_id and id=delivery.schedule_id;
 if target.id is null or window_row.id is null or publication.id is null then return new;end if;
 phase:=report->>'phase';
 if phase='restored'then
  effective_end:=least(window_row.ends_at,coalesce((select ended_at from public.matchday_runs where tenant_id=new.tenant_id and publication_id=publication.id),window_row.ends_at),
   coalesce((select lifecycle.ended_at from public.matchday_actions action join public.matchday_action_lifecycle lifecycle
    on lifecycle.tenant_id=action.tenant_id and lifecycle.action_id=action.id where action.tenant_id=new.tenant_id and action.id=delivery.action_id),window_row.ends_at));
  if effective_end>private.matchday_now_s300_v1()or reported<effective_end then return new;end if;
  identity:=jsonb_build_object('releaseId',report->'releaseId','compositionId',report->'compositionId','compositionRevision',report->'compositionRevision','compositionHash',report->'compositionHash');
  if not delivery.window_offers_json@>jsonb_build_array(identity)then return new;end if;
 else
  if report->>'releaseId'is distinct from window_row.release_id::text then return new;end if;
  expected_composition:=private.screen_composition_json_v1(new.tenant_id,target.composition_id);
  if report->>'compositionId'is distinct from expected_composition->>'id'
   or coalesce(report->'compositionRevision','null'::jsonb)is distinct from coalesce(expected_composition->'revision','null'::jsonb)
   or report->>'compositionHash'is distinct from(case when expected_composition is not null then private.matchday_hash_s300_v1(expected_composition)end)then return new;end if;
 end if;
 if phase in('rendered','restored')then
  frame_at:=private.screen_frame_timestamp_s296_v1(new.current_sync_detail#>>'{publicationTrace,firstFrameAt}');
  if new.active_release_id::text is distinct from report->>'releaseId'
   or new.active_composition_id::text is distinct from report->>'compositionId'
   or new.current_sync_detail#>>'{publicationTrace,releaseId}'is distinct from report->>'releaseId'
   or frame_at is null or frame_at>reported or frame_at<delivery.offered_at
   or(phase='restored'and frame_at<effective_end)then return new;end if;
  bootstrap:=public.get_player_effective_target_v1(new.token_hash);
  if phase='rendered'and(bootstrap#>>'{matchday_window,window_id}'is distinct from window_row.id::text
   or bootstrap#>>'{matchday_window,content_hash}'is distinct from delivery.content_hash)then return new;end if;
  historical:=phase='restored'and(bootstrap->>'desired_release_id'is distinct from report->>'releaseId'
   or bootstrap#>>'{composition,id}'is distinct from report->>'compositionId');
 end if;
 update public.matchday_deliveries set received_at=case when phase='received'then coalesce(received_at,reported)else received_at end,
  prepared_at=case when phase='prepared'then coalesce(prepared_at,reported)else prepared_at end,
  rendered_at=case when phase='rendered'then coalesce(rendered_at,reported)else rendered_at end,
  restored_at=case when phase='restored'then coalesce(restored_at,reported)else restored_at end,
  confirmed_release_id=case when phase in('rendered','restored')then(report->>'releaseId')::uuid else confirmed_release_id end,
  status=case when phase='restored'then'restored'when restored_at is not null then status when phase='rendered'then'rendered'
   when rendered_at is not null then status when phase='prepared'then'prepared'when prepared_at is not null then status else'received'end,
  detail=case when historical then'Eerder aangeboden herstelpublicatie getoond; de actuele planning kan inmiddels anders zijn.'else detail end
  where tenant_id=new.tenant_id and id=delivery.id;
 return new;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or datatype_mismatch then return new;
end$$;
create trigger matchday_player_window_receipt after update of current_sync_detail on public.player_devices
 for each row execute function private.matchday_window_receipt_s300_v1();

-- S301 now sees real editable runbook drafts. Publication facts remain frozen.
create function private.matchday_sportlink_context_s300_v1(p_context jsonb)returns jsonb
language sql immutable set search_path=''as $$select case when jsonb_typeof(p_context)='object'then jsonb_build_object(
 'providerTeamId',p_context->'teamId','competitionSelectionMode','pinned','competitionId',p_context->'competitionId',
 'poolId',p_context->'poolId','seasonId',p_context->'seasonId','phaseId',p_context->'phaseId')end$$;
create function private.matchday_season_impact_s300_v1(p_tenant_id uuid,p_runbook_id uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare refs jsonb;count_refs integer;begin
 if not private.has_tenant_capability(p_tenant_id,'tenant.release.read')or not private.has_tenant_capability(p_tenant_id,'tenant.screen.read')then
  return jsonb_build_object('knownCount',null,'truncated',false,'unknown',true,'references','[]'::jsonb);end if;
 with references_all as(
  select distinct 'publication'kind,release.id,left(playlist.name||' · v'||release.version,200)name,'/dashboard/publications/'||release.id href,'immutable_publication'state
  from public.matchday_publication_targets target join public.matchday_publications publication
   on publication.tenant_id=target.tenant_id and publication.id=target.publication_id
  cross join lateral(select target.default_release_id id union select(value#>>'{}')::uuid from jsonb_each(target.phase_release_ids))ids
  join public.playlist_releases release on release.tenant_id=target.tenant_id and release.id=ids.id
  join public.playlists playlist on playlist.tenant_id=release.tenant_id and playlist.id=release.playlist_id
  where target.tenant_id=p_tenant_id and publication.runbook_id=p_runbook_id
  union
  select 'schedule',schedule.id,left(schedule.name,200),'/dashboard/planning',case when schedule.enabled then'configured'else'ended'end
  from public.matchday_owned_schedules owned join public.matchday_publications publication on publication.tenant_id=owned.tenant_id and publication.id=owned.publication_id
  join public.content_schedules schedule on schedule.tenant_id=owned.tenant_id and schedule.id=owned.schedule_id
  where owned.tenant_id=p_tenant_id and publication.runbook_id=p_runbook_id
  union
  select distinct 'screen',screen.id,left(screen.name,200),'/dashboard/screens/'||screen.id,'frozen_target'
  from public.matchday_publication_targets target join public.matchday_publications publication on publication.tenant_id=target.tenant_id and publication.id=target.publication_id
  join public.screens screen on screen.tenant_id=target.tenant_id and screen.id=target.screen_id
  where target.tenant_id=p_tenant_id and publication.runbook_id=p_runbook_id
 ),numbered as(select *,row_number()over(order by kind,id)ordinal from references_all)
 select count(*),coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'name',name,'href',href,'state',state,'confirmedVersionId',null)order by kind,id)filter(where ordinal<=100),'[]')
 into count_refs,refs from numbered;
 return jsonb_build_object('knownCount',count_refs,'truncated',count_refs>100,'unknown',false,'references',refs);
end$$;
create function private.matchday_season_hash_s300_v1(p_tenant_id uuid,p_runbook_id uuid,p_source_hash text)returns text
language sql stable security definer set search_path=''as $$select private.matchday_hash_s300_v1(jsonb_build_object(
 'sourceHash',p_source_hash,'runbook',p_runbook_id,'currentPublicationId',book.current_publication_id,
 'publications',(select coalesce(jsonb_agg(jsonb_build_object('id',publication.id,'version',publication.version,'configuration',publication.configuration_json-array['name'],
  'targets',(select jsonb_agg(to_jsonb(target)-array['screen_name']order by target.id)from public.matchday_publication_targets target where target.tenant_id=p_tenant_id and target.publication_id=publication.id),
  'schedules',(select jsonb_agg(to_jsonb(schedule)-array['name','created_at','updated_at','created_by','updated_by']order by schedule.id)
   from public.matchday_owned_schedules owned join public.content_schedules schedule on schedule.tenant_id=owned.tenant_id and schedule.id=owned.schedule_id
   where owned.tenant_id=p_tenant_id and owned.publication_id=publication.id),
  'run',(select to_jsonb(run)-array['phase_actor_id','phase_changed_at','ended_at']from public.matchday_runs run where run.tenant_id=p_tenant_id and run.publication_id=publication.id))order by publication.id),'[]')
  from public.matchday_publications publication where publication.tenant_id=p_tenant_id and publication.runbook_id=p_runbook_id)))
 from public.matchday_runbooks book where book.tenant_id=p_tenant_id and book.id=p_runbook_id$$;
create function private.matchday_season_row_s300_v1(p_book public.matchday_runbooks,p_connection public.sportlink_connections,
 p_target_season_id text,p_contexts jsonb,p_source_hash text)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare slide public.dynamic_slides%rowtype;version public.dynamic_slide_versions%rowtype;row_value jsonb;source_status text;restore_link text;begin
 slide:=jsonb_populate_record(null::public.dynamic_slides,jsonb_build_object('id',p_book.id,'tenant_id',p_book.tenant_id,'data_source_id',p_connection.data_source_id,
  'name',p_book.configuration_json->>'name','status','draft','slide_type','sport_match_of_the_day','active_draft_version_id',p_book.id));
 version:=jsonb_populate_record(null::public.dynamic_slide_versions,jsonb_build_object('id',p_book.id,'tenant_id',p_book.tenant_id,'dynamic_slide_id',p_book.id,
  'data_source_id',p_connection.data_source_id,'status','draft','name',p_book.configuration_json->>'name','slide_type','sport_match_of_the_day','edit_revision',p_book.revision,
  'configuration_json',jsonb_build_object('context',private.matchday_sportlink_context_s300_v1(p_book.configuration_json->'context'))));
 select status into source_status from public.dynamic_data_sources where tenant_id=p_book.tenant_id and id=p_connection.data_source_id;
 row_value:=private.sportlink_season_row_s301_v1(slide,version,p_connection,source_status,p_target_season_id,p_contexts,p_source_hash);
 select '/dashboard/publications/'||target.default_release_id into restore_link from public.matchday_publications publication
  join public.matchday_publication_targets target on target.tenant_id=publication.tenant_id and target.publication_id=publication.id
  where publication.tenant_id=p_book.tenant_id and publication.runbook_id=p_book.id order by publication.version desc,target.id limit 1;
 return row_value||jsonb_build_object('resourceKind','matchday_runbook','canUpdate',
  row_value->>'state'in('available','choice_required')and private.has_tenant_capability(p_book.tenant_id,'tenant.playlist.write'),
  'contextHash',private.matchday_season_hash_s300_v1(p_book.tenant_id,p_book.id,p_source_hash),'impact',private.matchday_season_impact_s300_v1(p_book.tenant_id,p_book.id),
  'links',jsonb_build_object('edit','/dashboard/matchday?runbook='||p_book.id,'publish','/dashboard/matchday?runbook='||p_book.id,'restore',restore_link));
end$$;
create function private.matchday_update_context_s300_v1(p_tenant_id uuid,p_runbook_id uuid,p_expected bigint,p_context jsonb,p_clear boolean)returns public.matchday_runbooks
language plpgsql security definer set search_path=''as $$declare book public.matchday_runbooks%rowtype;configuration jsonb;new_context jsonb;begin
 perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.write',true);perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.data_source.read');
 select *into book from public.matchday_runbooks where tenant_id=p_tenant_id and id=p_runbook_id for update;
 if book.id is null then raise exception 'draft outside tenant'using errcode='42501';end if;
 if book.revision<>p_expected then raise exception 'draft context revision changed'using errcode='40001';end if;
 perform id from public.sports_clubs where tenant_id=p_tenant_id and source_connection_id=private.matchday_uuid_s300_v1(p_context->'connectionId')order by id for share;
 perform id from public.sports_teams where tenant_id=p_tenant_id and source_connection_id=private.matchday_uuid_s300_v1(p_context->'connectionId')order by id for share;
 perform id from public.sportlink_connections where tenant_id=p_tenant_id and id=private.matchday_uuid_s300_v1(p_context->'connectionId')for share;
 perform id from public.dynamic_data_sources where tenant_id=p_tenant_id and id=private.matchday_uuid_s300_v1(p_context->'sourceId')for share;
 new_context:=private.matchday_context_s300_v1(p_tenant_id,p_context);configuration:=book.configuration_json;
 if (configuration->'context')is distinct from new_context and jsonb_array_length(configuration->'matches')>0 then
  if not p_clear then raise exception 'explicit match clearing is required for a different context'using errcode='22023';end if;
  configuration:=configuration||jsonb_build_object('matches','[]'::jsonb,'mainMatchId',null);end if;
 configuration:=private.matchday_configuration_s300_v1(p_tenant_id,configuration||jsonb_build_object('context',new_context));
 update public.matchday_runbooks set configuration_json=configuration,revision=revision+1,updated_by=private.current_user_id(),updated_at=private.matchday_now_s300_v1()
  where tenant_id=p_tenant_id and id=book.id returning *into book;return book;
end$$;
create function public.update_matchday_draft_context_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare book public.matchday_runbooks%rowtype;replay jsonb;begin
 perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.write',true);perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.data_source.read');
 perform private.matchday_keys_s300_v1(p_input,array['runbookId','expectedRevision','requestId','context','clearSelectedMatches']);
 perform private.matchday_uuid_s300_v1(p_input->'runbookId');perform private.matchday_uuid_s300_v1(p_input->'requestId');perform private.matchday_revision_s300_v1(p_input->'expectedRevision');
 if jsonb_typeof(p_input->'clearSelectedMatches')is distinct from'boolean'then raise exception 'explicit clearing decision required'using errcode='22023';end if;
 replay:=private.begin_publisher_command(p_tenant_id,'matchday.context.update',(p_input->>'requestId')::uuid,p_input);if replay is not null then return replay;end if;
 select *into book from public.matchday_runbooks where tenant_id=p_tenant_id and id=(p_input->>'runbookId')::uuid for update;
 if book.id is null then raise exception 'draft outside tenant'using errcode='42501';end if;
 if book.revision<>(p_input->>'expectedRevision')::bigint then return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.context.update','conflict',book.id,null,null,book.revision,'Het concept is ondertussen gewijzigd.');end if;
 book:=private.matchday_update_context_s300_v1(p_tenant_id,book.id,book.revision,p_input->'context',(p_input->>'clearSelectedMatches')::boolean);
 return private.matchday_receipt_s300_v1(p_tenant_id,p_input,'matchday.context.update','applied',book.id,null,null,book.revision,'Alleen de broncontext van het concept is aangepast; bestaande publicaties blijven behouden.');
end$$;
create function public.list_matchday_draft_contexts_s300_v1(p_tenant_id uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$begin
 perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.read');perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.data_source.read');
 return coalesce((select jsonb_agg(jsonb_build_object('runbookId',id,'name',configuration_json->'name','expectedRevision',revision,
  'context',configuration_json->'context','selectedMatchCount',jsonb_array_length(configuration_json->'matches'),'currentPublicationId',current_publication_id)order by id)
  from(select *from public.matchday_runbooks where tenant_id=p_tenant_id order by id limit 100)books),'[]'::jsonb);
end$$;
create or replace function private.sportlink_season_runbooks_available_s301_v1()returns boolean
language sql stable set search_path=''as $$select true$$;
create or replace function private.sportlink_season_runbook_rows_s301_v1(p_tenant_id uuid,p_connection_id uuid,p_target_season_id text,p_contexts jsonb,p_context_hash text)
returns setof jsonb language sql stable security definer set search_path=''as $$
 select private.matchday_season_row_s300_v1(book,connection,p_target_season_id,p_contexts,p_context_hash)
 from public.matchday_runbooks book join public.sportlink_connections connection on connection.tenant_id=book.tenant_id and connection.id=p_connection_id
 where book.tenant_id=p_tenant_id and book.configuration_json#>>'{context,connectionId}'=p_connection_id::text
  and private.has_tenant_capability(p_tenant_id,'tenant.release.read')and private.has_tenant_capability(p_tenant_id,'tenant.playlist.read')
$$;
create function private.matchday_season_prepare_s300_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare book public.matchday_runbooks%rowtype;connection public.sportlink_connections%rowtype;
 contexts jsonb;source_hash text;row_value jsonb;mapping jsonb;new_context jsonb;old_context jsonb;begin
 select *into book from public.matchday_runbooks where tenant_id=p_tenant_id and id=(p_input->>'resourceId')::uuid;
 if book.id is null then raise exception 'runbook outside tenant'using errcode='42501';end if;
 old_context:=private.matchday_sportlink_context_s300_v1(book.configuration_json->'context');
 if p_input->>'basisVersionId'is distinct from book.id::text or book.revision<>(p_input->>'expectedRevision')::bigint
  or private.sportlink_season_binding_hash_s301_v1((book.configuration_json#>>'{context,sourceId}')::uuid,jsonb_build_object('context',old_context))is distinct from p_input->>'oldBindingHash'then
  return jsonb_build_object('status','conflict','reason','Het concept of de eerdere bronselectie is gewijzigd.');end if;
 select *into connection from public.sportlink_connections where tenant_id=p_tenant_id and id=(book.configuration_json#>>'{context,connectionId}')::uuid;
 contexts:=private.sportlink_season_contexts_s301_v1(p_tenant_id,connection.id);source_hash:=private.sportlink_season_source_hash_s301_v1(p_tenant_id,connection.id,contexts);
 if private.matchday_season_hash_s300_v1(p_tenant_id,book.id,source_hash)is distinct from p_input->>'contextHash'then return jsonb_build_object('status','conflict','reason','De broncontext of het gebruik is ondertussen gewijzigd.');end if;
 if jsonb_array_length(p_input#>'{newSelection,mappings}')<>1 or p_input#>>'{newSelection,mappings,0,fromProviderTeamId}'is distinct from old_context->>'providerTeamId'then
  raise exception 'runbook mapping must cover its one exact main context'using errcode='22023';end if;
 mapping:=p_input#>'{newSelection,mappings,0}';
 if not exists(select 1 from private.sportlink_season_candidates_s301_v1(contexts,old_context,mapping#>>'{context,seasonId}',true)candidate where candidate->'context'=mapping->'context')then
  raise exception 'runbook destination is not an observed exact candidate'using errcode='42501';end if;
 new_context:=private.matchday_context_projection_s300_v1(p_tenant_id,connection.data_source_id,connection.id,mapping->'context');
 if new_context is null then raise exception 'runbook destination resolver refused context'using errcode='42501';end if;
 perform private.matchday_context_s300_v1(p_tenant_id,new_context);
 if new_context=book.configuration_json->'context'then return jsonb_build_object('status','blocked','reason','Deze bronselectie is al actueel.');end if;
 if jsonb_array_length(book.configuration_json->'matches')>0 and not(p_input->>'clearSelectedMatches')::boolean then
  return jsonb_build_object('status','blocked','reason','Bevestig expliciet dat de geselecteerde wedstrijden en hoofdwedstrijd uit het concept worden gewist.');end if;
 row_value:=private.matchday_season_row_s300_v1(book,connection,mapping#>>'{context,seasonId}',contexts,source_hash);
 return jsonb_build_object('status','ready','context',new_context,'oldSelection',jsonb_build_object('mappings',jsonb_build_array(jsonb_build_object('fromProviderTeamId',old_context->>'providerTeamId','context',old_context))),'row',row_value);
end$$;
create or replace function private.sportlink_season_runbook_preview_s301_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare prepared jsonb;begin
 perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.release.read');prepared:=private.matchday_season_prepare_s300_v1(p_tenant_id,p_input);
 return jsonb_build_object('schemaVersion',1,'resourceKind','matchday_runbook','resourceId',p_input->'resourceId','oldSelection',prepared->'oldSelection',
  'newSelection',p_input->'newSelection','basisVersionId',p_input->'basisVersionId','expectedRevision',p_input->'expectedRevision','oldBindingHash',p_input->'oldBindingHash','contextHash',p_input->'contextHash',
  'canApply',prepared->>'status'='ready'and private.has_tenant_capability(p_tenant_id,'tenant.playlist.write'),
  'reasons',case when prepared->>'status'='ready'then'[]'::jsonb else jsonb_build_array(prepared->>'reason')end,
  'preview',jsonb_build_object('state',case when prepared->>'status'='ready'then'empty'else'blocked'end,'data',null,'message','De nieuwe exacte context wordt alleen in het concept opgeslagen. Kies daarna opnieuw wedstrijden en controleer de publicatie.'),
  'impact',coalesce(prepared#>'{row,impact}',private.matchday_season_impact_s300_v1(p_tenant_id,(p_input->>'resourceId')::uuid)),
  'clearsSelectedMatches',(p_input->>'clearSelectedMatches')::boolean,'links',coalesce(prepared#>'{row,links}',jsonb_build_object('edit','/dashboard/matchday?runbook='||(p_input->>'resourceId'),'publish',null,'restore',null)));
end$$;
create or replace function private.sportlink_season_runbook_apply_s301_v1(p_tenant_id uuid,p_input jsonb)returns jsonb
language plpgsql security definer set search_path=''as $$declare book public.matchday_runbooks%rowtype;prepared jsonb;begin
 perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.playlist.write',true);perform private.matchday_actor_s300_v1(p_tenant_id,'tenant.data_source.read');
 select *into book from public.matchday_runbooks where tenant_id=p_tenant_id and id=(p_input->>'resourceId')::uuid for update;
 if book.id is null then raise exception 'runbook outside tenant'using errcode='42501';end if;
 -- Use the worker's normalized-row lock order before rechecking source identity.
 perform id from public.sports_clubs where tenant_id=p_tenant_id and source_connection_id=(book.configuration_json#>>'{context,connectionId}')::uuid order by id for share;
 perform id from public.sports_teams where tenant_id=p_tenant_id and source_connection_id=(book.configuration_json#>>'{context,connectionId}')::uuid order by id for share;
 perform id from public.sportlink_connections where tenant_id=p_tenant_id and id=(book.configuration_json#>>'{context,connectionId}')::uuid for share;
 perform id from public.dynamic_data_sources where tenant_id=p_tenant_id and id=(book.configuration_json#>>'{context,sourceId}')::uuid for share;
 prepared:=private.matchday_season_prepare_s300_v1(p_tenant_id,p_input);
 if prepared->>'status'='ready'then book:=private.matchday_update_context_s300_v1(p_tenant_id,book.id,book.revision,prepared->'context',(p_input->>'clearSelectedMatches')::boolean);end if;
 return jsonb_build_object('schemaVersion',1,'status',case when prepared->>'status'='ready'then'applied'else prepared->>'status'end,
  'resourceKind','matchday_runbook','resourceId',book.id,'requestId',p_input->'requestId','correlationId',p_input->'correlationId','receiptId',null,
  'previousVersionId',book.id,'draftVersionId',case when prepared->>'status'='ready'then book.id end,
  'previousRevision',(p_input->>'expectedRevision')::bigint,'newRevision',case when prepared->>'status'='ready'then book.revision end,
  'reason',prepared->>'reason','links',coalesce(prepared#>'{row,links}',jsonb_build_object('edit','/dashboard/matchday?runbook='||book.id,'publish',null,'restore',null)));
end$$;
revoke all on function private.sportlink_season_runbooks_available_s301_v1(),private.sportlink_season_runbook_rows_s301_v1(uuid,uuid,text,jsonb,text),
 private.sportlink_season_runbook_preview_s301_v1(uuid,jsonb),private.sportlink_season_runbook_apply_s301_v1(uuid,jsonb)from public,anon,authenticated,service_role;

-- Enroll only an explicitly frozen LED binding for its original half-open
-- period. All unrelated legacy LED deliveries retain their existing route.
create function private.matchday_led_delivery_allowed_s300_v1(p_tenant_id uuid,p_screen_id uuid,p_version_id uuid,p_event_id uuid)returns boolean
language plpgsql stable security definer set search_path=''as $$declare target public.matchday_publication_targets%rowtype;publication public.matchday_publications%rowtype;
 binding jsonb;event_connection_id uuid;event_match_identity text;event_observed_at timestamptz;player public.player_devices%rowtype;window_metadata jsonb;state public.ledscores_live_match_states%rowtype;begin
 select selected.*into target from public.matchday_publication_targets selected join public.matchday_publications candidate
  on candidate.tenant_id=selected.tenant_id and candidate.id=selected.publication_id
 join public.matchday_runbooks book on book.tenant_id=candidate.tenant_id and book.id=candidate.runbook_id and book.current_publication_id=candidate.id
 where selected.tenant_id=p_tenant_id and selected.screen_id=p_screen_id and selected.role='led'
  and candidate.starts_at<=private.matchday_now_s300_v1()and candidate.ends_at>private.matchday_now_s300_v1()
  and exists(select 1 from jsonb_array_elements(candidate.configuration_json->'roles')led_role(value)
   where led_role.value->>'role'='led'and(p_version_id is null or led_role.value#>>'{ledBinding,alertVersionId}'=p_version_id::text))
 order by candidate.published_at desc,candidate.id desc limit 1;
 if target.id is null then return true;end if;
 select *into publication from public.matchday_publications where tenant_id=p_tenant_id and id=target.publication_id;
 select role->'ledBinding'into binding from jsonb_array_elements(publication.configuration_json->'roles')role where role->>'role'='led';
 select connection_id,match_identity,source_observed_at into event_connection_id,event_match_identity,event_observed_at
  from public.ledscores_goal_events where tenant_id=p_tenant_id and id=p_event_id;
 if event_connection_id is null then select connection_id,match_identity,source_observed_at into event_connection_id,event_match_identity,event_observed_at
  from public.ledscores_match_events where tenant_id=p_tenant_id and id=p_event_id;end if;
 select *into player from public.player_devices where tenant_id=p_tenant_id and id=target.player_id and screen_id=p_screen_id and status='paired';
 if event_connection_id is null or player.id is null or event_connection_id::text is distinct from binding->>'connectionId'
  or event_match_identity is distinct from'match:'||(binding->>'providerMatchId')or event_observed_at<publication.starts_at
  or event_observed_at>=publication.ends_at or event_observed_at>private.matchday_now_s300_v1()
  or event_observed_at<private.matchday_now_s300_v1()-make_interval(secs=>(binding->>'maximumSourceAgeSeconds')::int)
  or not coalesce((select enabled from public.matchday_settings where tenant_id=p_tenant_id),false)
  or not exists(select 1 from public.matchday_runs where tenant_id=p_tenant_id and publication_id=publication.id and status not in('closed','cancelled')and phase not in('cancelled','postponed','finished'))then return false;end if;
 window_metadata:=public.get_player_effective_target_v1(player.token_hash)->'matchday_window';
 if window_metadata->>'publication_id'is distinct from publication.id::text then return false;end if;
 if not exists(select 1 from private.matchday_led_options_s300_v1(p_tenant_id,(publication.configuration_json->>'mainMatchId')::uuid)option
  where option->>'connectionId'=binding->>'connectionId'and option->>'alertVersionId'=binding->>'alertVersionId'and option->>'providerMatchId'=binding->>'providerMatchId')then return false;end if;
 select *into state from public.ledscores_live_match_states where tenant_id=p_tenant_id and connection_id=event_connection_id and match_identity=event_match_identity;
 return coalesce(state.source_observed_at<=private.matchday_now_s300_v1()and state.source_observed_at>=private.matchday_now_s300_v1()-make_interval(secs=>(binding->>'maximumSourceAgeSeconds')::int),false);
end$$;
create function private.matchday_guard_led_delivery_s300_v1()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if new.message_kind in('goal','goal_enrichment','match_overlay')and not private.matchday_led_delivery_allowed_s300_v1(new.tenant_id,new.screen_id,new.alert_version_id,coalesce(new.goal_event_id,new.match_event_id))then return null;end if;
 return new;
end$$;
create trigger matchday_led_delivery_scope before insert on public.ledscores_player_deliveries
 for each row execute function private.matchday_guard_led_delivery_s300_v1();

-- A queued message may outlive a cancelled enrollment before reconnect. Apply
-- the same exact guard at both existing reads, including enrichment/overlays.
create function private.matchday_led_bootstrap_s300_v1(p_token_hash text,p_base jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare device public.player_devices%rowtype;filtered jsonb;begin
 if jsonb_typeof(p_base->'pendingDeliveries')is distinct from'array'or jsonb_array_length(p_base->'pendingDeliveries')=0 then return p_base;end if;
 select *into device from public.player_devices where token_hash=p_token_hash and status='paired';
 if device.id is null then return p_base;end if;
 select coalesce(jsonb_agg(message.value order by message.ordinality),'[]')into filtered
 from jsonb_array_elements(p_base->'pendingDeliveries')with ordinality message(value,ordinality)
 join public.ledscores_player_deliveries delivery on delivery.tenant_id=device.tenant_id and delivery.screen_id=device.screen_id and delivery.id::text=message.value->>'id'
 where private.matchday_led_delivery_allowed_s300_v1(device.tenant_id,device.screen_id,delivery.alert_version_id,coalesce(delivery.goal_event_id,delivery.match_event_id));
 if filtered=p_base->'pendingDeliveries'then return p_base;end if;
 return jsonb_set(p_base,'{pendingDeliveries}',filtered);
end$$;
alter function public.get_ledscores_player_bootstrap_v1(text)rename to get_ledscores_player_bootstrap_before_matchday_s300_v1;
create function public.get_ledscores_player_bootstrap_v1(p_token_hash text)returns jsonb
language sql stable security definer set search_path=''as $$select private.matchday_led_bootstrap_s300_v1(p_token_hash,public.get_ledscores_player_bootstrap_before_matchday_s300_v1(p_token_hash))$$;
alter function public.get_ledscores_match_player_bootstrap_v1(text)rename to get_ledscores_match_player_bootstrap_before_matchday_s300_v1;
create function public.get_ledscores_match_player_bootstrap_v1(p_token_hash text)returns jsonb
language sql stable security definer set search_path=''as $$select private.matchday_led_bootstrap_s300_v1(p_token_hash,public.get_ledscores_match_player_bootstrap_before_matchday_s300_v1(p_token_hash))$$;
revoke all on function public.get_ledscores_player_bootstrap_v1(text),public.get_ledscores_match_player_bootstrap_v1(text)from public,anon,authenticated,service_role;
grant execute on function public.get_ledscores_player_bootstrap_v1(text),public.get_ledscores_match_player_bootstrap_v1(text)to service_role;

-- S300_FINAL_ACL
-- Kept at the end by the migration author after all new functions are defined.
do $$declare procedure_record record;begin
 for procedure_record in select procedure.oid,namespace.nspname,procedure.proname
  from pg_proc procedure join pg_namespace namespace on namespace.oid=procedure.pronamespace
  where namespace.nspname in('public','private')and procedure.proname like '%\_s300\_v1'escape'\'loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',procedure_record.oid::regprocedure);
  if procedure_record.nspname='public'then
   execute format('grant execute on function %s to %I',procedure_record.oid::regprocedure,
    case when procedure_record.proname like '%player%'then'service_role'else'authenticated'end);
  end if;
 end loop;
end$$;
