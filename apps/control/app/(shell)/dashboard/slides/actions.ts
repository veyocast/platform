"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  editorialFocalPointSchema,
  editorialPriceListConfigurationSchema,
  editorialThemeConfigSchema,
  playerDynamicTemplateAssetSchema,
  playerDynamicTemplatePayloadSchema,
  priceListSlideConfigSchema,
  themeSelectionSchema,
  type EditorialPriceListConfiguration,
  type PlayerDynamicTemplateAsset,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import { priceRowsThatFit } from "@veyocast/content-templates";
import {
  resolveEditorialThemeConfig
} from "@veyocast/content-templates/editorial-arena-theme";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlAdminClient } from "../../../../lib/supabase/admin";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  slideComposerErrorPath,
  validateEditorialSlideTheme
} from "./new/slide-composer-validation";

export type DynamicSlidePreviewResult =
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

export async function previewDynamicSlide(
  formData: FormData
): Promise<DynamicSlidePreviewResult> {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const name = String(formData.get("name") ?? "Voorbeeld").trim();
  const templateVersionId = String(formData.get("templateVersionId") ?? "");
  const dataSourceId = String(formData.get("dataSourceId") ?? "");
  const requestedSlideType = String(formData.get("slideType") ?? "");
  const configuration = dynamicSlideConfiguration(formData);
  if (!configuration) {
    return {
      code: "PREVIEW_CONFIGURATION_INVALID",
      message: "Selecteer minimaal één beschikbaar product en controleer de kolomindeling.",
      ok: false
    };
  }
  const themeValidation = validateEditorialSlideTheme({
    rawTheme: parseJson(formData.get("editorialThemeJson")),
    rawThemeSelection: parseJson(formData.get("themeSelectionJson")),
    resolvedTheme: editorialThemeFromConfiguration(configuration),
    slideType: requestedSlideType
  });
  if (!themeValidation.ok) return themeValidation;
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    !uuidPattern.test(templateVersionId) ||
    !uuidPattern.test(dataSourceId)
  ) {
    return {
      code: "PREVIEW_SELECTION_INVALID",
      message: "Kies eerst een geldig template en een beschikbare databron.",
      ok: false
    };
  }

  const { data, error } = await supabase.rpc("preview_dynamic_slide_v1", {
    p_configuration_json: configuration,
    p_data_source_id: dataSourceId,
    p_name: name || "Voorbeeld",
    p_template_version_id: templateVersionId,
    p_tenant_id: session.tenantId!
  });
  if (error || !isRecord(data)) {
    console.error("Dynamische slide preview mislukt", {
      code: error?.code ?? "preview_result_invalid"
    });
    return {
      code: error?.code ?? "PREVIEW_UNAVAILABLE",
      message:
        error?.code === "42501"
          ? "Je hebt geen toestemming om deze preview te laden."
          : "De echte preview kon tijdelijk niet worden opgebouwd. De databron en bestaande slides zijn niet gewijzigd.",
      ok: false
    };
  }

  const snapshotData = isRecord(data.data) ? data.data : null;
  const source = isRecord(data.source) ? data.source : null;
  if (
    !snapshotData ||
    typeof data.previewId !== "string" ||
    !uuidPattern.test(data.previewId)
  ) {
    return {
      code: "PREVIEW_PAYLOAD_INVALID",
      message: "De databron gaf geen geldige voorbeeldinhoud terug.",
      ok: false
    };
  }

  const mediaAssetIds = collectPreviewMediaAssetIds(snapshotData);
  const assets = await loadPreviewAssets(
    supabase,
    session.tenantId!,
    mediaAssetIds
  );
  const parsed = playerDynamicTemplatePayloadSchema.safeParse({
    ...(assets.size ? { assets: Object.fromEntries(assets) } : {}),
    data: snapshotData,
    orientation: data.orientation,
    schemaVersion: 1,
    slideType: data.slideType,
    snapshotHash: createHash("sha256")
      .update(JSON.stringify(snapshotData))
      .digest("hex"),
    snapshotId: data.previewId,
    templateSlug: data.templateSlug,
    templateVersionId: data.templateVersionId
  });
  if (!parsed.success) {
    return {
      code: "PREVIEW_PAYLOAD_INVALID",
      message: "De voorbeeldinhoud voldoet niet aan het veilige Playercontract.",
      ok: false
    };
  }

  return {
    itemCount: previewItemCount(snapshotData),
    missingAssetCount: Math.max(0, mediaAssetIds.length - assets.size),
    ok: true,
    payload: parsed.data,
    source: {
      lastErrorCode:
        typeof source?.lastErrorCode === "string"
          ? source.lastErrorCode
          : null,
      lastSuccessfulSyncAt:
        typeof source?.lastSuccessfulSyncAt === "string"
          ? source.lastSuccessfulSyncAt
          : null,
      providerStatus:
        typeof source?.providerStatus === "string"
          ? source.providerStatus
          : "unknown"
    }
  };
}

