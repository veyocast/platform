import "server-only";
import type { Capability } from "@veyocast/auth";
import type { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { contentLibraryColumns, mapContentLibraryRows } from "./content-data.server";
import { attentionStatuses, contentReadableKinds, contentSearchPattern, type ContentLibraryQuery } from "./content-library";

type Client = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
export async function loadContentLibrary(client: Client | null, tenantId: string | null, capabilities: readonly Capability[], state: ContentLibraryQuery) {
  const kinds = contentReadableKinds(capabilities);
  if (!kinds.length) return { items: [], count: 0, total: 0, ready: 0, processing: 0, failed: false };
  if (!client || !tenantId) return { items: [], count: 0, total: 0, ready: 0, processing: 0, failed: true };
  const base = () => client.from("sync_content_library_v1").select(contentLibraryColumns, { count: "exact" }).eq("tenant_id", tenantId).in("kind", kinds);
  let request = base().eq("archived", state.status === "archive");
  if (state.query) {
    const pattern = contentSearchPattern(state.query);
    request = pattern.operator === "ilike" ? request.ilike("title", pattern.value) : request.filter("title", "imatch", pattern.value);
  }
  if (state.filter === "media") request = request.eq("kind", "media");
  if (state.filter === "designs") request = request.eq("kind", "studio");
  if (state.filter === "series") request = request.eq("kind", "series");
  if (state.filter === "slides") request = request.neq("kind", "media");
  if (state.filter === "menus") request = request.eq("kind", "dynamic").in("family", ["menu", "price_list"]);
  if (state.filter === "automatic") request = request.eq("kind", "dynamic").not("family", "in", "(menu,price_list)");
  if (state.status === "attention") request = request.in("status", attentionStatuses);
  const count = () => client.from("sync_content_library_v1").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("kind", kinds).eq("archived", false);
  try {
    const [result, total, ready, processing] = await Promise.all([
      request.order("updated_at", { ascending: false }).order("content_key").range((state.page - 1) * state.size, state.page * state.size - 1),
      count(), count().in("status", ["ready", "published"]), count().in("status", ["uploading", "processing", "rendering"]),
    ]);
    const failed = Boolean(result.error || total.error || ready.error || processing.error);
    return { items: failed ? [] : await mapContentLibraryRows(client, tenantId, result.data ?? []), count: result.count ?? 0, total: total.count ?? 0, ready: ready.count ?? 0, processing: processing.count ?? 0, failed };
  } catch { return { items: [], count: 0, total: 0, ready: 0, processing: 0, failed: true }; }
}
