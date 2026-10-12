"use server";

import { revalidatePath } from "next/cache";
import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type SitesMediaMetadataResult = {
  status: "saved" | "conflict" | "error";
  message: string;
  actualUpdatedAt?: string;
};

function containsControlCharacter(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function labels(value: FormDataEntryValue | null, minimum: number, maximum: number): string[] | null {
  const raw = String(value ?? "");
  if (raw.length > 2500) return null;
  const values = [...new Set(raw.split(",").map(value => value.trim().normalize("NFC")).filter(Boolean))];
  return values.length <= 20 && values.every(value => value.length >= minimum && value.length <= maximum && !containsControlCharacter(value)) ? values : null;
}

export async function saveSitesMediaMetadata(formData: FormData): Promise<SitesMediaMetadataResult> {
  const assetId = String(formData.get("assetId") ?? ""), key = String(formData.get("idempotencyKey") ?? ""), updatedAt = String(formData.get("expectedUpdatedAt") ?? "");
  const title = String(formData.get("title") ?? "").trim(), folderId = String(formData.get("folderId") ?? ""), tags = labels(formData.get("tags"), 1, 48), collections = labels(formData.get("collections"), 2, 80);
  const error = (message: string): SitesMediaMetadataResult => ({ status: "error", message });
  if (!uuid.test(assetId) || !uuid.test(key) || (folderId && !uuid.test(folderId)) || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)) || title.length < 2 || title.length > 120 || containsControlCharacter(title) || !tags || !collections) {
    return error("De mediagegevens zijn niet geldig. Gebruik een naam van 2 tot 120 tekens en maximaal 20 tags (1–48 tekens) of collecties (2–80 tekens); je invoer blijft behouden.");
  }
  const session = await requireTenantCapability("tenant.media.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) return error("De veilige verbinding is niet beschikbaar. Er is niets opgeslagen; je invoer blijft behouden. Herstel de verbinding en probeer opnieuw.");
  try {
    const { data, error: failure } = await supabase.rpc("save_media_metadata_v1", {
      p_tenant_id: session.tenantId, p_asset_id: assetId, p_expected_updated_at: updatedAt,
      p_payload: { title, folderId: folderId || null, tags, collections, favorite: formData.get("favorite") === "on" },
      p_idempotency_key: key
    });
    if (failure) return error(failure.code === "42501" ? "Je mag deze media niet wijzigen. Er is niets opgeslagen; je invoer blijft behouden." : "De mediagegevens konden niet veilig worden opgeslagen. Je invoer blijft behouden; probeer opnieuw.");
    if (!data || typeof data !== "object" || Array.isArray(data)) return error("De server gaf geen volledige opslagbevestiging. Je invoer blijft behouden; probeer dezelfde opslagactie opnieuw.");
    const receipt = data as Record<string, unknown>;
    if (receipt.outcome === "conflict") return { status: "conflict", message: "Deze media is in een andere sessie gewijzigd. Je eigen invoer blijft behouden; open de actuele gegevens om de wijzigingen samen te voegen.", actualUpdatedAt: typeof receipt.actualUpdatedAt === "string" ? receipt.actualUpdatedAt : undefined };
    if (receipt.outcome !== "applied" || receipt.assetId !== assetId || typeof receipt.actualUpdatedAt !== "string" || !Number.isFinite(Date.parse(receipt.actualUpdatedAt))) return error("De server gaf geen volledige opslagbevestiging. Je invoer blijft behouden; probeer dezelfde opslagactie opnieuw.");
    revalidatePath("/dashboard/media");
    return { status: "saved", message: "Mediagegevens opgeslagen.", actualUpdatedAt: receipt.actualUpdatedAt };
  } catch {
    return error("De opslagbevestiging kon niet worden ontvangen. Je invoer blijft behouden; probeer dezelfde opslagactie opnieuw.");
  }
}
