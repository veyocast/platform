import "server-only";

import { randomUUID } from "node:crypto";
import { hasCapability } from "@veyocast/auth";
import { parseStudioDocument, studioDocumentAssetIds } from "@veyocast/studio";
import { requireAgentActor } from "./access";
import { agentResources, commandCapability, parseAgentDraft, type AgentDomain, type AgentPlan, type AgentProposal, type AgentStep } from "./catalog";
import { checkPlaylistPublication } from "../../app/(shell)/dashboard/playlists/publication-check.server";
import { checkScheduleConflicts } from "../../app/(shell)/dashboard/planning/actions";
import { createControlAdminClient } from "../supabase/admin";
import { requireRiskConfirmation } from "./risks";

const resources: Record<Exclude<AgentDomain,"attachment">, keyof typeof agentResources> = { playlist: "playlists", media: "media", screen: "screens", group: "groups", schedule: "schedules", studio: "studio" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function prepareAgentProposal(conversationId: string, input: unknown, replaces?: { id: string; hash: string }) {
  const { session, client } = await requireAgentActor();
  if (!uuid.test(conversationId)) throw Error("Open eerst een geldig gesprek.");
  const steps: AgentStep[] = [];
  let previous: AgentProposal | null = null;
  if (replaces) {
    const read = await client.from("ai_proposals").select("*").eq("id", replaces.id).eq("tenant_id", session.tenantId).eq("user_id", session.userId).eq("conversation_id", conversationId).single();
    if (read.error || !read.data || read.data.plan_hash !== replaces.hash) throw Error("Het eerdere voorstel is gewijzigd. Open de actuele versie; er is niets opnieuw uitgevoerd.");
    previous = read.data as AgentProposal;
  }
  const revisions = new Map<string, number>();
  const createdPlaylists = new Map<string, string>();
  for (const draft of parseAgentDraft(input)) {
    const capability = commandCapability(draft.domain, draft.operation);
    if (!hasCapability(session.capabilities, capability) && !(draft.domain === "studio" && ["save", "rename"].includes(draft.operation) && hasCapability(session.capabilities, "tenant.studio.edit_all"))) throw Error("Je huidige rol mag deze actie niet uitvoeren. Er is niets gewijzigd.");
    const resource = agentResources[draft.domain === "attachment" ? "media" : resources[draft.domain]];
    const args = structuredClone(draft.args);
    if (previous) delete args.idFromStep;
    if (args.idFromStep !== undefined) {
      const source = steps[Number(args.idFromStep)];
      if (!source || source.domain !== draft.domain || source.operation !== "create" || typeof source.args.newId !== "string") throw Error("De verwijzing naar het nieuw te maken object is ongeldig.");
      args.id = source.args.newId;
    }
    let label = String(args.name ?? "Nieuw object");
    let href: string = resource.href;
    if (draft.domain === "attachment") {
      const privateAsset = await client.from("ai_attachments").select("id").eq("id", args.id).eq("tenant_id", session.tenantId).eq("user_id", session.userId).eq("conversation_id", conversationId).single();
      if (privateAsset.error) throw Error("Deze privébijlage hoort niet bij het actuele gesprek. Er is niets bewaard.");
      const asset = await createControlAdminClient().from("media_assets").select("title,status").eq("id", args.id).eq("tenant_id", session.tenantId).single();
      if (asset.error || asset.data.status !== "ready") throw Error("De bijlage is nog niet veilig verwerkt. Wacht op Gereed of herstel de upload voordat je een bewaar- of publicatievoorstel maakt.");
      steps.push({ domain: "attachment", operation: "retain", args, commandKey: randomUUID(), label: asset.data.title, href: `/dashboard/media/${String(args.id)}`, affectedScreens: [] });
      continue;
    }
    if (draft.domain === "playlist" && createdPlaylists.has(String(args.id))) {
      label = createdPlaylists.get(String(args.id))!;
      href = `/dashboard/playlists/${String(args.id)}`;
      const revisionKey = `playlist:${String(args.id)}`;
      args.revision = revisions.get(revisionKey) ?? 0;
      revisions.set(revisionKey, Number(args.revision) + (draft.operation === "publish" ? 0 : 1));
    } else if (draft.operation !== "create") {
      if (!uuid.test(String(args.id))) throw Error("De bestemming is niet exact bepaald. Kies eerst het juiste object.");
      const result = await client.from(resource.table).select(resource.fields).eq("id", args.id).eq("tenant_id", session.tenantId).single();
      if (result.error || !result.data) throw Error("Het gekozen object bestaat niet of is niet toegankelijk in deze vereniging. Er is niets gewijzigd.");
      const target = result.data as unknown as Record<string, unknown>;
      label = String(target[resource.label]);
      href = `${resource.href}${resource.href.endsWith("/") ? String(args.id) : ""}`;
      const revisionKey = `${draft.domain}:${String(args.id)}`;
      if (["screen", "media"].includes(draft.domain)) delete args.revision;
      else {
        args.revision = revisions.get(revisionKey) ?? Number(target.revision);
        revisions.set(revisionKey, Number(args.revision) + (draft.operation === "publish" ? 0 : 1));
      }
      args.updatedAt = target.updated_at;
      if (draft.domain === "schedule") { args.targetKind = target.target_kind; args.targetId = target.target_screen_id ?? target.target_screen_group_id; }
    } else {
      args.id = null; args.revision = 0;
      if (draft.domain === "playlist") {
        args.newId = previous?.plan.steps.slice(previous.next_step).some(step => step.domain === "playlist" && step.operation === "create" && step.args.newId === args.newId) ? args.newId : randomUUID();
        if (typeof args.name !== "string" || args.name.trim().length < 2 || args.name.length > 120) throw Error("Kies een playlistnaam van 2–120 tekens.");
        createdPlaylists.set(String(args.newId), args.name);
        href = `/dashboard/playlists/${String(args.newId)}`;
      }
    }
    if (!args.payload) args.payload = {};
    if (draft.domain === "media" && draft.operation === "archive") {
      const usage = await client.rpc("get_media_asset_usage", { p_asset_id: args.id });
      if (usage.error || !Array.isArray(usage.data)) throw Error("Het actuele mediagebruik kon niet worden bevestigd. Er is niets gearchiveerd.");
      const draftCount = usage.data.filter((item: { usage_type?: string }) => item.usage_type === "draft").length;
      args.payload = { expectedDraftCount: draftCount, removeDraftReferences: draftCount > 0 };
    }
    if (draft.domain === "studio" && ["create", "save"].includes(draft.operation)) {
      const document = parseStudioDocument(args.document);
      args.document = document; args.assetIds = studioDocumentAssetIds(document);
      args.name = document.syncPresentation?.name ?? args.name;
      args.orientation = document.artboard.orientation;
      if (draft.operation === "save") {
        const stored = await client.from("studio_project_drafts").select("draft_revision,document_json").eq("tenant_id", session.tenantId).eq("project_id", args.id).single();
        if (stored.error) throw Error("De ontwerpversie kon niet worden bevestigd.");
        const original = parseStudioDocument(stored.data.document_json);
        if (original.syncPresentation || original.sitesPresentation) throw Error("Open de eigen brongebonden editor voor dit ontwerp. De agent verandert geen dynamische Sportlink-, RSS-, Menu- of Twelve-renderer in een vrij ontwerp.");
        args.revision = stored.data.draft_revision;
      }
    }
    const affectedScreens: AgentStep["affectedScreens"] = [];
    if (draft.domain === "schedule") {
      const payload = args.payload as Record<string, unknown>;
      const targets = await client.rpc("get_ai_target_screens_v1", { p_tenant_id: session.tenantId, p_target_kind: payload.targetKind ?? args.targetKind, p_target_id: payload.targetId || args.targetId || null });
      if (targets.error || !Array.isArray(targets.data) || !targets.data.length) throw Error("De actuele planningsschermen konden niet worden bevestigd. Kies een beschikbare bestemming met toegankelijke schermen.");
      affectedScreens.push(...targets.data as AgentStep["affectedScreens"]);
    }
    if (draft.domain === "playlist") {
      if (args.id && !createdPlaylists.has(String(args.id))) {
        const assigned = await client.rpc("get_ai_playlist_reach_v1", { p_playlist_id: args.id });
        if (assigned.error || !Array.isArray(assigned.data)) throw Error("De gevolgen voor gedeelde schermen, groepen, zones en planning konden niet worden bevestigd. Controleer je leesrechten en probeer opnieuw.");
        affectedScreens.push(...assigned.data as AgentStep["affectedScreens"]);
      }
      if (draft.operation === "publish") {
        if (!Array.isArray(args.screenIds) || args.screenIds.some(screen => !uuid.test(String(screen)))) throw Error("Kies de exacte doelschermen vóór publicatie.");
        const targets = await client.from("screens").select("id,name").eq("tenant_id", session.tenantId).in("id", args.screenIds);
        if (targets.error || targets.data.length !== args.screenIds.length) throw Error("Een doelscherm is niet beschikbaar in deze vereniging.");
        for (const target of targets.data) if (!affectedScreens.some(screen => screen.id === target.id)) affectedScreens.push(target);
      }
    }
    steps.push({ domain: draft.domain, operation: draft.operation, args, commandKey: randomUUID(), label, href, affectedScreens });
  }
  const plan: AgentPlan = { schemaVersion: 1, timezone: session.timezoneName, steps };
  const saved = await client.rpc("create_ai_proposal_v1", { p_tenant_id: session.tenantId, p_conversation_id: conversationId, p_plan: plan, p_replaces_id: previous?.id ?? null, p_replaces_hash: previous?.plan_hash ?? null, p_replaces_next_step: previous?.next_step ?? null });
  if (saved.error || !saved.data) throw Error("Het voorstel kon niet bevestigd worden opgeslagen. Er is niets uitgevoerd; probeer opnieuw.");
  return saved.data as AgentProposal;
}

export async function decideAgentProposal(id: string, hash: string, approve: boolean, acceptedRiskHash: string | null) {
  const { session, client } = await requireAgentActor();
  const read = await client.from("ai_proposals").select("*").eq("id", id).eq("tenant_id", session.tenantId).eq("user_id", session.userId).single();
  if (read.error || !read.data || read.data.plan_hash !== hash) throw Error("Het oorspronkelijke voorstel kon niet worden bevestigd. Open het opnieuw; er is niets uitgevoerd.");
  let proposal = read.data as AgentProposal;
  if (approve) {
    for (const step of proposal.plan.steps.slice(proposal.next_step)) {
      const capability = commandCapability(step.domain, step.operation);
      if (!hasCapability(session.capabilities, capability) && !(step.domain === "studio" && ["save", "rename"].includes(step.operation) && hasCapability(session.capabilities, "tenant.studio.edit_all"))) throw Error("Je rechten zijn gewijzigd. Er is geen nieuwe stap uitgevoerd; laat een bevoegde beheerder het voorstel opnieuw beoordelen.");
    }
  }
  const decision = await client.rpc("decide_ai_proposal_v1", { p_proposal_id: id, p_plan_hash: hash, p_approve: approve });
  if (decision.error) throw Error("Het akkoord kon niet bevestigd worden opgeslagen. Controleer de status voordat je opnieuw indient.");
  proposal = decision.data as AgentProposal;
  if (!approve) return proposal;
  for (let count = 0; count < proposal.plan.steps.length; count++) {
    if (["completed", "cancelled", "review_required"].includes(proposal.status)) break;
    const step = proposal.plan.steps[proposal.next_step];
    if (!step) break;
    if (step.domain === "playlist" && step.operation !== "create" || step.domain === "schedule") {
      const payload = step.args.payload as Record<string, unknown>;
      const reach = step.domain === "playlist"
        ? await client.rpc("get_ai_playlist_reach_v1", { p_playlist_id: step.args.id })
        : await client.rpc("get_ai_target_screens_v1", { p_tenant_id: session.tenantId, p_target_kind: payload.targetKind ?? step.args.targetKind, p_target_id: payload.targetId || step.args.targetId || null });
      if (reach.error || !Array.isArray(reach.data)) throw Error("De actuele gevolgen voor gekoppelde schermen konden niet worden bevestigd. Er is geen nieuwe stap uitgevoerd; controleer de status en probeer opnieuw.");
      const actual = new Set((reach.data as AgentStep["affectedScreens"]).map(screen => screen.id));
      if (step.operation === "publish") for (const screenId of step.args.screenIds as string[]) actual.add(screenId);
      const shown = new Set(step.affectedScreens.map(screen => screen.id));
      if (actual.size !== shown.size || [...actual].some(screenId => !shown.has(screenId))) throw Error("De gekoppelde schermen, groepen, zones of planning zijn sinds dit voorstel gewijzigd. Er is geen nieuwe stap uitgevoerd; controleer een aangepast voorstel vóór nieuw akkoord.");
    }
    let needsExecutionCheck = false;
    if (step.domain === "playlist" && step.operation === "publish") {
      const checked = await checkPlaylistPublication({ tenantId: session.tenantId, playlistId: String(step.args.id), revision: Number(step.args.revision), screenIds: step.args.screenIds as string[] });
      const labels: Record<string, string> = { SCREEN_DISABLED: "scherm uitgeschakeld", SCREEN_MAINTENANCE: "onderhoudsmodus", DEVICE_MISSING: "Player niet gekoppeld", HEARTBEAT_MISSING: "heartbeat ontbreekt", HEARTBEAT_STALE: "heartbeat verouderd", MANIFEST_INCOMPATIBLE: "manifest incompatibel", MANIFEST_COMPATIBILITY_UNKNOWN: "compatibiliteit onbekend", STORAGE_UNKNOWN: "opslag onbekend", STORAGE_INSUFFICIENT: "opslag onvoldoende", STORAGE_MARGIN_LOW: "weinig opslagmarge" };
      const messages = checked.targets.filter(target => ["warning", "unknown"].includes(target.preflight.status)).map(target => `${target.screen.name}: ${target.preflight.reasons.map(reason => labels[reason] ?? "onbekende controle").join(", ")}.`);
      if (proposal.plan.steps.slice(0, proposal.next_step).some(previous => previous.domain === "playlist" && (previous.args.id === step.args.id || previous.args.newId === step.args.id))) messages.unshift("De voorafgaande playlistwijzigingen zijn nu bevestigd opgeslagen. Controleer eerst het vernieuwde werkelijke publicatievoorbeeld en bevestig deze afzonderlijke publicatiestap.");
      requireRiskConfirmation(proposal, messages, acceptedRiskHash);
      needsExecutionCheck = true;
    }
    if (step.domain === "schedule" && ["create", "update", "enable"].includes(step.operation)) {
      let payload = step.args.payload as Record<string, unknown>;
      if (step.operation === "enable") {
        const stored = await client.from("content_schedules").select("starts_at,ends_at,target_kind,target_screen_id,target_screen_group_id,timezone_name,schedule_kind,recurrence_json").eq("tenant_id", session.tenantId).eq("id", step.args.id).single();
        if (stored.error) throw Error("De planningsregel kon niet opnieuw gecontroleerd worden. Er is niets ingeschakeld.");
        payload = { startsAt: stored.data.starts_at, endsAt: stored.data.ends_at, targetKind: stored.data.target_kind, targetId: stored.data.target_screen_id ?? stored.data.target_screen_group_id ?? "", timezoneName: stored.data.timezone_name, scheduleKind: stored.data.schedule_kind, recurrence: stored.data.recurrence_json };
      }
      const checked = await checkScheduleConflicts({ startsAtIso: String(payload.startsAt), endsAtIso: payload.endsAt ? String(payload.endsAt) : null, targetKind: payload.targetKind as "screen" | "screen_group", targetId: String(payload.targetId), timezoneName: String(payload.timezoneName ?? session.timezoneName), scheduleKind: payload.scheduleKind as "once", recurrence: payload.recurrence as Record<string, unknown>, excludeScheduleId: step.args.id ? String(step.args.id) : null });
      if (checked.error) throw Error("De planning kon niet volledig gecontroleerd worden. Open Planning en beoordeel de betrokken schermen; er is geen planningsstap uitgevoerd.");
      requireRiskConfirmation(proposal, checked.conflicts.map(conflict => `${conflict.screenName}: conflict met ${conflict.scheduleName}, ${conflict.startsAt} tot ${conflict.endsAt ?? "onbepaald"} (${session.timezoneName}).`), acceptedRiskHash);
      needsExecutionCheck = true;
    }
    await requireAgentActor();
    if (needsExecutionCheck) {
      const proof = await createControlAdminClient().rpc("register_ai_execution_check_v1", { p_proposal_id: id, p_plan_hash: hash, p_expected_step: proposal.next_step, p_actor_id: session.userId, p_tenant_id: session.tenantId });
      if (proof.error || proof.data !== true) throw Error("De actuele publicatiecontrole kon niet aan dit akkoord worden gekoppeld. Er is geen nieuwe stap uitgevoerd.");
    }
    const executed = await client.rpc("execute_ai_proposal_step_v1", { p_proposal_id: id, p_plan_hash: hash, p_expected_step: proposal.next_step });
    if (executed.error || !executed.data) throw Error("De stapbevestiging ontbreekt. Het oorspronkelijke voorstel en bevestigde stappen blijven behouden; hervat dezelfde opdracht.");
    proposal = executed.data as AgentProposal;
    if (proposal.status === "failed") break;
  }
  return proposal;
}
