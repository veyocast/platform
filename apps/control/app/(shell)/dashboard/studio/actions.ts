"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasCapability, type Capability } from "@veyocast/auth";
import {
  applyStudioBrandKit,
  createEmptyStudioDocument,
  getStudioSystemTemplate,
  parseStudioDocument,
  type StudioDocument,
  type StudioRenderOutputType
} from "@veyocast/studio";

import {
  requireTenantControlSession
} from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

const studioCapabilities = {
  archive: "tenant.studio.archive" as Capability,
  create: "tenant.studio.create" as Capability,
  editAll: "tenant.studio.edit_all" as Capability,
  editOwn: "tenant.studio.edit_own" as Capability,
  jobManage: "tenant.studio.job.manage" as Capability,
  render: "tenant.studio.render" as Capability,
  settingsManage: "tenant.settings.manage" as Capability,
  templateManage: "tenant.studio.template.manage" as Capability
} as const;

export type StudioActionResult = {
  actualRevision?: number;
  error?: string;
  jobId?: string;
  mediaAssetId?: string;
  ok: boolean;
  outcome?: string;
  projectId?: string;
  revision?: number;
  status?: string;
};

export async function createStudioProject(formData: FormData) {
  const session = await requireTenantControlSession(studioCapabilities.create);
  const name = projectName(formData);
  const formatId =
    formData.get("format") === "portrait-hd"
      ? "portrait-hd"
      : "landscape-hd";
  const templateId = String(formData.get("templateId") ?? "").trim();
  const systemTemplate = templateId
    ? getStudioSystemTemplate(templateId)
    : undefined;
  const motionEnabled = formData.get("motionEnabled") === "on";

  if (!session.isLive) {
    const target = systemTemplate?.id ?? `blank-${formatId}`;
    redirect(`/dashboard/studio/${target}?demo=1`);
  }
  if (!session.tenantId || session.tenantStatus !== "active") {
    redirectStudioError(
      "Deze vereniging kan momenteel geen nieuwe ontwerpen maken."
    );
  }
  const supabase = await createControlSupabaseClient();
  if (!supabase) redirectStudioError("De beveiligde datasessie ontbreekt.");
  let sourceDocument = systemTemplate?.document;
  if (templateId && !sourceDocument) {
    if (!uuidPattern.test(templateId)) {
      redirectStudioError("Het gekozen tenanttemplate is ongeldig.");
    }
    const [templateResult, draftResult] = await Promise.all([
      supabase
        .from("studio_projects")
        .select("id, project_kind, status, orientation")
        .eq("tenant_id", session.tenantId)
        .eq("id", templateId)
        .eq("project_kind", "tenant_template")
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("studio_project_drafts")
        .select("document_json")
        .eq("tenant_id", session.tenantId)
        .eq("project_id", templateId)
        .maybeSingle()
    ]);
    if (
      templateResult.error ||
      draftResult.error ||
      !templateResult.data ||
      !draftResult.data
    ) {
      redirectStudioError(
        "Het tenanttemplate bestaat niet meer of is niet toegankelijk."
      );
    }
    const templateDocument = parseStudioDocument(
      draftResult.data.document_json
    );
    if (templateDocument.artboard.orientation !== formatId.replace("-hd", "")) {
      redirectStudioError("Het tenanttemplate past niet bij het gekozen formaat.");
    }
    sourceDocument = templateDocument;
  }
  let document = studioCreationDocument({
    formatId,
    motionEnabled,
    sourceDocument,
    templateId: templateId || undefined
  });
  if (formData.get("applyTenantBrand") === "on") {
    const brandResult = await supabase
      .from("studio_tenant_brand_kits")
      .select("primary_color, secondary_color, logo_media_asset_id")
      .eq("tenant_id", session.tenantId)
      .maybeSingle();
    if (brandResult.error || !brandResult.data) {
      redirectStudioError(
        "De gekozen huisstijl is niet meer beschikbaar. Controleer de Studio-huisstijl."
      );
    }
    document = applyStudioBrandKit(document, {
      logoMediaAssetId: brandResult.data.logo_media_asset_id,
      primaryColor: brandResult.data.primary_color,
      secondaryColor: brandResult.data.secondary_color
    });
  }

  const { data, error } = await supabase.rpc("create_studio_project_v1", {
    p_document: document,
    p_idempotency_key: idempotencyValue(formData),
    p_name: name,
    p_orientation: document.artboard.orientation,
    p_project_kind:
      formData.get("projectKind") === "tenant_template"
        ? "tenant_template"
        : "design",
    p_referenced_asset_ids: referencedAssetIds(document),
    p_tenant_id: session.tenantId
  });
  const projectId = resultString(data, "projectId");
  if (error || !projectId) {
    console.error("Studio-ontwerp maken mislukt", error);
    redirectStudioError(createErrorMessage(error?.code));
  }

  revalidatePath("/dashboard/studio");
  redirect(
    `/dashboard/studio/${projectId}?succes=${encodeURIComponent(
      "Het ontwerp is veilig als concept aangemaakt."
    )}`
  );
}

