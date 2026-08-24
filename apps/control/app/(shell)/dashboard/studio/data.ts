import "server-only";

import {
  safeParseStudioDocument,
  studioRenderOutputTypes,
  studioRenderStatuses,
  type StudioRenderOutputType,
  type StudioRenderStatus
} from "@veyocast/studio";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { loadDemoStudioOverview, loadDemoStudioProject } from "./demo-data";
import type {
  StudioBrandKit,
  StudioBrandResources,
  StudioEditorData,
  StudioMediaAsset,
  StudioOverviewData,
  StudioProjectDetail,
  StudioProjectKind,
  StudioProjectStatus,
  StudioProjectSummary,
  StudioRenderJob,
  StudioRevision
} from "./types";

type UnknownRow = Record<string, unknown>;

export type StudioOverviewFilter = {
  format?: "all" | "landscape" | "portrait";
  kind?: "all" | "design" | "template";
  owner?: "all" | "mine";
  query?: string;
  sort?: "name" | "updated";
  status?: "active" | "all" | "archived" | "deleted";
  updated?: "all" | "month" | "week";
  view?: "grid" | "list";
};

export async function loadStudioOverview(
  tenantId: string | null,
  isLive: boolean,
  userId: string,
  filter: StudioOverviewFilter
): Promise<StudioOverviewData> {
  if (!isLive) return filterDemoOverview(loadDemoStudioOverview(), filter);
  if (!tenantId) {
    return {
      error: "Kies eerst een actieve vereniging.",
      projects: [],
      renderJobs: []
    };
  }

  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      error: "De beveiligde datasessie ontbreekt.",
      projects: [],
      renderJobs: []
    };
  }

  let projectsQuery = supabase
    .from("studio_projects")
    .select("*")
    .eq("tenant_id", tenantId);
  if (filter.status === "archived") {
    projectsQuery = projectsQuery.eq("status", "archived");
  } else if (filter.status === "deleted") {
    projectsQuery = projectsQuery.eq("status", "deleted");
  } else if (filter.status !== "all") {
    projectsQuery = projectsQuery.eq("status", "active");
  }
  if (filter.format && filter.format !== "all") {
    projectsQuery = projectsQuery.eq("orientation", filter.format);
  }
  if (filter.owner === "mine") {
    projectsQuery = projectsQuery.eq("owner_user_id", userId);
  }
  if (filter.kind === "design") {
    projectsQuery = projectsQuery.eq("project_kind", "design");
  } else if (filter.kind === "template") {
    projectsQuery = projectsQuery.eq("project_kind", "tenant_template");
  }
  if (filter.updated === "week" || filter.updated === "month") {
    const days = filter.updated === "week" ? 7 : 30;
    projectsQuery = projectsQuery.gte(
      "updated_at",
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    );
  }
  if (filter.query?.trim()) {
    projectsQuery = projectsQuery.ilike(
      "name",
      `%${escapeLike(filter.query.trim())}%`
    );
  }
  projectsQuery =
    filter.sort === "name"
      ? projectsQuery.order("name", { ascending: true })
      : projectsQuery.order("updated_at", { ascending: false });

  const projectsResult = await projectsQuery.limit(100);
  if (projectsResult.error) {
    console.error("Studio-ontwerpen laden mislukt", projectsResult.error);
    return {
      error: "De Studio-ontwerpen konden niet veilig worden geladen.",
      projects: [],
      renderJobs: []
    };
  }

  const projectRows = (projectsResult.data ?? []) as UnknownRow[];
  const projectIds = projectRows.flatMap((row) =>
    typeof row.id === "string" ? [row.id] : []
  );
  const [draftsResult, jobsResult, exportsResult] = projectIds.length
    ? await Promise.all([
        supabase
          .from("studio_project_drafts")
          .select("*")
          .eq("tenant_id", tenantId)
          .in("project_id", projectIds),
        supabase
          .from("studio_render_jobs")
          .select("*")
          .eq("tenant_id", tenantId)
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("studio_exports")
          .select("*")
          .eq("tenant_id", tenantId)
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(100)
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];
  const aggregateError =
    draftsResult.error ?? jobsResult.error ?? exportsResult.error;
  if (aggregateError) {
    console.error("Studio-samenvatting laden mislukt", aggregateError);
    return {
      error: "De Studio-details konden niet volledig worden geladen.",
      projects: [],
      renderJobs: []
    };
  }

  const drafts = (draftsResult.data ?? []) as UnknownRow[];
  const jobs = ((jobsResult.data ?? []) as UnknownRow[])
    .map(mapRenderJob)
    .filter((job): job is StudioRenderJob => job !== null);
  const exports = (exportsResult.data ?? []) as UnknownRow[];
  const projects = projectRows
    .map((row) =>
      mapProjectSummary(
        row,
        drafts.find((draft) => draft.project_id === row.id),
        jobs.find((job) => job.projectId === row.id),
        exports.find((entry) => entry.project_id === row.id)
      )
    )
    .filter((project): project is StudioProjectSummary => project !== null);

  return { error: null, projects, renderJobs: jobs };
}

