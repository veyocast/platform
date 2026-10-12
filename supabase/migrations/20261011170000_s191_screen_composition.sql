-- S191: simultaneous content zones reference immutable, tenant-scoped releases.
-- A scheduled main assignment remains authoritative when a default changes.
create table public.screen_composition_drafts (
  tenant_id uuid not null,screen_id uuid not null,revision bigint not null default 0 check(revision>=0),
  configuration_json jsonb not null check(jsonb_typeof(configuration_json)='object'),
  updated_by uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now(),
  primary key(tenant_id,screen_id),foreign key(tenant_id,screen_id) references public.screens(tenant_id,id) on delete cascade
);
create table public.screen_compositions (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,screen_id uuid not null,
  revision bigint not null check(revision>0),configuration_json jsonb not null check(jsonb_typeof(configuration_json)='object'),
  published_by uuid references public.profiles(id) on delete set null,published_at timestamptz not null default now(),
  unique(tenant_id,id),unique(tenant_id,screen_id,id),unique(tenant_id,screen_id,revision),
  foreign key(tenant_id,screen_id) references public.screens(tenant_id,id) on delete restrict
);
create index screen_compositions_tenant_screen_idx on public.screen_compositions(tenant_id,screen_id,revision desc);
create table public.screen_composition_bindings (
  tenant_id uuid not null,composition_id uuid not null,zone_id text not null check(zone_id in('main','side','bottom')),
  playlist_id uuid not null,release_id uuid not null,config_revision bigint not null check(config_revision>0),fallback_release_id uuid,
  primary key(tenant_id,composition_id,zone_id),
  foreign key(tenant_id,composition_id) references public.screen_compositions(tenant_id,id) on delete cascade,
  foreign key(tenant_id,playlist_id,release_id) references public.playlist_releases(tenant_id,playlist_id,id) on delete restrict,
  foreign key(tenant_id,playlist_id,fallback_release_id) references public.playlist_releases(tenant_id,playlist_id,id) on delete restrict
);
create index screen_composition_bindings_tenant_release_idx on public.screen_composition_bindings(tenant_id,release_id);
create index screen_composition_bindings_tenant_fallback_idx on public.screen_composition_bindings(tenant_id,fallback_release_id);
alter table public.screen_composition_drafts enable row level security;
alter table public.screen_composition_drafts force row level security;
alter table public.screen_compositions enable row level security;
alter table public.screen_compositions force row level security;
alter table public.screen_composition_bindings enable row level security;
alter table public.screen_composition_bindings force row level security;
create policy screen_composition_drafts_read on public.screen_composition_drafts for select to authenticated using(private.is_tenant_member(tenant_id));
create policy screen_compositions_read on public.screen_compositions for select to authenticated using(private.is_tenant_member(tenant_id));
create policy screen_composition_bindings_read on public.screen_composition_bindings for select to authenticated using(private.is_tenant_member(tenant_id));
revoke all on public.screen_composition_drafts,public.screen_compositions,public.screen_composition_bindings from public,anon,authenticated,service_role;
grant select on public.screen_composition_drafts,public.screen_compositions,public.screen_composition_bindings to authenticated,service_role;
alter table public.screens add column composition_id uuid,add column composition_revision bigint not null default 0 check(composition_revision>=0),
  add constraint screens_composition_scope_fkey foreign key(tenant_id,id,composition_id) references public.screen_compositions(tenant_id,screen_id,id) on delete restrict;
alter table public.player_devices add column active_composition_id uuid,add column desired_composition_id uuid,
  add constraint devices_active_composition_scope_fkey foreign key(tenant_id,screen_id,active_composition_id) references public.screen_compositions(tenant_id,screen_id,id) on delete restrict,
  add constraint devices_desired_composition_scope_fkey foreign key(tenant_id,screen_id,desired_composition_id) references public.screen_compositions(tenant_id,screen_id,id) on delete restrict;
create index player_devices_tenant_composition_idx on public.player_devices(tenant_id,active_composition_id,desired_composition_id);

