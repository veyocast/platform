"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Upload } from "tus-js-client";
import {
  useEffect,
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

type PendingUpload = {
  fileLastModified: number;
  fileName: string;
  fileSizeBytes: number;
  idempotencyKey: string;
  title: string;
  uploadSessionId: string;
};

const pendingUploadKey = "veyocast:media-upload:pending:v1";
const tusChunkSize = 6 * 1024 * 1024;

export function VideoUploadForm({
  anonKey,
  canUpload,
  supabaseUrl
}: VideoUploadFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const progressRef = useRef(0);
  const uploadRef = useRef<Upload | null>(null);
  const pendingRef = useRef<PendingUpload | null>(null);
  const router = useRouter();
  const [finalizationSessionId, setFinalizationSessionId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const pending = readPendingUpload();
    if (!pending) return;
    pendingRef.current = pending;
    setNotice({
      message: `Een onderbroken upload van ${pending.fileName} kan worden hervat. Kies hetzelfde bestand; reeds verstuurde delen worden niet opnieuw verzonden.`,
      tone: "warning"
    });
  }, []);

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

    if (file.type !== "video/mp4" || !/\.mp4$/i.test(file.name)) {
      setNotice({
        message: "Kies een echt MP4-bestand. Extensie en gedeclareerd bestandstype moeten beide video/mp4 zijn.",
        tone: "critical"
      });
      return;
    }

    setIsBusy(true);
    setIsPaused(false);
    setProgress(0);
    progressRef.current = 0;
    setNotice({
      message: "VeyoCast controleert quota en maakt een afgeschermde uploadintent aan.",
      tone: "warning"
    });

    const previous = readPendingUpload();
    const matchesPrevious = previous
      && previous.fileName === file.name
      && previous.fileSizeBytes === file.size
      && previous.fileLastModified === file.lastModified
      && previous.title === title;
    const idempotencyKey = matchesPrevious
      ? previous.idempotencyKey
      : window.crypto.randomUUID();

    const preparation = await prepareMediaVideoUpload({
      fileName: file.name,
      fileSizeBytes: file.size,
      idempotencyKey,
      mimeType: file.type,
      title
    });
    if (!preparation.ok) {
      setIsBusy(false);
      setNotice({ message: preparation.message, tone: "critical" });
      return;
    }

    const { upload } = preparation;
    const pending: PendingUpload = {
      fileLastModified: file.lastModified,
      fileName: file.name,
      fileSizeBytes: file.size,
      idempotencyKey,
      title,
      uploadSessionId: upload.uploadSessionId
    };
    pendingRef.current = pending;
    writePendingUpload(pending);

    const supabase = createBrowserClient(supabaseUrl, anonKey);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setIsBusy(false);
      setNotice({
        message: "De beveiligde sessie is verlopen. De uploadintent blijft bewaard; log opnieuw in en kies daarna hetzelfde bestand om te hervatten.",
        tone: "critical"
      });
      return;
    }

    const tusUpload = new Upload(file, {
      chunkSize: tusChunkSize,
      endpoint: resumableEndpoint(supabaseUrl),
      fingerprint: () => Promise.resolve(
        `veyocast:${upload.uploadSessionId}:${file.name}:${file.size}:${file.lastModified}`
      ),
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${session.access_token}`
      },
      metadata: {
        bucketName: upload.bucket,
        cacheControl: "31536000",
        contentType: "video/mp4",
        objectName: upload.path
      },
      onError(error) {
        console.error("Hervatbare video-upload onderbroken", error);
        setIsBusy(false);
        setIsPaused(true);
        setNotice({
          message: `De verbinding is onderbroken bij ${Math.round(progressRef.current)}%. De server heeft het bestand niet geactiveerd. Kies Hervatten of selecteer na een herlaadactie hetzelfde bestand.`,
          tone: "critical"
        });
      },
      onProgress(bytesUploaded, bytesTotal) {
        const next = bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0;
        progressRef.current = next;
        setProgress(next);
        setNotice({
          message: `${formatBytes(bytesUploaded)} van ${formatBytes(bytesTotal)} veilig verstuurd. Navigeren of herladen is toegestaan; kies daarna hetzelfde bestand om door te gaan.`,
          tone: "warning"
        });
      },
      onSuccess() {
        setProgress(100);
        progressRef.current = 100;
        setFinalizationSessionId(upload.uploadSessionId);
        void finalize(upload.uploadSessionId);
      },
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      uploadDataDuringCreation: true
    });
    uploadRef.current = tusUpload;

    const previousUploads = await tusUpload.findPreviousUploads();
    if (previousUploads[0]) {
      tusUpload.resumeFromPreviousUpload(previousUploads[0]);
      setNotice({
        message: "De vorige overdracht is gevonden. VeyoCast hervat vanaf het laatst bevestigde deel.",
        tone: "warning"
      });
    }
    tusUpload.start();
  }

  async function pause() {
    if (!uploadRef.current) return;
    await uploadRef.current.abort(false);
    setIsBusy(false);
    setIsPaused(true);
    setNotice({
      message: `Upload gepauzeerd op ${Math.round(progress)}%. De reeds bevestigde delen blijven maximaal 23 uur hervatbaar.`,
      tone: "warning"
    });
  }

  function resume() {
    if (!uploadRef.current) return;
    setIsBusy(true);
    setIsPaused(false);
    setNotice({ message: "De upload wordt hervat.", tone: "warning" });
    uploadRef.current.start();
  }

  async function cancel() {
    const sessionId = pendingRef.current?.uploadSessionId;
    if (!sessionId) return;
    setIsBusy(true);
    try {
      await uploadRef.current?.abort(true);
    } catch {
      // De serveractie ruimt het exacte tenantpad ook op wanneer TUS-terminatie faalt.
    }
    const cancellation = await cancelMediaVideoUpload(sessionId);
    setIsBusy(false);
    setIsPaused(false);
    setProgress(0);
    progressRef.current = 0;
    if (cancellation.blocked) {
      clearPendingUpload();
      pendingRef.current = null;
      uploadRef.current = null;
      formRef.current?.reset();
    }
    setNotice({
      message: cancellation.blocked
        ? cancellation.removed
          ? "De upload is geannuleerd en het tijdelijke opslagobject is verwijderd."
          : "De upload is geblokkeerd. Automatische opslagopruiming kon niet worden bevestigd; de verlopen TUS-upload wordt door opslag opgeruimd."
        : "Annuleren kon niet veilig worden bevestigd. De media is niet geactiveerd; vernieuw de bibliotheek voordat je opnieuw probeert.",
      tone: cancellation.blocked ? "warning" : "critical"
    });
    router.refresh();
  }

  async function finalize(uploadSessionId: string) {
    setIsBusy(true);
    setIsPaused(false);
    setNotice({
      message: "VeyoCast vergelijkt opslagmetadata en zet daarna precies één verwerkingsjob klaar.",
      tone: "warning"
    });
    const result = await finalizeMediaVideoUpload(uploadSessionId);
    setIsBusy(false);
    setNotice({ message: result.message, tone: result.ok ? "success" : "critical" });
    if (result.ok) {
      clearPendingUpload();
      pendingRef.current = null;
      uploadRef.current = null;
      setFinalizationSessionId(null);
      formRef.current?.reset();
      router.refresh();
    } else if (!result.retryable) {
      clearPendingUpload();
      pendingRef.current = null;
      uploadRef.current = null;
      setFinalizationSessionId(null);
      router.refresh();
    }
  }

  return (
    <form aria-busy={isBusy} className="upload-form" onSubmit={submit} ref={formRef}>
      <div className="field">
        <label htmlFor="video-title">Videotitel</label>
        <input disabled={!canUpload || isBusy || isPaused} id="video-title" maxLength={120} minLength={2} name="video-title" placeholder="Bijvoorbeeld welkom loop" required type="text" />
      </div>
      <div className="field">
        <label htmlFor="video-file">Videobestand</label>
        <input accept="video/mp4,.mp4" disabled={!canUpload || isBusy || isPaused} id="video-file" name="video-file" required type="file" />
      </div>
      {progress > 0 ? (
        <div className="upload-progress">
          <div className="upload-progress__copy"><span>Overdracht</span><strong>{Math.round(progress)}%</strong></div>
          <progress aria-label="Voortgang video-upload" max={100} value={progress}>{Math.round(progress)}%</progress>
        </div>
      ) : null}
      <div className="upload-actions">
        {!isPaused ? (
          <UploadButton disabled={!canUpload || isBusy} type="submit" variant="primary">
            {isBusy ? "Video versturen…" : "Video uploaden"}
          </UploadButton>
        ) : (
          <UploadButton onClick={resume} type="button" variant="primary">Hervatten</UploadButton>
        )}
        {isBusy && uploadRef.current ? (
          <UploadButton onClick={pause} type="button" variant="secondary">Pauzeren</UploadButton>
        ) : null}
        {pendingRef.current ? (
          <UploadButton disabled={isBusy && !uploadRef.current} onClick={cancel} type="button" variant="secondary">Annuleren</UploadButton>
        ) : null}
      </div>
      {finalizationSessionId && !isBusy && notice?.tone === "critical" ? (
        <UploadButton onClick={() => finalize(finalizationSessionId)} type="button" variant="secondary">Afronding opnieuw proberen</UploadButton>
      ) : null}
      {notice ? <p className={`notice notice--${notice.tone}`} role={notice.tone === "critical" ? "alert" : "status"}>{notice.message}</p> : null}
      {!canUpload ? <p className="notice notice--warning" role="status">Video uploaden vereist editor- of beheerrechten en een actieve tenantverbinding.</p> : null}
    </form>
  );
}

function resumableEndpoint(supabaseUrl: string) {
  const endpoint = new URL(supabaseUrl);
  if (endpoint.hostname.endsWith(".supabase.co") && !endpoint.hostname.endsWith(".storage.supabase.co")) {
    endpoint.hostname = endpoint.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  endpoint.pathname = "/storage/v1/upload/resumable";
  endpoint.search = "";
  return endpoint.toString();
}

function readPendingUpload(): PendingUpload | null {
  try {
    const value = window.localStorage.getItem(pendingUploadKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PendingUpload>;
    if (
      typeof parsed.fileName !== "string" || typeof parsed.fileSizeBytes !== "number"
      || typeof parsed.fileLastModified !== "number" || typeof parsed.idempotencyKey !== "string"
      || typeof parsed.title !== "string" || typeof parsed.uploadSessionId !== "string"
    ) return null;
    return parsed as PendingUpload;
  } catch {
    return null;
  }
}

function writePendingUpload(upload: PendingUpload) {
  window.localStorage.setItem(pendingUploadKey, JSON.stringify(upload));
}

function clearPendingUpload() {
  window.localStorage.removeItem(pendingUploadKey);
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function UploadButton({ className, variant, ...props }: ComponentPropsWithoutRef<"button"> & { variant: "primary" | "secondary" }) {
  const classes = ["button-link", `button-link--${variant}`, className].filter(Boolean).join(" ");
  return <button className={classes} {...props} />;
}
