export type MediaCandidate = {
  assetId: string;
  durationSeconds?: number;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  tenantId: string;
};

export type MediaKind = "image" | "video";

export type ProcessingVariant = {
  maxHeight?: number;
  type: "original" | "player_1080p" | "thumbnail";
};

export type MediaProcessingPlan =
  | {
      candidate: MediaCandidate;
      kind: MediaKind;
      status: "queued";
      variants: ProcessingVariant[];
    }
  | {
      candidate: MediaCandidate;
      rejection: MediaRejection;
      status: "rejected";
    };

export type MediaRejection = {
  code:
    | "empty_file"
    | "file_too_large"
    | "unsupported_extension"
    | "unsupported_mime_type"
    | "video_too_long";
  effect: string;
  recovery: string;
};

const allowedMimeTypes = {
  "image/jpeg": { extensions: ["jpg", "jpeg"], kind: "image" },
  "image/png": { extensions: ["png"], kind: "image" },
  "image/webp": { extensions: ["webp"], kind: "image" },
  "video/mp4": { extensions: ["mp4"], kind: "video" }
} as const satisfies Record<
  string,
  { extensions: readonly string[]; kind: MediaKind }
>;

export const maxUploadBytes = 524_288_000;
export const maxVideoDurationSeconds = 300;

export function createMediaProcessingPlan(
  candidate: MediaCandidate
): MediaProcessingPlan {
  const rejection = validateMediaCandidate(candidate);

  if (rejection) {
    return {
      candidate,
      rejection,
      status: "rejected"
    };
  }

  const kind =
    allowedMimeTypes[candidate.mimeType as keyof typeof allowedMimeTypes].kind;

  return {
    candidate,
    kind,
    status: "queued",
    variants:
      kind === "video"
        ? [
            { type: "original" },
            { maxHeight: 1080, type: "player_1080p" },
            { type: "thumbnail" }
          ]
        : [{ type: "original" }, { type: "thumbnail" }]
  };
}

export function validateMediaCandidate(
  candidate: MediaCandidate
): MediaRejection | null {
  if (candidate.fileSizeBytes <= 0) {
    return {
      code: "empty_file",
      effect: "Het bestand wordt niet aan de uploadqueue toegevoegd.",
      recovery: "Kies een bestand met inhoud en start de upload opnieuw."
    };
  }

  if (candidate.fileSizeBytes > maxUploadBytes) {
    return {
      code: "file_too_large",
      effect: "De upload overschrijdt de MVP-limiet van 500 MB.",
      recovery: "Comprimeer de video of kies een kortere MP4."
    };
  }

  const mimeRule = allowedMimeTypes[candidate.mimeType as keyof typeof allowedMimeTypes];

  if (!mimeRule) {
    return {
      code: "unsupported_mime_type",
      effect: "De worker verwerkt dit bestandstype niet.",
      recovery: "Gebruik JPEG, PNG, WebP of MP4/H.264 met AAC-audio."
    };
  }

  const extension = getFileExtension(candidate.fileName);
  const expectedExtensions: readonly string[] = mimeRule.extensions;

  if (!extension || !expectedExtensions.includes(extension)) {
    return {
      code: "unsupported_extension",
      effect: "MIME-type en bestandsnaam passen niet bij de toegestane media.",
      recovery: `Gebruik een bestand met extensie ${mimeRule.extensions.join(", ")}.`
    };
  }

  if (
    mimeRule.kind === "video"
    && candidate.durationSeconds !== undefined
    && candidate.durationSeconds > maxVideoDurationSeconds
  ) {
    return {
      code: "video_too_long",
      effect: "De video wordt niet klaargezet voor playerverwerking.",
      recovery: "Kort de video in tot maximaal 5 minuten."
    };
  }

  return null;
}

function getFileExtension(fileName: string) {
  const parts = fileName.trim().toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) : null;
}
