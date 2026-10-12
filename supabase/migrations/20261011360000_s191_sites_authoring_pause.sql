-- S191: managed negative rollout flag. Pausing authoring never changes published
-- releases, cached playback, provider refresh, or immutable restore provenance.
insert into private.tenant_feature_flag_definitions(flag_key)
values ('sites_authoring_paused') on conflict(flag_key) do nothing;
alter table public.tenant_feature_flags drop constraint tenant_feature_flags_flag_key_check;
alter table public.tenant_feature_flags add constraint tenant_feature_flags_flag_key_check check(flag_key in (
 'vector_v2_design_system','vector_v2_marketing','vector_v2_control_shell','vector_v2_mobile_shell','vector_v2_player_shell',
 'unified_resource_picker','unified_filter_dock','venue_twin','screen_health_view','engage','youtube_integration','sportlink_birthdays','ledscores_realtime',
 'billing_engine_enabled','billing_collect_recurring','billing_proration_enabled','billing_dunning_worker','billing_enforce_entitlements',
 'billing_player_warning_chip','billing_player_restriction_splash','billing_mollie_nextgen_webhooks','billing_mollie_sales_invoices',
 'billing_reconciliation_worker','billing_support_overrides','billing_mollie_fixed_subscription_adapter','sites_authoring_paused'));

create function private.sites_authoring_is_paused_v1(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select flag.enabled from public.tenant_feature_flags flag where flag.tenant_id=p_tenant_id and flag.flag_key='sites_authoring_paused'),false)
  or coalesce((select definition.kill_switch_active from private.tenant_feature_flag_definitions definition where definition.flag_key='sites_authoring_paused'),true)
$$;
revoke all on function private.sites_authoring_is_paused_v1(uuid) from public,anon,authenticated,service_role;

