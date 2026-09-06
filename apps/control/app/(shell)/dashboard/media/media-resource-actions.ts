"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type MediaArchiveState = {
  archivedCount: number;
  blockedAssetIds: string[];
  draftReferenceCount: number;
  failedAssetIds: string[];
  message: string;
  status: "blocked" | "error" | "idle" | "success";
};

export async function archiveMediaResources(
  _previous: MediaArchiveState,
  formData: FormData
): Promise<MediaArchiveState> {
  const assetIds = parseIds(formData.get("assetIds"));
  const expectedDraftCounts = parseExpectedCounts(formData.get("expectedDraftCounts"));
  const override = formData.get("override") === "true";
  if (!assetIds || !expectedDraftCounts || assetIds.some((id) => !(id in expectedDraftCounts))) {
    return mediaArchiveError(
      "De mediaselectie of impacttelling is ongeldig. Er is niets verwijderd; wis de selectie en kies de media opnieuw."
    );
  }
  if (override && formData.get("confirmOverride") !== "on") {
    return mediaArchiveError(
      "Bevestig expliciet dat conceptplaatsingen ook verwijderd mogen worden. Er is niets gewijzigd."
    );
  }

  const session = await requireTenantCapability("tenant.media.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    return mediaArchiveError(
      "De beveiligde tenantsessie ontbreekt. Er is niets verwijderd; log opnieuw in en probeer het daarna nogmaals."
    );
  }

  const results = await Promise.all(assetIds.map(async (assetId) => {
    const expectedDraftCount = expectedDraftCounts[assetId]!;
    const { data, error } = await supabase.rpc("mutate_media_asset_v1", {
      p_asset_id: assetId,
      p_idempotency_key: randomUUID(),
      p_operation: "archive",
      p_payload: {
        expectedDraftCount,
        removeDraftReferences: override && expectedDraftCount > 0
      },
      p_tenant_id: session.tenantId
    });
    return { assetId, data, error, expectedDraftCount };
  }));

  const archivedIds = results.flatMap((result) =>
    !result.error && isRecord(result.data) && result.data.outcome === "applied"
      ? [result.assetId]
      : []
  );
  const blocked = results.filter((result) =>
    !override && result.error?.code === "23514" && result.expectedDraftCount > 0
  );
  const blockedAssetIds = blocked.map((result) => result.assetId);
  const failedAssetIds = results.flatMap((result) =>
    result.error && !blockedAssetIds.includes(result.assetId) ? [result.assetId] : []
  );
  const draftReferenceCount = blocked.reduce(
    (total, result) => total + result.expectedDraftCount,
    0
  );

  if (archivedIds.length) {
    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard/playlists");
  }
  if (failedAssetIds.length) {
    const firstFailure = results.find((result) => failedAssetIds.includes(result.assetId));
    console.error("Bulkarchivering media gedeeltelijk mislukt", {
      code: firstFailure?.error?.code ?? "INVALID_RESULT",
      failedCount: failedAssetIds.length
    });
  }

  if (blockedAssetIds.length) {
    return {
      archivedCount: archivedIds.length,
      blockedAssetIds,
      draftReferenceCount,
      failedAssetIds,
      message: `${blockedAssetIds.length} ${blockedAssetIds.length === 1 ? "item is" : "items zijn"} geblokkeerd door ${draftReferenceCount} ${draftReferenceCount === 1 ? "conceptplaylist" : "conceptplaylists"}.${archivedIds.length ? ` ${archivedIds.length} overige ${archivedIds.length === 1 ? "item is" : "items zijn"} al herstelbaar gearchiveerd.` : " Er is voor de geblokkeerde media niets gewijzigd."} Kies override alleen als die conceptplaatsingen ook verwijderd mogen worden; releases blijven immutable.`,
      status: "blocked"
    };
  }
  if (failedAssetIds.length) {
    return {
      archivedCount: archivedIds.length,
      blockedAssetIds: [],
      draftReferenceCount: 0,
      failedAssetIds,
      message: `${failedAssetIds.length} ${failedAssetIds.length === 1 ? "item kon" : "items konden"} niet veilig worden gearchiveerd.${archivedIds.length ? ` ${archivedIds.length} ${archivedIds.length === 1 ? "item is" : "items zijn"} wel gearchiveerd.` : " Er is niets gewijzigd."} Vernieuw de bibliotheek; het gebruik kan intussen zijn veranderd.`,
      status: "error"
    };
  }

  return {
    archivedCount: archivedIds.length,
    blockedAssetIds: [],
    draftReferenceCount: override
      ? assetIds.reduce((total, id) => total + expectedDraftCounts[id]!, 0)
      : 0,
    failedAssetIds: [],
    message: override
      ? `${archivedIds.length} ${archivedIds.length === 1 ? "media-item is" : "media-items zijn"} gearchiveerd en uit de bevestigde conceptplaylists verwijderd. Bestaande releases blijven afspeelbaar.`
      : `${archivedIds.length} ${archivedIds.length === 1 ? "media-item is" : "media-items zijn"} herstelbaar gearchiveerd. Bestaande releases blijven afspeelbaar.`,
    status: "success"
  };
}

function parseIds(value: FormDataEntryValue | null) {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ""));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) return null;
    const ids = [...new Set(parsed)];
    return ids.every((id): id is string => typeof id === "string" && uuidPattern.test(id))
      ? ids
      : null;
  } catch {
    return null;
  }
}

function parseExpectedCounts(value: FormDataEntryValue | null) {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ""));
    if (!isRecord(parsed)) return null;
    const entries = Object.entries(parsed);
    if (entries.length > 100) return null;
    if (!entries.every(([id, count]) => uuidPattern.test(id) && Number.isSafeInteger(count) && Number(count) >= 0)) {
      return null;
    }
    return Object.fromEntries(entries.map(([id, count]) => [id, Number(count)]));
  } catch {
    return null;
  }
}

function mediaArchiveError(message: string): MediaArchiveState {
  return {
    archivedCount: 0,
    blockedAssetIds: [],
    draftReferenceCount: 0,
    failedAssetIds: [],
    message,
    status: "error"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
