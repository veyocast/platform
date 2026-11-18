import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { requireAgentActor } from "./access";
import { createControlAdminClient } from "../supabase/admin";
import { uploadValidatedImageCandidate } from "../media/validated-image-upload";
import { callAiProvider } from "./provider";
import { validateImageUploadFile, imageUploadPolicyMessage } from "../media/image-upload-policy";

import type { AgentAttachment } from "./catalog";

export async function uploadAgentImage(conversationId: string, candidate: FormDataEntryValue | null, title: string, attachmentId: string = randomUUID()) {
  const { session, client } = await requireAgentActor("tenant.media.write");
  if (!(candidate instanceof File)) throw Error("Kies een geldige afbeelding voor dit gesprek.");
  const policyFailure = validateImageUploadFile(candidate);
  if (policyFailure) throw Error(imageUploadPolicyMessage(policyFailure));
  const signature = createHash("sha256").update(Buffer.from(await candidate.arrayBuffer())).update(`\u0000${candidate.name}\u0000${title}`).digest("hex");
  const reserved = await client.rpc("reserve_ai_attachment_v1", { p_conversation_id: conversationId, p_attachment_id: attachmentId, p_source_signature: signature });
  if (reserved.error || reserved.data !== attachmentId) throw Error("De privébijlage kon niet veilig aan dit gesprek worden gekoppeld. Er is geen bestand opgeslagen.");
  const admin = createControlAdminClient();
  const existing = await admin.from("media_assets").select("id,status").eq("tenant_id", session.tenantId).eq("id", attachmentId).maybeSingle();
  if (existing.error) throw Error("De eerdere uploadstatus kon niet worden gecontroleerd. Behoud het bestand en probeer opnieuw.");
  if (existing.data) {
    if (existing.data.status === "ready") {
      const recorded = await admin.rpc("complete_ai_attachment_v1", { p_attachment_id: attachmentId, p_tenant_id: session.tenantId, p_actor_id: session.userId });
      if (recorded.error || recorded.data !== true) throw Error("De eerdere upload kon niet bevestigd worden afgerond. Het bestand blijft privé; probeer dezelfde bijlage opnieuw.");
      return attachmentId;
    }
    throw Error("De eerdere upload is nog niet gereed of is mislukt. Controleer de bijlagestatus; start niet blind een dubbele upload.");
  }
  const uploaded = await uploadValidatedImageCandidate({ candidate, supabase: client, tenantId: session.tenantId, userId: session.userId, title, reservedAssetId: attachmentId });
  const recorded = await admin.rpc("complete_ai_attachment_v1", { p_attachment_id: uploaded.assetId, p_tenant_id: session.tenantId, p_actor_id: session.userId });
  if (recorded.error || recorded.data !== true) throw Error("De bijlage is ontvangen, maar de afronding is niet bevestigd. Het bestand blijft privé en wordt niet gepubliceerd; controleer de status.");
  return uploaded.assetId;
}