create function public.get_sites_authoring_state_v1(p_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if private.current_user_id() is null or not (private.is_tenant_member(p_tenant_id) or private.is_platform_member(array['platform_owner','platform_admin','platform_support','platform_viewer']::public.platform_role[])) then
  raise exception 'Sites authoring read permission required' using errcode='42501';
 end if;
 if not exists(select 1 from public.tenants where id=p_tenant_id) then raise exception 'tenant not found' using errcode='P0002';end if;
 return pg_catalog.jsonb_build_object('tenantId',p_tenant_id,'paused',private.sites_authoring_is_paused_v1(p_tenant_id),'revision',coalesce((select flag.revision from public.tenant_feature_flags flag where flag.tenant_id=p_tenant_id and flag.flag_key='sites_authoring_paused'),0));
end $$;
revoke all on function public.get_sites_authoring_state_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_sites_authoring_state_v1(uuid) to authenticated;

create function private.json_has_sites_authoring_v1(p_value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.sitesPresentation'),false)
  or coalesce(pg_catalog.jsonb_path_exists(p_value,'$.**.sitesConfiguration'),false)
  or coalesce(p_value->>'rendererVersion'='sites-v11',false)
$$;
revoke all on function private.json_has_sites_authoring_v1(jsonb) from public,anon,authenticated,service_role;

-- Context cannot be forged by a browser GUC. It exists only inside the original
-- capability/CAS/audit-checked restore command and names its exact immutable source.
create table private.sites_immutable_restore_contexts (
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 resource_kind text not null check(resource_kind in ('studio','playlist')),
 resource_id uuid not null, source_id uuid not null, actor_id uuid not null,
 backend_pid integer not null, transaction_id bigint not null,
 primary key(tenant_id,resource_kind,resource_id,backend_pid,transaction_id)
);
create index sites_immutable_restore_contexts_tenant_idx on private.sites_immutable_restore_contexts(tenant_id);
alter table private.sites_immutable_restore_contexts enable row level security;
alter table private.sites_immutable_restore_contexts force row level security;
revoke all on private.sites_immutable_restore_contexts from public,anon,authenticated,service_role;

create function private.assert_sites_authoring_open_v1(p_tenant_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Serialize admission with the existing S139 tenant-first flag command, and
 -- hold the definition share lock so a global emergency stop cannot race commit.
 perform 1 from public.tenants where id=p_tenant_id for share;
 perform 1 from private.tenant_feature_flag_definitions where flag_key='sites_authoring_paused' for share;
 if private.sites_authoring_is_paused_v1(p_tenant_id) then raise exception 'Sites authoring is paused' using errcode='55000';end if;
end $$;
revoke all on function private.assert_sites_authoring_open_v1(uuid) from public,anon,authenticated,service_role;

create function private.guard_sites_authoring_pause_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare candidate jsonb; previous jsonb; affected boolean:=false; source_id uuid; restore_allowed boolean:=false; same_binding boolean:=false;
begin
 if tg_op='UPDATE' then
  same_binding:=pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(new)->'tenant_id',pg_catalog.to_jsonb(new)->'id',pg_catalog.to_jsonb(new)->'project_id',pg_catalog.to_jsonb(new)->'playlist_id',pg_catalog.to_jsonb(new)->'data_source_id',pg_catalog.to_jsonb(new)->'template_id',pg_catalog.to_jsonb(new)->'template_version_id',pg_catalog.to_jsonb(new)->'connection_id',pg_catalog.to_jsonb(new)->'orientation')
   is not distinct from pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(old)->'tenant_id',pg_catalog.to_jsonb(old)->'id',pg_catalog.to_jsonb(old)->'project_id',pg_catalog.to_jsonb(old)->'playlist_id',pg_catalog.to_jsonb(old)->'data_source_id',pg_catalog.to_jsonb(old)->'template_id',pg_catalog.to_jsonb(old)->'template_version_id',pg_catalog.to_jsonb(old)->'connection_id',pg_catalog.to_jsonb(old)->'orientation');
 end if;
 if tg_table_name='studio_project_drafts' then
  candidate:=new.document_json;if tg_op='UPDATE' then previous:=old.document_json;end if;
  affected:=private.json_has_sites_authoring_v1(candidate) or private.json_has_sites_authoring_v1(previous);
  if tg_op='UPDATE' and same_binding and candidate is not distinct from previous and new.document_hash is not distinct from old.document_hash and new.referenced_asset_ids is not distinct from old.referenced_asset_ids then return new;end if;
 elsif tg_table_name='dynamic_slides' then
  candidate:=new.configuration_json;if tg_op='UPDATE' then previous:=old.configuration_json;end if;
  affected:=private.json_has_sites_authoring_v1(candidate) or private.json_has_sites_authoring_v1(previous)
   or coalesce(candidate#>>'{editorial,themeSelection,ref,id}',candidate#>>'{themeSelection,ref,id}',candidate#>>'{menuDocument,theme,themeId}',candidate#>>'{theme,themeId}')='onzetrots-tv'
   or coalesce(previous#>>'{editorial,themeSelection,ref,id}',previous#>>'{themeSelection,ref,id}',previous#>>'{menuDocument,theme,themeId}',previous#>>'{theme,themeId}')='onzetrots-tv'
   or exists(select 1 from public.tenant_settings settings where settings.tenant_id=new.tenant_id and settings.default_theme_id='onzetrots-tv');
 elsif tg_table_name='ledscores_goal_alerts' then
  candidate:=new.draft_config;if tg_op='UPDATE' then previous:=old.draft_config;end if;
  affected:=private.json_has_sites_authoring_v1(candidate) or private.json_has_sites_authoring_v1(previous);
 elsif tg_table_name='playlist_items' then
  candidate:=new.sites_configuration_json;if tg_op='UPDATE' then previous:=old.sites_configuration_json;end if;
  affected:=candidate is not null or previous is not null;
 elsif tg_table_name='tenant_theme_profiles' then
  candidate:=pg_catalog.jsonb_build_array(new.theme_id,new.theme_version,new.selection_json,new.color_overrides,new.appearance_config);
  if tg_op='UPDATE' then previous:=pg_catalog.jsonb_build_array(old.theme_id,old.theme_version,old.selection_json,old.color_overrides,old.appearance_config);end if;
  affected:=new.theme_id='onzetrots-tv' or (tg_op='UPDATE' and old.theme_id='onzetrots-tv');
 elsif tg_table_name='tenant_settings' then
  candidate:=pg_catalog.to_jsonb(new.default_theme_id);
  if tg_op='UPDATE' then previous:=pg_catalog.to_jsonb(old.default_theme_id);end if;
  affected:=new.default_theme_id='onzetrots-tv' or (tg_op='UPDATE' and old.default_theme_id='onzetrots-tv');
 end if;
 if not coalesce(affected,false) or (tg_table_name<>'studio_project_drafts' and tg_op='UPDATE' and same_binding and candidate is not distinct from previous) then return new;end if;
 if tg_table_name='studio_project_drafts' then
  select context.source_id into source_id from private.sites_immutable_restore_contexts context
   where context.tenant_id=new.tenant_id and context.resource_kind='studio' and context.resource_id=new.project_id
    and context.actor_id=private.current_user_id() and context.backend_pid=pg_catalog.pg_backend_pid() and context.transaction_id=pg_catalog.txid_current();
  if source_id is not null then
   select exists(select 1 from public.studio_revisions revision where revision.tenant_id=new.tenant_id and revision.project_id=new.project_id and revision.id=source_id
    and revision.document_json=candidate and revision.document_hash=new.document_hash
    and coalesce((select pg_catalog.array_agg(asset.media_asset_id order by asset.media_asset_id) from public.studio_revision_assets asset where asset.tenant_id=new.tenant_id and asset.revision_id=source_id),'{}'::uuid[])=new.referenced_asset_ids) into restore_allowed;
  end if;
 elsif tg_table_name='playlist_items' then
  select context.source_id into source_id from private.sites_immutable_restore_contexts context
   where context.tenant_id=new.tenant_id and context.resource_kind='playlist' and context.resource_id=new.playlist_id
    and context.actor_id=private.current_user_id() and context.backend_pid=pg_catalog.pg_backend_pid() and context.transaction_id=pg_catalog.txid_current();
  if source_id is not null then
   select exists(select 1 from public.playlist_releases release join public.playlist_release_authoring_snapshots snapshot on snapshot.tenant_id=release.tenant_id and snapshot.release_id=release.id
    cross join lateral pg_catalog.jsonb_array_elements(snapshot.snapshot_json->'items') document
    left join public.playlist_release_items frozen on frozen.tenant_id=release.tenant_id and frozen.release_id=release.id and frozen.sort_order=(document->>'sortOrder')::integer and frozen.media_asset_id=(document->>'mediaAssetId')::uuid
    where release.tenant_id=new.tenant_id and release.playlist_id=new.playlist_id and release.id=source_id
     and new.position_key=(document->>'positionKey')::numeric and new.media_asset_id=(document->>'mediaAssetId')::uuid
     and candidate is not distinct from coalesce(nullif(document->'sitesConfiguration','null'::jsonb),frozen.sites_configuration_json)
    union all
    select 1 from public.playlist_releases release join public.playlist_release_items frozen on frozen.tenant_id=release.tenant_id and frozen.release_id=release.id
    where release.tenant_id=new.tenant_id and release.playlist_id=new.playlist_id and release.id=source_id
     and not exists(select 1 from public.playlist_release_authoring_snapshots snapshot where snapshot.tenant_id=release.tenant_id and snapshot.release_id=release.id)
     and new.position_key=(frozen.sort_order::numeric+1)*1024 and new.media_asset_id=frozen.media_asset_id
     and candidate is not distinct from frozen.sites_configuration_json) into restore_allowed;
  end if;
 end if;
 if not restore_allowed then perform private.assert_sites_authoring_open_v1(new.tenant_id);end if;
 return new;
end $$;
revoke all on function private.guard_sites_authoring_pause_v1() from public,anon,authenticated,service_role;
create trigger sites_authoring_pause_studio before insert or update on public.studio_project_drafts for each row execute function private.guard_sites_authoring_pause_v1();
create trigger sites_authoring_pause_dynamic before insert or update on public.dynamic_slides for each row execute function private.guard_sites_authoring_pause_v1();
create trigger sites_authoring_pause_led before insert or update on public.ledscores_goal_alerts for each row execute function private.guard_sites_authoring_pause_v1();
create trigger sites_authoring_pause_playlist before insert or update on public.playlist_items for each row execute function private.guard_sites_authoring_pause_v1();
create trigger sites_authoring_pause_profile before insert or update on public.tenant_theme_profiles for each row execute function private.guard_sites_authoring_pause_v1();
create trigger sites_authoring_pause_theme before insert or update on public.tenant_settings for each row execute function private.guard_sites_authoring_pause_v1();

alter function public.restore_studio_revision_v1(uuid,uuid,bigint,uuid) rename to restore_studio_revision_before_sites_pause_v1;
create function public.restore_studio_revision_v1(p_project_id uuid,p_revision_id uuid,p_expected_draft_revision bigint,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid; result jsonb;
begin
 select project.tenant_id into tenant from public.studio_projects project join public.studio_revisions revision on revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.id=p_revision_id
 where project.id=p_project_id and private.current_user_id() is not null and private.can_edit_studio_project(project.tenant_id,project.owner_user_id);
 if tenant is null then raise exception 'actor cannot restore Studio project' using errcode='42501';end if;
 perform 1 from public.tenants where id=tenant for share;
 insert into private.sites_immutable_restore_contexts values(tenant,'studio',p_project_id,p_revision_id,private.current_user_id(),pg_catalog.pg_backend_pid(),pg_catalog.txid_current());
 result:=public.restore_studio_revision_before_sites_pause_v1(p_project_id,p_revision_id,p_expected_draft_revision,p_idempotency_key);
 delete from private.sites_immutable_restore_contexts where tenant_id=tenant and resource_kind='studio' and resource_id=p_project_id and source_id=p_revision_id and backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.txid_current();
 return result;
end $$;
revoke all on function public.restore_studio_revision_before_sites_pause_v1(uuid,uuid,bigint,uuid),public.restore_studio_revision_v1(uuid,uuid,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.restore_studio_revision_v1(uuid,uuid,bigint,uuid) to authenticated;

alter function public.restore_playlist_release_to_draft_v1(uuid,bigint,uuid) rename to restore_playlist_release_to_draft_before_sites_pause_v1;
create function public.restore_playlist_release_to_draft_v1(p_release_id uuid,p_expected_revision bigint,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid; playlist uuid; result jsonb;
begin
 select release.tenant_id,release.playlist_id into tenant,playlist from public.playlist_releases release
 where release.id=p_release_id and private.current_user_id() is not null and private.can_publish_playlist(release.tenant_id);
 if tenant is null then raise exception 'actor cannot restore this release' using errcode='42501';end if;
 perform 1 from public.tenants where id=tenant for share;
 insert into private.sites_immutable_restore_contexts values(tenant,'playlist',playlist,p_release_id,private.current_user_id(),pg_catalog.pg_backend_pid(),pg_catalog.txid_current());
 result:=public.restore_playlist_release_to_draft_before_sites_pause_v1(p_release_id,p_expected_revision,p_idempotency_key);
 delete from private.sites_immutable_restore_contexts where tenant_id=tenant and resource_kind='playlist' and resource_id=playlist and source_id=p_release_id and backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.txid_current();
 return result;
end $$;
revoke all on function public.restore_playlist_release_to_draft_before_sites_pause_v1(uuid,bigint,uuid),public.restore_playlist_release_to_draft_v1(uuid,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.restore_playlist_release_to_draft_v1(uuid,bigint,uuid) to authenticated;
comment on function public.get_sites_authoring_state_v1(uuid) is 'Tenant-scoped negative flag: raw configured pause OR global kill switch; no authoring permission is granted.';
