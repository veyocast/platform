import { menuDocumentV2Schema, type MenuDocumentV2 } from "@veyocast/contracts";

import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import type {
  MenuStudioMediaOption,
  MenuStudioProductOption
} from "./menu-studio-editor";

export type MenuStudioFlags = {
  authoring: boolean;
  linkedGroups: boolean;
  media: boolean;
  player: boolean;
  publish: boolean;
  read: boolean;
};

export type MenuStudioSource = {
  id: string;
  kind: "manual_products" | "twelve_excel";
  name: string;
};

export type MenuStudioTemplateOption = {
  name: string;
  orientation: "landscape" | "portrait";
  slug: string;
  versionId: string;
};

export function menuStudioTemplateVersionIds(
  templates: MenuStudioTemplateOption[],
  currentVersionId?: string
): Partial<Record<MenuStudioTemplateOption["orientation"], string>> {
  const current = templates.find((template) => template.versionId === currentVersionId);
  const family = current ? templateFamily(current.slug) : null;
  const result: Partial<Record<MenuStudioTemplateOption["orientation"], string>> = {};
  for (const orientation of ["landscape", "portrait"] as const) {
    const template = templates.find((candidate) =>
      candidate.orientation === orientation &&
      family !== null &&
      templateFamily(candidate.slug) === family
    ) ?? templates.find((candidate) => candidate.orientation === orientation);
    if (template) result[orientation] = template.versionId;
  }
  return result;
}

function templateFamily(slug: string) {
  return slug.replace(/-(?:landscape|portrait)$/u, "");
}

export async function loadMenuStudioOptions(
  tenantId: string,
  requestedSourceId?: string,
  includedAssetIds: string[] = []
) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const [settingsResult, sourcesResult, templatesResult] = await Promise.all([
    supabase
      .from("tenant_settings")
      .select("default_theme_id, default_theme_version, menu_document_v2_read_enabled, menu_studio_v2_authoring_enabled, menu_studio_v2_linked_groups_enabled, menu_studio_v2_media_enabled, menu_studio_v2_player_enabled, menu_studio_v2_publish_enabled, primary_color, theme_accent, theme_support")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("dynamic_data_sources")
      .select("id, kind, name")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("kind", ["manual_products", "twelve_excel"])
      .order("name"),
    supabase
      .from("dynamic_templates")
      .select("current_published_version_id, name, orientation, slug")
      .eq("slide_type", "price_list")
      .eq("status", "published")
      .not("current_published_version_id", "is", null)
      .order("name")
  ]);
  if (settingsResult.error || sourcesResult.error || templatesResult.error) {
    console.error("Menu Studio-opties laden mislukt", {
      settings: settingsResult.error?.code,
      sources: sourcesResult.error?.code,
      templates: templatesResult.error?.code
    });
    return null;
  }
  const settings = settingsResult.data as Record<string, unknown> | null;
  const sources = (sourcesResult.data ?? []).flatMap((source) =>
    source.id && source.name && (source.kind === "manual_products" || source.kind === "twelve_excel")
      ? [{ id: source.id, kind: source.kind, name: source.name } satisfies MenuStudioSource]
      : []
  );
  const source = sources.find((candidate) => candidate.id === requestedSourceId) ?? sources[0] ?? null;
  const [products, media] = source
    ? await Promise.all([
        loadProducts(supabase, tenantId, source),
        loadMedia(supabase, tenantId, includedAssetIds)
      ])
    : [[], []];
  const templates = (templatesResult.data ?? []).flatMap((template) =>
    template.current_published_version_id &&
    (template.orientation === "landscape" || template.orientation === "portrait")
      ? [{
          name: template.name,
          orientation: template.orientation,
          slug: template.slug,
          versionId: template.current_published_version_id
        } satisfies MenuStudioTemplateOption]
      : []
  );
  return {
    flags: flags(settings),
    media,
    products,
    source,
    sources,
    templates,
    theme: {
      brand: {
        accent: requiredColor(settings?.theme_accent ?? settings?.primary_color, "#FF5C20"),
        ...(optionalColor(settings?.theme_support)
          ? { support: requiredColor(settings?.theme_support, "#0050FF") }
          : {})
      },
      mode: "light" as const,
      themeId: themeId(settings?.default_theme_id),
      themeVersion: version(settings?.default_theme_version)
    }
  };
}

