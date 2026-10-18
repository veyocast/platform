import "server-only";
import {syncContentFamilies} from "@veyocast/contracts";
import {mobileSyncStudioResultV3Schema, mobileSyncStudioWorkspaceV3Schema, parseStudioDocument, studioDocumentAssetIds, type MobileSyncStudioProjectV3, type MobileSyncStudioRequestV3, type MobileSyncStudioResultV3} from "@veyocast/studio";
import {loadSitesAuthoringState, sitesAuthoringPausedMessage} from "../sites-authoring-state";
import {MobileApiContextError, type MobileRequestContext, type MobileTenantContext} from "../mobile-api/context";

type Client = MobileRequestContext["supabase"];
const failure = (context: MobileRequestContext, status: 403 | 404, message: string) => new MobileApiContextError(status, status === 403 ? "FORBIDDEN" : "NOT_FOUND", message, "Je lokale invoer blijft behouden. Controleer je organisatie en rechten.", context.requestId);
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Reads only authenticated tenant rows. Listing stays bounded; full render and
 * series verification runs only for the explicitly opened design. */
export async function loadMobileStudioV3(context: MobileRequestContext, tenant: MobileTenantContext, projectId?: string, offset = 0) {
  const client = context.supabase;
  const authoring = await loadSitesAuthoringState(client, tenant.id);
  let query = client.from("studio_project_drafts")
    .select("project_id,draft_revision,document_json,studio_projects!inner(id,name,status)", {count: "exact"})
    .eq("tenant_id", tenant.id).eq("studio_projects.status", "active")
    .not("document_json->syncPresentation", "is", null)
    .order("updated_at", {ascending: false}).order("project_id").range(offset, offset + 7);
  if (projectId) query = query.eq("project_id", projectId);
  const rows = await query;
  if (rows.error) throw Error("MOBILE_SYNC_STUDIO_UNAVAILABLE");
  if (projectId && !rows.data?.length) throw failure(context, 404, "Dit Sync-ontwerp is niet beschikbaar in deze organisatie.");
  const projects: MobileSyncStudioProjectV3[] = [];
  for (const row of rows.data ?? []) {
    const parent = object(Array.isArray(row.studio_projects) ? row.studio_projects[0] : row.studio_projects);
    const document = parseStudioDocument(row.document_json);
    if (!document.syncPresentation || typeof parent.name !== "string") throw Error("MOBILE_SYNC_DOCUMENT_INVALID");
    const draftRevision = Number(row.draft_revision);
    projects.push({kind: "sync", id: row.project_id, name: parent.name, draftRevision, document,
      ...(projectId ? await loadVerifiedRender(client, tenant.id, row.project_id, draftRevision) : {renderStatus: "unknown" as const, renderJobId: null, previewUrl: null, mediaAssetId: null}),
      series: projectId ? await loadSeries(client, tenant.id, row.project_id) : null});
  }
  return mobileSyncStudioWorkspaceV3Schema.parse({schemaVersion: 3, authoringPaused: authoring.paused, offset, total: rows.count ?? projects.length, hasMore: offset + projects.length < (rows.count ?? projects.length), projects, templates: syncContentFamilies.map(({id, name, label}) => ({id, name, label}))});
}

async function loadSeries(client: Client, tenantId: string, projectId: string): Promise<MobileSyncStudioProjectV3["series"]> {
  const membership = await client.from("studio_series_items").select("series_id").eq("tenant_id", tenantId).eq("project_id", projectId).limit(2);
  if (membership.error || (membership.data?.length ?? 0) > 1) throw Error("MOBILE_SYNC_SERIES_UNAVAILABLE");
  const seriesId = membership.data?.[0]?.series_id;
  if (!seriesId) return null;
  const [series, items] = await Promise.all([
    client.from("studio_series").select("id,name,revision").eq("tenant_id", tenantId).eq("id", seriesId).eq("status", "active").maybeSingle(),
    client.from("studio_series_items").select("project_id,sort_order").eq("tenant_id", tenantId).eq("series_id", seriesId).order("sort_order").limit(21)
  ]);
  if (series.error || items.error || !series.data || !items.data?.length || items.data.length > 20) throw Error("MOBILE_SYNC_SERIES_INVALID");
  const ids = items.data.map(item => item.project_id);
  const [names, drafts] = await Promise.all([
    client.from("studio_projects").select("id,name").eq("tenant_id", tenantId).in("id", ids).eq("status", "active"),
    client.from("studio_project_drafts").select("project_id,draft_revision").eq("tenant_id", tenantId).in("project_id", ids)
  ]);
  if (names.error || drafts.error) throw Error("MOBILE_SYNC_SERIES_MEMBERS_UNAVAILABLE");
  return {id: seriesId, name: series.data.name, revision: Number(series.data.revision), members: ids.map(id => {
    const name = names.data?.find(row => row.id === id), draft = drafts.data?.find(row => row.project_id === id);
    if (!name || !draft) throw Error("MOBILE_SYNC_SERIES_MEMBER_MISSING");
    return {projectId: id, name: name.name, draftRevision: Number(draft.draft_revision)};
  })};
}

