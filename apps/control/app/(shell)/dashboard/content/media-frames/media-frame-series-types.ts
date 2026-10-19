import type { MediaFrameCommand, MediaFrameExpectedSource, MediaFrameSettings } from "@veyocast/contracts";
import type { ContentItem } from "../model";

export type MediaSeriesMembershipDTO = { seriesId: string; seriesRevision: number; seriesTitle: string; position: number };
export type MediaSeriesSummaryDTO = { id: string; revision: number; memberCount: number };
export type ContentFilmstripPreview =
  | { kind: "media-frame"; value: NonNullable<ContentItem["mediaFramePreview"]> }
  | { kind: "image"; url: string }
  | { kind: "unavailable"; message: string };
export type ContentFilmstripItem = { key: string; title: string; href: string; orientation: string | null; preview: ContentFilmstripPreview };
export type ContentFilmstripPage = { items: ContentFilmstripItem[]; offset: number; total: number; hasMore: boolean };
export type MediaSeriesEditorExtraProps = { contentKey: string; membership: MediaSeriesMembershipDTO | null; series: MediaSeriesSummaryDTO | null; filmstrip: ContentFilmstripPage };

/** Null binding is deliberate: new series identities are created in the atomic RPC. */
export type MediaFrameSeriesCommand = {
  kind: "media-series";
  tenantId: string;
  frameId: string;
  sourceAssetId: string;
  expectedFrameRevision: number;
  settings: MediaFrameSettings;
  expectedSources: MediaFrameExpectedSource[];
  seriesId: string | null;
  expectedSeriesRevision: number | null;
  seriesTitle: string;
  idempotencyKey: string;
} & ({ operation: "save" } | { operation: "append"; newFrameId: string });
export type MediaFramePendingV2 = { kind: "frame"; command: MediaFrameCommand } | { kind: "series"; command: MediaFrameSeriesCommand };
export type MediaSeriesDraftV2 = { seriesId: string | null; baseRevision: number | null; seriesTitle: string; dirty: boolean };
export type MediaFrameSeriesResult =
  | { ok: true; current: { frameId: string; frameRevision: number; versionId: string; versionNumber: number }; membership: MediaSeriesMembershipDTO | null; series: MediaSeriesSummaryDTO | null; appended: null | { frameId: string; frameRevision: number; versionId: string; versionNumber: number; contentKey: string; href: string; name: string; membership: MediaSeriesMembershipDTO } }
  | { ok: false; code: "invalid" | "denied" | "conflict" | "source_unavailable" | "unavailable"; uncertain: boolean; message: string };
export type ContentFilmstripResult = { ok: true; page: ContentFilmstripPage } | { ok: false; message: string };