export async function loadMenuStudioSlide(tenantId: string, slideId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return null;
  const slideResult = await supabase
    .from("dynamic_slides")
    .select("id, name, orientation, data_source_id, template_version_id, configuration_json, menu_document_revision, menu_last_published_revision, status")
    .eq("tenant_id", tenantId)
    .eq("id", slideId)
    .neq("status", "archived")
    .maybeSingle();
  const document = menuDocumentV2Schema.safeParse(slideResult.data?.configuration_json);
  if (slideResult.error || !slideResult.data || !document.success || !slideResult.data.data_source_id || !slideResult.data.template_version_id) {
    return null;
  }
  const options = await loadMenuStudioOptions(
    tenantId,
    slideResult.data.data_source_id,
    document.data.assets.map((asset) => asset.assetId)
  );
  if (!options?.source || !options.templates.length) return null;
  return {
    ...options,
    document: document.data,
    lastPublishedRevision: Number(slideResult.data.menu_last_published_revision ?? 0) || null,
    slide: slideResult.data
  };
}

export function initialMenuDocument({
  documentId,
  tenantId,
  theme
}: {
  documentId: string;
  tenantId: string;
  theme: MenuDocumentV2["theme"];
}): MenuDocumentV2 {
  const now = new Date().toISOString();
  return {
    assets: [],
    createdAt: now,
    id: documentId,
    pages: [{ blocks: [], id: cryptoId(documentId), order: 0 }],
    revision: 1,
    schemaVersion: "menu-document.v2",
    tenantId,
    theme,
    title: "Nieuw menu",
    updatedAt: now
  };
}

async function loadProducts(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  source: MenuStudioSource
): Promise<MenuStudioProductOption[]> {
  const result = await supabase
    .from("tenant_products")
    .select("id, name, description, category, price_cents, currency, available, data_source_id, sort_order, revision, vat_rate, unit, custom_fields")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .or(`data_source_id.eq.${source.id},data_source_id.is.null`)
    .order("category")
    .order("sort_order")
    .order("name")
    .limit(2_000);
  if (result.error) {
    console.error("Menu Studio-producten laden mislukt", { code: result.error.code });
    return [];
  }
  return (result.data ?? []).flatMap((product) =>
    product.id && product.name && product.price_cents !== null
      ? [{
          available: product.available !== false,
          category: product.category?.trim() || "Overig",
          currency: typeof product.currency === "string" ? product.currency : "EUR",
          description: product.description?.trim() || "",
          id: product.id,
          name: product.name,
          priceCents: Number(product.price_cents),
          sourceId: source.id,
          sourceKind: source.kind,
          sourceRevision: String(product.revision ?? 0),
          taxMode: productTaxMode(product.custom_fields),
          ...(product.vat_rate !== null && Number.isFinite(Number(product.vat_rate))
            ? { taxRateBps: Math.round(Number(product.vat_rate) * 100) }
            : {}),
          ...(product.unit?.trim() ? { unitKey: product.unit.trim() } : {})
        }]
      : []
  );
}

