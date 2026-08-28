"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button, StatusPill } from "@veyocast/ui";

import {
  productLogoValidationMessage,
  type ProductLogoApiResult,
  validateProductLogoFile
} from "../../../../../lib/products/product-logo-upload";
import styles from "./products.module.css";

export function ProductLogoControl({
  canRemove,
  canUpload,
  logoUrl,
  productId,
  productName,
  revision
}: {
  canRemove: boolean;
  canUpload: boolean;
  logoUrl: string | null;
  productId: string;
  productName: string;
  revision: number;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(logoUrl);
  const [currentRevision, setCurrentRevision] = useState(revision);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "critical" | "success";
  } | null>(null);

  useEffect(() => {
    setPreviewUrl(logoUrl);
  }, [logoUrl]);

  useEffect(() => {
    setCurrentRevision(revision);
  }, [revision]);

  async function uploadLogo() {
    const file = fileInput.current?.files?.[0];
    if (!file || pending || !canUpload) {
      setFeedback({
        message: "Kies eerst een JPEG-, PNG-, WebP- of veilig SVG-bestand.",
        tone: "critical"
      });
      return;
    }
    const validationFailure = validateProductLogoFile(file);
    if (validationFailure) {
      setFeedback({
        message: productLogoValidationMessage(validationFailure),
        tone: "critical"
      });
      return;
    }

    setPending(true);
    setFeedback(null);
    const body = new FormData();
    body.set("media", file);
    body.set("productId", productId);
    body.set("revision", String(currentRevision));
    try {
      const response = await fetch("/api/products/logos", {
        body,
        cache: "no-store",
        credentials: "same-origin",
        method: "POST"
      });
      const result = await readResult(response);
      if (!response.ok || !result?.ok) {
        setFeedback(failureFeedback(result));
        return;
      }
      setFeedback({ message: result.data.message, tone: "success" });
      setPreviewUrl(result.data.previewUrl);
      setCurrentRevision(result.data.revision);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch {
      setFeedback({
        message: "De uploadverbinding werd onderbroken. Het product is niet gewijzigd; probeer opnieuw.",
        tone: "critical"
      });
    } finally {
      setPending(false);
    }
  }

  async function removeLogo() {
    if (!canRemove || pending || !previewUrl) return;
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/products/logos", {
        body: JSON.stringify({ productId, revision: currentRevision }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "DELETE"
      });
      const result = await readResult(response);
      if (!response.ok || !result?.ok) {
        setFeedback(failureFeedback(result));
        return;
      }
      setFeedback({ message: result.data.message, tone: "success" });
      setPreviewUrl(null);
      setCurrentRevision(result.data.revision);
      router.refresh();
    } catch {
      setFeedback({
        message: "De verbinding werd onderbroken. Het bestaande productlogo blijft gekoppeld; probeer opnieuw.",
        tone: "critical"
      });
    } finally {
      setPending(false);
    }
  }

  const inputId = `product-logo-${productId}`;
  return (
    <div className={styles.productLogo}>
      <div className={styles.logoHeading}>
        <span>Productlogo</span>
        <StatusPill
          label={previewUrl ? "Ingesteld" : "Ontbreekt"}
          tone={previewUrl ? "success" : "neutral"}
        />
      </div>
      {previewUrl ? (
        <Image
          alt={`Productlogo van ${productName}`}
          className={styles.logoPreview}
          height={88}
          src={previewUrl}
          unoptimized
          width={240}
        />
      ) : (
        <div className={styles.logoPlaceholder} aria-hidden="true">
          Geen logo
        </div>
      )}
      <label className={styles.logoFile} htmlFor={inputId}>
        <span>Nieuw logo kiezen</span>
        <input
          accept="image/jpeg,image/png,image/svg+xml,image/webp,.jpg,.jpeg,.png,.svg,.webp"
          disabled={!canUpload || pending}
          id={inputId}
          ref={fileInput}
          type="file"
        />
      </label>
      <div className={styles.logoActions}>
        <Button
          disabled={!canUpload || pending}
          onClick={() => void uploadLogo()}
          size="sm"
          type="button"
          variant="secondary"
        >
          {pending ? "Bezig…" : previewUrl ? "Vervangen" : "Uploaden"}
        </Button>
        {previewUrl ? (
          <Button
            disabled={!canRemove || pending}
            onClick={() => void removeLogo()}
            size="sm"
            type="button"
            variant="ghost"
          >
            Verwijderen
          </Button>
        ) : null}
      </div>
      {!canUpload ? (
        <small>Uploaden vereist product- én mediarechten.</small>
      ) : null}
      {feedback ? (
        <small
          className={feedback.tone === "critical" ? styles.logoError : styles.logoSuccess}
          role={feedback.tone === "critical" ? "alert" : "status"}
        >
          {feedback.message}
        </small>
      ) : null}
    </div>
  );
}

async function readResult(response: Response) {
  return (await response.json().catch(() => null)) as ProductLogoApiResult | null;
}

function failureFeedback(result: ProductLogoApiResult | null) {
  const message = result && !result.ok
    ? `${result.error.message} ${result.error.recovery}${result.requestId ? ` Referentie: ${result.requestId}.` : ""}`
    : "De server gaf geen veilige bevestiging. Vernieuw de productlijst en probeer opnieuw.";
  return { message, tone: "critical" as const };
}
