"use server";
import { requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function listContentPlaylists(
  query: string,
  offset = 0,
): Promise<
  | {
      ok: true;
      rows: Array<{ id: string; name: string; revision: number }>;
      hasMore: boolean;
    }
  | { ok: false; message: string }
> {
  const session = await requireTenantControlSession("tenant.playlist.read");
  const client = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !client)
    return {
      ok: false,
      message:
        "Je beveiligde sessie ontbreekt. Je selectie blijft bewaard; log opnieuw in.",
    };
  if (
    typeof query !== "string" ||
    query.length > 120 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    return {
      ok: false,
      message:
        "De zoekopdracht is ongeldig. Wis de zoekterm en probeer opnieuw.",
    };
  let request = client
    .from("playlists")
    .select("id,name,revision")
    .eq("tenant_id", session.tenantId)
    .neq("status", "archived");
  if (query.trim())
    request = request.ilike(
      "name",
      `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`,
    );
  const result = await request
    .order("name")
    .order("id")
    .range(offset, offset + 20);
  if (result.error)
    return {
      ok: false,
      message:
        "De playlists konden niet worden geladen. Je selectie blijft bewaard; probeer opnieuw.",
    };
  return {
    ok: true,
    rows: (result.data ?? [])
      .slice(0, 20)
      .map((row) => ({
        id: row.id,
        name: row.name,
        revision: Number(row.revision),
      })),
    hasMore: (result.data?.length ?? 0) > 20,
  };
}
