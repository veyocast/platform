-- Source collections use the existing tenant-scoped series, projects and
-- command receipts. Membership never changes a previously exported revision.
create function public.mutate_sync_studio_series_v1(
 p_project_id uuid,p_expected_draft_revision bigint,p_series_id uuid,p_expected_series_revision bigint,
 p_operation text,p_name text,p_member_ids uuid[],p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare project public.studio_projects%rowtype;draft public.studio_project_drafts%rowtype;series public.studio_series%rowtype;
 operation text:=lower(btrim(coalesce(p_operation,'')));normalized_name text:=nullif(btrim(p_name),'');
 request jsonb:=jsonb_build_object('projectId',p_project_id,'draftRevision',p_expected_draft_revision,'seriesId',p_series_id,
  'seriesRevision',p_expected_series_revision,'operation',p_operation,'name',p_name,'members',to_jsonb(p_member_ids));
 replay jsonb;result jsonb;ids uuid[];new_id uuid;next_project uuid;new_name text;next_document jsonb;series_revision bigint;
begin
 select * into project from public.studio_projects where id=p_project_id;
 if not found or private.current_user_id() is null or not private.can_edit_studio_project(project.tenant_id,project.owner_user_id) then
  raise exception 'actor cannot edit Source collection' using errcode='42501';end if;
 perform private.require_active_tenant_command(project.tenant_id);
 perform private.assert_sites_authoring_open_v1(project.tenant_id);
 if operation not in('add','duplicate','remove','reorder','rename') or p_expected_draft_revision is null or p_expected_draft_revision<0
  or p_idempotency_key is null or (normalized_name is not null and length(normalized_name) not between 2 and 120)
  or coalesce(cardinality(p_member_ids),0)>20 then raise exception 'Source collection request outside limits' using errcode='23514';end if;
 if p_series_id is not null then
  select * into series from public.studio_series where id=p_series_id and tenant_id=project.tenant_id for update;
  if not found or not private.can_edit_studio_project(series.tenant_id,series.owner_user_id) then
   raise exception 'actor cannot edit Source collection' using errcode='42501';end if;
 end if;
 replay:=private.begin_studio_command(project.tenant_id,'studio.sync.series.mutate',p_idempotency_key,request);
 if replay is not null then return replay;end if;
 -- All membership operations acquire project locks in the same order. An
 -- independent editor save locks only its project and cannot undo membership.
 perform candidate.id from public.studio_projects candidate where candidate.tenant_id=project.tenant_id
  and (candidate.id=p_project_id or candidate.id in(select item.project_id from public.studio_series_items item
   where item.tenant_id=project.tenant_id and item.series_id=p_series_id)) order by candidate.id for update;
 select * into project from public.studio_projects where id=p_project_id;
 select * into draft from public.studio_project_drafts where tenant_id=project.tenant_id and project_id=project.id for update;
 if project.status<>'active' or not found or draft.document_json#>>'{syncPresentation,rendererVersion}' is distinct from 'sync-v1'
  or draft.document_json#>>'{syncPresentation,sourceRevision}' is distinct from '8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'
  or draft.document_json?'sitesPresentation' then raise exception 'Source collection requires active Source documents' using errcode='23514';end if;
 if draft.draft_revision<>p_expected_draft_revision then raise exception 'Source collection draft changed' using errcode='40001';end if;
 if p_series_id is null then
  if operation<>'add' or p_expected_series_revision is not null or exists(select 1 from public.studio_series_items where tenant_id=project.tenant_id and project_id=project.id)
   then raise exception 'Source collection membership changed' using errcode='40001';end if;
  if not private.can_create_studio(project.tenant_id) then raise exception 'actor cannot create Source collection' using errcode='42501';end if;
  insert into public.studio_series(tenant_id,owner_user_id,name)values(project.tenant_id,private.current_user_id(),coalesce(normalized_name,project.name)) returning * into series;
  ids:=array[project.id];
 else
  if series.status<>'active' or series.revision is distinct from p_expected_series_revision then raise exception 'Source collection changed' using errcode='40001';end if;
  select array_agg(item.project_id order by item.sort_order) into ids from public.studio_series_items item where item.tenant_id=series.tenant_id and item.series_id=series.id;
  if ids is null or not(project.id=any(ids)) or exists(
   select 1 from public.studio_series_items item join public.studio_projects member on member.tenant_id=item.tenant_id and member.id=item.project_id
   left join public.studio_project_drafts member_draft on member_draft.tenant_id=member.tenant_id and member_draft.project_id=member.id
   where item.tenant_id=series.tenant_id and item.series_id=series.id and(member.status<>'active'
    or member_draft.document_json#>>'{syncPresentation,rendererVersion}' is distinct from 'sync-v1'
    or member_draft.document_json#>>'{syncPresentation,sourceRevision}' is distinct from '8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'))
   then raise exception 'Source collection membership invalid' using errcode='23514';end if;
 end if;
 next_project:=project.id;
 if operation in('add','duplicate') then
  if cardinality(ids)>=20 then raise exception 'Source collection has reached twenty designs' using errcode='23514';end if;
  if not private.can_create_studio(project.tenant_id) then raise exception 'actor cannot add Source design' using errcode='42501';end if;
  new_name:=left(project.name,96)||case when operation='duplicate' then ' · kopie' else ' · slide '||(cardinality(ids)+1)::text end;
  next_document:=jsonb_set(draft.document_json,'{syncPresentation,name}',to_jsonb(new_name));
  result:=public.create_studio_project_v1(p_tenant_id=>project.tenant_id,p_name=>new_name,p_orientation=>next_document#>>'{artboard,orientation}',
   p_document=>next_document,p_referenced_asset_ids=>draft.referenced_asset_ids,p_project_kind=>'design',
   p_idempotency_key=>private.studio_series_child_key_v1(p_idempotency_key,0));
  new_id:=(result->>'projectId')::uuid;
  if new_id is null then raise exception 'Source collection design was not created' using errcode='55000';end if;
  if operation='duplicate' then
   ids:=ids[1:array_position(ids,project.id)]||array[new_id]||ids[array_position(ids,project.id)+1:cardinality(ids)];
  else ids:=array_append(ids,new_id);end if;
  next_project:=new_id;
 elsif operation='remove' then
  if cardinality(ids)<=1 then raise exception 'Source collection requires at least one design' using errcode='23514';end if;
  result:=public.mutate_studio_project_v1(project.id,project.revision,'archive','{}',private.studio_series_child_key_v1(p_idempotency_key,1));
  if result->>'outcome' is distinct from 'applied' then raise exception 'Source collection archive conflict' using errcode='40001';end if;
  ids:=array_remove(ids,project.id);next_project:=ids[1];
 elsif operation='reorder' then
  if cardinality(p_member_ids) is distinct from cardinality(ids) or cardinality(array(select distinct unnest(p_member_ids)))<>cardinality(ids)
    or not(p_member_ids@>ids and ids@>p_member_ids) then raise exception 'Source collection order must retain every member once' using errcode='23514';end if;
  ids:=p_member_ids;
 elsif operation='rename' then
  if normalized_name is null then raise exception 'Source collection name missing' using errcode='23514';end if;
 end if;
 delete from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id;
 insert into public.studio_series_items(tenant_id,series_id,project_id,sort_order)
  select series.tenant_id,series.id,value,ordinality-1 from unnest(ids)with ordinality as ordered(value,ordinality);
 update public.studio_series set name=case when operation='rename' then normalized_name else name end,
  revision=case when p_series_id is null then revision else revision+1 end,updated_at=now()
  where tenant_id=series.tenant_id and id=series.id returning revision into series_revision;
 return private.complete_studio_command(project.tenant_id,'studio.sync.series.mutate',p_idempotency_key,request,'studio_series',series.id,
  jsonb_build_object('outcome','applied','seriesId',series.id,'revision',series_revision,'projectIds',to_jsonb(ids),'nextProjectId',next_project),'studio.sync.series.updated','success');
end;$$;
revoke all on function public.mutate_sync_studio_series_v1(uuid,bigint,uuid,bigint,text,text,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.mutate_sync_studio_series_v1(uuid,bigint,uuid,bigint,text,text,uuid[],uuid) to authenticated;