export async function loadStudioProject(
  tenantId: string | null,
  isLive: boolean,
  projectId: string
): Promise<StudioEditorData> {
  if (!isLive) return loadDemoStudioProject(projectId);
  if (!tenantId || !uuidPattern.test(projectId)) {
    return emptyStudioEditorData();
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      ...emptyStudioEditorData(),
      error: "De beveiligde datasessie ontbreekt.",
    };
  }

  const [projectResult, draftResult, jobsResult, revisionsResult, brandResult] =
    await Promise.all([
      supabase
        .from("studio_projects")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("studio_project_drafts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("studio_render_jobs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("studio_revisions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .order("revision_number", { ascending: false })
        .limit(50),
      supabase
        .from("studio_tenant_brand_kits")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle()
    ]);
  const aggregateError =
    projectResult.error ??
    draftResult.error ??
    jobsResult.error ??
    revisionsResult.error ??
    brandResult.error;
  if (aggregateError) {
    console.error("Studio-ontwerp laden mislukt", aggregateError);
    return {
      ...emptyStudioEditorData(),
      error: "Het Studio-ontwerp kon niet volledig worden geladen.",
    };
  }
  if (!projectResult.data || !draftResult.data) {
    return emptyStudioEditorData();
  }

  const project = mapProjectDetail(
    projectResult.data as UnknownRow,
    draftResult.data as UnknownRow
  );
  if (!project) {
    return {
      ...emptyStudioEditorData(),
      error: "Het bewerkbare Studio-document is ongeldig.",
    };
  }

  const brandRow = (brandResult.data ?? null) as UnknownRow | null;
  const logoMediaAssetId =
    typeof brandRow?.logo_media_asset_id === "string"
      ? brandRow.logo_media_asset_id
      : null;
  const assetData = await loadStudioMediaAssets(
    supabase,
    tenantId,
    logoMediaAssetId ? [logoMediaAssetId] : []
  );
  const revisionRows = (revisionsResult.data ?? []) as UnknownRow[];
  const creatorIds = [
    ...new Set(
      revisionRows.flatMap((row) =>
        typeof row.created_by === "string" ? [row.created_by] : []
      )
    )
  ];
  const profilesResult = creatorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", creatorIds)
    : { data: [], error: null };
  if (profilesResult.error) {
    console.error("Studio-revisieauteurs laden mislukt", profilesResult.error);
  }
  const profileNames = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.id,
      profile.display_name
    ])
  );
  const revisions = revisionRows
    .map((row) => mapRevision(row, profileNames))
    .filter((revision): revision is StudioRevision => revision !== null);
  const brandKit = mapBrandKit(
    brandRow,
    assetData.assets.find((asset) => asset.id === logoMediaAssetId)?.previewUrl ??
      null
  );

  return {
    assets: assetData.assets,
    brandKit,
    error: assetData.error,
    project,
    renderJobs: ((jobsResult.data ?? []) as UnknownRow[])
      .map(mapRenderJob)
      .filter((job): job is StudioRenderJob => job !== null),
    revisions
  };
}