export async function createDynamicSlide(formData: FormData) {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const name = String(formData.get("name") ?? "").trim();
  const templateVersionId = String(formData.get("templateVersionId") ?? "");
  const dataSourceId = String(formData.get("dataSourceId") ?? "");
  const selectionMode = String(formData.get("selectionMode") ?? "latest");
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const sportCompetitionExternalId = normalizeSportlinkSelection(
    formData.get("sportCompetitionExternalId")
  );
  const sportTeamExternalId = normalizeSportlinkSelection(
    formData.get("sportTeamExternalId")
  );
  const sportSeason = normalizeSportlinkSelection(
    formData.get("sportSeason")
  );
  const requestedMaxItems = Math.min(
    40,
    Math.max(1, Number(formData.get("maxItems")) || 8)
  );
  const requestedSecondsPerSlide = Math.min(
    120,
    Math.max(5, Number(formData.get("secondsPerSlide")) || 5)
  );
  const requestedSlideType = String(formData.get("slideType") ?? "");
  const configuration = dynamicSlideConfiguration(formData);
  if (!configuration) {
    redirectToSlideComposerError(
      requestedSlideType,
      "Selecteer minimaal een beschikbaar product en controleer de kolomindeling."
    );
  }
  const themeValidation = validateEditorialSlideTheme({
    rawTheme: parseJson(formData.get("editorialThemeJson")),
    rawThemeSelection: parseJson(formData.get("themeSelectionJson")),
    resolvedTheme: editorialThemeFromConfiguration(configuration),
    slideType: requestedSlideType
  });
  if (!themeValidation.ok) {
    redirectToSlideComposerError(requestedSlideType, themeValidation.message);
  }
  const editorialConfiguration = "editorial" in configuration &&
    isRecord(configuration.editorial)
    ? configuration.editorial
    : null;
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    name.length < 2 ||
    name.length > 120 ||
    !uuidPattern.test(templateVersionId) ||
    !uuidPattern.test(dataSourceId) ||
    (selectionMode !== "latest" && selectionMode !== "pinned")
  ) {
    redirectToSlideComposerError(
      requestedSlideType,
      "Controleer de naam, het template en de databron."
    );
  }
  const [templateResult, sourceResult] = await Promise.all([
    supabase
      .from("dynamic_templates")
      .select("slide_type, orientation")
      .eq("current_published_version_id", templateVersionId)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .from("dynamic_data_sources")
      .select("kind")
      .eq("id", dataSourceId)
      .eq("tenant_id", session.tenantId!)
      .neq("status", "archived")
      .maybeSingle()
  ]);
  const templateSlideType = templateResult.data?.slide_type;
  const sourceKind = sourceResult.data?.kind;
  if (templateResult.error || !templateSlideType) {
    redirectToSlideComposerError(
      requestedSlideType,
      "Het gekozen template is niet meer gepubliceerd. Kies een ander template."
    );
  }
  if (sourceResult.error || !sourceKind) {
    redirectToSlideComposerError(
      requestedSlideType,
      "De gekozen databron is niet meer beschikbaar."
    );
  }
  if (!sourceMatchesSlideType(sourceKind, templateSlideType)) {
    redirectToSlideComposerError(
      requestedSlideType,
      "Template en databron horen niet bij hetzelfde slidetype. Kies de combinatie opnieuw."
    );
  }
  if (
    supportsSportContextSelection(templateSlideType) &&
    (
      sportCompetitionExternalId === false ||
      sportTeamExternalId === false ||
      sportSeason === false
    )
  ) {
    redirectToSlideComposerError(
      requestedSlideType,
      "De gekozen Sportlink-selectie is ongeldig. Kies team en competitie opnieuw."
    );
  }
  const priceList = editorialConfiguration
    ? editorialPriceListConfigurationSchema.safeParse(
        "priceList" in editorialConfiguration
          ? editorialConfiguration.priceList
          : undefined
      )
    : null;
  if (templateSlideType === "menu" && !priceList?.success) {
    redirectToSlideComposerError(
      requestedSlideType,
      "Selecteer en orden eerst de producten voor beide prijskolommen."
    );
  }
  if (templateSlideType === "menu" && priceList?.success) {
    const orientation = templateResult.data?.orientation === "portrait"
      ? "portrait"
      : "landscape";
    const capacity = priceRowsThatFit(orientation);
    if (
      priceList.data.columns.left.length > capacity ||
      priceList.data.columns.right.length > capacity ||
      !(await priceListBelongsToSource({
        configuration: priceList.data,
        dataSourceId,
        supabase,
        tenantId: session.tenantId!
      }))
    ) {
      redirectToSlideComposerError(
        requestedSlideType,
        "De prijslijstindeling is ongeldig, loopt over of bevat producten buiten de gekozen tenantbron."
      );
    }
  }
  const configuredPriceItems = priceList?.success
    ? priceProductCount(priceList.data)
    : 0;
  const maxItems = isSingleMatchSlide(templateSlideType)
    ? 1
    : templateSlideType === "news"
      ? Math.min(requestedMaxItems, 12)
      : isEditorialSportList(templateSlideType)
        ? Math.min(requestedMaxItems, 20)
        : templateSlideType === "menu" && configuredPriceItems
          ? Math.min(configuredPriceItems, 40)
          : requestedMaxItems;
  const { data, error } = await supabase.rpc("create_dynamic_slide_v1", {
    p_configuration_json: {
      ...configuration,
      ...(templateSlideType === "price_list" ? {} : { maxItems }),
      ...(templateSlideType === "menu" && category ? { category } : {}),
      ...(templateSlideType === "news"
        ? {
            secondsPerSlide: requestedSecondsPerSlide,
            title: title || "Voetbalnieuws"
          }
        : title
          ? { title }
          : {}),
      ...(supportsSportContextSelection(templateSlideType) &&
      sportCompetitionExternalId
        ? { sportCompetitionExternalId }
        : {}),
      ...(supportsSportContextSelection(templateSlideType) &&
      sportTeamExternalId
        ? { sportTeamExternalId }
        : {}),
      ...(supportsSportStandingSelection(templateSlideType) && sportSeason
        ? { sportSeason }
        : {})
    },
    p_data_source_id: dataSourceId,
    p_name: name,
    p_selection_mode: selectionMode,
    p_template_version_id: templateVersionId,
    p_tenant_id: session.tenantId!
  });
  const slideId = isRecord(data) && typeof data.slideId === "string"
    ? data.slideId
    : null;
  if (error || !slideId) {
    console.error("Dynamische slide maken mislukt", {
      code: error?.code ?? "slide_result_invalid"
    });
    const message = error?.code === "23514"
      ? "De gekozen databron bevat nog geen bruikbare inhoud. Synchroniseer de bron en probeer het opnieuw."
      : error?.code === "42501"
        ? "Je hebt geen toestemming om deze dynamische slide te maken."
        : "De slide kon tijdelijk niet worden gemaakt. Je bestaande slides en publicaties zijn niet gewijzigd.";
    redirectToSlideComposerError(requestedSlideType, message);
  }
  revalidatePath("/dashboard/slides");
  redirect(`/dashboard/slides/${slideId}?succes=De+eerste+immutable+snapshot+wordt+gerenderd.`);
}

