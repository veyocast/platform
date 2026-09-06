"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  playerDynamicTemplateAssetSchema,
  playerDynamicTemplatePayloadSchema,
  type PlayerDynamicTemplateAsset,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlAdminClient } from "../../../../lib/supabase/admin";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type SlideResourcePreviewResult =
  | {
      itemCount: number;
      missingAssetCount: number;
      ok: true;
      payload: PlayerDynamicTemplatePayload;
      source: {
        lastErrorCode: string | null;
        lastSuccessfulSyncAt: string | null;
        providerStatus: string;
      };
    }
  | {
      code: string;
      message: string;
      ok: false;
    };

export type SlideArchiveState = {
  archivedCount: number;
  blockedSlideIds: string[];
  draftReferenceCount: number;
  message: string;
  status: "blocked" | "error" | "idle" | "success";
};

export async function archiveSlideResources(
  _previous: SlideArchiveState,
  formData: FormData
): Promise<SlideArchiveState> {
  const slideIds = parseSlideIds(formData.get("slideIds"));
  const override = formData.get("override") === "true";
  if (!slideIds) {
    return archiveError(
      "De selectie is ongeldig. Er is niets verwijderd; wis de selectie en kies de slides opnieuw."
    );
  }
  if (override && formData.get("confirmOverride") !== "on") {
    return archiveError(
      "Bevestig expliciet dat de geblokkeerde slides ook uit conceptplaylists mogen worden verwijderd. Er is niets gewijzigd."
    );
  }

  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    return archiveError(
      "De beveiligde tenantsessie ontbreekt. Er is niets verwijderd; log opnieuw in en probeer het daarna nogmaals."
    );
  }

  const { data, error } = await supabase.rpc("mutate_dynamic_slides_v1", {
    p_idempotency_key: randomUUID(),
    p_operation: "archive",
    p_override: override,
    p_slide_ids: slideIds,
    p_tenant_id: session.tenantId
  });
  if (error || !isRecord(data)) {
    console.error("Dynamische slides archiveren mislukt", {
      code: error?.code ?? "INVALID_RESULT"
    });
    return archiveError(slideArchiveErrorMessage(error?.code));
  }

  const outcome = data.outcome;
  const archivedCount = safeCount(data.archivedCount);
  const draftReferenceCount = safeCount(data.draftReferenceCount);
  const blockedSlideIds = parseReturnedIds(data.blockedSlideIds);
  if (outcome === "blocked") {
    return {
      archivedCount,
      blockedSlideIds,
      draftReferenceCount,
      message: `${blockedSlideIds.length} ${blockedSlideIds.length === 1 ? "slide is" : "slides zijn"} nog gekoppeld aan ${draftReferenceCount} ${draftReferenceCount === 1 ? "conceptplaatsing" : "conceptplaatsingen"}. Er is voor deze slides niets gewijzigd. Kies override alleen als die conceptplaatsingen ook verwijderd mogen worden; immutable releases blijven altijd behouden.`,
      status: "blocked"
    };
  }
  if (outcome !== "applied" && outcome !== "idempotent") {
    return archiveError(
      "De server gaf geen herkenbare bevestiging. Vernieuw de lijst voordat je opnieuw verwijdert."
    );
  }

  revalidatePath("/dashboard/slides");
  revalidatePath("/dashboard/playlists");
  return {
    archivedCount,
    blockedSlideIds: [],
    draftReferenceCount,
    message: override && draftReferenceCount > 0
      ? `${archivedCount} ${archivedCount === 1 ? "slide is" : "slides zijn"} inactief gemaakt en ${draftReferenceCount} ${draftReferenceCount === 1 ? "conceptplaatsing is" : "conceptplaatsingen zijn"} verwijderd. Bestaande releases zijn ongewijzigd.`
      : `${archivedCount} ${archivedCount === 1 ? "slide is" : "slides zijn"} inactief gemaakt. Bestaande releases zijn ongewijzigd.`,
    status: "success"
  };
}