async function loadVerifiedRender(client: Client, tenantId: string, projectId: string, draftRevision: number): Promise<Pick<MobileSyncStudioProjectV3, "renderStatus" | "renderJobId" | "previewUrl" | "mediaAssetId">> {
  const pending = {renderStatus: "idle" as const, renderJobId: null, previewUrl: null, mediaAssetId: null};
  const jobs = await client.from("studio_render_jobs").select("id,status,revision_id,media_asset_id,output_kind").eq("tenant_id", tenantId).eq("project_id", projectId).order("created_at", {ascending: false}).limit(1);
  if (jobs.error) throw Error("MOBILE_SYNC_RENDER_UNAVAILABLE");
  const job = jobs.data?.[0];
  if (!job) return pending;
  const revision = await client.from("studio_revisions").select("draft_revision").eq("tenant_id", tenantId).eq("id", job.revision_id).maybeSingle();
  if (revision.error) throw Error("MOBILE_SYNC_RENDER_REVISION_UNAVAILABLE");
  if (Number(revision.data?.draft_revision) !== draftRevision) return pending;
  const state = {renderStatus: (job.status === "completed" ? "rendering" : ["failed", "cancelled", "queued"].includes(job.status) ? job.status : "rendering") as MobileSyncStudioProjectV3["renderStatus"], renderJobId: job.id, previewUrl: null, mediaAssetId: null};
  if (job.status !== "completed" || !job.media_asset_id) return state;
  const [exported, asset, variants] = await Promise.all([
    client.from("studio_exports").select("checksum_sha256").eq("tenant_id", tenantId).eq("render_job_id", job.id).maybeSingle(),
    client.from("media_assets").select("id").eq("tenant_id", tenantId).eq("id", job.media_asset_id).eq("status", "ready").is("deleted_at", null).maybeSingle(),
    client.from("media_variants").select("variant_type,storage_bucket,storage_path,file_size_bytes,checksum_sha256").eq("tenant_id", tenantId).eq("asset_id", job.media_asset_id).in("variant_type", job.output_kind === "mp4" ? ["player_1080p", "thumbnail"] : ["original"])
  ]);
  if (exported.error || asset.error || variants.error) throw Error("MOBILE_SYNC_RENDER_CONFIRMATION_UNAVAILABLE");
  const output = variants.data?.find(row => row.variant_type === (job.output_kind === "mp4" ? "player_1080p" : "original"));
  const verified = (row: typeof output) => Boolean(row && row.storage_bucket === "tenant-media" && row.storage_path.startsWith(`tenants/${tenantId}/assets/${job.media_asset_id}/`) && Number(row.file_size_bytes) > 0 && /^[a-f0-9]{64}$/.test(row.checksum_sha256 ?? ""));
  if (!asset.data || !verified(output) || output?.checksum_sha256 !== exported.data?.checksum_sha256) return state;
  const preview = job.output_kind === "mp4" ? variants.data?.find(row => row.variant_type === "thumbnail") : output;
  let previewUrl: string | null = null;
  if (verified(preview)) {
    const signed = await client.storage.from("tenant-media").createSignedUrl(preview!.storage_path, 600);
    if (!signed.error) previewUrl = signed.data?.signedUrl ?? null;
  }
  return {renderStatus: "completed", renderJobId: job.id, mediaAssetId: asset.data.id, previewUrl};
}

