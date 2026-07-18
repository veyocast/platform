"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  MediaUploadError,
  uploadValidatedImage
} from "../../../../lib/media/validated-image-upload";

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
