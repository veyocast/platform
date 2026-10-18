-- Source designs are independently addressable projects. Older Sites library
-- contracts remain unchanged; this reader also covers future Source series.
create function public.list_publisher_sync_studio_v1(p_tenant_id uuid,p_offset integer default 0,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_read_studio(p_tenant_id) then raise exception 'actor cannot read Studio library' using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 10000 or length(coalesce(p_search,''))>160
 then raise exception 'library filters outside limits' using errcode='22023';end if;
 with source_projects as materialized(
  select project.id,project.name,project.revision,project.updated_at,draft.draft_revision,draft.document_json,draft.document_hash
  from public.studio_projects project join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
  where project.tenant_id=p_tenant_id and project.status='active'
   and draft.document_json#>>'{syncPresentation,rendererVersion}'='sync-v1'
   and draft.document_json#>>'{syncPresentation,sourceRevision}'='8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'
   and not(draft.document_json?'sitesPresentation')
 ), candidates as(
  select project.id,project.name,project.revision,project.updated_at,'project'::text as kind from source_projects project
  where not exists(select 1 from public.studio_series_items member where member.tenant_id=p_tenant_id and member.project_id=project.id)
  union all
  select series.id,series.name,series.revision,series.updated_at,'series'::text from public.studio_series series
  where series.tenant_id=p_tenant_id and series.status='active'
   and exists(select 1 from public.studio_series_items member where member.tenant_id=p_tenant_id and member.series_id=series.id)
   and not exists(select 1 from public.studio_series_items member where member.tenant_id=p_tenant_id and member.series_id=series.id
     and not exists(select 1 from source_projects project where project.id=member.project_id))
 ), matching as materialized(
  select * from candidates where nullif(btrim(p_search),'')is null or position(lower(btrim(p_search))in lower(name))>0
 ), page as(select * from matching order by updated_at desc,id limit 8 offset p_offset), members as(
  select page.id as group_id,project.*,0 as sort_order from page join source_projects project on page.kind='project' and page.id=project.id
  union all
  select page.id,project.*,member.sort_order from page
  join public.studio_series_items member on member.tenant_id=p_tenant_id and member.series_id=page.id and page.kind='series'
  join source_projects project on project.id=member.project_id
 ), rows as(
  select page.*,coalesce((select jsonb_agg(jsonb_build_object('projectId',member.id,'name',member.name,'document',member.document_json,
   'draftRevision',member.draft_revision,'exportId',exported.id,'mediaAssetId',exported.media_asset_id,'outputKind',exported.output_kind,
   'checksumSha256',exported.verified_checksum,'bytes',exported.verified_bytes)order by member.sort_order)
   from members member left join lateral(
    select export.*,variant.checksum_sha256 as verified_checksum,variant.file_size_bytes as verified_bytes from public.studio_revisions revision
    join public.studio_exports export on export.tenant_id=revision.tenant_id and export.project_id=revision.project_id and export.revision_id=revision.id
    join public.media_assets asset on asset.tenant_id=export.tenant_id and asset.id=export.media_asset_id and asset.status='ready' and asset.deleted_at is null
    join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
      and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
      and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=export.checksum_sha256
    where revision.tenant_id=p_tenant_id and revision.project_id=member.id and revision.draft_revision=member.draft_revision
      and revision.document_hash=member.document_hash
    order by export.created_at desc,export.id desc limit 1
   )exported on true where member.group_id=page.id),'[]'::jsonb)as members from page
 )select jsonb_build_object('total',(select count(*)from matching),'projects',coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'name',name,'revision',revision,'kind',kind,'members',members)order by updated_at desc,id),'[]'::jsonb))into result from rows;
 return result;
end;$$;

-- Explicit selection prepares a standalone project. Opening/polling the reader
-- never enqueues work. Serialize by project and reuse its exact immutable job,
-- including after a browser reload loses an acknowledgement/key.
create function public.prepare_publisher_sync_project_v1(p_project_id uuid,p_expected_draft_revision bigint,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare project public.studio_projects%rowtype;draft public.studio_project_drafts%rowtype;
 request jsonb:=jsonb_build_object('projectId',p_project_id,'draftRevision',p_expected_draft_revision);
 replay jsonb;result jsonb;job_id uuid;render_kind text;
begin
 select *into project from public.studio_projects where id=p_project_id for update;
 if not found or private.current_user_id()is null or not private.can_read_studio(project.tenant_id)
  or not private.has_tenant_capability(project.tenant_id,'tenant.studio.render')
  or not private.can_edit_studio_project(project.tenant_id,project.owner_user_id)
 then raise exception 'actor cannot prepare Source project' using errcode='42501';end if;
 perform private.require_active_tenant_command(project.tenant_id);
 replay:=private.begin_studio_command(project.tenant_id,'publisher.sync.prepare',p_idempotency_key,request);
 if replay is not null then return replay;end if;
 select *into draft from public.studio_project_drafts where tenant_id=project.tenant_id and project_id=project.id;
 if not found or project.status<>'active' or draft.draft_revision is distinct from p_expected_draft_revision
  or draft.document_json#>>'{syncPresentation,rendererVersion}' is distinct from 'sync-v1'
  or draft.document_json#>>'{syncPresentation,sourceRevision}' is distinct from '8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'
  or draft.document_json?'sitesPresentation'
 then raise exception 'Source draft changed' using errcode='40001';end if;
 render_kind:=case when draft.document_json#>>'{motion,enabled}'='true' then 'mp4' else 'png' end;
 select job.id into job_id from public.studio_render_jobs job
 join public.studio_revisions revision on revision.tenant_id=job.tenant_id and revision.project_id=job.project_id and revision.id=job.revision_id
 where job.tenant_id=project.tenant_id and job.project_id=project.id and revision.draft_revision=draft.draft_revision
  and revision.document_hash=draft.document_hash and job.output_kind=render_kind and job.status not in('failed','cancelled')
  and(job.status<>'completed' or exists(select 1 from public.studio_exports exported
    join public.media_assets asset on asset.tenant_id=exported.tenant_id and asset.id=exported.media_asset_id and asset.status='ready' and asset.deleted_at is null
    join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
     and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
     and variant.file_size_bytes>0 and variant.checksum_sha256=exported.checksum_sha256
    where exported.tenant_id=job.tenant_id and exported.render_job_id=job.id))
 order by job.created_at desc,job.id desc limit 1;
 if job_id is null then
  result:=public.request_studio_render_v1(project.id,draft.draft_revision,render_kind,md5(p_idempotency_key::text||':'||project.id::text)::uuid);
  if result->>'outcome'is distinct from 'queued' or result->>'renderJobId'is null then raise exception 'Source render not confirmed' using errcode='40001';end if;
  job_id:=(result->>'renderJobId')::uuid;
 end if;
 return private.complete_studio_command(project.tenant_id,'publisher.sync.prepare',p_idempotency_key,request,'studio_project',project.id,
  jsonb_build_object('projectId',project.id,'jobId',job_id,'draftRevision',draft.draft_revision),'publisher.sync.prepared','success');
end;$$;
revoke all on function public.list_publisher_sync_studio_v1(uuid,integer,text),public.prepare_publisher_sync_project_v1(uuid,bigint,uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_publisher_sync_studio_v1(uuid,integer,text),public.prepare_publisher_sync_project_v1(uuid,bigint,uuid)to authenticated;
