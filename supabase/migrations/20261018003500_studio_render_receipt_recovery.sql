-- S226: committed render receipts are verified against their immutable job
-- snapshot, rather than a later mutable Studio draft. Existing actor/capability
-- checks, receipt format, request hashes, CAS and command identities stay intact.
create function private.replay_committed_studio_render_v1(
 p_tenant_id uuid,p_project_id uuid,p_expected_revision bigint,p_output_kind text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt public.studio_command_receipts%rowtype;document_hash text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(private.current_user_id()::text||':'||p_idempotency_key::text,43));
 select candidate.* into receipt from public.studio_command_receipts candidate
 where candidate.tenant_id=p_tenant_id and candidate.actor_user_id=private.current_user_id()
  and candidate.idempotency_key=p_idempotency_key;
 if not found or receipt.command_type<>'studio.render.request' or receipt.target_type<>'studio_render_jobs'
  or receipt.outcome_json->>'outcome'<>'queued' then return null;end if;
 select revision.document_hash into document_hash
 from public.studio_render_jobs job join public.studio_revisions revision
  on revision.tenant_id=job.tenant_id and revision.project_id=job.project_id and revision.id=job.revision_id
 where job.tenant_id=p_tenant_id and job.id=receipt.target_id and job.project_id=p_project_id
  and job.output_kind=p_output_kind and revision.draft_revision=p_expected_revision;
 if not found then return null;end if;
 -- The original receipt helper still verifies the exact original request hash.
 return private.begin_studio_command(p_tenant_id,'studio.render.request',p_idempotency_key,
  jsonb_build_object('projectId',p_project_id,'expectedDraftRevision',p_expected_revision,'outputKind',p_output_kind,'documentHash',document_hash));
end;$$;
revoke all on function private.replay_committed_studio_render_v1(uuid,uuid,bigint,text,uuid) from public,anon,authenticated,service_role;

-- The unchanged current writer follows below, with one committed-receipt lookup
-- between immutable input validation and current draft/output validation.

create or replace function public.request_studio_render_v1(
  p_project_id uuid,
  p_expected_draft_revision bigint,
  p_output_kind text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := private.current_user_id();
  project_record public.studio_projects%rowtype;
  draft_record public.studio_project_drafts%rowtype;
  normalized_output_kind text := lower(btrim(coalesce(p_output_kind, '')));
  request_json jsonb;
  request_hash text;
  replay jsonb;
  outcome jsonb;
  revision_id uuid;
  revision_number bigint;
  render_job_id uuid;
  planned_asset_id uuid := gen_random_uuid();
begin
  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Studio project not found' using errcode = 'P0002';
  end if;
  if actor_id is null
    or not private.can_edit_studio_project(
      project_record.tenant_id,
      project_record.owner_user_id
    )
    or not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.render'
    )
  then
    raise exception 'actor cannot render Studio project' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_draft_revision is null or p_expected_draft_revision < 0
    or normalized_output_kind not in ('png', 'mp4')
  then raise exception 'Studio render request is invalid' using errcode='23514';end if;

  replay:=private.replay_committed_studio_render_v1(project_record.tenant_id,p_project_id,p_expected_draft_revision,normalized_output_kind,p_idempotency_key);
  if replay is not null then return replay;end if;

  if (project_record.motion_enabled and normalized_output_kind<>'mp4')
    or(not project_record.motion_enabled and normalized_output_kind<>'png')
  then raise exception 'Studio render request is invalid' using errcode='23514';end if;

  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id;
  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;

  request_json := jsonb_build_object(
    'projectId', p_project_id,
    'expectedDraftRevision', p_expected_draft_revision,
    'outputKind', normalized_output_kind,
    'documentHash', draft_record.document_hash
  );
  request_hash := private.studio_document_hash(request_json);
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.render.request',
    p_idempotency_key,
    request_json
  );
  if replay is not null then
    return replay;
  end if;

  select project.*
  into project_record
  from public.studio_projects project
  where project.id = p_project_id
  for update;
  select draft.*
  into draft_record
  from public.studio_project_drafts draft
  where draft.tenant_id = project_record.tenant_id
    and draft.project_id = project_record.id
  for update;

  if project_record.status <> 'active' then
    raise exception 'Studio project is not renderable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_draft_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.render.request',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.render.conflict',
      'failed'
    );
  end if;

  perform private.assert_studio_document(
    project_record.tenant_id,
    project_record.orientation,
    project_record.width,
    project_record.height,
    draft_record.document_json,
    draft_record.referenced_asset_ids
  );

  select coalesce(max(revision.revision_number), 0) + 1
  into revision_number
  from public.studio_revisions revision
  where revision.tenant_id = project_record.tenant_id
    and revision.project_id = project_record.id;

  insert into public.studio_revisions (
    tenant_id,
    project_id,
    revision_number,
    draft_revision,
    schema_version,
    document_json,
    document_hash,
    reason,
    created_by
  )
  values (
    project_record.tenant_id,
    project_record.id,
    revision_number,
    draft_record.draft_revision,
    draft_record.schema_version,
    draft_record.document_json,
    draft_record.document_hash,
    'render',
    actor_id
  )
  returning id into revision_id;

  insert into public.studio_revision_assets (
    tenant_id,
    project_id,
    revision_id,
    media_asset_id
  )
  select
    project_record.tenant_id,
    project_record.id,
    revision_id,
    asset_id
  from unnest(draft_record.referenced_asset_ids) asset_id;

  insert into public.studio_render_jobs (
    tenant_id,
    project_id,
    revision_id,
    requested_by,
    output_kind,
    planned_media_asset_id,
    request_idempotency_key,
    request_hash
  )
  values (
    project_record.tenant_id,
    project_record.id,
    revision_id,
    actor_id,
    normalized_output_kind,
    planned_asset_id,
    p_idempotency_key,
    request_hash
  )
  returning id into render_job_id;

  outcome := jsonb_build_object(
    'outcome', 'queued',
    'projectId', project_record.id,
    'revisionId', revision_id,
    'revisionNumber', revision_number,
    'renderJobId', render_job_id,
    'mediaAssetId', planned_asset_id,
    'status', 'queued',
    'outputKind', normalized_output_kind
  );
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.render.request',
    p_idempotency_key,
    request_json,
    'studio_render_jobs',
    render_job_id,
    outcome,
    'studio.render.queued'
  );
end;
$$;