export async function loadStudioBrandResources(
  tenantId: string | null,
  isLive: boolean
): Promise<StudioBrandResources> {
  if (!isLive || !tenantId) {
    return { assets: [], brandKit: null, error: null };
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      assets: [],
      brandKit: null,
      error: "De beveiligde datasessie ontbreekt."
    };
  }
  const brandResult = await supabase
    .from("studio_tenant_brand_kits")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (brandResult.error) {
    console.error("Studio-huisstijl laden mislukt", brandResult.error);
    return {
      assets: [],
      brandKit: null,
      error: "De Studio-huisstijl kon niet worden geladen."
    };
  }
  const brandRow = (brandResult.data ?? null) as UnknownRow | null;
  const logoMediaAssetId =
    typeof brandRow?.logo_media_asset_id === "string"
      ? brandRow.logo_media_asset_id
      : null;
  const assetData = await loadStudioMediaAssets(
    supabase,
    tenantId,
    logoMediaAssetId ? [logoMediaAssetId] : []
  );
  return {
    assets: assetData.assets.filter((asset) => asset.kind === "image"),
    brandKit: mapBrandKit(
      brandRow,
      assetData.assets.find((asset) => asset.id === logoMediaAssetId)
        ?.previewUrl ?? null
    ),
    error: assetData.error
  };
}

type StudioDataClient = NonNullable<
  Awaited<ReturnType<typeof createControlSupabaseClient>>
>;

async function loadStudioMediaAssets(
  supabase: StudioDataClient,
  tenantId: string,
  includeAssetIds: readonly string[]
) {
  const recentResult = await supabase
    .from("media_assets")
    .select("id, title, kind, status, deleted_at")
    .eq("tenant_id", tenantId)
    .in("kind", ["image", "video"])
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (recentResult.error) {
    console.error("Studio-media laden mislukt", recentResult.error);
    return {
      assets: [] as StudioMediaAsset[],
      error: "De gereedstaande Studio-media konden niet worden geladen."
    };
  }
  const assetRows = (recentResult.data ?? []) as UnknownRow[];
  const existingIds = new Set(
    assetRows.flatMap((row) => (typeof row.id === "string" ? [row.id] : []))
  );
  const missingIds = includeAssetIds.filter(
    (assetId) => uuidPattern.test(assetId) && !existingIds.has(assetId)
  );
  if (missingIds.length) {
    const extraResult = await supabase
      .from("media_assets")
      .select("id, title, kind, status, deleted_at")
      .eq("tenant_id", tenantId)
      .in("kind", ["image", "video"])
      .eq("status", "ready")
      .is("deleted_at", null)
      .in("id", missingIds);
    if (extraResult.error) {
      console.error("Studio-huisstijllogo laden mislukt", extraResult.error);
    } else {
      assetRows.push(...((extraResult.data ?? []) as UnknownRow[]));
    }
  }
  const assetIds = assetRows.flatMap((row) =>
    typeof row.id === "string" ? [row.id] : []
  );
  if (!assetIds.length) {
    return { assets: [] as StudioMediaAsset[], error: null };
  }
  const variantsResult = await supabase
    .from("media_variants")
    .select("asset_id, variant_type, storage_path, width, height, mime_type")
    .eq("tenant_id", tenantId)
    .in("asset_id", assetIds)
    .in("variant_type", ["thumbnail", "original", "player_1080p"]);
  if (variantsResult.error) {
    console.error("Studio-mediavarianten laden mislukt", variantsResult.error);
    return {
      assets: [] as StudioMediaAsset[],
      error: "De Studio-mediavoorbeelden konden niet worden geladen."
    };
  }
  const variantsByAsset = new Map<string, UnknownRow[]>();
  for (const variant of (variantsResult.data ?? []) as UnknownRow[]) {
    if (typeof variant.asset_id !== "string") continue;
    variantsByAsset.set(variant.asset_id, [
      ...(variantsByAsset.get(variant.asset_id) ?? []),
      variant
    ]);
  }
  const mapped = await Promise.all(
    assetRows.map(async (asset): Promise<StudioMediaAsset | null> => {
      if (typeof asset.id !== "string" || typeof asset.title !== "string") {
        return null;
      }
      if (asset.kind !== "image" && asset.kind !== "video") return null;
      const variants = variantsByAsset.get(asset.id) ?? [];
      const previewVariant =
        variants.find((variant) => variant.variant_type === "thumbnail") ??
        (asset.kind === "image"
          ? variants.find((variant) => variant.variant_type === "original")
          : undefined);
      const sourceVariant = asset.kind === "video"
        ? variants.find((variant) => variant.variant_type === "player_1080p") ??
          variants.find((variant) => variant.variant_type === "original")
        : previewVariant;
      let previewUrl: string | null = null;
      if (previewVariant && typeof previewVariant.storage_path === "string") {
        const signed = await supabase.storage
          .from("tenant-media")
          .createSignedUrl(previewVariant.storage_path, 600);
        previewUrl = signed.data?.signedUrl ?? null;
      }
      let sourceUrl: string | null = null;
      if (sourceVariant && typeof sourceVariant.storage_path === "string") {
        const signed = await supabase.storage
          .from("tenant-media")
          .createSignedUrl(sourceVariant.storage_path, 600);
        sourceUrl = signed.data?.signedUrl ?? null;
      }
      return {
        height: finiteNumberOrNull(sourceVariant?.height ?? previewVariant?.height),
        id: asset.id,
        kind: asset.kind,
        previewUrl,
        sourceUrl,
        title: asset.title,
        width: finiteNumberOrNull(sourceVariant?.width ?? previewVariant?.width)
      };
    })
  );
  return {
    assets: mapped.filter(
      (asset): asset is StudioMediaAsset => asset !== null
    ),
    error: null
  };
}