function studioCreationDocument({
  formatId,
  motionEnabled,
  sourceDocument,
  templateId
}: {
  formatId: "landscape-hd" | "portrait-hd";
  motionEnabled: boolean;
  sourceDocument?: StudioDocument;
  templateId?: string;
}) {
  const fallback = createEmptyStudioDocument(formatId, {
    durationMs: motionEnabled ? 10_000 : undefined,
    motionEnabled
  });
  return parseStudioDocument({
    ...(sourceDocument ?? fallback),
    metadata: {
      ...(sourceDocument ?? fallback).metadata,
      templateId
    },
    motion: {
      ...(sourceDocument ?? fallback).motion,
      enabled: motionEnabled
    }
  });
}

export async function saveStudioDraftAction(input: {
  document: StudioDocument;
  expectedRevision: number;
  idempotencyKey: string;
  projectId: string;
}): Promise<StudioActionResult> {
  const writer = await studioWriter([
    studioCapabilities.editOwn,
    studioCapabilities.editAll
  ]);
  const projectId = safeUuid(input.projectId);
  const expectedRevision = safeRevision(input.expectedRevision);
  const document = parseStudioDocument(input.document);
  const idempotencyKey = safeIdempotencyKey(input.idempotencyKey);
  if (!writer) {
    return {
      error: "Demomodus bewaart wijzigingen alleen tijdens deze sessie.",
      ok: true,
      outcome: "demo",
      revision: expectedRevision + 1
    };
  }

  const { data, error } = await writer.supabase.rpc("save_studio_draft_v1", {
    p_document: document,
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyKey,
    p_project_id: projectId,
    p_referenced_asset_ids: referencedAssetIds(document)
  });
  if (error) {
    console.error("Studio-concept opslaan mislukt", error);
    return {
      error: saveErrorMessage(error.code),
      ok: false
    };
  }
  const outcome = resultString(data, "outcome");
  if (outcome === "conflict") {
    return {
      actualRevision: resultInteger(data, "actualRevision") ?? undefined,
      error:
        "Iemand heeft dit ontwerp intussen gewijzigd. Je lokale versie is niet overschreven.",
      ok: false,
      outcome
    };
  }
  const revision = resultInteger(data, "draftRevision");
  if (outcome !== "saved" || revision === null) {
    return {
      error: "De server gaf geen volledige opslagbevestiging.",
      ok: false
    };
  }
  revalidatePath(`/dashboard/studio/${projectId}`);
  revalidatePath("/dashboard/studio");
  return { ok: true, outcome, revision };
}

export async function mutateStudioProjectAction(
  input: {
    expectedRevision: number;
    idempotencyKey: string;
    operation:
      | "archive"
      | "delete"
      | "duplicate"
      | "rename"
      | "restore";
    payload?: Record<string, unknown>;
    projectId: string;
  }
): Promise<StudioActionResult> {
  const requiredCapability =
    input.operation === "archive" ||
    input.operation === "delete" ||
    input.operation === "restore"
      ? studioCapabilities.archive
      : studioCapabilities.editOwn;
  const writer = await studioWriter(
    requiredCapability === studioCapabilities.editOwn
      ? [studioCapabilities.editOwn, studioCapabilities.editAll]
      : [requiredCapability]
  );
  if (!writer) {
    return {
      error: "Deze beheeractie is niet beschikbaar in demomodus.",
      ok: false
    };
  }
  const projectId = safeUuid(input.projectId);
  const payload =
    input.operation === "rename"
      ? { name: safeProjectName(input.payload?.name) }
      : input.payload ?? {};
  const { data, error } = await writer.supabase.rpc(
    "mutate_studio_project_v1",
    {
      p_expected_revision: safeRevision(input.expectedRevision),
      p_idempotency_key: safeIdempotencyKey(input.idempotencyKey),
      p_operation: input.operation,
      p_payload: payload,
      p_project_id: projectId
    }
  );
  if (error) {
    console.error("Studio-projectactie mislukt", error);
    return {
      error: mutationErrorMessage(error.code),
      ok: false
    };
  }
  const outcome = resultString(data, "outcome");
  if (outcome === "conflict") {
    return {
      actualRevision: resultInteger(data, "actualRevision") ?? undefined,
      error:
        "Het ontwerp is elders gewijzigd. Vernieuw eerst de projectgegevens.",
      ok: false,
      outcome
    };
  }
  const nextProjectId = resultString(data, "projectId") ?? projectId;
  revalidatePath("/dashboard/studio");
  revalidatePath(`/dashboard/studio/${projectId}`);
  return {
    ok: outcome === "applied" || outcome === "created",
    outcome: outcome ?? undefined,
    projectId: nextProjectId,
    revision: resultInteger(data, "projectRevision") ?? undefined,
    status: resultString(data, "status") ?? undefined
  };
}

