-- S305: an applied season transition owns its previous authoring basis and
-- the exact immutable publications that contain that basis. Ordinary unreachable
-- history keeps S190/S191 retention; this migration never reconstructs history.
create index publisher_receipts_season_previous_version_s305_idx
 on public.publisher_command_receipts(tenant_id,(outcome_json->>'previousVersionId'),target_id)
 where command_type='sportlink.season.draft.apply' and target_type='dynamic_slides'
  and outcome_json->>'status'='applied' and outcome_json->>'resourceKind'='dynamic_slide';

create function private.sportlink_season_version_is_retained_s305_v1(p_tenant_id uuid,p_version_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.dynamic_slide_versions version
  join public.dynamic_slide_versions basis on basis.tenant_id=version.tenant_id and basis.dynamic_slide_id=version.dynamic_slide_id
  join public.publisher_command_receipts receipt on receipt.tenant_id=basis.tenant_id
   and receipt.target_id=basis.dynamic_slide_id and receipt.outcome_json->>'previousVersionId'=basis.id::text
  where version.tenant_id=p_tenant_id and version.id=p_version_id
   and (basis.id=version.id or (basis.based_on_version_id=version.id and receipt.outcome_json->>'draftVersionId'=basis.id::text))
   and receipt.command_type='sportlink.season.draft.apply' and receipt.target_type='dynamic_slides'
   and receipt.outcome_json->>'status'='applied' and receipt.outcome_json->>'resourceKind'='dynamic_slide'
   and receipt.outcome_json->>'resourceId'=version.dynamic_slide_id::text
   and receipt.outcome_json->>'receiptId'=receipt.id::text)
$$;
revoke all on function private.sportlink_season_version_is_retained_s305_v1(uuid,uuid)
 from public,anon,authenticated,service_role;

alter function private.publication_release_is_referenced_v1(uuid,uuid)
 rename to publication_release_referenced_before_season_s305_v1;