function dynamicSlideConfiguration(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const slideType = String(formData.get("slideType") ?? "");
  const sportCompetitionExternalId = normalizeSportlinkSelection(
    formData.get("sportCompetitionExternalId")
  );
  const sportTeamExternalId = normalizeSportlinkSelection(
    formData.get("sportTeamExternalId")
  );
  const sportSeason = normalizeSportlinkSelection(formData.get("sportSeason"));
  const secondsPerSlide = Math.min(
    120,
    Math.max(5, Number(formData.get("secondsPerSlide")) || 5)
  );
  if (slideType === "price_list") {
    const raw = String(formData.get("priceListConfiguration") ?? "");
    try {
      const parsed = priceListSlideConfigSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      return {
        ...parsed.data,
        editorial: {
          newsVariant: "hero_split",
          pricePhotoMode: "show",
          schemaVersion: 2,
          theme: editorialThemeFromForm(formData),
          themeSelection: themeSelectionFromForm(formData)
        }
      };
    } catch {
      return null;
    }
  }
  const theme = editorialThemeFromForm(formData);
  const priceList = parseJsonField(
    formData.get("priceListJson"),
    editorialPriceListConfigurationSchema
  );
  const newsFocalPoint = parseJsonField(
    formData.get("newsFocalPointJson"),
    editorialFocalPointSchema
  );
  const configuredItems = priceList ? priceProductCount(priceList) : 0;
  const maxItems = Math.min(
    slideType === "news" ? 12 : isEditorialSportList(slideType) ? 20 : 40,
    Math.max(
      1,
      slideType === "menu" && configuredItems
        ? configuredItems
        : Number(formData.get("maxItems")) || 8
    )
  );
  const newsVariant = [
    "hero_split",
    "fullscreen_gradient",
    "news_grid",
    "text_only"
  ].includes(String(formData.get("newsVariant")))
    ? String(formData.get("newsVariant"))
    : "hero_split";
  const pricePhotoMode = formData.get("pricePhotoMode") === "reserve-empty"
    ? "reserve-empty"
    : "show";
  return {
    editorial: {
      ...(newsFocalPoint ? { newsFocalPoint } : {}),
      newsVariant,
      ...(priceList ? { priceList } : {}),
      pricePhotoMode,
      schemaVersion: 2,
      theme,
      themeSelection: themeSelectionFromForm(formData)
    },
    ...(slideType === "menu" && category ? { category } : {}),
    maxItems,
    ...(slideType === "news" ? { secondsPerSlide } : {}),
    ...(typeof sportCompetitionExternalId === "string"
      ? { sportCompetitionExternalId }
      : {}),
    ...(typeof sportTeamExternalId === "string"
      ? { sportTeamExternalId }
      : {}),
    ...(supportsSportStandingSelection(slideType) &&
    typeof sportSeason === "string"
      ? { sportSeason }
      : {}),
    ...(slideType === "news"
      ? { title: title || "Voetbalnieuws" }
      : title
        ? { title }
        : {})
  };
}