export async function restoreStudioRevisionAction(input: {
  expectedDraftRevision: number;
  idempotencyKey: string;
  projectId: string;
  revisionId: string;
}): Promise<StudioActionResult> {
  const writer = await studioWriter([
    studioCapabilities.editOwn,
    studioCapabilities.editAll
  ]);
  if (!writer) {
    return {
      error: "Revisies herstellen is niet beschikbaar in demomodus.",
      ok: false
    };
  }
  const projectId = safeUuid(input.projectId);
  const { data, error } = await writer.supabase.rpc(
    "restore_studio_revision_v1",
    {
      p_expected_draft_revision: safeRevision(input.expectedDraftRevision),
      p_idempotency_key: safeIdempotencyKey(input.idempotencyKey),
      p_project_id: projectId,
      p_revision_id: safeUuid(input.revisionId)
    }
  );
  if (error) {
    console.error("Studio-revisie herstellen mislukt", error);
    return { error: saveErrorMessage(error.code), ok: false };
  }
  const outcome = resultString(data, "outcome");
  if (outcome === "conflict") {
    return {
      actualRevision: resultInteger(data, "actualRevision") ?? undefined,
      error:
        "Het concept is intussen gewijzigd. De historische versie is niet hersteld.",
      ok: false,
      outcome
    };
  }
  const revision = resultInteger(data, "draftRevision");
  if (outcome !== "restored" || revision === null) {
    return {
      error: "De server bevestigde het herstel niet volledig.",
      ok: false
    };
  }
  revalidatePath(`/dashboard/studio/${projectId}`);
  revalidatePath("/dashboard/studio");
  return { ok: true, outcome, revision };
}

export async function copyStudioConflictAction(input: {
  document: StudioDocument;
  idempotencyKey: string;
  projectId: string;
}): Promise<StudioActionResult> {
  const writer = await studioWriter([studioCapabilities.create]);
  if (!writer) {
    return {
      error: "Een conflictkopie maken is niet beschikbaar in demomodus.",
      ok: false
    };
  }
  const sourceId = safeUuid(input.projectId);
  const document = parseStudioDocument(input.document);
  const sourceResult = await writer.supabase
    .from("studio_projects")
    .select("name")
    .eq("tenant_id", writer.session.tenantId)
    .eq("id", sourceId)
    .maybeSingle();
  if (sourceResult.error || !sourceResult.data) {
    return {
      error: "Het bronontwerp bestaat niet meer of is niet toegankelijk.",
      ok: false
    };
  }
  const { data, error } = await writer.supabase.rpc(
    "create_studio_project_v1",
    {
      p_document: document,
      p_idempotency_key: safeIdempotencyKey(input.idempotencyKey),
      p_name: safeProjectName(
        `${sourceResult.data.name.slice(0, 101)} (conflictkopie)`
      ),
      p_orientation: document.artboard.orientation,
      p_project_kind: "design",
      p_referenced_asset_ids: referencedAssetIds(document),
      p_tenant_id: writer.session.tenantId
    }
  );
  const projectId = resultString(data, "projectId");
  if (error || !projectId) {
    console.error("Studio-conflictkopie maken mislukt", error);
    return { error: createErrorMessage(error?.code), ok: false };
  }
  revalidatePath("/dashboard/studio");
  return {
    ok: true,
    outcome: "created",
    projectId
  };
}

