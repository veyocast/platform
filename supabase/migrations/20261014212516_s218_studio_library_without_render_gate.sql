-- Saved Sites documents are visible before a compatibility raster exists.
-- Selection still materializes a verified export before a playlist command runs.
-- Paginate active series first; verified exports enrich the previewable document.
create function public.list_publisher_studio_series_v2(p_tenant_id uuid,p_offset integer default 0,p_search text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_read_studio(p_tenant_id) then raise exception 'actor cannot read Studio library'using errcode='42501';end if;
 if p_offset is null or p_offset not between 0 and 10000 or length(coalesce(p_search,''))>160 then raise exception 'library filters outside limits'using errcode='22023';end if;
 with matching as materialized(select series.id,series.name,series.revision,series.updated_at from public.studio_series series
   where series.tenant_id=p_tenant_id and series.status='active' and (nullif(btrim(p_search),'')is null or position(lower(btrim(p_search))in lower(series.name))>0)
   and exists(select 1 from public.studio_series_items member where member.tenant_id=p_tenant_id and member.series_id=series.id)
   and not exists(select 1 from public.studio_series_items member
     where member.tenant_id=p_tenant_id and member.series_id=series.id and not exists(
       select 1 from public.studio_projects project
       join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
       where project.tenant_id=member.tenant_id and project.id=member.project_id and project.status='active'
         and draft.document_json#>>'{sitesPresentation,kind}'='studio'
     ))),
 page as(select * from matching order by updated_at desc,id limit 8 offset p_offset),
 rows as(select page.*,coalesce((select jsonb_agg(jsonb_build_object('projectId',project.id,'name',project.name,'document',draft.document_json,
   'draftRevision',draft.draft_revision,'exportId',exported.id,'mediaAssetId',exported.media_asset_id,'outputKind',exported.output_kind,'durationSeconds',exported.duration_seconds)order by member.sort_order)
   from public.studio_series_items member
   join public.studio_projects project on project.tenant_id=member.tenant_id and project.id=member.project_id and project.status='active'
   join public.studio_project_drafts draft on draft.tenant_id=project.tenant_id and draft.project_id=project.id
   left join lateral(select export.* from public.studio_revisions revision
     join public.studio_exports export on export.tenant_id=revision.tenant_id and export.project_id=revision.project_id and export.revision_id=revision.id
     join public.media_assets asset on asset.tenant_id=export.tenant_id and asset.id=export.media_asset_id and asset.status='ready' and asset.deleted_at is null
     join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end
       and variant.file_size_bytes>0 and variant.checksum_sha256~'^[0-9a-f]{64}$' and variant.checksum_sha256=export.checksum_sha256
     where revision.tenant_id=project.tenant_id and revision.project_id=project.id and revision.draft_revision=draft.draft_revision
     order by export.created_at desc,export.id desc limit 1)exported on true
   where member.tenant_id=p_tenant_id and member.series_id=page.id),'[]'::jsonb)as members,
   (select count(*)from public.studio_series_items member where member.tenant_id=p_tenant_id and member.series_id=page.id)as member_count from page)
 select jsonb_build_object('total',(select count(*)from matching),'series',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'revision',revision,'members',members)order by updated_at desc,id)
   filter(where member_count>0 and jsonb_array_length(members)=member_count),'[]'::jsonb))into result from rows;
 return result;
end $$;
revoke all on function public.list_publisher_studio_series_v2(uuid,integer,text)from public,anon,authenticated,service_role;
grant execute on function public.list_publisher_studio_series_v2(uuid,integer,text)to authenticated;