async function loadMedia(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  includedAssetIds: string[]
): Promise<MenuStudioMediaOption[]> {
  const assetsResult = await supabase
    .from("media_assets")
    .select("id, title, kind, mime_type, checksum_sha256, tintable")
    .eq("tenant_id", tenantId)
    .eq("status", "ready")
    .eq("source_kind", "user")
    .is("deleted_at", null)
    .not("checksum_sha256", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (assetsResult.error) return [];
  const recentAssets = assetsResult.data ?? [];
  const recentIds = new Set(recentAssets.map((asset) => asset.id));
  const missingIds = [...new Set(includedAssetIds)]
    .filter((assetId) => uuidPattern.test(assetId) && !recentIds.has(assetId));
  const includedResult = missingIds.length
    ? await supabase
        .from("media_assets")
        .select("id, title, kind, mime_type, checksum_sha256, tintable")
        .eq("tenant_id", tenantId)
        .eq("status", "ready")
        .is("deleted_at", null)
        .not("checksum_sha256", "is", null)
        .in("id", missingIds)
    : { data: [], error: null };
  if (includedResult.error) return [];
  const assets = [...recentAssets, ...(includedResult.data ?? [])];
  if (!assets.length) return [];
  const variantsResult = await supabase
    .from("media_variants")
    .select("asset_id, variant_type, storage_bucket, storage_path, checksum_sha256")
    .eq("tenant_id", tenantId)
    .in("asset_id", assets.map((asset) => asset.id))
    .in("variant_type", ["original", "player_1080p", "thumbnail"]);
  if (variantsResult.error) return [];
  const byAsset = new Map<string, (typeof variantsResult.data)[number]>();
  const posterByAsset = new Map<string, (typeof variantsResult.data)[number]>();
  for (const variant of variantsResult.data ?? []) {
    const asset = assets.find((candidate) => candidate.id === variant.asset_id);
    if (variant.variant_type === "thumbnail" && asset?.kind === "video") {
      posterByAsset.set(variant.asset_id, variant);
      continue;
    }
    const current = byAsset.get(variant.asset_id);
    if (!current || (asset?.kind === "video" && variant.variant_type === "player_1080p")) {
      byAsset.set(variant.asset_id, variant);
    }
  }
  return Promise.all(assets.flatMap((asset) => {
    const variant = byAsset.get(asset.id);
    if (!variant || !asset.checksum_sha256) return [];
    const poster = posterByAsset.get(asset.id);
    if (asset.kind === "video" && !poster) return [];
    return [Promise.all([
      supabase.storage.from(variant.storage_bucket).createSignedUrl(variant.storage_path, 3_600),
      poster
        ? supabase.storage.from(poster.storage_bucket).createSignedUrl(poster.storage_path, 3_600)
        : Promise.resolve({ data: null, error: null })
    ]).then(([signed, signedPoster]): MenuStudioMediaOption | null => signed.data?.signedUrl &&
      (!poster || signedPoster.data?.signedUrl) ? {
        assetVersion: asset.checksum_sha256!,
        id: asset.id,
        kind: asset.mime_type === "image/gif"
          ? "animation"
          : asset.kind === "video" ? "video" : "image",
        mimeType: asset.mime_type,
        name: asset.title,
        ...(poster?.checksum_sha256 ? { posterAssetVersion: poster.checksum_sha256 } : {}),
        ...(signedPoster.data?.signedUrl ? { posterUrl: signedPoster.data.signedUrl } : {}),
        sha256: asset.checksum_sha256!,
        tintable: asset.tintable === true,
        url: signed.data.signedUrl
      } : null)];
  })).then((values) => values.filter((value): value is MenuStudioMediaOption => value !== null));
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function productTaxMode(value: unknown): MenuStudioProductOption["taxMode"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "inclusive";
  const mode = (value as Record<string, unknown>).tax_mode;
  return mode === "exclusive" || mode === "not-applicable" ? mode : "inclusive";
}

function flags(settings: Record<string, unknown> | null): MenuStudioFlags {
  return {
    authoring: settings?.menu_studio_v2_authoring_enabled === true,
    linkedGroups: settings?.menu_studio_v2_linked_groups_enabled === true,
    media: settings?.menu_studio_v2_media_enabled === true,
    player: settings?.menu_studio_v2_player_enabled === true,
    publish: settings?.menu_studio_v2_publish_enabled === true,
    read: settings?.menu_document_v2_read_enabled === true
  };
}

function requiredColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value.toUpperCase()
    : fallback;
}

function optionalColor(value: unknown) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value.toUpperCase()
    : null;
}

function themeId(value: unknown): MenuDocumentV2["theme"]["themeId"] {
  return [
    "editorial", "obsidian", "atelier", "velocity", "heritage",
    "halo", "swiss", "pavilion", "tactical", "terrace"
  ].includes(String(value))
    ? value as MenuDocumentV2["theme"]["themeId"]
    : "editorial";
}

function version(value: unknown) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value)
    ? value
    : "1.0.0";
}

function cryptoId(documentId: string) {
  return `${documentId}:page:1`;
}
