"use server";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type ContentMediaArchivePreview = {
  assetId: string;
  title: string;
  kind: "image" | "video";
  draftCount: number;
  releaseCount: number;
  screenCount: number;
};

/** Read impact only when the user opens this specific card's archive dialog. */
export async function loadContentMediaArchivePreview(assetId: string): Promise<
  { ok: true; preview: ContentMediaArchivePreview } | { ok: false; message: string }
> {
  const failed = { ok: false as const, message: "Het actuele mediagebruik kon niet volledig worden gecontroleerd. Er is niets gewijzigd; open Media of probeer opnieuw." };
  if (typeof assetId !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(assetId)) return failed;
  const session = await requireTenantControlSession("tenant.media.write");
  if (!session.isLive || !session.tenantId || session.tenantStatus !== "active") return failed;
  const client = await createControlSupabaseClient();
  if (!client) return failed;
  const asset = await client.from("media_assets").select("id,title,kind")
    .eq("tenant_id", session.tenantId).eq("id", assetId).is("deleted_at", null).maybeSingle();
  if (asset.error || !asset.data || !["image", "video"].includes(asset.data.kind)) return failed;
  const usage = await client.rpc("get_media_asset_usage", { p_asset_id: assetId }, { count: "exact" }).range(0, 999);
  if (usage.error || !Array.isArray(usage.data) || !Number.isSafeInteger(usage.count) || usage.count !== usage.data.length ||
    usage.data.some(row => !row || typeof row !== "object" || !["draft", "release", "screen"].includes(row.usage_type) || typeof row.resource_id !== "string")) return failed;
  const rows = usage.data as Array<{ usage_type: string; resource_id: string }>;
  const count = (kind: string) => new Set(rows.filter(row => row.usage_type === kind).map(row => row.resource_id)).size;
  return { ok: true, preview: { assetId, title: asset.data.title, kind: asset.data.kind as "image" | "video", draftCount: count("draft"), releaseCount: count("release"), screenCount: count("screen") } };
}
