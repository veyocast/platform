"use server";

import { revalidatePath } from "next/cache";
import { playlistBatchCommandSchema, type PlaylistBatchCommand } from "@veyocast/contracts";
import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type SavePlaylistBatchResult =
  | { outcome: "applied"; actualRevision: number; itemIds: Record<string, string> }
  | { outcome: "conflict"; actualRevision: number }
  | { outcome: "failed"; message: string };

export async function savePlaylistBatch(command: PlaylistBatchCommand): Promise<SavePlaylistBatchResult> {
  const parsed = playlistBatchCommandSchema.safeParse(command);
  if (!parsed.success) return { outcome: "failed", message: "De wijzigingen zijn ongeldig of te groot. Je concept blijft open; controleer de inhoud en probeer opnieuw." };
  const session = await requireTenantCapability("tenant.playlist.write", "mutate");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) return { outcome: "failed", message: "De beveiligde datasessie ontbreekt. Je wijzigingen blijven open; log opnieuw in." };
  const scoped = await supabase.from("playlists").select("id").eq("tenant_id", session.tenantId).eq("id", parsed.data.playlistId).maybeSingle();
  if (scoped.error || !scoped.data) return { outcome: "failed", message: "Deze playlist hoort niet bij je actieve vereniging of is niet meer beschikbaar. Je concept blijft open; controleer de gekozen vereniging." };
  const { data, error } = await supabase.rpc("mutate_playlist_batch_v1", {
    p_playlist_id: parsed.data.playlistId,
    p_expected_revision: parsed.data.expectedRevision,
    p_operations: parsed.data.operations,
    p_idempotency_key: parsed.data.idempotencyKey
  });
  if (error) return { outcome: "failed", message: error.code === "40001"
    ? "Een ontwerp of playlist is intussen gewijzigd. Er is niets uit deze opslaghandeling toegepast. Je concept blijft open; laad de nieuwste versie en vergelijk de wijzigingen."
    : "De server kon deze wijzigingen niet veilig opslaan. Je concept blijft open; probeer opnieuw." };
  const result = data as { outcome?: string; actualRevision?: number; itemIds?: Record<string, string> } | null;
  if (!result || !Number.isSafeInteger(result.actualRevision)) return { outcome: "failed", message: "De server heeft de opslag niet bevestigd. Je concept blijft open; probeer dezelfde opslaghandeling opnieuw." };
  if (result.outcome === "conflict") return { outcome: "conflict", actualRevision: result.actualRevision! };
  if (result.outcome !== "applied" || !result.itemIds || Object.values(result.itemIds).some(id => !/^[\da-f-]{36}$/i.test(id))) return { outcome: "failed", message: "De opslagbevestiging is onvolledig. Je concept blijft open; vernieuw de serverstatus voordat je verdergaat." };
  revalidatePath("/dashboard/playlists");
  revalidatePath(`/dashboard/playlists/${parsed.data.playlistId}`);
  return { outcome: "applied", actualRevision: result.actualRevision!, itemIds: result.itemIds };
}