create function private.assert_screen_composition_v1(p_tenant_id uuid,p_screen_id uuid,p_configuration jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare expected text[];zone jsonb;ids text[];screen_orientation text;
begin
  select orientation into screen_orientation from public.screens where tenant_id=p_tenant_id and id=p_screen_id and deleted_at is null;
  if screen_orientation is null or octet_length(p_configuration::text)>16384 or jsonb_typeof(p_configuration) is distinct from 'object'
    or not(p_configuration?&array['schemaVersion','orientation','layout','mainWidthPercent','bottomHeightPercent','zones'])
    or p_configuration->>'schemaVersion' is distinct from '1' or p_configuration->>'orientation' not in('landscape','portrait')
    or p_configuration->>'layout' not in('full','sidebar','bottom','three')
    or jsonb_typeof(p_configuration->'zones') is distinct from 'array'
    or jsonb_typeof(p_configuration->'schemaVersion')is distinct from 'number'
    or jsonb_typeof(p_configuration->'orientation')is distinct from 'string'
    or jsonb_typeof(p_configuration->'layout')is distinct from 'string'
    or jsonb_typeof(p_configuration->'mainWidthPercent')is distinct from 'number'
    or jsonb_typeof(p_configuration->'bottomHeightPercent')is distinct from 'number'
    or (p_configuration->>'mainWidthPercent')::integer not between 50 and 80 or (p_configuration->>'mainWidthPercent')::integer%5<>0
    or (p_configuration->>'bottomHeightPercent')::integer not between 15 and 35 or (p_configuration->>'bottomHeightPercent')::integer%5<>0
    or exists(select 1 from jsonb_object_keys(p_configuration) key where key not in('schemaVersion','orientation','layout','mainWidthPercent','bottomHeightPercent','zones'))
    then raise exception 'screen composition invalid' using errcode='23514';end if;
  expected:=case p_configuration->>'layout' when 'full' then array['main'] when 'sidebar' then array['main','side'] when 'bottom' then array['main','bottom'] else array['main','side','bottom'] end;
  select array_agg(value->>'id') into ids from jsonb_array_elements(p_configuration->'zones');
  if cardinality(ids)<>cardinality(expected) or cardinality(ids)<>(select count(distinct id)from unnest(ids)id) or not(ids @> expected and ids <@ expected) then raise exception 'composition zones do not match layout' using errcode='23514';end if;
  for zone in select * from jsonb_array_elements(p_configuration->'zones') loop
    if exists(select 1 from jsonb_object_keys(zone) key where key not in('id','playlistId','fallbackReleaseId'))
      or not exists(select 1 from public.playlists where tenant_id=p_tenant_id and id=(zone->>'playlistId')::uuid and status<>'archived') then raise exception 'zone playlist unavailable in tenant' using errcode='23514';end if;
    if zone?'fallbackReleaseId' and not exists(select 1 from public.playlist_releases where tenant_id=p_tenant_id and playlist_id=(zone->>'playlistId')::uuid and id=(zone->>'fallbackReleaseId')::uuid) then raise exception 'zone fallback unavailable in tenant' using errcode='23514';end if;
  end loop;
end $$;
revoke all on function private.assert_screen_composition_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.save_screen_composition_draft_v1(p_screen_id uuid,p_expected_revision bigint,p_configuration jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare screen public.screens%rowtype;draft public.screen_composition_drafts%rowtype;request jsonb;replay jsonb;revision bigint;
begin
  select * into screen from public.screens where id=p_screen_id for update;
  if not found or private.current_user_id() is null or not private.can_manage_screens(screen.tenant_id) then raise exception 'actor cannot manage screen composition' using errcode='42501';end if;
  perform private.require_active_tenant_command(screen.tenant_id);
  perform private.assert_screen_composition_v1(screen.tenant_id,screen.id,p_configuration);
  request:=jsonb_build_object('screenId',p_screen_id,'expectedRevision',p_expected_revision,'configuration',p_configuration);
  replay:=private.begin_publisher_command(screen.tenant_id,'screen.composition.save',p_idempotency_key,request);if replay is not null then return replay;end if;
  select * into draft from public.screen_composition_drafts where tenant_id=screen.tenant_id and screen_id=screen.id for update;
  if p_expected_revision is null or coalesce(draft.revision,0)<>p_expected_revision then return private.complete_publisher_command(screen.tenant_id,'screen.composition.save',p_idempotency_key,request,'screens',screen.id,jsonb_build_object('outcome','conflict','actualRevision',coalesce(draft.revision,0)),'publisher.screen.composition.conflict','failed');end if;
  insert into public.screen_composition_drafts(tenant_id,screen_id,revision,configuration_json,updated_by)values(screen.tenant_id,screen.id,1,p_configuration,private.current_user_id())
    on conflict(tenant_id,screen_id)do update set revision=screen_composition_drafts.revision+1,configuration_json=excluded.configuration_json,updated_by=excluded.updated_by,updated_at=now() returning screen_composition_drafts.revision into revision;
  return private.complete_publisher_command(screen.tenant_id,'screen.composition.save',p_idempotency_key,request,'screens',screen.id,jsonb_build_object('outcome','saved','actualRevision',revision),'publisher.screen.composition.saved','success');
end $$;

create function public.publish_screen_composition_v1(p_screen_id uuid,p_expected_draft_revision bigint,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
<<composition_publish>>
declare screen public.screens%rowtype;draft public.screen_composition_drafts%rowtype;zone jsonb;publication public.playlist_publications%rowtype;
  request jsonb;replay jsonb;composition_id uuid:=gen_random_uuid();revision bigint;main_playlist uuid;main_release uuid;
begin
  select * into screen from public.screens where id=p_screen_id for update;
  if not found or private.current_user_id() is null or not private.can_manage_screens(screen.tenant_id)
    or not private.has_tenant_capability(screen.tenant_id,'tenant.playlist.publish') then raise exception 'actor cannot publish screen composition' using errcode='42501';end if;
  perform private.require_active_tenant_command(screen.tenant_id);
  if screen.deleted_at is not null or screen.status<>'active' then raise exception 'screen not active' using errcode='23514';end if;
  request:=jsonb_build_object('screenId',p_screen_id,'expectedDraftRevision',p_expected_draft_revision);
  replay:=private.begin_publisher_command(screen.tenant_id,'screen.composition.publish',p_idempotency_key,request);if replay is not null then return replay;end if;
  select * into draft from public.screen_composition_drafts where tenant_id=screen.tenant_id and screen_id=screen.id for update;
  if not found or p_expected_draft_revision is distinct from draft.revision then return private.complete_publisher_command(screen.tenant_id,'screen.composition.publish',p_idempotency_key,request,'screens',screen.id,jsonb_build_object('outcome','conflict','actualRevision',coalesce(draft.revision,0)),'publisher.screen.composition.conflict','failed');end if;
  perform private.assert_screen_composition_v1(screen.tenant_id,screen.id,draft.configuration_json);
  select coalesce(max(existing.revision),0)+1 into revision from public.screen_compositions existing where tenant_id=screen.tenant_id and screen_id=screen.id;
  insert into public.screen_compositions(id,tenant_id,screen_id,revision,configuration_json,published_by)values(composition_id,screen.tenant_id,screen.id,revision,draft.configuration_json,private.current_user_id());
  for zone in select * from jsonb_array_elements(draft.configuration_json->'zones') loop
    select * into publication from public.playlist_publications where tenant_id=screen.tenant_id and playlist_id=(zone->>'playlistId')::uuid for share;
    if not found or not exists(select 1 from public.playlist_release_items where tenant_id=screen.tenant_id and release_id=publication.release_id and enabled)
      or exists(select 1 from public.playlist_release_items item left join public.media_assets asset on asset.tenant_id=item.tenant_id and asset.id=item.media_asset_id
        left join public.media_variants variant on variant.tenant_id=item.tenant_id and variant.id=item.media_variant_id
        where item.tenant_id=screen.tenant_id and item.release_id=publication.release_id and item.enabled and
          (asset.id is null or asset.status<>'ready' or asset.deleted_at is not null or variant.id is null or variant.checksum_sha256 is distinct from item.checksum_sha256)) then raise exception 'zone requires a complete verified publication' using errcode='23514';end if;
    insert into public.screen_composition_bindings(tenant_id,composition_id,zone_id,playlist_id,release_id,config_revision,fallback_release_id)
      values(screen.tenant_id,composition_id,zone->>'id',publication.playlist_id,publication.release_id,publication.config_revision,nullif(zone->>'fallbackReleaseId','')::uuid);
    if zone->>'id'='main' then main_playlist:=publication.playlist_id;main_release:=publication.release_id;end if;
  end loop;
  update public.screens set composition_id=composition_publish.composition_id,composition_revision=revision,orientation=draft.configuration_json->>'orientation',
    default_playlist_id=main_playlist,default_release_id=main_release,
    assigned_playlist_id=case when active_schedule_id is null then main_playlist else assigned_playlist_id end,
    assigned_release_id=case when active_schedule_id is null then main_release else assigned_release_id end
    where id=screen.id;
  update public.player_devices set desired_composition_id=composition_id where tenant_id=screen.tenant_id and screen_id=screen.id and status='paired';
  insert into private.publication_version_prune_queue(tenant_id)values(screen.tenant_id)on conflict(tenant_id)do update set pending=true,requested_at=clock_timestamp(),not_before=clock_timestamp(),updated_at=clock_timestamp();
  return private.complete_publisher_command(screen.tenant_id,'screen.composition.publish',p_idempotency_key,request,'screens',screen.id,jsonb_build_object('outcome','published','compositionId',composition_id,'revision',revision,'actualRevision',draft.revision),'publisher.screen.composition.published','success');
end $$;
revoke all on function public.save_screen_composition_draft_v1(uuid,bigint,jsonb,uuid),public.publish_screen_composition_v1(uuid,bigint,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_screen_composition_draft_v1(uuid,bigint,jsonb,uuid),public.publish_screen_composition_v1(uuid,bigint,uuid)to authenticated;

create or replace function private.advance_screen_target_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then new.target_revision:=1;
  elsif row(new.assigned_release_id,new.active_assignment_source,new.active_schedule_id,new.composition_id)
    is distinct from row(old.assigned_release_id,old.active_assignment_source,old.active_schedule_id,old.composition_id)then new.target_revision:=old.target_revision+1;new.target_changed_at:=clock_timestamp();
  else new.target_revision:=old.target_revision;new.target_changed_at:=old.target_changed_at;end if;return new;
end $$;

create function private.screen_composition_json_v1(p_tenant_id uuid,p_composition_id uuid)returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',composition.id,'revision',composition.revision,'configuration',composition.configuration_json,'bindings',
    (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('zoneId',zone_id,'playlistId',playlist_id,'releaseId',release_id,'publicationId',playlist_id,'configRevision',config_revision,'fallbackReleaseId',fallback_release_id))order by zone_id)
      from public.screen_composition_bindings where tenant_id=p_tenant_id and composition_id=composition.id))
    from public.screen_compositions composition where tenant_id=p_tenant_id and id=p_composition_id
$$;
revoke all on function private.screen_composition_json_v1(uuid,uuid)from public,anon,authenticated,service_role;

-- All device-authenticated manifest lookups include the complete composition.
alter function public.get_player_effective_target_v1(text)rename to get_player_effective_target_before_composition_v1;
create function public.get_player_effective_target_v1(p_token_hash text)returns jsonb language sql stable security definer set search_path='' as $$
  select base||jsonb_build_object('desired_composition_id',screen.composition_id,'active_composition_id',device.active_composition_id,
    'composition',private.screen_composition_json_v1(screen.tenant_id,screen.composition_id),'data_key',coalesce((select string_agg(data.snapshot_id::text||':'||data.data_revision::text,','order by data.snapshot_id)
      from public.published_dynamic_data data where data.tenant_id=screen.tenant_id and exists(select 1 from public.playlist_release_items item where item.tenant_id=data.tenant_id and item.dynamic_snapshot_id=data.snapshot_id and item.live_data_enabled and
        (item.release_id=screen.assigned_release_id or exists(select 1 from public.screen_composition_bindings where tenant_id=screen.tenant_id and composition_id=screen.composition_id and release_id=item.release_id)))),''))
  from public.get_player_effective_target_before_composition_v1(p_token_hash)base
  join public.player_devices device on device.id=(base->>'device_id')::uuid
  join public.screens screen on screen.tenant_id=device.tenant_id and screen.id=device.screen_id
$$;
revoke all on function public.get_player_effective_target_before_composition_v1(text),public.get_player_effective_target_v1(text)from public,anon,authenticated,service_role;
grant execute on function public.get_player_effective_target_v1(text)to service_role;

create function public.acknowledge_player_composition_v1(p_token_hash text,p_composition_id uuid,p_target_revision bigint)
returns boolean language plpgsql security definer set search_path='' as $$
declare candidate public.player_devices%rowtype;device public.player_devices%rowtype;screen public.screens%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required'using errcode='42501';end if;
  -- Match publication's screen -> device order. Read the candidate without a
  -- lock, then revalidate its token, status and binding under the device lock.
  select * into candidate from public.player_devices where token_hash=lower(nullif(btrim(p_token_hash),'')) and status='paired';
  if not found then return false;end if;
  select * into screen from public.screens where tenant_id=candidate.tenant_id and id=candidate.screen_id and status='active' and deleted_at is null for share;
  if not found or screen.composition_id is distinct from p_composition_id or screen.target_revision is distinct from p_target_revision then return false;end if;
  select * into device from public.player_devices where id=candidate.id and token_hash=lower(nullif(btrim(p_token_hash),'')) and status='paired' for update;
  if not found or device.tenant_id is distinct from screen.tenant_id or device.screen_id is distinct from screen.id then return false;end if;
  update public.player_devices set active_composition_id=p_composition_id,desired_composition_id=p_composition_id where id=device.id;
  insert into private.publication_version_prune_queue(tenant_id)values(device.tenant_id)on conflict(tenant_id)do update set pending=true,requested_at=clock_timestamp(),not_before=clock_timestamp(),updated_at=clock_timestamp();
  return true;
end $$;
revoke all on function public.acknowledge_player_composition_v1(text,uuid,bigint)from public,anon,authenticated,service_role;
grant execute on function public.acknowledge_player_composition_v1(text,uuid,bigint)to service_role;

alter function private.publication_release_is_referenced_v1(uuid,uuid)rename to publication_release_referenced_before_composition_v1;
create function private.publication_release_is_referenced_v1(p_tenant_id uuid,p_release_id uuid)returns boolean language sql volatile security definer set search_path='' as $$
  select private.publication_release_referenced_before_composition_v1(p_tenant_id,p_release_id)or exists(select 1 from public.screen_composition_bindings where tenant_id=p_tenant_id and(release_id=p_release_id or fallback_release_id=p_release_id))
$$;
alter function private.referenced_publication_releases_v1(uuid)rename to referenced_releases_before_composition_v1;
create function private.referenced_publication_releases_v1(p_tenant_id uuid)returns table(release_id uuid)language sql stable security definer set search_path='' as $$
  select release_id from private.referenced_releases_before_composition_v1(p_tenant_id)
  union select binding.release_id from public.screen_composition_bindings binding where binding.tenant_id=p_tenant_id and(
    exists(select 1 from public.screens where tenant_id=p_tenant_id and composition_id=binding.composition_id)
    or exists(select 1 from public.player_devices where tenant_id=p_tenant_id and(active_composition_id=binding.composition_id or desired_composition_id=binding.composition_id)))
$$;
revoke all on function private.publication_release_is_referenced_v1(uuid,uuid),private.publication_release_referenced_before_composition_v1(uuid,uuid),private.referenced_publication_releases_v1(uuid),private.referenced_releases_before_composition_v1(uuid)from public,anon,authenticated,service_role;

create table private.composition_prune_context(backend_pid integer not null,transaction_id bigint not null,tenant_id uuid not null references public.tenants(id),composition_ids uuid[]not null,primary key(backend_pid,transaction_id));
create index composition_prune_context_tenant_idx on private.composition_prune_context(tenant_id);
alter table private.composition_prune_context enable row level security;alter table private.composition_prune_context force row level security;
revoke all on private.composition_prune_context from public,anon,authenticated,service_role;
create function private.composition_prune_contains_v1(p_tenant_id uuid,p_composition_id uuid)returns boolean language sql volatile security definer set search_path='' as $$
  select exists(select 1 from private.composition_prune_context where backend_pid=pg_backend_pid()and transaction_id=txid_current()and tenant_id=p_tenant_id and p_composition_id=any(composition_ids))
$$;
revoke all on function private.composition_prune_contains_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function private.composition_prune_contains_v1(uuid,uuid)to authenticated,service_role;
create function private.reject_screen_composition_mutation_v1()returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and private.composition_prune_contains_v1(old.tenant_id,case when tg_table_name='screen_compositions'then (to_jsonb(old)->>'id')::uuid else (to_jsonb(old)->>'composition_id')::uuid end)then return old;end if;
  raise exception 'published screen compositions are immutable'using errcode='23514';
end $$;
revoke all on function private.reject_screen_composition_mutation_v1()from public,anon,authenticated,service_role;
create trigger immutable_screen_compositions before update or delete on public.screen_compositions for each row execute function private.reject_screen_composition_mutation_v1();
create trigger immutable_screen_composition_bindings before update or delete on public.screen_composition_bindings for each row execute function private.reject_screen_composition_mutation_v1();

alter function public.prune_superseded_publication_versions_v1(uuid,integer)rename to prune_versions_before_composition_v1;
create function public.prune_superseded_publication_versions_v1(p_tenant_id uuid,p_limit integer default 25)returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate uuid;count integer:=0;result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role'then raise exception 'service role required'using errcode='42501';end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid prune scope or batch limit'using errcode='22023';end if;
  for candidate in select composition.id from public.screen_compositions composition where composition.tenant_id=p_tenant_id and composition.published_at<statement_timestamp()-interval '10 minutes'
    and not exists(select 1 from public.screens where tenant_id=p_tenant_id and composition_id=composition.id)
    and not exists(select 1 from public.player_devices where tenant_id=p_tenant_id and(active_composition_id=composition.id or desired_composition_id=composition.id))
    and exists(select 1 from public.screen_compositions newer where newer.tenant_id=p_tenant_id and newer.screen_id=composition.screen_id and newer.revision>composition.revision)
    order by composition.revision limit p_limit for update skip locked loop
    begin
      insert into private.composition_prune_context values(pg_backend_pid(),txid_current(),p_tenant_id,array[candidate])on conflict(backend_pid,transaction_id)do update set tenant_id=excluded.tenant_id,composition_ids=excluded.composition_ids;
      delete from public.screen_composition_bindings where tenant_id=p_tenant_id and composition_id=candidate;
      delete from public.screen_compositions where tenant_id=p_tenant_id and id=candidate;
      delete from private.composition_prune_context where backend_pid=pg_backend_pid()and transaction_id=txid_current();count:=count+1;
    exception when foreign_key_violation or lock_not_available then null;end;
  end loop;
  result:=public.prune_versions_before_composition_v1(p_tenant_id,p_limit);
  return result||jsonb_build_object('prunedCompositions',count);
end $$;
revoke all on function public.prune_versions_before_composition_v1(uuid,integer),public.prune_superseded_publication_versions_v1(uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.prune_superseded_publication_versions_v1(uuid,integer)to service_role;
select pg_catalog.pg_notify('pgrst','reload schema');