export async function upsertStudioBrandKitAction(input: {
  expectedRevision: number;
  idempotencyKey: string;
  logoMediaAssetId: string;
  primaryColor: string;
  secondaryColor: string;
}): Promise<StudioActionResult> {
  const writer = await studioWriter([studioCapabilities.settingsManage]);
  if (!writer) {
    return {
      error: "De Studio-huisstijl beheren is niet beschikbaar in demomodus.",
      ok: false
    };
  }
  const primaryColor = safeHexColor(input.primaryColor);
  const secondaryColor = safeHexColor(input.secondaryColor);
  const { data, error } = await writer.supabase.rpc(
    "upsert_studio_brand_kit_v1",
    {
      p_expected_revision: safeRevision(input.expectedRevision),
      p_idempotency_key: safeIdempotencyKey(input.idempotencyKey),
      p_logo_media_asset_id: safeUuid(input.logoMediaAssetId),
      p_primary_color: primaryColor,
      p_secondary_color: secondaryColor,
      p_tenant_id: writer.session.tenantId
    }
  );
  if (error) {
    console.error("Studio-huisstijl opslaan mislukt", error);
    return {
      error:
        error.code === "23514"
          ? "Gebruik twee geldige kleuren en een gereedstaande afbeelding als logo."
          : mutationErrorMessage(error.code),
      ok: false
    };
  }
  const outcome = resultString(data, "outcome");
  if (outcome === "conflict") {
    return {
      actualRevision: resultInteger(data, "actualRevision") ?? undefined,
      error:
        "De huisstijl is intussen gewijzigd. Vernieuw de pagina en probeer opnieuw.",
      ok: false,
      outcome
    };
  }
  const revision = resultInteger(data, "revision");
  if (outcome !== "saved" || revision === null) {
    return {
      error: "De server bevestigde de huisstijlwijziging niet volledig.",
      ok: false
    };
  }
  revalidatePath("/dashboard/studio");
  revalidatePath("/dashboard/studio/new");
  return { ok: true, outcome, revision };
}

export async function requestStudioRenderAction(input: {
  expectedDraftRevision: number;
  idempotencyKey: string;
  outputKind: StudioRenderOutputType;
  projectId: string;
}): Promise<StudioActionResult> {
  const writer = await studioWriter([studioCapabilities.render]);
  if (!writer) {
    return {
      error:
        "Demomodus toont de renderflow, maar maakt geen echt media-item.",
      jobId: `demo-${Date.now().toString(36)}`,
      ok: true,
      outcome: "demo",
      status: "completed"
    };
  }
  const { data, error } = await writer.supabase.rpc(
    "request_studio_render_v1",
    {
      p_expected_draft_revision: safeRevision(input.expectedDraftRevision),
      p_idempotency_key: safeIdempotencyKey(input.idempotencyKey),
      p_output_kind: input.outputKind === "mp4" ? "mp4" : "png",
      p_project_id: safeUuid(input.projectId)
    }
  );
  if (error) {
    console.error("Studio-render aanvragen mislukt", error);
    return { error: renderErrorMessage(error.code), ok: false };
  }
  const outcome = resultString(data, "outcome");
  if (outcome === "conflict") {
    return {
      actualRevision: resultInteger(data, "actualRevision") ?? undefined,
      error:
        "Het concept is intussen gewijzigd. Sla de nieuwste versie op en probeer opnieuw.",
      ok: false,
      outcome
    };
  }
  const jobId = resultString(data, "renderJobId");
  if (outcome !== "queued" || !jobId) {
    return {
      error: "De renderopdracht kon niet veilig worden bevestigd.",
      ok: false
    };
  }
  revalidatePath(`/dashboard/studio/${input.projectId}`);
  return {
    jobId,
    ok: true,
    outcome,
    status: resultString(data, "status") ?? "queued"
  };
}

export async function retryStudioRenderAction(input: {
  idempotencyKey: string;
  renderJobId: string;
}): Promise<StudioActionResult> {
  return mutateRenderJob(
    "retry_studio_render_v1",
    input.renderJobId,
    input.idempotencyKey
  );
}

export async function cancelStudioRenderAction(input: {
  idempotencyKey: string;
  renderJobId: string;
}): Promise<StudioActionResult> {
  return mutateRenderJob(
    "cancel_studio_render_v1",
    input.renderJobId,
    input.idempotencyKey
  );
}

async function mutateRenderJob(
  rpcName: "cancel_studio_render_v1" | "retry_studio_render_v1",
  renderJobId: string,
  idempotencyKey: string
): Promise<StudioActionResult> {
  const writer = await studioWriter([studioCapabilities.jobManage]);
  if (!writer) {
    return {
      error: "Renderjobs beheren is niet beschikbaar in demomodus.",
      ok: false
    };
  }
  const { data, error } = await writer.supabase.rpc(rpcName, {
    p_idempotency_key: safeIdempotencyKey(idempotencyKey),
    p_render_job_id: safeUuid(renderJobId)
  });
  if (error) {
    console.error("Studio-renderjob beheren mislukt", error);
    return { error: renderErrorMessage(error.code), ok: false };
  }
  const outcome = resultString(data, "outcome");
  return {
    jobId: resultString(data, "renderJobId") ?? undefined,
    ok:
      outcome === "queued" ||
      outcome === "cancelled" ||
      outcome === "unchanged",
    outcome: outcome ?? undefined,
    status: resultString(data, "status") ?? undefined
  };
}

