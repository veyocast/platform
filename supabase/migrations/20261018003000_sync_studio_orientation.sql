-- S226: extend only the six matching-dimension guards in each existing writer.
-- Source: 20261011160000_s191_sites_theme_authoring.sql.
-- Restore still enters through the current public authoring-pause wrapper;
-- its already revoked implementation retains that exact name and ACL.
-- Sync internal names follow the same atomic guarded draft/restore command.
-- Actor/capability, active tenant, CAS, receipts, asset validation, audit,
-- immutable revisions and all other writer statements remain unchanged.

create or replace function public.save_studio_draft_v1(
  p_project_id uuid,
  p_expected_revision bigint,
  p_document jsonb,
  p_referenced_asset_ids uuid[],
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
  normalized_asset_ids uuid[] :=
    private.normalize_studio_asset_ids(p_referenced_asset_ids);
  next_motion_enabled boolean;
  next_duration_ms integer;
  next_document_hash text;
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  checkpoint_revision_id uuid;
  checkpoint_revision_number bigint;
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
  then
    raise exception 'actor cannot edit Studio project' using errcode = '42501';
  end if;
  if project_record.project_kind = 'tenant_template'
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot edit Studio templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'expected Studio revision is invalid' using errcode = '23514';
  end if;
  perform private.assert_studio_document(
    project_record.tenant_id,
    case when (p_document ? 'sitesPresentation' or p_document ? 'syncPresentation') then p_document #>> '{artboard,orientation}' else project_record.orientation end,
    case when (p_document ? 'sitesPresentation' or p_document ? 'syncPresentation') then (p_document #>> '{artboard,width}')::integer else project_record.width end,
    case when (p_document ? 'sitesPresentation' or p_document ? 'syncPresentation') then (p_document #>> '{artboard,height}')::integer else project_record.height end,
    p_document,
    normalized_asset_ids
  );
  next_motion_enabled := (p_document #>> '{motion,enabled}')::boolean;
  next_duration_ms := (p_document #>> '{motion,durationMs}')::integer;
  if next_motion_enabled
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.motion.edit'
    )
  then
    raise exception 'actor cannot edit Studio motion' using errcode = '42501';
  end if;

  next_document_hash := private.studio_document_hash(p_document);
  request_json := jsonb_build_object(
    'projectId', p_project_id,
    'expectedRevision', p_expected_revision,
    'documentHash', next_document_hash,
    'referencedAssetIds', to_jsonb(normalized_asset_ids)
  );
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.draft.save',
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

  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;
  if project_record.status <> 'active' then
    raise exception 'Studio project is not editable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.draft.save',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.draft.conflict',
      'failed'
    );
  end if;

  update public.studio_project_drafts
  set
    draft_revision = draft_revision + 1,
    document_json = p_document,
    document_hash = next_document_hash,
    referenced_asset_ids = normalized_asset_ids,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and project_id = project_record.id
  returning draft_revision into draft_record.draft_revision;

  update public.studio_projects
  set
    name = case when p_document ? 'syncPresentation' then btrim(p_document#>>'{syncPresentation,name}') else name end,
    orientation = case when (p_document ? 'sitesPresentation' or p_document ? 'syncPresentation') then p_document #>> '{artboard,orientation}' else orientation end,
    width = case when (p_document ? 'sitesPresentation' or p_document ? 'syncPresentation') then (p_document #>> '{artboard,width}')::integer else width end,
    height = case when (p_document ? 'sitesPresentation' or p_document ? 'syncPresentation') then (p_document #>> '{artboard,height}')::integer else height end,
    motion_enabled = next_motion_enabled,
    duration_ms = next_duration_ms,
    revision = revision + 1,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and id = project_record.id
  returning revision into project_record.revision;

  if draft_record.draft_revision % 10 = 0 then
    select coalesce(max(revision.revision_number), 0) + 1
    into checkpoint_revision_number
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
      checkpoint_revision_number,
      draft_record.draft_revision,
      draft_record.schema_version,
      p_document,
      next_document_hash,
      'checkpoint',
      actor_id
    )
    returning id into checkpoint_revision_id;

    insert into public.studio_revision_assets (
      tenant_id,
      project_id,
      revision_id,
      media_asset_id
    )
    select
      project_record.tenant_id,
      project_record.id,
      checkpoint_revision_id,
      asset_id
    from unnest(normalized_asset_ids) asset_id;
  end if;

  outcome := jsonb_strip_nulls(jsonb_build_object(
    'outcome', 'saved',
    'projectId', project_record.id,
    'projectRevision', project_record.revision,
    'draftRevision', draft_record.draft_revision,
    'checkpointRevisionId', checkpoint_revision_id,
    'checkpointRevisionNumber', checkpoint_revision_number
  ));
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.draft.save',
    p_idempotency_key,
    request_json,
    'studio_projects',
    project_record.id,
    outcome,
    'studio.draft.saved'
  );
end;
$$;

create or replace function public.restore_studio_revision_before_sites_pause_v1(
  p_project_id uuid,
  p_revision_id uuid,
  p_expected_draft_revision bigint,
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
  source_revision public.studio_revisions%rowtype;
  source_asset_ids uuid[];
  request_json jsonb;
  replay jsonb;
  outcome jsonb;
  restored_revision_id uuid;
  restored_revision_number bigint;
  next_motion_enabled boolean;
  next_duration_ms integer;
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
  then
    raise exception 'actor cannot restore Studio project' using errcode = '42501';
  end if;
  if project_record.project_kind = 'tenant_template'
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.template.manage'
    )
  then
    raise exception 'actor cannot restore Studio templates' using errcode = '42501';
  end if;
  perform private.require_active_tenant_command(project_record.tenant_id);
  if p_expected_draft_revision is null or p_expected_draft_revision < 0 then
    raise exception 'expected Studio revision is invalid' using errcode = '23514';
  end if;

  select revision.*
  into source_revision
  from public.studio_revisions revision
  where revision.tenant_id = project_record.tenant_id
    and revision.project_id = project_record.id
    and revision.id = p_revision_id;
  if not found then
    raise exception 'Studio revision not found' using errcode = 'P0002';
  end if;

  select coalesce(
    array_agg(revision_asset.media_asset_id order by revision_asset.media_asset_id),
    '{}'::uuid[]
  )
  into source_asset_ids
  from public.studio_revision_assets revision_asset
  where revision_asset.tenant_id = source_revision.tenant_id
    and revision_asset.revision_id = source_revision.id;

  perform private.assert_studio_document(
    project_record.tenant_id,
    case when (source_revision.document_json ? 'sitesPresentation' or source_revision.document_json ? 'syncPresentation') then source_revision.document_json#>>'{artboard,orientation}' else project_record.orientation end,
    case when (source_revision.document_json ? 'sitesPresentation' or source_revision.document_json ? 'syncPresentation') then (source_revision.document_json#>>'{artboard,width}')::integer else project_record.width end,
    case when (source_revision.document_json ? 'sitesPresentation' or source_revision.document_json ? 'syncPresentation') then (source_revision.document_json#>>'{artboard,height}')::integer else project_record.height end,
    source_revision.document_json,
    source_asset_ids
  );
  next_motion_enabled :=
    (source_revision.document_json #>> '{motion,enabled}')::boolean;
  next_duration_ms :=
    (source_revision.document_json #>> '{motion,durationMs}')::integer;
  if next_motion_enabled
    and not private.has_tenant_capability(
      project_record.tenant_id,
      'tenant.studio.motion.edit'
    )
  then
    raise exception 'actor cannot restore Studio motion' using errcode = '42501';
  end if;

  request_json := jsonb_build_object(
    'projectId', project_record.id,
    'revisionId', source_revision.id,
    'expectedDraftRevision', p_expected_draft_revision,
    'documentHash', source_revision.document_hash
  );
  replay := private.begin_studio_command(
    project_record.tenant_id,
    'studio.revision.restore',
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
  if not found then
    raise exception 'Studio draft not found' using errcode = 'P0002';
  end if;
  if project_record.status <> 'active' then
    raise exception 'Studio project is not restorable' using errcode = '55000';
  end if;
  if draft_record.draft_revision <> p_expected_draft_revision then
    outcome := jsonb_build_object(
      'outcome', 'conflict',
      'projectId', project_record.id,
      'sourceRevisionId', source_revision.id,
      'actualRevision', draft_record.draft_revision
    );
    return private.complete_studio_command(
      project_record.tenant_id,
      'studio.revision.restore',
      p_idempotency_key,
      request_json,
      'studio_projects',
      project_record.id,
      outcome,
      'studio.revision.restore_conflict',
      'failed'
    );
  end if;

  update public.studio_project_drafts
  set
    draft_revision = draft_revision + 1,
    schema_version = source_revision.schema_version,
    document_json = source_revision.document_json,
    document_hash = source_revision.document_hash,
    referenced_asset_ids = source_asset_ids,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and project_id = project_record.id
  returning * into draft_record;

  update public.studio_projects
  set
    name = case when source_revision.document_json ? 'syncPresentation' then btrim(source_revision.document_json#>>'{syncPresentation,name}') else name end,
    orientation=case when (source_revision.document_json ? 'sitesPresentation' or source_revision.document_json ? 'syncPresentation') then source_revision.document_json#>>'{artboard,orientation}' else orientation end,
    width=case when (source_revision.document_json ? 'sitesPresentation' or source_revision.document_json ? 'syncPresentation') then (source_revision.document_json#>>'{artboard,width}')::integer else width end,
    height=case when (source_revision.document_json ? 'sitesPresentation' or source_revision.document_json ? 'syncPresentation') then (source_revision.document_json#>>'{artboard,height}')::integer else height end,
    motion_enabled = next_motion_enabled,
    duration_ms = next_duration_ms,
    revision = revision + 1,
    updated_by = actor_id
  where tenant_id = project_record.tenant_id
    and id = project_record.id
  returning * into project_record;

  select coalesce(max(revision.revision_number), 0) + 1
  into restored_revision_number
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
    restored_revision_number,
    draft_record.draft_revision,
    source_revision.schema_version,
    source_revision.document_json,
    source_revision.document_hash,
    'restore',
    actor_id
  )
  returning id into restored_revision_id;

  insert into public.studio_revision_assets (
    tenant_id,
    project_id,
    revision_id,
    media_asset_id
  )
  select
    project_record.tenant_id,
    project_record.id,
    restored_revision_id,
    media_asset_id
  from unnest(source_asset_ids) media_asset_id;

  outcome := jsonb_build_object(
    'outcome', 'restored',
    'projectId', project_record.id,
    'sourceRevisionId', source_revision.id,
    'revisionId', restored_revision_id,
    'revisionNumber', restored_revision_number,
    'projectRevision', project_record.revision,
    'draftRevision', draft_record.draft_revision
  );
  return private.complete_studio_command(
    project_record.tenant_id,
    'studio.revision.restore',
    p_idempotency_key,
    request_json,
    'studio_revisions',
    restored_revision_id,
    outcome,
    'studio.revision.restored'
  );
end;
$$;

revoke all on function public.restore_studio_revision_before_sites_pause_v1(uuid,uuid,bigint,uuid) from public,anon,authenticated,service_role;
