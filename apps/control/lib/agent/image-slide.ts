import "server-only";

import { createEmptyStudioDocument, layoutStudioText, parseStudioDocument, studioPalette, type StudioElement } from "@veyocast/studio";
import { requireAgentActor } from "./access";
import { createControlAdminClient } from "../supabase/admin";
import { prepareAgentProposal } from "./proposals";

export type ImageSlideInput = { conversationId: string; assetId: string; name: string; title: string; body: string; orientation: "landscape" | "portrait"; fit: "contain" | "cover"; logoId?: string };

export async function prepareImageSlide(input: ImageSlideInput) {
  const { session, client } = await requireAgentActor("tenant.studio.create");
  if (input.name.trim().length < 2 || input.name.length > 120 || input.title.length > 240 || input.body.length > 4000 || !["landscape", "portrait"].includes(input.orientation) || !["contain", "cover"].includes(input.fit)) throw Error("De naam, tekst of het formaat is ongeldig. Controleer het ontwerp; er is niets opgeslagen.");
  const steps: Array<{ domain: string; operation: string; args: Record<string, unknown> }> = [];
  for (const assetId of new Set([input.assetId, ...(input.logoId ? [input.logoId] : [])])) {
    const owned = await client.from("ai_attachments").select("id,retained").eq("id", assetId).eq("conversation_id", input.conversationId).eq("tenant_id", session.tenantId).eq("user_id", session.userId).maybeSingle();
    if (owned.error) throw Error("De eigen bijlage kon niet worden bevestigd.");
    const reader = owned.data ? createControlAdminClient() : client;
    const asset = await reader.from("media_assets").select("id,kind,status,deleted_at").eq("id", assetId).eq("tenant_id", session.tenantId).single();
    if (asset.error || asset.data.kind !== "image" || asset.data.status !== "ready" || asset.data.deleted_at) throw Error("De gekozen afbeelding of het originele logo is niet gereed in deze vereniging. Herstel de bijlage voordat je verdergaat.");
    if (owned.data && !owned.data.retained) steps.push({ domain: "attachment", operation: "retain", args: { id: assetId } });
  }
  const document = createEmptyStudioDocument(input.orientation === "portrait" ? "portrait-hd" : "landscape-hd", { background: studioPalette.paperWhite });
  const width = document.artboard.width, height = document.artboard.height;
  const hasCaption = Boolean(input.title.trim() || input.body.trim());
  const photoHeight = hasCaption ? height * 0.7 : height;
  const elements: StudioElement[] = [{ id: "agent-image", name: "Gekozen afbeelding", type: "image", mediaAssetId: input.assetId, variant: "original", objectFit: input.fit, x: 0, y: 0, width, height: photoHeight, zIndex: 0, rotation: 0, opacity: 1, visible: true, locked: false, focusX: 0.5, focusY: 0.5, cornerRadius: 0, alt: input.name }];
  if (input.title.trim()) elements.push({ id: "agent-title", name: "Exacte titel", type: "text", text: input.title, x: width * 0.05, y: photoHeight + height * 0.025, width: width * 0.9, height: height * 0.08, zIndex: 1, fontFamily: "Roboto", fontWeight: 700, fontSize: Math.round(width * 0.035), fill: studioPalette.inkBlack, lineHeight: 1.1, letterSpacing: 0, align: "left", verticalAlign: "top", autoFit: false, cornerRadius: 0, padding: 0, rotation: 0, opacity: 1, visible: true, locked: false });
  if (input.body.trim()) elements.push({ id: "agent-body", name: "Exacte datum, tijd en toelichting", type: "text", text: input.body, x: width * 0.05, y: photoHeight + height * 0.12, width: width * 0.9, height: height * 0.14, zIndex: 2, fontFamily: "Roboto", fontWeight: 400, fontSize: Math.round(width * 0.022), fill: studioPalette.inkBlack, lineHeight: 1.2, letterSpacing: 0, align: "left", verticalAlign: "top", autoFit: false, cornerRadius: 0, padding: 0, rotation: 0, opacity: 1, visible: true, locked: false });
  if (input.logoId) elements.push({ id: "agent-logo", name: "Origineel logo", type: "image", mediaAssetId: input.logoId, variant: "original", objectFit: "contain", x: width * 0.78, y: height * 0.03, width: width * 0.18, height: height * 0.15, zIndex: 3, rotation: 0, opacity: 1, visible: true, locked: false, focusX: 0.5, focusY: 0.5, cornerRadius: 0, alt: "Origineel logo" });
  const checked = parseStudioDocument({ ...document, elements });
  for (const element of checked.elements) {
    if (element.type !== "text") continue;
    const full = layoutStudioText({ ...element, height: Number.MAX_SAFE_INTEGER });
    if (full.lines.length * full.lineHeightPx > element.height - element.padding * 2) throw Error("De exacte tekst past niet in het leesvlak. Er is niets opgeslagen of weggelaten; kort de tekst in of pas de indeling in Studio aan.");
  }
  steps.push({ domain: "studio", operation: "create", args: { name: input.name.trim(), orientation: input.orientation, document: checked } });
  return prepareAgentProposal(input.conversationId, { steps });
}