async function studioWriter(requiredCapabilities: readonly Capability[]) {
  const session = await requireTenantControlSession("tenant.studio.read");
  if (!session.isLive) return null;
  if (
    !requiredCapabilities.some((capability) =>
      hasCapability(session.capabilities, capability)
    )
  ) {
    throw new Error("Je hebt geen recht om deze Studio-actie uit te voeren.");
  }
  if (session.tenantStatus !== "active") {
    throw new Error(
      "Deze vereniging is niet actief; Studio-wijzigingen zijn geblokkeerd."
    );
  }
  const supabase = await createControlSupabaseClient();
  if (!session.tenantId || !supabase) {
    throw new Error("De beveiligde Studio-sessie ontbreekt.");
  }
  return { session, supabase };
}

export async function canEditStudioProject(
  ownerUserId: string,
  userId: string,
  capabilities: readonly Capability[]
) {
  return (
    hasCapability(capabilities, studioCapabilities.editAll) ||
    (ownerUserId === userId &&
      hasCapability(capabilities, studioCapabilities.editOwn))
  );
}

function referencedAssetIds(document: StudioDocument) {
  return [
    ...new Set(
      document.elements.flatMap((element) =>
        element.type === "image" ? [element.mediaAssetId] : []
      )
    )
  ];
}

function projectName(formData: FormData) {
  return safeProjectName(formData.get("name"));
}

function safeProjectName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 2 || name.length > 120) {
    throw new Error("Gebruik een ontwerpnaam van 2 tot en met 120 tekens.");
  }
  return name;
}

function safeHexColor(value: unknown) {
  const color = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw new Error("Gebruik een geldige hexkleur met zes tekens.");
  }
  return color;
}

function safeUuid(value: string) {
  if (!uuidPattern.test(value)) {
    throw new Error("De gekozen Studio-resource is ongeldig.");
  }
  return value;
}

function safeRevision(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("De Studio-revisie is ongeldig.");
  }
  return value;
}

function safeIdempotencyKey(value: string) {
  return uuidPattern.test(value) ? value : randomUUID();
}

function idempotencyValue(formData: FormData) {
  return safeIdempotencyKey(String(formData.get("idempotencyKey") ?? ""));
}

function resultString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>)[key];
  return typeof result === "string" ? result : null;
}

function resultInteger(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = Number((value as Record<string, unknown>)[key]);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

function createErrorMessage(code: string | undefined) {
  if (code === "42501") {
    return "Je hebt geen recht om binnen deze vereniging een ontwerp te maken.";
  }
  if (code === "23514") {
    return "Het gekozen formaat of template bevat ongeldige ontwerpgegevens.";
  }
  return "Het Studio-ontwerp kon niet veilig worden aangemaakt.";
}

function saveErrorMessage(code: string | undefined) {
  if (code === "42501") {
    return "Je mag dit ontwerp niet bewerken.";
  }
  if (code === "23514") {
    return "Het ontwerp bevat ongeldige of niet-ondersteunde instellingen.";
  }
  if (code === "P0002") {
    return "Het ontwerp bestaat niet meer of is niet toegankelijk.";
  }
  return "Opslaan is mislukt. Je lokale wijzigingen blijven beschikbaar.";
}

function mutationErrorMessage(code: string | undefined) {
  if (code === "42501") return "Je mag deze projectactie niet uitvoeren.";
  if (code === "P0002") return "Het Studio-ontwerp bestaat niet meer.";
  return "De projectactie kon niet veilig worden uitgevoerd.";
}

function renderErrorMessage(code: string | undefined) {
  if (code === "42501") return "Je mag geen media uit dit ontwerp genereren.";
  if (code === "P0002") return "Het ontwerp of de renderjob bestaat niet meer.";
  if (code === "23514") {
    return "Het ontwerp voldoet niet aan de veilige rendergrenzen.";
  }
  return "De renderopdracht kon niet veilig worden uitgevoerd.";
}

function redirectStudioError(message: string): never {
  redirect(`/dashboard/studio?fout=${encodeURIComponent(message)}`);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