/** Original command bodies go unchanged to the existing receipt/CAS writers. */
export async function mutateMobileStudioV3(context: MobileRequestContext, tenant: MobileTenantContext, input: MobileSyncStudioRequestV3): Promise<MobileSyncStudioResultV3> {
  const client = context.supabase;
  if (context.assuranceLevel !== "aal2") throw failure(context, 403, "Bevestig eerst je tweestapsverificatie.");
  if (input.operation === "create" && !tenant.capabilities.includes("tenant.studio.create") || input.operation === "render" && !tenant.capabilities.includes("tenant.studio.render")) throw failure(context, 403, "Je hebt geen rechten voor deze Studio-actie.");
  if (input.operation !== "render" && (await loadSitesAuthoringState(client, tenant.id)).paused) throw failure(context, 403, sitesAuthoringPausedMessage);
  if (input.operation === "save" || input.operation === "series") {
    if (!tenant.capabilities.some(value => value === "tenant.studio.edit_own" || value === "tenant.studio.edit_all")) throw failure(context, 403, "Je hebt geen bewerkingsrechten voor Studio.");
  }
  if (input.operation === "series" && ["add", "duplicate"].includes(input.action) && !tenant.capabilities.includes("tenant.studio.create")) throw failure(context, 403, "Je hebt aanmaakrechten nodig om een slide toe te voegen.");
  if (input.operation === "series" && input.action === "remove" && !tenant.capabilities.includes("tenant.studio.archive")) throw failure(context, 403, "Je hebt archiefrechten nodig om een slide te verwijderen.");
  if (input.operation !== "create") {
    const project = await client.from("studio_projects").select("id").eq("tenant_id", tenant.id).eq("id", input.projectId).maybeSingle();
    if (project.error || !project.data) throw failure(context, 404, "Dit ontwerp is niet beschikbaar in deze organisatie.");
  }
  if (input.operation === "create" || input.operation === "save") {
    const document = parseStudioDocument(input.document);
    if (!document.syncPresentation) throw Error("MOBILE_SYNC_DOCUMENT_REQUIRED");
    const result = input.operation === "create"
      ? await client.rpc("create_studio_project_v1", {p_tenant_id: tenant.id, p_document: document, p_name: document.syncPresentation.name.trim(), p_orientation: document.artboard.orientation, p_project_kind: "design", p_referenced_asset_ids: studioDocumentAssetIds(document), p_idempotency_key: input.idempotencyKey})
      : await client.rpc("save_studio_draft_v1", {p_project_id: input.projectId, p_expected_revision: input.expectedDraftRevision, p_document: document, p_referenced_asset_ids: studioDocumentAssetIds(document), p_idempotency_key: input.idempotencyKey});
    const data = object(result.data);
    if (result.error) throw Error("MOBILE_SYNC_WRITE_UNCONFIRMED");
    return mobileSyncStudioResultV3Schema.parse({outcome: input.operation === "create" ? "created" : data.outcome, projectId: input.operation === "create" ? data.projectId : input.projectId, draftRevision: Number(data.draftRevision ?? data.actualRevision), renderJobId: null, series: null});
  }
  if (input.operation === "render") {
    const result = await client.rpc("request_studio_render_v1", {p_project_id: input.projectId, p_expected_draft_revision: input.expectedDraftRevision, p_output_kind: input.outputKind, p_idempotency_key: input.idempotencyKey});
    const data = object(result.data);
    // The existing RPC replays committed receipts before validating the current
    // motion/output-kind pair. A later motion edit can reject a stale request
    // with23514 before its ordinary CAS branch; this is a definite rollback.
    if (result.error?.code === "23514") {
      const current = await client.from("studio_project_drafts").select("draft_revision").eq("tenant_id", tenant.id).eq("project_id", input.projectId).maybeSingle();
      const revision = Number(current.data?.draft_revision);
      if (!current.error && current.data && Number.isSafeInteger(revision) && revision !== input.expectedDraftRevision) return mobileSyncStudioResultV3Schema.parse({outcome: "conflict", projectId: input.projectId, draftRevision: revision, renderJobId: null, series: null});
    }
    if (result.error) throw Error("MOBILE_SYNC_RENDER_UNCONFIRMED");
    return mobileSyncStudioResultV3Schema.parse({outcome: data.outcome, projectId: input.projectId, draftRevision: Number(data.actualRevision ?? input.expectedDraftRevision), renderJobId: data.renderJobId ?? null, series: null});
  }
  const result = await client.rpc("mutate_sync_studio_series_v1", {p_project_id: input.projectId, p_expected_draft_revision: input.draftRevision, p_series_id: input.seriesId, p_expected_series_revision: input.seriesRevision, p_operation: input.action, p_name: input.name, p_member_ids: input.memberIds, p_idempotency_key: input.idempotencyKey});
  const data = object(result.data);
  // This RPC checks its original receipt before revision/active-state CAS.
  // A returned serialization conflict therefore rejected this exact command;
  // preserve local input while allowing an explicit current-version recovery.
  if (["40001", "PT409"].includes(result.error?.code ?? "")) return mobileSyncStudioResultV3Schema.parse({outcome: "conflict", projectId: input.projectId, draftRevision: input.draftRevision, renderJobId: null, series: null});
  if (result.error) throw Error("MOBILE_SYNC_SERIES_UNCONFIRMED");
  return mobileSyncStudioResultV3Schema.parse({outcome: data.outcome, projectId: input.projectId, draftRevision: input.draftRevision, renderJobId: null, series: {id: data.seriesId, revision: Number(data.revision), projectIds: data.projectIds, nextProjectId: data.nextProjectId}});
}