-- Serialize preparation per series and reuse each exact draft's existing job.
-- Merely opening or polling the library never invokes this command.
create function public.prepare_publisher_studio_series_v1(p_series_id uuid,p_expected_revision bigint,p_members jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare series public.studio_series%rowtype; member record; draft public.studio_project_drafts%rowtype;
 actor uuid:=private.current_user_id(); job_id uuid; render_kind text; result jsonb; jobs jsonb:='[]'; request jsonb; replay jsonb;
begin
 select * into series from public.studio_series where id=p_series_id and status='active';
 if not found or actor is null or not private.can_read_studio(series.tenant_id) or not private.has_tenant_capability(series.tenant_id,'tenant.studio.render') then raise exception 'actor cannot prepare Studio series'using errcode='42501';end if;
 perform private.require_active_tenant_command(series.tenant_id);
 select * into series from public.studio_series where id=p_series_id and status='active'for update;
 if not found then raise exception 'Studio series changed'using errcode='40001';end if;
 if series.revision is distinct from p_expected_revision then raise exception 'Studio series changed'using errcode='40001';end if;
 if jsonb_typeof(p_members)is distinct from 'array' or jsonb_array_length(p_members)not between 1 and 20 or octet_length(p_members::text)>8192
   or jsonb_array_length(p_members)<>(select count(*)from public.studio_series_items where tenant_id=series.tenant_id and series_id=series.id)then raise exception 'invalid Studio member selection'using errcode='22023';end if;
 request:=jsonb_build_object('seriesId',p_series_id,'revision',p_expected_revision,'members',p_members);
 replay:=private.begin_studio_command(series.tenant_id,'publisher.studio.prepare',p_idempotency_key,request);if replay is not null then return replay;end if;
 perform project.id from public.studio_projects project join public.studio_series_items item on item.tenant_id=project.tenant_id and item.project_id=project.id
   where item.tenant_id=series.tenant_id and item.series_id=series.id order by project.id for update of project;
 for member in select item.project_id,item.sort_order,project.owner_user_id,project.status from public.studio_series_items item
   join public.studio_projects project on project.tenant_id=item.tenant_id and project.id=item.project_id
   where item.tenant_id=series.tenant_id and item.series_id=series.id order by item.sort_order loop
  select *into draft from public.studio_project_drafts where tenant_id=series.tenant_id and project_id=member.project_id;
  if not found or member.status<>'active' or not private.can_edit_studio_project(series.tenant_id,member.owner_user_id)then raise exception 'actor cannot prepare Studio member'using errcode='42501';end if;
  if p_members->member.sort_order->>'id' is distinct from member.project_id::text or (p_members->member.sort_order->>'draftRevision')::bigint is distinct from draft.draft_revision then raise exception 'Studio draft changed'using errcode='40001';end if;
  render_kind:=case when draft.document_json#>>'{motion,enabled}'='true' then 'mp4' else 'png' end;
  select job.id into job_id from public.studio_render_jobs job
   join public.studio_revisions revision on revision.tenant_id=job.tenant_id and revision.project_id=job.project_id and revision.id=job.revision_id
   where job.tenant_id=series.tenant_id and job.project_id=member.project_id and revision.draft_revision=draft.draft_revision
    and revision.document_hash=draft.document_hash and job.output_kind=render_kind and job.status not in('failed','cancelled')
    and(job.status<>'completed' or exists(select 1 from public.studio_exports exported
      join public.media_assets asset on asset.tenant_id=exported.tenant_id and asset.id=exported.media_asset_id and asset.status='ready'and asset.deleted_at is null
      join public.media_variants variant on variant.tenant_id=asset.tenant_id and variant.asset_id=asset.id
       and variant.variant_type::text=case when asset.kind='video' then 'player_1080p' else 'original' end and variant.file_size_bytes>0 and variant.checksum_sha256=exported.checksum_sha256
      where exported.tenant_id=job.tenant_id and exported.render_job_id=job.id))
   order by job.created_at desc,job.id desc limit 1;
  if job_id is null then
   result:=public.request_studio_render_v1(member.project_id,draft.draft_revision,render_kind,md5(p_idempotency_key::text||':'||member.project_id::text)::uuid);
   if result->>'outcome'is distinct from 'queued' or result->>'renderJobId'is null then raise exception 'Studio render not confirmed'using errcode='40001';end if;
   job_id:=(result->>'renderJobId')::uuid;
  end if;
  jobs:=jobs||jsonb_build_array(jsonb_build_object('projectId',member.project_id,'jobId',job_id));
 end loop;
 return private.complete_studio_command(series.tenant_id,'publisher.studio.prepare',p_idempotency_key,request,'studio_series',series.id,jsonb_build_object('jobs',jobs),'publisher.studio.prepared','success');
end $$;
revoke all on function public.prepare_publisher_studio_series_v1(uuid,bigint,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function public.prepare_publisher_studio_series_v1(uuid,bigint,jsonb,uuid)to authenticated;

select pg_catalog.pg_notify('pgrst','reload schema');
