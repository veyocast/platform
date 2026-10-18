import "server-only";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { syncPlaybackEvidence } from "../../../../../lib/sync-playback-evidence";
import { frozenProductPrices, type ProductPriceEvidence } from "./frozen-product-prices";

export async function loadFrozenProductPrices(tenantId: string): Promise<ProductPriceEvidence> {
  const unavailable: ProductPriceEvidence = { status: "unavailable", products: {} };
  const client = await createControlSupabaseClient();
  if (!client) return unavailable;
  try {
    const devices = await client.from("player_devices").select("active_release_id,desired_release_id,last_seen_at,last_error_code,current_sync_detail,status", { count: "exact" }).eq("tenant_id", tenantId).eq("status", "paired").limit(1000);
    if (devices.error || devices.count === null || devices.count > 1000) return unavailable;
    const now = Date.now();
    const ids = [...new Set((devices.data ?? []).flatMap(device => {
      const proof = syncPlaybackEvidence(device, now);
      return proof.confirmedReleaseId ? [proof.confirmedReleaseId] : [];
    }))];
    if (ids.length > 100) return unavailable;
    if (!ids.length) return { status: "none", products: {} };
    const snapshotIds = new Set<string>();
    for (let start = 0; start < ids.length; start += 100) {
      const items = await client.from("playlist_release_items").select("dynamic_snapshot_id", { count: "exact" }).eq("tenant_id", tenantId).in("release_id", ids.slice(start, start + 100)).eq("enabled", true).not("dynamic_snapshot_id", "is", null).limit(1000);
      if (items.error || items.count === null || items.count > 1000) return unavailable;
      for (const item of items.data ?? []) if (item.dynamic_snapshot_id) snapshotIds.add(item.dynamic_snapshot_id);
    }
    if (snapshotIds.size > 500) return unavailable;
    const snapshots: unknown[] = [];
    const refs = [...snapshotIds];
    for (let start = 0; start < refs.length; start += 100) {
      const batch = refs.slice(start, start + 100);
      const result = await client.from("dynamic_slide_snapshots").select("id,snapshot_data_json").eq("tenant_id", tenantId).eq("status", "ready").in("id", batch);
      if (result.error || result.data?.length !== batch.length) return unavailable;
      snapshots.push(...result.data.map(row => row.snapshot_data_json));
    }
    const products = frozenProductPrices(snapshots);
    return { status: Object.keys(products).length ? "available" : "none", products };
  } catch { return unavailable; }
}
