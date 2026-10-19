import { mediaFrameExpectedSourcesSchema, mediaFrameSettingsSchema } from "@veyocast/contracts";
import type { MediaFrameSeriesCommand, MediaFrameSeriesResult, MediaSeriesMembershipDTO, MediaSeriesSummaryDTO } from "./media-frame-series-types";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const exact = (value: Record<string, unknown>, names: string[]) => Object.keys(value).sort().join(",") === [...names].sort().join(",");
const id = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const integer = (value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;

/** Strict admission preserves the original JSON command; recovery must never
 * rebuild an earlier body or convert its null binding to a client-created ID. */
export function parseMediaFrameSeriesCommand(input: unknown): MediaFrameSeriesCommand | null {
  try {
    if (!record(input) || input.kind !== "media-series" || !["save", "append"].includes(String(input.operation))) return null;
    if (!exact(input, ["kind", "tenantId", "frameId", "sourceAssetId", "expectedFrameRevision", "settings", "expectedSources", "seriesId", "expectedSeriesRevision", "seriesTitle", "idempotencyKey", "operation", ...(input.operation === "append" ? ["newFrameId"] : [])])) return null;
    if (![input.tenantId, input.frameId, input.sourceAssetId, input.idempotencyKey].every(id) || !integer(input.expectedFrameRevision, 0, 2_147_483_647)) return null;
    if (input.seriesId === null ? input.expectedSeriesRevision !== null : !id(input.seriesId) || !integer(input.expectedSeriesRevision, 1) || input.expectedFrameRevision === 0) return null;
    if (typeof input.seriesTitle !== "string" || input.seriesTitle.length > 120) return null;
    if (input.operation === "append" && (!id(input.newFrameId) || input.newFrameId === input.frameId)) return null;
    if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 32_768) return null;
    const settings = mediaFrameSettingsSchema.safeParse(input.settings), sources = mediaFrameExpectedSourcesSchema.safeParse(input.expectedSources);
    if (!settings.success || !sources.success || !record(input.settings) || settings.data.name !== input.settings.name) return null;
    if (sources.data.find(source => source.role === "media")?.mediaAssetId !== input.sourceAssetId) return null;
    const background = sources.data.find(source => source.role === "background"), choice = settings.data.appearance.background;
    if (choice.kind === "image" ? background?.mediaAssetId !== choice.mediaAssetId : Boolean(background)) return null;
    return input as MediaFrameSeriesCommand;
  } catch { return null; }
}

export type MediaFrameSeriesRead = {
  frameId: string; frameRevision: number; versionId: string; versionNumber: number;
  membership: MediaSeriesMembershipDTO | null; series: MediaSeriesSummaryDTO | null;
};
const versionKeys = ["frameId", "frameRevision", "versionId", "versionNumber"];
function frameVersion(value: Record<string, unknown>) {
  return id(value.frameId) && integer(value.frameRevision, 1, 2_147_483_647) && id(value.versionId) && integer(value.versionNumber, 1, 2_147_483_647);
}
function binding(value: unknown): { membership: MediaSeriesMembershipDTO; series: MediaSeriesSummaryDTO } | null {
  if (!record(value) || !exact(value, ["seriesId", "seriesRevision", "seriesTitle", "position", "memberCount"]) || !id(value.seriesId) || !integer(value.seriesRevision, 1) || typeof value.seriesTitle !== "string" || value.seriesTitle.length > 120 || !integer(value.position, 0, 2_147_483_647) || !integer(value.memberCount, 1, 2_147_483_648) || value.position >= value.memberCount) return null;
  return { membership: { seriesId: value.seriesId, seriesRevision: value.seriesRevision, seriesTitle: value.seriesTitle, position: value.position }, series: { id: value.seriesId, revision: value.seriesRevision, memberCount: value.memberCount } };
}

/** One atomic RPC response; never combine separate mutable membership/header reads. */
export function parseMediaFrameSeriesRead(input: unknown, expectedFrameId: string): MediaFrameSeriesRead | null {
  if (!record(input) || !exact(input, [...versionKeys, "series"]) || !frameVersion(input) || input.frameId !== expectedFrameId) return null;
  const parsed = input.series === null ? { membership: null, series: null } : binding(input.series);
  return parsed ? { frameId: input.frameId as string, frameRevision: input.frameRevision as number, versionId: input.versionId as string, versionNumber: input.versionNumber as number, ...parsed } : null;
}
function utf16Prefix(value: string, limit: number) {
  let result = "";
  for (const character of value) { if (result.length + character.length > limit) break; result += character; }
  return result;
}
/** Same bounded Unicode name rule as the frozen SQL append contract. */
export function mediaFrameSeriesCopyName(title: string, ordinal: number) {
  const suffix = ` · slide ${ordinal}`;
  return utf16Prefix(title, 120 - suffix.length) + suffix;
}

/** Acknowledgements bind operation and all available frame/group identities.
 * Any incomplete/mismatched receipt is uncertain, never successful navigation. */
export function parseMediaFrameSeriesReceipt(input: unknown, command: MediaFrameSeriesCommand): Extract<MediaFrameSeriesResult, { ok: true }> | null {
  if (!record(input) || !exact(input, [...versionKeys, "outcome", "series", "newFrame"]) || !frameVersion(input) || input.frameId !== command.frameId || input.frameRevision !== command.expectedFrameRevision + 1 || command.expectedFrameRevision === 0 && input.versionNumber !== 1 || input.outcome !== (command.operation === "append" ? "appended" : "saved")) return null;
  const parsed = input.series === null ? { membership: null, series: null } : binding(input.series);
  if (!parsed) return null;
  const expectedTitle = command.operation === "append" ? command.seriesTitle.trim() || command.settings.name : command.seriesTitle;
  if (command.seriesId === null && command.operation === "save" && !command.seriesTitle.trim()) {
    if (parsed.membership || parsed.series) return null;
  } else {
    if (!parsed.membership || !parsed.series || parsed.membership.seriesTitle !== expectedTitle || (command.seriesId === null ? parsed.series.revision !== 1 || parsed.membership.position !== 0 || parsed.series.memberCount !== (command.operation === "append" ? 2 : 1) : parsed.series.id !== command.seriesId || parsed.series.revision !== command.expectedSeriesRevision! + 1)) return null;
  }
  const current = { frameId: command.frameId, frameRevision: input.frameRevision as number, versionId: input.versionId as string, versionNumber: input.versionNumber as number };
  if (command.operation === "save") return input.newFrame === null ? { ok: true, current, ...parsed, appended: null } : null;
  if (!parsed.membership || !parsed.series || parsed.membership.position >= parsed.series.memberCount - 1 || !record(input.newFrame) || !exact(input.newFrame, versionKeys) || !frameVersion(input.newFrame) || input.newFrame.frameId !== command.newFrameId || input.newFrame.frameRevision !== 1 || input.newFrame.versionNumber !== 1 || input.newFrame.versionId === current.versionId) return null;
  return { ok: true, current, ...parsed, appended: {
    frameId: command.newFrameId, frameRevision: 1, versionId: input.newFrame.versionId as string, versionNumber: 1,
    contentKey: `media-frame:${command.newFrameId}`, href: `/dashboard/content/media/${command.newFrameId}`,
    name: mediaFrameSeriesCopyName(expectedTitle, parsed.series.memberCount),
    membership: { ...parsed.membership, position: parsed.series.memberCount - 1 },
  } };
}