function themeSelectionFromForm(formData: FormData) {
  const parsed = themeSelectionSchema.safeParse(
    parseJson(formData.get("themeSelectionJson"))
  );
  if (parsed.success) return parsed.data;
  return {
    accent: null,
    categoryOverrides: [],
    modePolicy: { kind: "fixed" as const, mode: "light" as const },
    ref: {
      catalog: "v2" as const,
      id: "fieldflow" as const,
      version: "1.0.0"
    },
    support: null
  };
}

function editorialThemeFromForm(formData: FormData) {
  const parsed = editorialThemeConfigSchema.safeParse(
    parseJson(formData.get("editorialThemeJson"))
  );
  if (parsed.success) return parsed.data;
  return resolveEditorialThemeConfig({ mode: "light" });
}

function editorialThemeFromConfiguration(configuration: unknown) {
  if (!isRecord(configuration) || !isRecord(configuration.editorial)) {
    return null;
  }
  return configuration.editorial.theme;
}

function redirectToSlideComposerError(slideType: string, message: string): never {
  redirect(slideComposerErrorPath(slideType, message));
}

function parseJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 32_768) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseJsonField<T>(
  value: FormDataEntryValue | null,
  schema: { safeParse: (value: unknown) => { data?: T; success: boolean } }
) {
  const parsed = schema.safeParse(parseJson(value));
  return parsed.success ? parsed.data : undefined;
}