export async function loadSlideResourcePreview(
  slideId: string
): Promise<SlideResourcePreviewResult> {
  const session = await requireTenantControlSession("tenant.dynamic_slide.read");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase || !uuidPattern.test(slideId)) {
    return previewError(
      "PREVIEW_SELECTION_INVALID",
      "De slide of beveiligde tenantsessie is niet meer geldig. Vernieuw de lijst en probeer opnieuw."
    );
  }

  const slideResult = await supabase
    .from("dynamic_slides")
    .select("id,name,orientation,slide_type,current_snapshot_id,current_published_version_id")
    .eq("tenant_id", session.tenantId)
    .eq("id", slideId)
    .maybeSingle();
  if (slideResult.error || !slideResult.data?.current_snapshot_id) {
    return previewError(
      slideResult.error?.code ?? "PREVIEW_NOT_READY",
      "Deze slide heeft nog geen gereedstaande immutable snapshot. Wacht op de verwerking of maak vanuit de slide een nieuwe snapshot."
    );
  }

  const snapshotResult = await supabase
    .from("dynamic_slide_snapshots")
    .select("id,template_version_id,snapshot_data_json,source_revision_hash,status")
    .eq("tenant_id", session.tenantId)
    .eq("id", slideResult.data.current_snapshot_id)
    .maybeSingle();
  const snapshot = snapshotResult.data;
  if (snapshotResult.error || !snapshot || snapshot.status !== "ready" || !isRecord(snapshot.snapshot_data_json)) {
    return previewError(
      snapshotResult.error?.code ?? "PREVIEW_NOT_READY",
      "De huidige snapshot is nog niet bruikbaar. De bestaande slide is niet gewijzigd; controleer de verwerking en probeer later opnieuw."
    );
  }

  const [templateVersionResult, publishedVersionResult] = await Promise.all([
    supabase
      .from("dynamic_template_versions")
      .select("id,template_id")
      .eq("id", snapshot.template_version_id)
      .maybeSingle(),
    slideResult.data.current_published_version_id
      ? supabase
        .from("dynamic_slide_versions")
        .select("orientation,slide_type")
        .eq("tenant_id", session.tenantId)
        .eq("id", slideResult.data.current_published_version_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (templateVersionResult.error || !templateVersionResult.data) {
    return previewError(
      templateVersionResult.error?.code ?? "PREVIEW_TEMPLATE_MISSING",
      "Het gepubliceerde template van deze snapshot kon niet worden geladen. De slide blijft beschikbaar; open de slide om de templateversie te controleren."
    );
  }
  const templateResult = await supabase
    .from("dynamic_templates")
    .select("slug")
    .eq("id", templateVersionResult.data.template_id)
    .maybeSingle();
  if (templateResult.error || !templateResult.data?.slug) {
    return previewError(
      templateResult.error?.code ?? "PREVIEW_TEMPLATE_MISSING",
      "De Player-renderer herkent het template niet. De slide is niet gewijzigd; controleer de templatepublicatie."
    );
  }

  const mediaAssetIds = collectPreviewMediaAssetIds(snapshot.snapshot_data_json);
  const assets = await loadPreviewAssets(supabase, session.tenantId, mediaAssetIds);
  const publishedVersion = publishedVersionResult.data;
  const parsed = playerDynamicTemplatePayloadSchema.safeParse({
    ...(assets.size ? { assets: Object.fromEntries(assets) } : {}),
    data: snapshot.snapshot_data_json,
    orientation: publishedVersion?.orientation ?? slideResult.data.orientation,
    schemaVersion: 1,
    slideType: publishedVersion?.slide_type ?? slideResult.data.slide_type,
    snapshotHash: sha256Pattern.test(snapshot.source_revision_hash)
      ? snapshot.source_revision_hash
      : createHash("sha256").update(JSON.stringify(snapshot.snapshot_data_json)).digest("hex"),
    snapshotId: snapshot.id,
    templateSlug: templateResult.data.slug,
    templateVersionId: snapshot.template_version_id
  });
  if (!parsed.success) {
    console.error("Gepubliceerde slidepreview voldoet niet aan Playercontract", {
      slideId,
      issues: parsed.error.issues.map((issue) => issue.path.join("."))
    });
    return previewError(
      "PREVIEW_PAYLOAD_INVALID",
      "De huidige snapshot voldoet niet aan het Player-previewcontract. De immutable output blijft behouden; publiceer een herstelde slideversie."
    );
  }

  return {
    itemCount: previewItemCount(snapshot.snapshot_data_json),
    missingAssetCount: Math.max(0, mediaAssetIds.length - assets.size),
    ok: true,
    payload: parsed.data,
    source: {
      lastErrorCode: null,
      lastSuccessfulSyncAt: null,
      providerStatus: "published_snapshot"
    }
  };
}

async function loadPreviewAssets(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  mediaAssetIds: string[]
) {
  const assets = new Map<string, PlayerDynamicTemplateAsset>();
  if (!mediaAssetIds.length) return assets;
  const [variants, assetKinds] = await Promise.all([
    supabase
      .from("media_variants")
      .select("asset_id,variant_type,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256")
      .eq("tenant_id", tenantId)
      .in("variant_type", ["original", "player_1080p"])
      .in("asset_id", mediaAssetIds),
    supabase
      .from("media_assets")
      .select("id,kind")
      .eq("tenant_id", tenantId)
      .in("id", mediaAssetIds)
  ]);
  if (variants.error || assetKinds.error) return assets;

  const kindById = new Map((assetKinds.data ?? []).map((asset) => [asset.id, asset.kind]));
  const tenantAssetIds = new Set((assetKinds.data ?? []).map((asset) => asset.id));
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
    if (!signed.error && parsed.success) assets.set(variant.asset_id, parsed.data);
  }));

  const providerAssetIds = mediaAssetIds.filter((id) => !tenantAssetIds.has(id));
  if (providerAssetIds.length) {
    try {
      const admin = createControlAdminClient();
      const providers = await admin
        .from("provider_asset_versions")
        .select("id,storage_path,mime_type,file_size_bytes,checksum_sha256")
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
    } catch (error) {
      console.error("Provider-assets voor slidepreview konden niet worden geladen", {
        message: error instanceof Error ? error.message : "UNKNOWN_ERROR"
      });
    }
  }
  return assets;
}

