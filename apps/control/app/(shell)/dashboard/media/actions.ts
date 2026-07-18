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

export async function uploadMediaImage(formData: FormData) {
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
      ok: false as const
    };
  }
}

export async function cancelMediaVideoUpload(uploadSessionId: string) {
  try {
    const result = await cancelValidatedVideoUpload(uploadSessionId);
    revalidatePath("/dashboard/media");
    return result;
  } catch (error) {
    console.error("Mislukte video-upload opruimen mislukt", error);
    return { blocked: false, removed: false };
  }
}
