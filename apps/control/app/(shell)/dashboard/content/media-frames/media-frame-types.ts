import type { MediaFrameExpectedSource, MediaFrameSettings } from "@veyocast/contracts";
import type { MediaSeriesEditorExtraProps } from "./media-frame-series-types";

/** Signed URLs are transient display values; only fingerprint identities are saved. */
export type MediaFrameSource = {
  mediaAssetId: string;
  kind: "image" | "video";
  title: string;
  fileName: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  maximumDurationSeconds?: number;
  sourceUrl: string;
  posterUrl: string | null;
  expectedSource: MediaFrameExpectedSource;
};

export type MediaFrameVersion = {
  id: string;
  number: number;
  createdAt: string;
  settings: MediaFrameSettings;
  sources: MediaFrameSource[];
};

export type MediaFrameEditorProps = {
  /** Additive Source filmstrip/recovery context; older editor fixtures remain valid. */
  mediaSeries?: MediaSeriesEditorExtraProps;
  tenantId: string;
  actorScope: string;
  frameId: string;
  isPrimary: boolean;
  isNew: boolean;
  frameRevision: number;
  versionId: string | null;
  versionNumber: number;
  settings: MediaFrameSettings;
  mainSource: MediaFrameSource;
  imageSources: MediaFrameSource[];
  versions: MediaFrameVersion[];
  canWrite: boolean;
  /** Current actor capability; permits only replay of an existing exact journal command. */
  canReplayPending?: boolean;
};

export type MediaFrameActionResult =
  | { ok: true; frameId: string; frameRevision: number; versionId: string; versionNumber: number; outcome: "created" | "saved" | "duplicated" | "archived" | "restored" | "noop" }
  | { ok: false; code: "invalid" | "denied" | "conflict" | "source_unavailable" | "unavailable"; uncertain: boolean; message: string };

export type MediaFrameSourceResult =
  | { ok: true; source: MediaFrameSource }
  | { ok: false; message: string };