function collectPreviewMediaAssetIds(snapshot: Record<string, unknown>) {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && uuidPattern.test(value)) ids.add(value);
  };
  const brand = record(snapshot.brand);
  add(brand?.logoMediaAssetId);
  const menu = record(snapshot.menu);
  for (const candidate of array(menu?.products).slice(0, 40)) add(record(candidate)?.imageMediaAssetId);
  const priceList = record(snapshot.priceList);
  for (const sectionCandidate of array(priceList?.sections).slice(0, 40)) {
    for (const productCandidate of array(record(sectionCandidate)?.products).slice(0, 100)) {
      const product = record(productCandidate);
      if (product?.photoVisible === true) add(product.imageMediaAssetId);
    }
  }
  const menuDocument = record(snapshot.menuDocument);
  for (const candidate of array(menuDocument?.assets).slice(0, 100)) add(record(candidate)?.assetId);
  const news = record(snapshot.news);
  add(news?.providerLogoMediaAssetId);
  for (const candidate of array(news?.articles).slice(0, 50)) {
    const article = record(candidate);
    add(article?.heroMediaAssetId);
    add(article?.qrMediaAssetId);
  }
  const sport = record(snapshot.sport);
  const arrivalConfig = record(sport?.arrivalConfig);
  if (arrivalConfig?.showSponsor === true) add(arrivalConfig.sponsorMediaAssetId);
  for (const candidate of array(sport?.items).slice(0, 250)) {
    const item = record(candidate);
    add(item?.logoMediaAssetId);
    add(item?.homeLogoMediaAssetId);
    add(item?.awayLogoMediaAssetId);
    add(item?.photoMediaAssetId);
  }
  return [...ids];
}

function previewItemCount(snapshot: Record<string, unknown>) {
  const sport = record(snapshot.sport);
  if (Array.isArray(sport?.items)) return sport.items.length;
  const menu = record(snapshot.menu);
  if (Array.isArray(menu?.products)) return menu.products.length;
  const menuDocument = record(snapshot.menuDocument);
  if (Array.isArray(menuDocument?.pages)) {
    return menuDocument.pages.reduce<number>((total, pageValue) => {
      const page = record(pageValue);
      return total + array(page?.blocks).reduce<number>((pageTotal, blockValue) => {
        const block = record(blockValue);
        return pageTotal + (block?.type === "product-group" ? 1 : array(block?.productNodes).length);
      }, 0);
    }, 0);
  }
  const priceList = record(snapshot.priceList);
  if (Array.isArray(priceList?.sections)) {
    return priceList.sections.reduce(
      (total, section) => total + array(record(section)?.products).length,
      0
    );
  }
  const news = record(snapshot.news);
  return array(news?.articles).length;
}

function parseSlideIds(value: FormDataEntryValue | null) {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ""));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) return null;
    const unique = [...new Set(parsed)];
    return unique.every((id): id is string => typeof id === "string" && uuidPattern.test(id))
      ? unique
      : null;
  } catch {
    return null;
  }
}

function parseReturnedIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && uuidPattern.test(id))
    : [];
}

function safeCount(value: unknown) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function slideArchiveErrorMessage(code: string | undefined) {
  if (code === "42501") return "Je mag deze slides niet verwijderen. Er is niets gewijzigd; vraag een beheerder om schrijfrechten.";
  if (code === "P0002") return "Minimaal één slide bestaat niet meer binnen deze vereniging. Er is niets gewijzigd; vernieuw de lijst en selecteer opnieuw.";
  if (code === "23505") return "Deze opdracht is al met andere invoer gebruikt. Er is niets dubbel uitgevoerd; start de actie opnieuw.";
  if (code === "22023" || code === "23514") return "De selectie of override is niet geldig. Er is niets verwijderd; vernieuw de lijst en controleer de selectie.";
  return "De slides konden niet veilig worden verwijderd. Er is niets buiten de actieve vereniging gewijzigd; vernieuw de lijst en probeer opnieuw.";
}

function archiveError(message: string): SlideArchiveState {
  return {
    archivedCount: 0,
    blockedSlideIds: [],
    draftReferenceCount: 0,
    message,
    status: "error"
  };
}

function previewError(code: string, message: string): SlideResourcePreviewResult {
  return { code, message, ok: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown) {
  return isRecord(value) ? value : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[0-9a-f]{64}$/i;
