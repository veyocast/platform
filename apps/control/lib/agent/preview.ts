import "server-only";

import { requireAgentActor } from "./access";
import type { AgentProposal } from "./catalog";
import { loadPlaylistStudio } from "../../app/(shell)/dashboard/playlists/data";
import { loadPublicationMediaPreview } from "../../app/(shell)/dashboard/playlists/publish-media-frame-preview.server";
import { parseStudioDocument, studioDocumentAssetIds } from "@veyocast/studio";
import { createControlAdminClient } from "../supabase/admin";
import type { AgentAttachment } from "./catalog";

export async function readAgentStudioPreviewAssets(proposalId: string, stepIndex: number): Promise<AgentAttachment[]> {
  const { session, client } = await requireAgentActor("tenant.studio.read");
  await requireAgentActor("tenant.media.read");
  const stored = await client.from("ai_proposals").select("*").eq("id", proposalId).eq("tenant_id", session.tenantId).eq("user_id", session.userId).single();
  if (stored.error || !stored.data || !Number.isSafeInteger(stepIndex)) throw Error("Het eigen ontwerpvoorstel kon niet worden bevestigd.");
  const proposal = stored.data as AgentProposal, step = proposal.plan.steps[stepIndex];
  if (!step || step.domain !== "studio") throw Error("Deze stap heeft geen Studio-voorbeeld.");
  const ids = studioDocumentAssetIds(parseStudioDocument(step.args.document));
  if (!ids.length) return [];
  const owned = await client.from("ai_attachments").select("id").eq("tenant_id", session.tenantId).eq("conversation_id", proposal.conversation_id).eq("user_id", session.userId).in("id", ids);
  const ordinary = await client.from("media_assets").select("id").eq("tenant_id", session.tenantId).eq("status", "ready").is("deleted_at", null).in("id", ids);
  if (owned.error || ordinary.error) throw Error("De originele ontwerpmedia konden niet veilig bevestigd worden.");
  const authorized = new Set([...owned.data, ...ordinary.data].map(asset => asset.id));
  if (ids.some(id => !authorized.has(id))) throw Error("Een ontwerpafbeelding is niet toegankelijk in dit gesprek. Er wordt geen onvolledig voorbeeld als gereed getoond.");
  const admin = createControlAdminClient();
  const assets = await admin.from("media_assets").select("id,title,kind,width,height,storage_path").eq("tenant_id", session.tenantId).eq("status", "ready").is("deleted_at", null).in("id", ids);
  const variants = await admin.from("media_variants").select("asset_id,storage_bucket,storage_path,variant_type").eq("tenant_id", session.tenantId).in("asset_id", ids).in("variant_type", ["original", "player_1080p", "thumbnail", "poster"]);
  if (assets.error || variants.error || assets.data.length !== ids.length) throw Error("De ontwerpmedia zijn nog niet gereed. Wacht op verwerking of herstel het voorstel.");
  const safe = variants.data.filter(variant => variant.storage_bucket === "tenant-media" && variant.storage_path.startsWith(`tenants/${session.tenantId}/assets/${variant.asset_id}/`));
  const paths = [...new Set(safe.map(variant => variant.storage_path))];
  const signed = await admin.storage.from("tenant-media").createSignedUrls(paths, 600);
  if (signed.error) throw Error("De beveiligde originele ontwerpafbeeldingen konden niet geopend worden.");
  const urls = new Map((signed.data ?? []).flatMap(item => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  return assets.data.map(asset => {
    const source = safe.find(variant => variant.asset_id === asset.id && variant.variant_type === (asset.kind === "video" ? "player_1080p" : "original"));
    const thumbnail = safe.find(variant => variant.asset_id === asset.id && ["thumbnail", "poster"].includes(variant.variant_type));
    const sourceUrl = source ? urls.get(source.storage_path) ?? null : null;
    if (!sourceUrl) throw Error("Een origineel ontwerpbeeld is niet bevestigd beschikbaar. Er wordt geen leeg voorbeeld als gereed getoond.");
    return { id: asset.id, title: asset.title, status: "ready", kind: asset.kind as "image" | "video", width: asset.width, height: asset.height, sourceUrl, previewUrl: thumbnail ? urls.get(thumbnail.storage_path) ?? sourceUrl : sourceUrl, retained: !owned.data.some(attachment => attachment.id === asset.id) };
  });
}

export async function readAgentPlaylistPreview(proposalId: string, stepIndex: number) {
  const { session, client } = await requireAgentActor("tenant.playlist.read");
  const stored = await client.from("ai_proposals").select("*").eq("id", proposalId).eq("tenant_id", session.tenantId).eq("user_id", session.userId).single();
  if (stored.error || !stored.data || !Number.isSafeInteger(stepIndex)) throw Error("Het eigen voorstel kon niet worden bevestigd.");
  const proposal = stored.data as AgentProposal;
  const step = proposal.plan.steps[stepIndex];
  if (!step || step.domain !== "playlist" || step.operation !== "publish") throw Error("Deze stap heeft geen playlistvoorbeeld.");
  if (proposal.plan.steps.slice(proposal.next_step, stepIndex).some(previous => previous.domain === "playlist" && previous.args.id === step.args.id)) throw Error("Dit voorstel bevat voorafgaande playlistwijzigingen. Controleer die stappen en bekijk na hun bevestigde opslag het vernieuwde publicatievoorbeeld vóór afzonderlijke publicatie.");
  const studio = await loadPlaylistStudio(session.tenantId, String(step.args.id), false);
  if (!studio.playlist || studio.playlist.revision !== Number(step.args.revision)) throw Error("Het concept is gewijzigd of nog niet aangemaakt. Controleer het vernieuwde voorstel; dit is geen betrouwbaar publicatievoorbeeld.");
  const result = await loadPublicationMediaPreview(session.tenantId, studio.items, new Set(studio.sections.filter(section => section.enabled).map(section => section.id)));
  return result.previewItems;
}
