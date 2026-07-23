"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  MediaUploadError,
  uploadValidatedImage
} from "../../../../lib/media/validated-image-upload";
import {
  cancelValidatedVideoUpload,
  finalizeValidatedVideoUpload,
  prepareValidatedVideoUpload,
  type VideoUploadCandidate
} from "../../../../lib/media/validated-video-upload";
import { requireTenantCapability } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import {
  mediaViewHref,
  mediaViewStateToStorage,
  parseMediaViewStatePayload,
  type MediaViewState
} from "./saved-media-view";

export async function uploadMediaImage(formData: FormData) {
  await requireTenantCapability("tenant.media.write");
  let message: string;

  try {
    const result = await uploadValidatedImage(formData);
    message = `${result.title} is gecontroleerd en gereed voor playlists.`;
  } catch (error) {
    if (error instanceof MediaUploadError) {
      redirect(`/dashboard/media?fout=${encodeURIComponent(error.message)}#upload`);
    }

    console.error("Onverwachte media-uploadfout", error);
    redirect(
      "/dashboard/media?fout=De+upload+is+onverwacht+afgebroken.+Er+is+geen+media+beschikbaar+gemaakt%3B+probeer+opnieuw.#upload"
    );
  }

  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard/pilot");
  redirect(`/dashboard/media?succes=${encodeURIComponent(message)}#upload`);
}

export async function prepareMediaVideoUpload(candidate: VideoUploadCandidate) {
  await requireTenantCapability("tenant.media.write");
  try {
    return {
      ok: true as const,
      upload: await prepareValidatedVideoUpload(candidate)
    };
  } catch (error) {
    if (!(error instanceof MediaUploadError)) {
      console.error("Onverwachte video-uploadvoorbereidingsfout", error);
    }
    return {
      message: error instanceof MediaUploadError
        ? error.message
        : "De video-upload kon onverwacht niet worden voorbereid. Er is niets opgeslagen; probeer opnieuw.",
      ok: false as const
    };
  }
}

export async function finalizeMediaVideoUpload(uploadSessionId: string) {
  await requireTenantCapability("tenant.media.write");
  try {
    await finalizeValidatedVideoUpload(uploadSessionId);
    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard/pilot");
    return {
      message: "De video staat veilig in de verwerkingsqueue. Na controle en normalisatie wordt die beschikbaar voor playlists.",
      ok: true as const
    };
  } catch (error) {
    if (!(error instanceof MediaUploadError)) {
      console.error("Onverwachte videofinalisatiefout", error);
    }
    return {
      message: error instanceof MediaUploadError
        ? error.message
        : "De upload kon onverwacht niet worden afgerond. De video is niet beschikbaar gemaakt; probeer de afronding opnieuw.",
      ok: false as const,
      retryable: !(error instanceof MediaUploadError && error.message.includes("quarantaine"))
    };
  }
}

export async function cancelMediaVideoUpload(uploadSessionId: string) {
  await requireTenantCapability("tenant.media.write");
  try {
    const result = await cancelValidatedVideoUpload(uploadSessionId);
    revalidatePath("/dashboard/media");
    return result;
  } catch (error) {
    console.error("Mislukte video-upload opruimen mislukt", error);
    return { blocked: false, removed: false };
  }
}

export async function renameMediaAsset(formData: FormData) {
  const { session, supabase } = await requireMediaWriter();
  const assetId = mediaId(formData);
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2 || title.length > 120) {
    fail(assetId, "Gebruik een mediatitel van 2 tot en met 120 tekens.");
  }

  const { error } = await supabase.from("media_assets").update({ title }).eq("id", assetId).eq("tenant_id", session.tenantId).is("deleted_at", null);
  if (error) fail(assetId, "De mediatitel kon niet worden opgeslagen. Het bestand en de huidige titel blijven ongewijzigd.");
  completeAsset(assetId, "De mediatitel is opgeslagen.");
}

export async function archiveMediaAsset(formData: FormData) {
  const { session, supabase } = await requireMediaWriter();
  const assetId = mediaId(formData);
  const { count, error: usageError } = await supabase.from("playlist_items").select("id", { count: "exact", head: true }).eq("tenant_id", session.tenantId).eq("media_asset_id", assetId);
  if (usageError) fail(assetId, "Het gebruik van deze media kon niet worden gecontroleerd. Er is niets gearchiveerd.");
  if ((count ?? 0) > 0) fail(assetId, "Deze media staat nog in een playlist. Verwijder het item daar eerst; bestaande releases blijven altijd intact.");

  const { error } = await supabase.from("media_assets").update({ deleted_at: new Date().toISOString() }).eq("id", assetId).eq("tenant_id", session.tenantId).is("deleted_at", null);
  if (error) fail(assetId, "De media kon niet veilig worden gearchiveerd. Het opslagobject blijft beschikbaar en er is niets gewijzigd.");
  revalidatePath("/dashboard/media");
  redirect("/dashboard/media?succes=De+media+is+gearchiveerd.+Bestaande+immutable+releases+blijven+ongewijzigd.");
}

