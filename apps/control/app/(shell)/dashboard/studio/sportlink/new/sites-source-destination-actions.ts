"use server";
import { requireTenantCapability } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { savePlaylistBatch } from "../../../playlists/sites-batch-actions";
import type { SitesSourceDestination } from "./sites-source-destination-model";
export type SitesSourceDestinationPrepareResult = { outcome: "ready"; url: string; actualRevision: number } | { outcome: "pending" | "conflict" | "failed"; message: string };
export async function prepareSitesSourceDestination(input: { destination: SitesSourceDestination; designs: Array<{ slideId: string; snapshotId?: string; menuRevision?: number; durationSeconds: number; clientId: string }>; idempotencyKey: string }): Promise<SitesSourceDestinationPrepareResult> {
  const session = await requireTenantCapability("tenant.playlist.write", "mutate");
  await requireTenantCapability("tenant.playlist.publish", "publish");
  if (!input || !input.destination || !Array.isArray(input.destination.screenIds) || !Array.isArray(input.designs)) return { outcome: "failed", message: "De bestemming of ontwerpen ontbreken. Je opgeslagen ontwerpen blijven behouden; controleer je selectie." };
  const destination = input.destination;
  const id = (value: unknown): value is string => typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(value);
  if (destination.mode !== "publish" || !id(destination.playlistId) || !id(input.idempotencyKey) || !Number.isSafeInteger(destination.expectedRevision) || destination.expectedRevision < 0 || !destination.screenIds.length || destination.screenIds.length > 100 || new Set(destination.screenIds).size !== destination.screenIds.length || !destination.screenIds.every(id) || !input.designs.length || input.designs.length > 25 || input.designs.some(design => !design || typeof design !== "object") || new Set(input.designs.map(design => design.slideId)).size !== input.designs.length || new Set(input.designs.map(design => design.clientId)).size !== input.designs.length || input.designs.some(design => !id(design.slideId) || !id(design.clientId) || (design.snapshotId && !id(design.snapshotId)) || !Number.isInteger(design.durationSeconds) || design.durationSeconds < 5 || design.durationSeconds > 3600 || (design.menuRevision !== undefined && (!Number.isSafeInteger(design.menuRevision) || design.menuRevision < 1)))) return { outcome: "failed", message: "De bestemming of ontwerpen zijn ongeldig. Je opgeslagen ontwerpen blijven behouden; controleer je selectie." };
  const client = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !client) return { outcome: "failed", message: "De beveiligde datasessie ontbreekt. Je ontwerpen blijven behouden. Log opnieuw in." };
  try {
    const [screens, slides] = await Promise.all([
      client.from("screens").select("id").eq("tenant_id", session.tenantId).is("deleted_at", null).eq("status", "active").in("id", destination.screenIds),
      client.from("dynamic_slides").select("id,status,current_snapshot_id,active_draft_version_id,configuration_json").eq("tenant_id", session.tenantId).neq("status", "archived").in("id", input.designs.map(design => design.slideId))
    ]);
    if (screens.error || slides.error) return { outcome: "failed", message: "De bestemming kon niet veilig worden gecontroleerd. Je ontwerpen blijven behouden. Probeer opnieuw." };
    if (screens.data?.length !== destination.screenIds.length || slides.data?.length !== input.designs.length) return { outcome: "failed", message: "Een scherm of ontwerp hoort niet meer bij je actieve vereniging. Er is niets toegevoegd. Controleer je selectie." };
    if (slides.data.some(slide => slide.status !== "ready" || !slide.current_snapshot_id || slide.active_draft_version_id)) return { outcome: "pending", message: "Je ontwerpen zijn opgeslagen. De nieuwe previews worden nog voorbereid, of een menuconcept moet eerst worden gepubliceerd. Je playlist en huidige publicatie blijven ongewijzigd." };
    const operations = input.designs.map(design => {
      const slide = slides.data!.find(value => value.id === design.slideId)!;
      const configuration = slide.configuration_json as { revision?: unknown } | null;
      if ((design.snapshotId && design.snapshotId !== slide.current_snapshot_id) || (design.menuRevision !== undefined && configuration?.revision !== design.menuRevision)) return null;
      return { operation: "add_dynamic" as const, clientId: design.clientId, dynamicSlideId: design.slideId, expectedSnapshotId: slide.current_snapshot_id!, durationSeconds: design.durationSeconds };
    });
    if (operations.some(operation => !operation)) return { outcome: "conflict", message: "Een opgeslagen ontwerp is intussen gewijzigd. Er is niets toegevoegd. Je keuzes blijven behouden; open de nieuwste ontwerpversie en controleer de bestemming opnieuw." };
    const result = await savePlaylistBatch({ playlistId: destination.playlistId, expectedRevision: destination.expectedRevision, idempotencyKey: input.idempotencyKey, operations: operations.filter((operation): operation is NonNullable<typeof operation> => operation !== null) });
    if (result.outcome === "conflict") return { outcome: "conflict", message: "De playlist is intussen gewijzigd. Er is niets uit deze toevoeging toegepast. Je ontwerpen en bestemming blijven behouden; open de playlist en vergelijk je wijzigingen." };
    if (result.outcome === "failed") return { outcome: "failed", message: result.message };
    return { outcome: "ready", actualRevision: result.actualRevision, url: `/dashboard/playlists/${destination.playlistId}/publish?screens=${encodeURIComponent(destination.screenIds.join(","))}` };
  } catch { return { outcome: "failed", message: "De verbinding werd onderbroken. De toevoeging kon niet worden bevestigd. Je ontwerpen blijven behouden; probeer met dezelfde sleutel opnieuw." }; }
}