function mapRevision(
  row: UnknownRow,
  profileNames: ReadonlyMap<string, string | null>
): StudioRevision | null {
  const parsed = safeParseStudioDocument(row.document_json);
  const reason =
    row.reason === "render" ||
    row.reason === "checkpoint" ||
    row.reason === "restore"
      ? row.reason
      : null;
  if (
    !parsed.success ||
    !reason ||
    typeof row.id !== "string" ||
    !Number.isSafeInteger(Number(row.revision_number))
  ) {
    return null;
  }
  const createdBy = typeof row.created_by === "string" ? row.created_by : null;
  return {
    createdAt: dateStringOrNow(row.created_at),
    createdBy,
    createdByName:
      (createdBy ? profileNames.get(createdBy) : null) ??
      (createdBy ? `Teamlid ${createdBy.slice(0, 8)}` : "Systeem"),
    document: parsed.data,
    draftRevision: integerOr(row.draft_revision, 0),
    id: row.id,
    number: integerOr(row.revision_number, 0),
    reason
  };
}

function mapBrandKit(
  row: UnknownRow | null,
  logoPreviewUrl: string | null
): StudioBrandKit | null {
  if (
    !row ||
    typeof row.logo_media_asset_id !== "string" ||
    typeof row.primary_color !== "string" ||
    typeof row.secondary_color !== "string" ||
    !hexColorPattern.test(row.primary_color) ||
    !hexColorPattern.test(row.secondary_color)
  ) {
    return null;
  }
  return {
    logoMediaAssetId: row.logo_media_asset_id,
    logoPreviewUrl,
    primaryColor: row.primary_color.toUpperCase(),
    revision: integerOr(row.revision, 0),
    secondaryColor: row.secondary_color.toUpperCase()
  };
}

function emptyStudioEditorData(): StudioEditorData {
  return {
    assets: [],
    brandKit: null,
    error: null,
    project: null,
    renderJobs: [],
    revisions: []
  };
}

function filterDemoOverview(
  data: StudioOverviewData,
  filter: StudioOverviewFilter
) {
  const query = filter.query?.trim().toLocaleLowerCase("nl-NL") ?? "";
  const projects = data.projects
    .filter(
      (project) =>
        (filter.format === undefined ||
          filter.format === "all" ||
          project.orientation === filter.format) &&
        (filter.kind === undefined ||
          filter.kind === "all" ||
          (filter.kind === "template"
            ? project.kind === "tenant_template"
            : project.kind === "design")) &&
        (filter.updated === undefined ||
          filter.updated === "all" ||
          Date.parse(project.updatedAt) >=
            Date.now() -
              (filter.updated === "week" ? 7 : 30) * 24 * 60 * 60 * 1000) &&
        (!query || project.name.toLocaleLowerCase("nl-NL").includes(query))
    )
    .sort((left, right) =>
      filter.sort === "name"
        ? left.name.localeCompare(right.name, "nl-NL")
        : right.updatedAt.localeCompare(left.updatedAt)
    );
  return { ...data, projects };
}

