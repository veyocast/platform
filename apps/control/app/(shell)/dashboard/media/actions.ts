"use server";

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

async function requireMediaWriter() {
  const session = await requireTenantCapability("tenant.media.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) fail(null, "Live Supabase is niet beschikbaar. Er is niets gewijzigd; herstel de configuratie en log opnieuw in.");
  return { session, supabase };
}

function mediaId(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) fail(null, "De gekozen media is ongeldig. Er is niets gewijzigd; laad de pagina opnieuw.");
  return assetId;
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
