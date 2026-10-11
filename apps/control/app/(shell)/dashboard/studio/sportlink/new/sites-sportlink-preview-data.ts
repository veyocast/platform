import "server-only";
import { createHash } from "node:crypto";
import { playerDynamicTemplateAssetSchema, playerDynamicTemplatePayloadSchema, type PlayerDynamicTemplateAsset, type PlayerDynamicTemplatePayload, type SitesDynamicConfiguration } from "@veyocast/contracts";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { createControlAdminClient } from "../../../../../../lib/supabase/admin";
export async function loadCanonicalSitesSportlinkPreview({sourceId,name,templateVersionId,orientation,configuration,expectedSlideType}:{sourceId:string;name:string;templateVersionId:string;orientation:"landscape"|"portrait";configuration:Record<string,unknown>;expectedSlideType?:string}):Promise<{ok:true;payload:PlayerDynamicTemplatePayload}|{ok:false;message:string}>{
 const session=await requireTenantControlSession("tenant.dynamic_slide.write");
 try {
 const supabase=await createControlSupabaseClient();
 if(!supabase||!session.tenantId)return {ok:false,message:"Het schermvoorbeeld is tijdelijk niet beschikbaar. Je ontwerp blijft behouden. Probeer opnieuw."};
  const background = (configuration.sitesConfiguration as SitesDynamicConfiguration | undefined)?.background;
  if (background?.kind === "tenant") {
    const [asset, original] = await Promise.all([
      supabase.from("media_assets").select("id").eq("tenant_id", session.tenantId).eq("id", background.mediaAssetId).eq("kind", "image").eq("status", "ready").is("deleted_at", null).maybeSingle(),
      supabase.from("media_variants").select("asset_id").eq("tenant_id", session.tenantId).eq("asset_id", background.mediaAssetId).eq("variant_type", "original").eq("checksum_sha256", background.checksumSha256).maybeSingle()
    ]);
    if (asset.error || original.error || !asset.data || !original.data) return { ok: false, message: "Je gekozen achtergrond is niet meer beschikbaar. Kies een foto uit je mediabibliotheek en probeer opnieuw." };
  }
  const { data, error } = await supabase.rpc("preview_dynamic_slide_v1", { p_tenant_id: session.tenantId, p_name: name, p_template_version_id: templateVersionId, p_data_source_id: sourceId, p_configuration_json: configuration });
  if (error || !data || typeof data !== "object") return { ok: false, message: "Het schermvoorbeeld kon niet worden geladen. Je bron en ontwerpen blijven behouden. Controleer de bronstatus en probeer opnieuw." };
  if (expectedSlideType && data.slideType !== expectedSlideType) return { ok: false, message: "Dit template hoort bij een andere familie. Kies de juiste familie en probeer opnieuw." };
  if (data.orientation !== orientation) return { ok: false, message: "Dit template past niet bij je schermformaat. Kies een beschikbaar formaat en probeer opnieuw." };
  const snapshot: unknown = data.data;
  const ids = new Set<string>();
  const pending: unknown[] = [snapshot]; let scanned = 0;
  while (pending.length && scanned++ < 10_000) {
    const node = pending.pop();
    if (Array.isArray(node)) { pending.push(...node); continue; }
    if (!node || typeof node !== "object") continue;
    for (const [key, item] of Object.entries(node)) {
      if (typeof item === "string" && /(?:mediaAssetId|assetId|logoMediaAssetId|photoMediaAssetId|providerAssetVersionId|logoAssetVersionId|photoAssetVersionId)$/i.test(key) && /^[0-9a-f-]{36}$/i.test(item)) ids.add(item);
      else if (item && typeof item === "object") pending.push(item);
    }
  }
  if (ids.size > 201 || pending.length) return { ok: false, message: "Het schermvoorbeeld bevat te veel media. Kies een kleinere selectie en probeer opnieuw." };
  const assets: Record<string, PlayerDynamicTemplateAsset> = {};
  if (ids.size) {
    const [variants, kinds] = await Promise.all([
      supabase.from("media_variants").select("asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256").eq("tenant_id", session.tenantId).in("asset_id", [...ids]).in("variant_type", ["original", "player_1080p"]),
      supabase.from("media_assets").select("id,kind").eq("tenant_id", session.tenantId).in("id", [...ids]).eq("status", "ready").is("deleted_at", null)
    ]);
    const byId = new Map((kinds.data ?? []).map(asset => [asset.id, asset.kind]));
    await Promise.all((variants.data ?? []).filter(variant => variant.variant_type === (byId.get(variant.asset_id) === "video" ? "player_1080p" : "original")).map(async variant => {
      if (!byId.has(variant.asset_id)) return;
      const url = await supabase.storage.from(variant.storage_bucket).createSignedUrl(variant.storage_path, 600);
      const parsed = playerDynamicTemplateAssetSchema.safeParse({ bytes: Number(variant.file_size_bytes), checksumSha256: variant.checksum_sha256, mimeType: variant.mime_type, url: url.data?.signedUrl });
      if (parsed.success) assets[variant.asset_id] = parsed.data;
    }));
    const missing = [...ids].filter(id => !byId.has(id));
    if (missing.length) {
      const admin = createControlAdminClient();
      const provider = await admin.from("provider_asset_versions").select("id,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256").eq("storage_bucket", "provider-assets").in("id", missing);
      await Promise.all((provider.data ?? []).map(async variant => {
        const url = await admin.storage.from(variant.storage_bucket).createSignedUrl(variant.storage_path, 600);
        const parsed = playerDynamicTemplateAssetSchema.safeParse({ bytes: Number(variant.file_size_bytes), checksumSha256: variant.checksum_sha256, mimeType: variant.mime_type, url: url.data?.signedUrl });
        if (parsed.success) assets[variant.id] = parsed.data;
      }));
    }
  }
  const payload = playerDynamicTemplatePayloadSchema.safeParse({ assets, data: snapshot, orientation: data.orientation, schemaVersion: 1, slideType: data.slideType, snapshotHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), snapshotId: data.previewId, templateSlug: data.templateSlug, templateVersionId: data.templateVersionId });
  return payload.success ? { ok: true, payload: payload.data } : { ok: false, message: "De opgeslagen gegevens leveren nog geen geldig schermvoorbeeld. Controleer je bronstatus en probeer opnieuw." };
  } catch {
    return { ok: false, message: "Het schermvoorbeeld is tijdelijk niet bereikbaar. Je gegevens en ontwerpen blijven behouden. Probeer opnieuw." };
  }
}