function priceProductCount(configuration: EditorialPriceListConfiguration) {
  return [
    ...configuration.columns.left,
    ...configuration.columns.right
  ].filter((entry) => entry.kind === "product").length;
}

async function priceListBelongsToSource({
  configuration,
  dataSourceId,
  supabase,
  tenantId
}: {
  configuration: EditorialPriceListConfiguration;
  dataSourceId: string;
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
  tenantId: string;
}) {
  const ids: string[] = [];
  const categoryByProduct = new Map<string, string>();
  for (const entries of [configuration.columns.left, configuration.columns.right]) {
    let category = "";
    for (const entry of entries) {
      if (entry.kind === "category") {
        category = entry.category;
        continue;
      }
      if (!category || ids.includes(entry.productId)) return false;
      ids.push(entry.productId);
      categoryByProduct.set(entry.productId, category);
    }
  }
  if (!ids.length || ids.length > 40) return false;
  const result = await supabase
    .from("tenant_products")
    .select("id, category")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("available", true)
    .in("id", ids)
    .or(`data_source_id.eq.${dataSourceId},data_source_id.is.null`);
  if (result.error || result.data?.length !== ids.length) return false;
  return result.data.every(
    (product) => (product.category || "Overig") === categoryByProduct.get(product.id)
  );
}

function isEditorialSportList(slideType: string) {
  return ["sport_program", "sport_results", "sport_standing"].includes(
    slideType
  );
}

function collectPreviewMediaAssetIds(snapshot: Record<string, unknown>) {
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
  return [...ids];
}

