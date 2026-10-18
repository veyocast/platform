-- One read projection over existing authorities. No copied state or new writer.
-- security_invoker is essential: each branch keeps its own existing RLS.
create or replace view public.sync_content_library_v1 with (security_invoker = true) as
with projects as not materialized (
  select p.*, e.media_asset_id as ready_asset_id
  from public.studio_projects p
  left join public.studio_project_drafts d on d.tenant_id=p.tenant_id and d.project_id=p.id
  left join lateral (
    select x.media_asset_id from public.studio_exports x
    join public.studio_revisions r on r.tenant_id=x.tenant_id and r.project_id=x.project_id and r.id=x.revision_id
    join public.media_assets a on a.tenant_id=x.tenant_id and a.id=x.media_asset_id and a.status='ready' and a.deleted_at is null
    where x.tenant_id=p.tenant_id and x.project_id=p.id and r.document_hash=d.document_hash
    order by x.created_at desc, x.id limit 1
  ) e on true
  where p.status<>'deleted'
)
select m.tenant_id, m.id, 'media:' || m.id::text as content_key,
  m.title, 'media'::text as kind, m.kind::text as family,
  m.status::text as status, (m.deleted_at is not null) as archived,
  case when m.height is null or m.width is null then null when m.height = m.width then 'square' when m.height > m.width then 'portrait' else 'landscape' end as orientation,
  m.duration_seconds::numeric as duration_seconds,
  null::bigint as revision, m.updated_at, m.width, m.height,
  m.id as preview_asset_id,
  case when m.status='ready' and m.deleted_at is null then jsonb_build_object('kind','media','assetId',m.id) end as placement
from public.media_assets m where m.source_kind = 'user'
  and not exists(select 1 from public.studio_exports x where x.tenant_id=m.tenant_id and x.media_asset_id=m.id)
union all
select p.tenant_id, p.id, 'studio:' || p.id::text, p.name, 'studio', 'free',
  case when p.ready_asset_id is not null then 'ready' else 'draft' end, p.status = 'archived', p.orientation, p.duration_ms / 1000.0, p.revision, p.updated_at, p.width, p.height,
  p.ready_asset_id, case when p.ready_asset_id is not null and p.status='active' then jsonb_build_object('kind','media','assetId',p.ready_asset_id) end
from projects p
where not exists(select 1 from public.studio_series_items i where i.tenant_id=p.tenant_id and i.project_id=p.id)
union all
select d.tenant_id, d.id, 'dynamic:' || d.id::text, d.name, 'dynamic', d.slide_type,
  d.status, d.status = 'archived', d.orientation, null::numeric, d.revision, d.updated_at, null::integer, null::integer,
  snap.output_media_asset_id,
  case when d.status='ready' and snap.id is not null then jsonb_build_object('kind','dynamic','snapshotId',snap.id) end
from public.dynamic_slides d
left join public.dynamic_slide_snapshots snap on snap.tenant_id=d.tenant_id and snap.dynamic_slide_id=d.id and snap.id=d.current_snapshot_id and snap.status='ready'
union all
select s.tenant_id, s.id, 'series:' || s.id::text, s.name, 'series', 'series',
  case when members.count>0 and members.ready_count=members.count then 'ready' else 'draft' end, s.status = 'archived',
  (select p.orientation from public.studio_series_items i join public.studio_projects p on p.id = i.project_id and p.tenant_id = i.tenant_id where i.series_id = s.id and i.tenant_id = s.tenant_id order by i.sort_order limit 1),
  (select sum(p.duration_ms) / 1000.0 from public.studio_series_items i join public.studio_projects p on p.id = i.project_id and p.tenant_id = i.tenant_id where i.series_id = s.id and i.tenant_id = s.tenant_id),
  s.revision, s.updated_at, null::integer, null::integer,
  members.first_asset,
  case when s.status='active' and members.count>0 and members.ready_count=members.count then jsonb_build_object('kind','series','memberCount',members.count,'revision',s.revision) end
from public.studio_series s
left join lateral (
  select count(*)::integer as count, count(case when p.status='active' then p.ready_asset_id end)::integer as ready_count,
    (array_agg(p.ready_asset_id order by i.sort_order))[1] as first_asset
  from public.studio_series_items i left join projects p on p.tenant_id=i.tenant_id and p.id=i.project_id
  where i.tenant_id=s.tenant_id and i.series_id=s.id
) members on true;
revoke all on public.sync_content_library_v1 from public, anon, authenticated, service_role;
grant select on public.sync_content_library_v1 to authenticated;
comment on view public.sync_content_library_v1 is 'Read-only Sync library; original resource identities and per-source tenant RLS remain authoritative.';
