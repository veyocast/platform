import {collectSyncSportMediaAssetIds} from '@veyocast/contracts';
import "server-only";
import {playerDynamicTemplateAssetSchema,type PlayerDynamicTemplateAsset} from "@veyocast/contracts";
import type {createControlSupabaseClient} from "./supabase/server";
import {createControlAdminClient} from "./supabase/admin";

/** IDs must originate in the already authorized canonical snapshot, never raw browser input. */
export function collectPreviewMediaAssetIds(snapshot: Record<string, unknown>) {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && uuidPattern.test(value)) ids.add(value);
  };
  const brand = isRecord(snapshot.brand) ? snapshot.brand : null;
  add(brand?.logoMediaAssetId);
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  if (Array.isArray(menu?.products)) {
    for (const candidate of menu.products.slice(0, 40)) {
      const product = isRecord(candidate) ? candidate : null;
      add(product?.imageMediaAssetId);
    }
  }
  const priceList = isRecord(snapshot.priceList) ? snapshot.priceList : null;
  if (Array.isArray(priceList?.sections)) {
    for (const sectionCandidate of priceList.sections.slice(0, 40)) {
      const section = isRecord(sectionCandidate) ? sectionCandidate : null;
      if (!Array.isArray(section?.products)) continue;
      for (const productCandidate of section.products.slice(0, 100)) {
        const product = isRecord(productCandidate) ? productCandidate : null;
        if (product?.photoVisible === true) add(product.imageMediaAssetId);
      }
    }
  }
  const menuDocument = isRecord(snapshot.menuDocument) ? snapshot.menuDocument : null;
  if (Array.isArray(menuDocument?.assets)) {
    for (const candidate of menuDocument.assets.slice(0, 100)) {
      const asset = isRecord(candidate) ? candidate : null;
      add(asset?.assetId);
    }
  }
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  add(news?.providerLogoMediaAssetId);
  if (Array.isArray(news?.articles)) {
    for (const candidate of news.articles.slice(0, 50)) {
      const article = isRecord(candidate) ? candidate : null;
      add(article?.heroMediaAssetId);
      add(article?.qrMediaAssetId);
    }
  }
  const sport = isRecord(snapshot.sport) ? snapshot.sport : null;
  const arrivalConfig = isRecord(sport?.arrivalConfig) ? sport.arrivalConfig : null;
  if (arrivalConfig?.showSponsor === true) add(arrivalConfig.sponsorMediaAssetId);
  if (Array.isArray(sport?.items)) {
    for (const candidate of sport.items.slice(0, 100)) {
      const item = isRecord(candidate) ? candidate : null;
      add(item?.logoMediaAssetId);
      add(item?.homeLogoMediaAssetId);
      add(item?.awayLogoMediaAssetId);
      add(item?.photoMediaAssetId);
    }
  }
  for(const id of collectSyncSportMediaAssetIds(snapshot))ids.add(id);
  return [...ids];
}

export async function loadPreviewAssets(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  mediaAssetIds: string[]
) {
  const assets = new Map<string, PlayerDynamicTemplateAsset>();
  if (!mediaAssetIds.length) return assets;
  const variants = await supabase
    .from("media_variants")
    .select("asset_id, variant_type, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
    .eq("tenant_id", tenantId)
    .in("variant_type", ["original", "player_1080p"])
    .in("asset_id", mediaAssetIds);
  if (variants.error) return assets;
  const assetKinds = await supabase
    .from("media_assets")
    .select("id, kind")
    .eq("tenant_id", tenantId)
    .in("id", mediaAssetIds);
  if (assetKinds.error) return assets;
  const kindById = new Map((assetKinds.data ?? []).map((asset) => [asset.id, asset.kind]));
  const tenantAssetIds = new Set((assetKinds.data ?? []).map((asset) => asset.id));
  const providerAssetIds = mediaAssetIds.filter((id) => !tenantAssetIds.has(id));
  const preferred = (variants.data ?? []).filter((variant) =>
    kindById.get(variant.asset_id) === "video"
      ? variant.variant_type === "player_1080p"
      : variant.variant_type === "original"
  );
  await Promise.all(preferred.map(async (variant) => {
    const signed = await supabase.storage
      .from(variant.storage_bucket)
      .createSignedUrl(variant.storage_path, 600);
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(variant.file_size_bytes),
      checksumSha256: variant.checksum_sha256,
      mimeType: variant.mime_type,
      url: signed.data?.signedUrl
    });
    if (parsed.success) assets.set(variant.asset_id, parsed.data);
  }));
  if (providerAssetIds.length) {
    const admin = createControlAdminClient();
    const providers = await admin
      .from("provider_asset_versions")
      .select("id, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
      .eq("storage_bucket", "provider-assets")
      .in("id", providerAssetIds);
    if (!providers.error) {
      await Promise.all((providers.data ?? []).map(async (provider) => {
        const signed = await admin.storage
          .from("provider-assets")
          .createSignedUrl(provider.storage_path, 600);
        const parsed = playerDynamicTemplateAssetSchema.safeParse({
          bytes: Number(provider.file_size_bytes),
          checksumSha256: provider.checksum_sha256,
          mimeType: provider.mime_type,
          url: signed.data?.signedUrl
        });
        if (!signed.error && parsed.success) assets.set(provider.id, parsed.data);
      }));
    }
  }
  return assets;
}


const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null;}