export async function retryMediaProcessing(formData: FormData) {
  const { supabase } = await requireMediaWriter();
  const assetId = mediaId(formData);
  const { error } = await supabase.rpc("retry_media_processing", { p_asset_id: assetId });
  if (error) fail(assetId, "Alleen een actieve video met mislukte verwerking en een bestaande job kan opnieuw worden gestart. Upload de video opnieuw als deze fout blijft staan.");
  completeAsset(assetId, "De video staat opnieuw in de verwerkingsqueue. De huidige releases blijven ongewijzigd.");
}

export async function createMediaFolder(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 120) fail(null, "Gebruik een mapnaam van maximaal 120 tekens.");
  await organizeMedia(formData, "create_folder", {
    name,
    parentFolderId: optionalId(formData, "parentFolderId")
  });
  completeLibrary("De mediamap is gemaakt.");
}

export async function createMediaTag(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  if (name.length < 1 || name.length > 48) fail(null, "Gebruik een tagnaam van maximaal 48 tekens.");
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) fail(null, "Gebruik een geldige hexkleur voor de tag.");
  await organizeMedia(formData, "create_tag", { color: color || null, name });
  completeLibrary("De mediatag is gemaakt.");
}

export async function moveMediaAsset(formData: FormData) {
  const assetId = mediaId(formData);
  await organizeMedia(formData, "move_asset", {
    assetId,
    folderId: optionalId(formData, "folderId")
  });
  completeAsset(assetId, "De media is naar de gekozen map verplaatst.");
}

export async function setMediaFavorite(formData: FormData) {
  const assetId = mediaId(formData);
  await organizeMedia(formData, "set_favorite", {
    assetId,
    favorite: formData.get("favorite") === "true"
  });
  completeAsset(assetId, formData.get("favorite") === "true"
    ? "De media staat in je favorieten."
    : "De media is uit je favorieten verwijderd.");
}

export async function assignMediaTag(formData: FormData) {
  const assetId = mediaId(formData);
  await organizeMedia(formData, "assign_tag", {
    assetId,
    tagId: requiredId(formData, "tagId")
  });
  completeAsset(assetId, "De tag is aan deze media toegevoegd.");
}

export async function removeMediaTag(formData: FormData) {
  const assetId = mediaId(formData);
  await organizeMedia(formData, "remove_tag", {
    assetId,
    tagId: requiredId(formData, "tagId")
  });
  completeAsset(assetId, "De tag is van deze media verwijderd.");
}

export async function saveMediaView(formData: FormData) {
  const { session, supabase } = await requirePersonalMediaViewSession();
  const state = parseMediaViewStatePayload(formData.get("viewState"));
  if (!state) failView(null, "De huidige filters zijn ongeldig. Pas de filters opnieuw toe en probeer daarna nogmaals.");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    failView(state, "Gebruik een naam van 2 tot en met 80 tekens.");
  }
  const storage = mediaViewStateToStorage(state);
  const { error } = await supabase.from("publisher_saved_views").insert({
    column_json: storage.columnJson,
    density: storage.density,
    filter_json: storage.filterJson,
    is_default: false,
    name,
    resource_type: "media",
    sort_json: storage.sortJson,
    tenant_id: session.tenantId,
    user_id: session.userId
  });

  if (error) {
    console.error("Persoonlijke mediaweergave opslaan mislukt", {
      code: error.code
    });
    failView(
      state,
      error.code === "23505"
        ? "Je hebt al een mediaweergave met deze naam. Kies een andere naam."
        : error.code === "42501"
          ? "Je mag binnen deze vereniging geen persoonlijke weergave opslaan."
          : "De mediaweergave kon niet veilig worden opgeslagen. Je filters zijn niet gewijzigd; probeer opnieuw."
    );
  }

  completeView(state, "Je persoonlijke mediaweergave is opgeslagen.");
}