function mapProjectSummary(
  row: UnknownRow,
  draft: UnknownRow | undefined,
  job: StudioRenderJob | undefined,
  exportRow: UnknownRow | undefined
): StudioProjectSummary | null {
  const project = mapProjectBase(row);
  if (!project) return null;
  const parsed = draft ? safeParseStudioDocument(draft.document_json) : null;
  const document = parsed?.success ? parsed.data : null;
  return {
    ...project,
    document,
    draftRevision: integerOr(draft?.draft_revision, 0),
    durationMs: integerOr(row.duration_ms, document?.motion.durationMs ?? 10_000),
    lastExportMediaId:
      typeof exportRow?.media_asset_id === "string"
        ? exportRow.media_asset_id
        : null,
    lastRenderStatus: job?.status ?? null
  };
}

function mapProjectDetail(
  row: UnknownRow,
  draft: UnknownRow
): StudioProjectDetail | null {
  const project = mapProjectBase(row);
  const parsed = safeParseStudioDocument(draft.document_json);
  if (!project || !parsed.success) return null;
  return {
    ...project,
    document: parsed.data,
    draftRevision: integerOr(draft.draft_revision, 0)
  };
}

function mapProjectBase(row: UnknownRow) {
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string"
  ) {
    return null;
  }
  const orientation =
    row.orientation === "portrait" ? "portrait" : "landscape";
  const status = isProjectStatus(row.status) ? row.status : "active";
  const kind = isProjectKind(row.project_kind)
    ? row.project_kind
    : "design";
  return {
    createdAt: dateStringOrNow(row.created_at),
    id: row.id,
    kind,
    motionEnabled: Boolean(row.motion_enabled),
    name: row.name,
    orientation,
    ownerUserId:
      typeof row.owner_user_id === "string" ? row.owner_user_id : null,
    projectRevision: integerOr(row.revision, 0),
    status,
    updatedAt: dateStringOrNow(row.updated_at)
  } as const;
}

function mapRenderJob(row: UnknownRow): StudioRenderJob | null {
  if (
    typeof row.id !== "string" ||
    typeof row.project_id !== "string" ||
    typeof row.revision_id !== "string" ||
    !isRenderStatus(row.status) ||
    !isOutputKind(row.output_kind)
  ) {
    return null;
  }
  return {
    attemptCount: integerOr(row.attempt_count, 0),
    createdAt: dateStringOrNow(row.created_at),
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    errorDetail:
      typeof row.error_detail === "string" ? row.error_detail : null,
    finishedAt:
      typeof row.finished_at === "string" ? row.finished_at : null,
    id: row.id,
    mediaAssetId:
      typeof row.media_asset_id === "string" ? row.media_asset_id : null,
    outputKind: row.output_kind,
    progress: Math.min(100, Math.max(0, integerOr(row.progress, 0))),
    projectId: row.project_id,
    revisionId: row.revision_id,
    startedAt: typeof row.started_at === "string" ? row.started_at : null,
    status: row.status,
    updatedAt: dateStringOrNow(row.updated_at)
  };
}

function isRenderStatus(value: unknown): value is StudioRenderStatus {
  return (
    typeof value === "string" &&
    studioRenderStatuses.includes(value as StudioRenderStatus)
  );
}

function isOutputKind(value: unknown): value is StudioRenderOutputType {
  return (
    typeof value === "string" &&
    studioRenderOutputTypes.includes(value as StudioRenderOutputType)
  );
}

function isProjectStatus(value: unknown): value is StudioProjectStatus {
  return value === "active" || value === "archived" || value === "deleted";
}

function isProjectKind(value: unknown): value is StudioProjectKind {
  return value === "design" || value === "tenant_template";
}

function integerOr(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function finiteNumberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateStringOrNow(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : new Date().toISOString();
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hexColorPattern = /^#[0-9A-F]{6}$/i;
