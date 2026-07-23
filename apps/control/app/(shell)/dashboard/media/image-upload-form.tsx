"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button, StatusPill } from "@veyocast/ui";

import {
  uploadMediaImages,
  type MediaImageUploadState
} from "./actions";

const initialState: MediaImageUploadState = {
  completedAt: null,
  results: []
};

export function ImageUploadForm({ canUpload }: { canUpload: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(uploadMediaImages, initialState);

  useEffect(() => {
    if (state.completedAt && state.results.some((result) => result.status === "success")) {
      formRef.current?.reset();
    }
  }, [state.completedAt, state.results]);

  const completedCount = state.results.filter(
    (result) => result.status === "success"
  ).length;

  return (
    <form
      action={action}
      aria-busy={pending}
      className="upload-form"
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
          required
          type="file"
        />
        <small>Maximaal twaalf bestanden per upload.</small>
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