export async function deleteMediaView(formData: FormData) {
  const { session, supabase } = await requirePersonalMediaViewSession();
  const state = parseMediaViewStatePayload(formData.get("viewState"));
  if (!state) failView(null, "De huidige filters zijn ongeldig. Vernieuw de mediabibliotheek.");
  const viewId = requiredId(formData, "viewId");
  const expectedRevision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    failView(state, "De opgeslagen weergave is verouderd. Vernieuw de mediabibliotheek.");
  }

  const { data, error } = await supabase
    .from("publisher_saved_views")
    .delete()
    .eq("id", viewId)
    .eq("tenant_id", session.tenantId)
    .eq("user_id", session.userId)
    .eq("resource_type", "media")
    .eq("revision", expectedRevision)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Persoonlijke mediaweergave verwijderen mislukt", {
      code: error.code
    });
    failView(state, "De persoonlijke mediaweergave kon niet worden verwijderd. Je media en filters zijn niet gewijzigd.");
  }
  if (!data) {
    failView(state, "De persoonlijke mediaweergave bestaat niet meer of is intussen gewijzigd. Vernieuw de pagina.");
  }
  completeView(state, "De persoonlijke mediaweergave is verwijderd.");
}

async function organizeMedia(
  formData: FormData,
  operation: "assign_tag" | "create_folder" | "create_tag" | "move_asset" | "remove_tag" | "set_favorite",
  payload: Record<string, boolean | string | null>
) {
  const { session, supabase } = await requireMediaWriter();
  const { data, error } = await supabase.rpc("mutate_media_organization_v1", {
    p_idempotency_key: idempotencyValue(formData),
    p_operation: operation,
    p_payload: payload,
    p_tenant_id: session.tenantId
  });
  if (error) {
    console.error(`Mediaorganisatie ${operation} mislukt`, error);
    fail(typeof payload.assetId === "string" ? payload.assetId : null, organizationError(error.code));
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail(typeof payload.assetId === "string" ? payload.assetId : null, "De wijziging gaf geen veilige bevestiging. Vernieuw de mediabibliotheek.");
  }
}

async function requireMediaWriter() {
  const session = await requireTenantCapability("tenant.media.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) fail(null, "Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  return { session, supabase };
}

async function requirePersonalMediaViewSession() {
  const session = await requireTenantCapability("tenant.media.read");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    failView(null, "Live Supabase is niet beschikbaar. Er is geen persoonlijke weergave gewijzigd; herstel de configuratie en log opnieuw in.");
  }
  return { session, supabase };
}

function mediaId(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) fail(null, "De gekozen media is ongeldig. Er is niets gewijzigd; laad de pagina opnieuw.");
  return assetId;
}

function requiredId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!uuidPattern.test(value)) fail(null, "De gekozen map of tag is ongeldig. Vernieuw de pagina.");
  return value;
}

function optionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value ? requiredId(formData, key) : null;
}

function idempotencyValue(formData: FormData) {
  const value = String(formData.get("idempotencyKey") ?? "");
  return uuidPattern.test(value) ? value : randomUUID();
}

function organizationError(code: string | undefined) {
  if (code === "23505") return "Deze map- of tagnaam bestaat al. Kies een andere naam.";
  if (code === "P0002") return "De media, map of tag bestaat niet meer. Vernieuw de bibliotheek.";
  if (code === "42501") return "Je mag de mediabibliotheek niet organiseren. Er is niets gewijzigd.";
  if (code === "23514") return "Deze wijziging zou een ongeldige mapstructuur of verwijzing maken. Er is niets gewijzigd.";
  return "De mediabibliotheek kon niet veilig worden georganiseerd. Probeer opnieuw.";
}

function fail(assetId: string | null, message: string): never {
  const selected = assetId ? `asset=${encodeURIComponent(assetId)}&` : "";
  redirect(`/dashboard/media?${selected}fout=${encodeURIComponent(message)}`);
}

function completeAsset(assetId: string, message: string): never {
  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard/playlists");
  redirect(`/dashboard/media?asset=${assetId}&succes=${encodeURIComponent(message)}`);
}

function completeLibrary(message: string): never {
  revalidatePath("/dashboard/media");
  redirect(`/dashboard/media?succes=${encodeURIComponent(message)}`);
}

function failView(state: MediaViewState | null, message: string): never {
  redirect(viewResultHref(state, "fout", message));
}

function completeView(state: MediaViewState, message: string): never {
  revalidatePath("/dashboard/media");
  redirect(viewResultHref(state, "succes", message));
}

function viewResultHref(
  state: MediaViewState | null,
  key: "fout" | "succes",
  message: string
) {
  const href = mediaViewHref(state ?? {});
  return `${href}${href.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
