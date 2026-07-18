"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent
} from "react";

import {
  cancelMediaVideoUpload,
  finalizeMediaVideoUpload,
  prepareMediaVideoUpload
} from "./actions";

type VideoUploadFormProps = {
  anonKey: string;
  canUpload: boolean;
  supabaseUrl: string;
};

type UploadNotice = {
  message: string;
  tone: "critical" | "success" | "warning";
};

export function VideoUploadForm({
  anonKey,
  canUpload,
  supabaseUrl
}: VideoUploadFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [finalizationSessionId, setFinalizationSessionId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("video-title") ?? "").trim();
    const file = formData.get("video-file");
    if (!(file instanceof File) || file.size === 0) {
      setNotice({
        message: "Kies een MP4-video met inhoud. De upload is niet gestart.",
        tone: "critical"
      });
      return;
    }

    setIsBusy(true);
    setNotice({
      message: "Castivo maakt een afgeschermde uploadsessie aan.",
      tone: "warning"
    });
    const preparation = await prepareMediaVideoUpload({
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type,
      title
    });
    if (!preparation.ok) {
      setIsBusy(false);
      setNotice({ message: preparation.message, tone: "critical" });
      return;
    }

    const { upload } = preparation;
    setNotice({
      message: "De video wordt rechtstreeks naar de private tenantopslag gestuurd. Sluit dit venster nog niet.",
      tone: "warning"
    });
    const supabase = createBrowserClient(supabaseUrl, anonKey);
    const { error: uploadError } = await supabase.storage
      .from(upload.bucket)
      .uploadToSignedUrl(upload.path, upload.token, file, {
        cacheControl: "31536000",
        contentType: "video/mp4",
        upsert: false
    });
    if (uploadError) {
      const cancellation = await cancelMediaVideoUpload(upload.uploadSessionId);
      setIsBusy(false);
      setNotice({
        message: cancellation.blocked && cancellation.removed
          ? "De overdracht naar private opslag is mislukt. Het item is geblokkeerd en opgeruimd; controleer je verbinding en probeer opnieuw."
          : cancellation.blocked
            ? "De overdracht is mislukt en het item is geblokkeerd. Opslagopruiming kon niet worden bevestigd; een beheerder kan het weesbestand verwijderen."
            : "De overdracht is mislukt en Castivo kon blokkering niet bevestigen. Vernieuw de mediabibliotheek en neem contact op met een beheerder voordat je opnieuw uploadt.",
        tone: "critical"
      });
      return;
    }

    setFinalizationSessionId(upload.uploadSessionId);
    await finalize(upload.uploadSessionId);
  }

  async function finalize(uploadSessionId: string) {
    setIsBusy(true);
    setNotice({
      message: "Castivo vergelijkt opslagmetadata en zet daarna één verwerkingsjob klaar.",
      tone: "warning"
    });
    const result = await finalizeMediaVideoUpload(uploadSessionId);
    setIsBusy(false);
    setNotice({
      message: result.message,
      tone: result.ok ? "success" : "critical"
    });
    if (result.ok) {
      setFinalizationSessionId(null);
      formRef.current?.reset();
    }
  }

  return (
    <form
      aria-busy={isBusy}
      className="upload-form"
      onSubmit={submit}
      ref={formRef}
    >
      <div className="field">
        <label htmlFor="video-title">Videotitel</label>
        <input
          disabled={!canUpload || isBusy}
          id="video-title"
          maxLength={120}
          minLength={2}
          name="video-title"
          placeholder="Bijvoorbeeld welkom loop"
          required
          type="text"
        />
      </div>
      <div className="field">
        <label htmlFor="video-file">Videobestand</label>
        <input
          accept="video/mp4,.mp4"
          disabled={!canUpload || isBusy}
          id="video-file"
          name="video-file"
          required
          type="file"
        />
      </div>
      <UploadButton disabled={!canUpload || isBusy} type="submit" variant="primary">
        {isBusy ? "Video verwerken…" : "Video uploaden"}
      </UploadButton>
      {finalizationSessionId && !isBusy && notice?.tone === "critical" ? (
        <UploadButton
          onClick={() => finalize(finalizationSessionId)}
          type="button"
          variant="secondary"
        >
          Afronding opnieuw proberen
        </UploadButton>
      ) : null}
      {notice ? (
        <p
          className={`notice notice--${notice.tone}`}
          role={notice.tone === "critical" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}
      {!canUpload ? (
        <p className="notice notice--warning" role="status">
          Video uploaden vereist editor- of beheerrechten en een actieve tenantverbinding.
        </p>
      ) : null}
    </form>
  );
}

function UploadButton({
  className,
  variant,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant: "primary" | "secondary";
}) {
  const classes = ["button-link", `button-link--${variant}`, className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...props} />;
}
