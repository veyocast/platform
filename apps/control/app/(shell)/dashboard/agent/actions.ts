"use server";

import { revalidatePath } from "next/cache";
import { answerAgentMessage, createAgentConversation } from "../../../../lib/agent/conversation";
import { decideAgentProposal, prepareAgentProposal } from "../../../../lib/agent/proposals";
import { generateAgentImage, readAgentAttachments } from "../../../../lib/agent/attachments";
import { requireAgentActor } from "../../../../lib/agent/access";
import type { AgentProposal } from "../../../../lib/agent/catalog";
import { prepareImageSlide, type ImageSlideInput } from "../../../../lib/agent/image-slide";
import { AgentRiskConfirmation } from "../../../../lib/agent/risks";
import { readAgentPlaylistPreview, readAgentStudioPreviewAssets } from "../../../../lib/agent/preview";
import { readAgentPlayerStatus } from "../../../../lib/agent/resources";
import { PlaylistPublicationBlocked } from "../playlists/publication-check.server";

function publicFailure(cause: unknown) {
  if (cause instanceof PlaylistPublicationBlocked) return cause.message;
  return cause instanceof Error && /^(De |Het |Je |Kies |Deze |Dit |OpenAI |Er |Een |Vul |Open |Alleen |Controleer )/.test(cause.message)
    ? cause.message : "De agent kon deze stap niet veilig afronden. Je invoer en bevestigde stappen blijven behouden; controleer de status en probeer opnieuw.";
}

export async function openAgentConversationAction() {
  try { return { ok: true as const, id: await createAgentConversation() }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function readAgentAttachmentsAction(conversationId: string) {
  try { return { ok: true as const, attachments: await readAgentAttachments(conversationId) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function readAgentPlayerStatusAction(screenIds: string[]) {
  try { return { ok: true as const, status: await readAgentPlayerStatus(screenIds) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function generateAgentImageAction(input: { conversationId: string; prompt: string; title: string; orientation: "landscape" | "portrait"; referenceId?: string }) {
  try { return { ok: true as const, id: await generateAgentImage(input) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function prepareImageSlideAction(input: ImageSlideInput) {
  try { return { ok: true as const, proposal: await prepareImageSlide(input) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function sendAgentMessageAction(conversationId: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  try { return { ok: true as const, reply: await answerAgentMessage(conversationId, messages) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function reviseAgentProposalAction(conversationId: string, steps: unknown, replaces?: { id: string; hash: string }) {
  try { return { ok: true as const, proposal: await prepareAgentProposal(conversationId, { steps }, replaces) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function readAgentPlaylistPreviewAction(id: string, stepIndex: number) {
  try { return { ok: true as const, preview: await readAgentPlaylistPreview(id, stepIndex) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function readAgentStudioPreviewAssetsAction(id: string, stepIndex: number) {
  try { return { ok: true as const, assets: await readAgentStudioPreviewAssets(id, stepIndex) }; }
  catch (cause) { return { ok: false as const, error: publicFailure(cause) }; }
}

export async function decideAgentProposalAction(id: string, hash: string, approve: boolean, riskHash: string | null = null) {
  try {
    const proposal = await decideAgentProposal(id, hash, approve, riskHash);
    for (const path of ["/dashboard/agent", "/dashboard/content", "/dashboard/playlists", "/dashboard/screens", "/dashboard/screen-groups", "/dashboard/planning", "/dashboard/publications", "/dashboard/media", "/dashboard/studio"]) revalidatePath(path);
    return { ok: true as const, proposal };
  } catch (cause) {
    let proposal: AgentProposal | undefined;
    try {
      const { session, client } = await requireAgentActor();
      const read = await client.from("ai_proposals").select("*").eq("id", id).eq("tenant_id", session.tenantId).eq("user_id", session.userId).single();
      if (!read.error && read.data) proposal = read.data as AgentProposal;
    } catch { proposal = undefined; }
    return { ok: false as const, error: publicFailure(cause), proposal, risk: cause instanceof AgentRiskConfirmation ? cause.risk : undefined };
  }
}