export async function readAgentAttachments(conversationId: string): Promise<AgentAttachment[]> {
  const { session, client } = await requireAgentActor("tenant.media.read");
  const owned = await client.from("ai_attachments").select("id,retained").eq("tenant_id", session.tenantId).eq("user_id", session.userId).eq("conversation_id", conversationId).order("created_at");
  if (owned.error) throw Error("De privébijlagen konden niet worden gelezen. Er is niets bewaard of gepubliceerd.");
  if (!owned.data.length) return [];
  const admin = createControlAdminClient();
  const assets = await admin.from("media_assets").select("id,title,status,kind,width,height,storage_bucket,storage_path").eq("tenant_id", session.tenantId).is("deleted_at", null).in("id", owned.data.map(attachment => attachment.id));
  if (assets.error) throw Error("De actuele verwerking van de privébijlagen kon niet worden bevestigd.");
  const variants = await admin.from("media_variants").select("asset_id,storage_bucket,storage_path,variant_type").eq("tenant_id", session.tenantId).in("asset_id", assets.data.map(asset => asset.id)).in("variant_type", ["thumbnail", "poster", "player_1080p"]);
  if (variants.error) throw Error("De veilige previews konden niet worden gelezen.");
  const safePath = (assetId: string, bucket: string, path: string) => bucket === "tenant-media" && path.startsWith(`tenants/${session.tenantId}/assets/${assetId}/`);
  const paths = new Set<string>();
  for (const asset of assets.data) {
    if (asset.status === "ready" && asset.kind === "image" && safePath(asset.id, asset.storage_bucket, asset.storage_path)) paths.add(asset.storage_path);
  }
  for (const variant of variants.data) if (safePath(variant.asset_id, variant.storage_bucket, variant.storage_path)) paths.add(variant.storage_path);
  const signed = paths.size ? await admin.storage.from("tenant-media").createSignedUrls([...paths], 600) : null;
  if (signed?.error) throw Error("De privépreviews konden niet veilig worden geopend. Er is niets gepubliceerd.");
  const urls = new Map((signed?.data ?? []).flatMap(item => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  return assets.data.map(asset => {
    const variant = variants.data.find(item => item.asset_id === asset.id && ["thumbnail", "poster"].includes(item.variant_type));
    const video = variants.data.find(item => item.asset_id === asset.id && item.variant_type === "player_1080p");
    const sourceUrl = asset.status === "ready" ? urls.get(asset.kind === "image" ? asset.storage_path : video?.storage_path ?? "") ?? null : null;
    return { id: asset.id, title: asset.title, status: asset.status, kind: asset.kind as "image" | "video", width: asset.width, height: asset.height, previewUrl: variant ? urls.get(variant.storage_path) ?? sourceUrl : sourceUrl, sourceUrl, retained: owned.data.find(attachment => attachment.id === asset.id)!.retained };
  });
}

export async function generateAgentImage(input: { conversationId: string; prompt: string; title: string; orientation: "landscape" | "portrait"; referenceId?: string }) {
  if (!input.prompt.trim() || input.prompt.length > 4000 || input.title.trim().length < 2 || input.title.length > 120 || !["landscape", "portrait"].includes(input.orientation)) throw Error("Vul een beeldopdracht tot 4000 tekens, een titel van 2–120 tekens en een geldig schermformaat in.");
  const actor = await requireAgentActor("tenant.media.write");
  await requireAgentActor("tenant.media.read");
  const conversation = await actor.client.from("ai_conversations").select("id").eq("id", input.conversationId).eq("tenant_id", actor.session.tenantId).eq("user_id", actor.session.userId).single();
  if (conversation.error || !conversation.data) throw Error("Dit gesprek hoort niet bij de actieve gebruiker en vereniging. Er is geen betaalde aanvraag gestart.");
  const size = input.orientation === "portrait" ? "1024x1536" : "1536x1024";
  let body: Record<string, unknown> | FormData = { prompt: input.prompt, size, quality: "low", n: 1, output_format: "png" };
  if (input.referenceId) {
    const { session, client } = await requireAgentActor("tenant.media.read");
    const owned = await client.from("ai_attachments").select("id").eq("id", input.referenceId).eq("conversation_id", input.conversationId).eq("user_id", session.userId).eq("tenant_id", session.tenantId).maybeSingle();
    if (owned.error || !owned.data) throw Error("De ingezonden bronafbeelding hoort niet bij dit gesprek. Kies een eigen privébijlage.");
    const admin = createControlAdminClient();
    const asset = await admin.from("media_assets").select("storage_bucket,storage_path,mime_type,status,kind").eq("tenant_id", session.tenantId).eq("id", input.referenceId).single();
    if (asset.error || asset.data.status !== "ready" || asset.data.kind !== "image" || !["image/png", "image/jpeg", "image/webp"].includes(asset.data.mime_type) || asset.data.storage_bucket !== "tenant-media" || !asset.data.storage_path.startsWith(`tenants/${session.tenantId}/assets/${input.referenceId}/`)) throw Error("De bronafbeelding is nog niet veilig beschikbaar of heeft geen ondersteund PNG-, JPEG- of WebP-formaat. Wacht op Gereed of kies een geschikte afbeelding.");
    const source = await admin.storage.from(asset.data.storage_bucket).download(asset.data.storage_path);
    if (source.error || source.data.size > 50 * 1024 * 1024) throw Error("De bronafbeelding kon niet veilig worden geladen. Er is geen generatie gestart.");
    body = new FormData(); body.set("prompt", input.prompt); body.set("size", size); body.set("quality", "low"); body.set("n", "1"); body.set("output_format", "png"); body.append("image[]", new File([source.data], "bronafbeelding.png", { type: asset.data.mime_type }));
  }
  const response = await callAiProvider({ operationId: randomUUID(), operation: input.referenceId ? "image_edit" : "image_generation", body });
  const image = Array.isArray(response.data) ? (response.data[0] as { b64_json?: unknown } | undefined)?.b64_json : null;
  if (typeof image !== "string" || image.length > 32 * 1024 * 1024 || !/^[A-Za-z0-9+/=]+$/.test(image)) throw Error("De provider gaf geen veilig afbeeldingsresultaat. Er is niets gepubliceerd; de aanvraag kan wel kosten hebben veroorzaakt.");
  const bytes = Buffer.from(image, "base64");
  return uploadAgentImage(input.conversationId, new File([bytes], "gegenereerd-concept.png", { type: "image/png" }), input.title);
}