async function loadPreviewAssets(
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

function previewItemCount(snapshot: Record<string, unknown>) {
  const sport = isRecord(snapshot.sport) ? snapshot.sport : null;
  if (Array.isArray(sport?.items)) return sport.items.length;
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  if (Array.isArray(menu?.products)) return menu.products.length;
  const menuDocument = isRecord(snapshot.menuDocument) ? snapshot.menuDocument : null;
  if (Array.isArray(menuDocument?.pages)) {
    return menuDocument.pages.reduce((total, pageValue) => {
      const page = isRecord(pageValue) ? pageValue : null;
      if (!Array.isArray(page?.blocks)) return total;
      return total + page.blocks.reduce((pageTotal, blockValue) => {
        const block = isRecord(blockValue) ? blockValue : null;
        if (block?.type === "product-group") return pageTotal + 1;
        return pageTotal + (Array.isArray(block?.productNodes) ? block.productNodes.length : 0);
      }, 0);
    }, 0);
  }
  const priceList = isRecord(snapshot.priceList) ? snapshot.priceList : null;
  if (Array.isArray(priceList?.sections)) {
    return priceList.sections.reduce((count, candidate) => {
      const section = isRecord(candidate) ? candidate : null;
      return count + (Array.isArray(section?.products) ? section.products.length : 0);
    }, 0);
  }
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  return Array.isArray(news?.articles) ? news.articles.length : 0;
}

export async function refreshDynamicSlide(formData: FormData) {
  await requireTenantControlSession("tenant.dynamic_slide.write");
  const slideId = String(formData.get("slideId") ?? "");
  const supabase = await createControlSupabaseClient();
  if (!supabase || !uuidPattern.test(slideId)) {
    redirect("/dashboard/slides?fout=De+slide+is+ongeldig.");
  }
  const { data, error } = await supabase.rpc("refresh_dynamic_slide_v1", {
    p_slide_id: slideId
  });
  if (error) {
    redirect(`/dashboard/slides/${slideId}?fout=Er+kon+geen+nieuwe+snapshot+worden+gemaakt.+De+laatste+goede+versie+blijft+beschikbaar.`);
  }
  revalidatePath(`/dashboard/slides/${slideId}`);
  revalidatePath("/dashboard/slides");
  if (isRecord(data) && data.changed === false) {
    redirect(`/dashboard/slides/${slideId}?succes=De+inhoud+is+ongewijzigd.+Er+is+geen+nieuwe+versie+aangemaakt.`);
  }
  redirect(`/dashboard/slides/${slideId}?succes=Nieuwe+snapshot+staat+in+de+renderqueue.`);
}

export async function addDynamicSlideToPlaylist(formData: FormData) {
  const session = await requireTenantControlSession("tenant.playlist.write");
  const slideId = String(formData.get("slideId") ?? "");
  const playlistId = String(formData.get("playlistId") ?? "");
  const duration = Math.min(3600, Math.max(5, Number(formData.get("duration")) || 10));
  const supabase = await createControlSupabaseClient();
  if (
    !supabase ||
    !uuidPattern.test(slideId) ||
    !uuidPattern.test(playlistId)
  ) {
    redirect(`/dashboard/slides/${slideId}?fout=Kies+een+geldige+playlist.`);
  }
  const playlist = await supabase
    .from("playlists")
    .select("revision")
    .eq("id", playlistId)
    .eq("tenant_id", session.tenantId!)
    .maybeSingle();
  if (
    playlist.error ||
    !playlist.data ||
    !Number.isInteger(Number(playlist.data.revision))
  ) {
    redirect(`/dashboard/slides/${slideId}?fout=De+playlist+kon+niet+veilig+worden+geladen.`);
  }
  const { data, error } = await supabase.rpc("add_dynamic_slide_to_playlist_v2", {
    p_duration_seconds: duration,
    p_dynamic_slide_id: slideId,
    p_expected_revision: Number(playlist.data.revision),
    p_idempotency_key: randomUUID(),
    p_playlist_id: playlistId
  });
  if (
    error ||
    !isRecord(data) ||
    (data.outcome !== "applied" && data.outcome !== "conflict")
  ) {
    redirect(`/dashboard/slides/${slideId}?fout=De+slide+is+nog+niet+gereed+of+kon+niet+aan+de+playlist+worden+toegevoegd.`);
  }
  if (data.outcome === "conflict") {
    redirect(
      `/dashboard/slides/${slideId}?fout=De+playlist+is+ondertussen+gewijzigd.+Open+de+slide+opnieuw+en+probeer+nogmaals.`
    );
  }
  revalidatePath(`/dashboard/playlists/${playlistId}`);
  redirect(`/dashboard/playlists/${playlistId}?succes=De+dynamische+HTML%2FCSS-slide+is+aan+het+concept+toegevoegd.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sourceMatchesSlideType(kind: string, slideType: string) {
  if (slideType === "menu" || slideType === "price_list") {
    return kind === "manual_products" || kind === "twelve_excel";
  }
  if (slideType === "news") return kind === "rss";
  return kind === "sportlink" && slideType.startsWith("sport_");
}

function isSingleMatchSlide(slideType: string) {
  return [
    "sport_match_of_the_day",
    "sport_next_match"
  ].includes(slideType);
}

function supportsSportMatchSelection(slideType: string) {
  return [
    "sport_cancellations",
    "sport_dressing_rooms",
    "sport_match_of_the_day",
    "sport_next_match",
    "sport_officials",
    "sport_program",
    "sport_results"
  ].includes(slideType);
}

function supportsSportStandingSelection(slideType: string) {
  return [
    "sport_period_standing",
    "sport_standing"
  ].includes(slideType);
}

function supportsSportContextSelection(slideType: string) {
  return supportsSportMatchSelection(slideType) ||
    supportsSportStandingSelection(slideType);
}

function normalizeSportlinkSelection(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "*") return null;
  return normalized.length <= 240 &&
    ![...normalized].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    })
    ? normalized
    : false;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