create function private.publication_release_is_referenced_v1(p_tenant_id uuid,p_release_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select private.publication_release_referenced_before_season_s305_v1(p_tenant_id,p_release_id)
  or exists(select 1 from public.playlist_release_items item
   join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
   where item.tenant_id=p_tenant_id and item.release_id=p_release_id
    and private.sportlink_season_version_is_retained_s305_v1(p_tenant_id,snapshot.dynamic_slide_version_id))
$$;

alter function private.publication_snapshot_is_referenced_v1(uuid,uuid,uuid)
 rename to publication_snapshot_referenced_before_season_s305_v1;
create function private.publication_snapshot_is_referenced_v1(
 p_tenant_id uuid,p_snapshot_id uuid,p_ignored_version_id uuid default null
)returns boolean language sql volatile security definer set search_path='' as $$
 select private.publication_snapshot_referenced_before_season_s305_v1(p_tenant_id,p_snapshot_id,p_ignored_version_id)
  or exists(select 1 from public.dynamic_slide_versions version
   where version.tenant_id=p_tenant_id and version.published_snapshot_id=p_snapshot_id
    and private.sportlink_season_version_is_retained_s305_v1(p_tenant_id,version.id))
$$;

alter function private.publication_version_can_prune_v1(uuid,uuid)
 rename to publication_version_can_prune_before_season_s305_v1;
create function private.publication_version_can_prune_v1(p_tenant_id uuid,p_version_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select not private.sportlink_season_version_is_retained_s305_v1(p_tenant_id,p_version_id)
  and private.publication_version_can_prune_before_season_s305_v1(p_tenant_id,p_version_id)
$$;
revoke all on function private.publication_release_is_referenced_v1(uuid,uuid),
 private.publication_release_referenced_before_season_s305_v1(uuid,uuid),
 private.publication_snapshot_is_referenced_v1(uuid,uuid,uuid),
 private.publication_snapshot_referenced_before_season_s305_v1(uuid,uuid,uuid),
 private.publication_version_can_prune_v1(uuid,uuid),
 private.publication_version_can_prune_before_season_s305_v1(uuid,uuid)
 from public,anon,authenticated,service_role;

-- The canonical apply command already owns the slide and basis-version locks.
-- Acquire exact restoration references before its reviewed impact is checked.
-- NOWAIT preserves binding-before-queue ordering: no waiting behind a prune
-- holding its queue row. A conflict aborts the whole apply, including authoring.
create function private.lock_sportlink_season_restore_refs_s305_v1(
 p_tenant_id uuid,p_slide_id uuid,p_version_id uuid
)returns void language plpgsql security definer set search_path='' as $$
declare version_ids uuid[];
begin
 select array_agg(version.id order by version.id)into version_ids
 from public.dynamic_slide_versions basis join public.dynamic_slide_versions version
  on version.tenant_id=basis.tenant_id and version.dynamic_slide_id=basis.dynamic_slide_id
   and version.id in(basis.id,basis.based_on_version_id)
 where basis.tenant_id=p_tenant_id and basis.dynamic_slide_id=p_slide_id and basis.id=p_version_id;
 perform 1 from public.dynamic_slide_versions version where version.tenant_id=p_tenant_id
  and version.id=any(version_ids)order by version.id for key share of version nowait;
 perform 1 from public.dynamic_slide_snapshots snapshot
  join public.dynamic_slide_versions version on version.tenant_id=snapshot.tenant_id and version.id=snapshot.dynamic_slide_version_id
  where version.tenant_id=p_tenant_id and version.id=any(version_ids)and snapshot.id=version.published_snapshot_id
  order by snapshot.id for key share of snapshot nowait;
 perform 1 from public.playlist_releases release
  where release.tenant_id=p_tenant_id and exists(select 1 from public.playlist_release_items item
   join public.dynamic_slide_snapshots snapshot on snapshot.tenant_id=item.tenant_id and snapshot.id=item.dynamic_snapshot_id
   where item.tenant_id=p_tenant_id and item.release_id=release.id and snapshot.dynamic_slide_id=p_slide_id
    and snapshot.dynamic_slide_version_id=any(version_ids))
  order by release.id for key share of release nowait;
exception when lock_not_available then
 raise exception 'season restoration reference changed; review the transition again' using errcode='40001';
end $$;
revoke all on function private.lock_sportlink_season_restore_refs_s305_v1(uuid,uuid,uuid)
 from public,anon,authenticated,service_role;

create or replace function public.apply_sportlink_season_switch_draft_v1(p_tenant_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prepared jsonb;replay jsonb;result jsonb;saved jsonb;forked jsonb;
 slide public.dynamic_slides%rowtype;version public.dynamic_slide_versions%rowtype;draft_version public.dynamic_slide_versions%rowtype;
 source_id uuid;connection_id uuid;draft_id uuid;revision bigint;status text;reason text;
begin
 if private.current_user_id()is null or not private.has_tenant_capability(p_tenant_id,'tenant.data_source.read')
  or not private.has_tenant_capability(p_tenant_id,case when p_input->>'resourceKind'='matchday_runbook'
   then'tenant.playlist.write'else'tenant.dynamic_slide.write'end)then
  raise exception 'season draft write permission required'using errcode='42501';end if;
 perform private.require_active_tenant_command(p_tenant_id);
 perform private.assert_sportlink_season_input_s301_v1(p_input,true);
 -- Matching retries return before resource revision, active-draft and current
 -- normalized-source checks; a changed body under this nonce is a conflict.
 replay:=private.begin_publisher_command(p_tenant_id,'sportlink.season.draft.apply',(p_input->>'requestId')::uuid,p_input);
 if replay is not null then return replay;end if;
 if p_input->>'resourceKind'='matchday_runbook'then
  result:=private.sportlink_season_runbook_apply_s301_v1(p_tenant_id,p_input);
  return private.complete_sportlink_season_command_s301_v1(p_tenant_id,p_input,'matchday_runbooks',
   (p_input->>'resourceId')::uuid,result,null);
 end if;
 select *into slide from public.dynamic_slides where tenant_id=p_tenant_id and id=(p_input->>'resourceId')::uuid for update;
 if slide.id is null then raise exception 'season resource outside tenant'using errcode='42501';end if;
 select *into version from public.dynamic_slide_versions where tenant_id=p_tenant_id and dynamic_slide_id=slide.id
  and id=coalesce(slide.active_draft_version_id,slide.current_published_version_id)for update;
 perform private.lock_sportlink_season_restore_refs_s305_v1(p_tenant_id,slide.id,version.id);
 source_id:=version.data_source_id;
 select id into connection_id from public.sportlink_connections where tenant_id=p_tenant_id and data_source_id=source_id;
 -- Use the worker's club/team -> connection/source lock order. Shared row
 -- locks retain exact normalized candidates until the authoring transaction ends.
 perform id from public.sports_clubs where tenant_id=p_tenant_id and source_connection_id=connection_id order by id for share;
 perform id from public.sports_teams where tenant_id=p_tenant_id and source_connection_id=connection_id order by id for share;
 perform id from public.sportlink_connections where tenant_id=p_tenant_id and id=connection_id for share;
 perform id from public.dynamic_data_sources where tenant_id=p_tenant_id and id=source_id for share;
 prepared:=private.sportlink_season_prepare_s301_v1(p_tenant_id,p_input);
 status:=prepared->>'status';reason:=prepared->>'reason';
 if status='ready'then
  begin
   if version.status='draft'then draft_id:=version.id;revision:=version.edit_revision;
   else
    -- The screen/slide lock and prepare check guarantee that this call cannot
    -- silently resume another user's newly created draft.
    forked:=public.create_or_resume_dynamic_slide_version_v1(slide.id,version.id);
    if forked->>'outcome'<>'created'then raise exception 'draft fork conflict'using errcode='40001';end if;
    draft_id:=(forked->>'versionId')::uuid;
    -- The original materialization triggers can advance edit_revision after
    -- the fork's local RETURNING row was captured. Reload this exact new draft;
    -- this is not permission to resume any pre-existing concurrent draft.
    select *into draft_version from public.dynamic_slide_versions where tenant_id=p_tenant_id
     and dynamic_slide_id=slide.id and id=draft_id for update;
    if draft_version.status is distinct from'draft'or draft_version.based_on_version_id is distinct from version.id
     or not exists(select 1 from public.dynamic_slides where tenant_id=p_tenant_id and id=slide.id and active_draft_version_id=draft_id)then
     raise exception 'draft fork identity conflict'using errcode='40001';end if;
    revision:=draft_version.edit_revision;
   end if;
   saved:=public.save_dynamic_slide_version_v1(slide.id,draft_id,revision,version.name,version.template_version_id,
    version.data_source_id,version.orientation,version.selection_mode,prepared->'configuration',version.theme_selection_json);
   if saved->>'outcome'<>'applied'then raise exception 'draft save conflict'using errcode='40001';end if;
   select edit_revision into revision from public.dynamic_slide_versions where tenant_id=p_tenant_id and id=draft_id;
   status:='applied';reason:=null;
  exception
   when serialization_failure then status:='conflict';draft_id:=null;revision:=null;
    reason:='Het concept is tijdens het opslaan gewijzigd. Controleer deze rij opnieuw.';
   when check_violation or invalid_parameter_value or no_data_found or insufficient_privilege then
    status:='blocked';draft_id:=null;revision:=null;
    reason:='De bestaande authoringvalidatie weigert deze conceptwijziging. Er is niets gedeeltelijk opgeslagen; open het ontwerp voor controle.';
  end;
 end if;
 result:=jsonb_build_object('schemaVersion',1,'status',status,'resourceKind','dynamic_slide','resourceId',slide.id,
  'requestId',p_input->'requestId','correlationId',p_input->'correlationId','receiptId',null,
  'previousVersionId',p_input->'basisVersionId','draftVersionId',draft_id,'previousRevision',p_input->'expectedRevision',
  'newRevision',revision,'reason',reason,'links',private.sportlink_season_links_s301_v1(p_tenant_id,slide.id));
 return private.complete_sportlink_season_command_s301_v1(p_tenant_id,p_input,'dynamic_slides',slide.id,result,prepared->'oldSelection');
end $$;
revoke all on function public.apply_sportlink_season_switch_draft_v1(uuid,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.apply_sportlink_season_switch_draft_v1(uuid,jsonb)to authenticated;
notify pgrst,'reload schema';
