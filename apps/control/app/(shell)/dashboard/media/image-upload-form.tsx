"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button, StatusPill } from "@veyocast/ui";

import {
  imageUploadPolicyMessage,
  maxImageUploadBatchSize,
  validateImageUploadFile
} from "../../../../lib/media/image-upload-policy";
import type { ImageUploadApiResult } from "../../../../lib/media/image-upload-api";

type MediaImageUploadState = {
  completedAt: string | null;
  results: Array<{
    fileName: string;
    message: string;
    status: "critical" | "success";
  }>;
};

const initialState: MediaImageUploadState = {
  completedAt: null,
  results: []
};

export function ImageUploadForm({ canUpload }: { canUpload: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);

  const completedCount = state.results.filter(
    (result) => result.status === "success"
  ).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpload || pending) return;

    const files = [...(fileInputRef.current?.files ?? [])];
    if (files.length === 0) {
      setState(failureState("Geen bestand", "Kies minimaal één JPEG-, PNG- of WebP-bestand met inhoud."));
      return;
    }
    if (files.length > maxImageUploadBatchSize) {
      setState(failureState(
        "Selectie",
        `Upload maximaal ${maxImageUploadBatchSize} afbeeldingen per keer. Verklein de selectie en probeer opnieuw.`
      ));
      return;
    }

    setPending(true);
    const results: MediaImageUploadState["results"] = [];
    try {
      for (const file of files) {
        const policyFailure = validateImageUploadFile(file);
        if (policyFailure) {
          results.push({
            fileName: file.name,
            message: imageUploadPolicyMessage(policyFailure),
            status: "critical"
          });
          setState({ completedAt: null, results: [...results] });
          continue;
        }

        const formData = new FormData();
        formData.set("media", file);
        const suppliedTitle = titleInputRef.current?.value.trim() ?? "";
        formData.set(
          "title",
          files.length === 1 && suppliedTitle
            ? suppliedTitle
            : mediaTitleFromFileName(file.name)
        );

        try {
          const response = await fetch("/api/media/images", {
            body: formData,
            cache: "no-store",
            credentials: "same-origin",
            method: "POST"
          });
          const result = (await response.json().catch(() => null)) as
            | ImageUploadApiResult
            | null;

          if (!response.ok || !result?.ok) {
            const reference = result?.requestId
              ? ` Referentie: ${result.requestId}.`
              : "";
            results.push({
              fileName: file.name,
              message:
                result && !result.ok
                  ? `${result.error.message} ${result.error.recovery}${reference}`
                  : `De uploadservice gaf geen geldig antwoord.${reference} Probeer het bestand opnieuw.`,
              status: "critical"
            });
          } else {
            results.push({
              fileName: file.name,
              message: `${result.data.title} is gecontroleerd en gereed voor playlists.`,
              status: "success"
            });
          }
        } catch {
          results.push({
            fileName: file.name,
            message:
              "De uploadverbinding werd onderbroken. Dit bestand is niet beschikbaar gemaakt; probeer het opnieuw.",
            status: "critical"
          });
        }
        setState({ completedAt: null, results: [...results] });
      }

      const completedAt = new Date().toISOString();
      setState({ completedAt, results });
      if (results.some((result) => result.status === "success")) {
        formRef.current?.reset();
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-busy={pending}
      className="upload-form"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <div className="field">
        <label htmlFor="media-title">Titel voor één afbeelding</label>
        <input
          disabled={!canUpload || pending}
          id="media-title"
          maxLength={120}
          minLength={2}
          name="title"
          placeholder="Optioneel · standaard de bestandsnaam"
          ref={titleInputRef}
          type="text"
        />
      </div>
      <div className="field">
        <label htmlFor="media-file">Afbeeldingen</label>
        <input
          accept="image/jpeg,image/png,image/webp"
          disabled={!canUpload || pending}
          id="media-file"
          multiple
          name="media"
          ref={fileInputRef}
          required
          type="file"
        />
        <small>
          Maximaal {maxImageUploadBatchSize} bestanden; ieder bestand wordt
          afzonderlijk en veilig verzonden.
        </small>
      </div>
      <Button disabled={!canUpload || pending} type="submit">
        {pending ? "Afbeeldingen verifiëren…" : "Uploaden en verifiëren"}
      </Button>

      {state.results.length ? (
        <section
          aria-live="polite"
          className="media-upload-results"
          aria-label="Resultaat van afbeeldinguploads"
        >
          <div className="media-upload-results__summary">
            <strong>Uploadresultaat</strong>
            <StatusPill
              label={`${completedCount} van ${state.results.length} gereed`}
              tone={
                completedCount === state.results.length ? "success" : "warning"
              }
            />
          </div>
          <ul>
            {state.results.map((result, index) => (
              <li key={`${state.completedAt}-${result.fileName}-${index}`}>
                <span>
                  <strong>{result.fileName}</strong>
                  <small>{result.message}</small>
                </span>
                <StatusPill
                  label={result.status === "success" ? "Gereed" : "Mislukt"}
                  tone={result.status}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!canUpload ? (
        <p className="notice notice--warning" role="status">
          Uploaden vereist editor- of beheerrechten en een actieve vereniging.
        </p>
      ) : null}
    </form>
  );
}

function failureState(fileName: string, message: string): MediaImageUploadState {
  return {
    completedAt: new Date().toISOString(),
    results: [{ fileName, message, status: "critical" }]
  };
}

function mediaTitleFromFileName(fileName: string) {
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return (baseName.length >= 2 ? baseName : "Afbeelding").slice(0, 120);
}
