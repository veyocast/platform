import assert from "node:assert/strict";
import { test } from "vitest";
import { currentPlayerHeartbeats, reportedScreenPlatforms, screenPlaybackEvidence, syncScreenTab } from "./sync-screen-detail-model";
import type { FleetDevice } from "./data";

const now = Date.parse("2026-10-19T12:00:00Z");
const device: FleetDevice = { id: "own-player", screenId: "own-screen", appVersion: null, capabilities: {}, deviceName: "Eigen Player", lastErrorAt: null, pairedAt: "2026-10-19T11:00:00Z", platform: "Android", revokedAt: null, storageQuotaBytes: null, storageUsedBytes: null, syncRetryRequestedAt: null, status: "paired", activeReleaseId: "active-release", desiredReleaseId: "active-release", lastSeenAt: "2026-10-19T11:59:00Z", lastErrorCode: null, syncDetail: {} };

test("old content/planning/activity/player bookmarks retain the matching main task", () => {
  for (const [query, expected] of [[undefined,"overview"],["content","overview"],["planning","overview"],["layout","layout"],["automation","hours"],["hours","hours"],["health","health"],["activity","health"],["sync","health"],["player","device"],["settings","device"],["device","device"],["unknown","overview"]] as const) assert.equal(syncScreenTab(query), expected, String(query));
});

test("assignment and active IDs alone never become a confirmed visible publication", () => {
  assert.equal(screenPlaybackEvidence(device, now).confirmedReleaseId, null);
  assert.equal(screenPlaybackEvidence(device, now).desiredConfirmed, false);
  assert.equal(screenPlaybackEvidence(null, now).contact, "unknown");
});

test("only a matching real first-frame trace confirms a publication; offline keeps last confirmation separate", () => {
  const traced = { ...device, syncDetail: { publicationTrace: { releaseId: "active-release", firstFrameAt: "2026-10-19T11:58:00Z" } } };
  assert.equal(screenPlaybackEvidence(traced, now).desiredConfirmed, true);
  assert.equal(screenPlaybackEvidence({ ...traced, lastSeenAt: "2026-10-19T11:40:00Z", syncDetail: { publicationTrace: { releaseId: "active-release", firstFrameAt: "2026-10-19T11:39:00Z" } } }, now).confirmedReleaseId, "active-release");
  assert.equal(screenPlaybackEvidence({ ...traced, lastSeenAt: "2026-10-19T11:40:00Z" }, now).desiredConfirmed, false);
  assert.equal(screenPlaybackEvidence({ ...traced, lastErrorCode: "MEDIA_FAILED" }, now).confirmedReleaseId, null);
  assert.equal(screenPlaybackEvidence({ ...traced, desiredReleaseId: "next-release" }, now).desiredConfirmed, false);
});

test("platform filters retain only reported names and do not invent a platform for unpaired screens", () => {
  assert.deepEqual(reportedScreenPlatforms([{ platform: null }, { platform: "" }, { platform: " " }, { platform: "Android TV" }, { platform: "LG webOS" }, { platform: "Android TV" }, { platform: "Eigen profiel" }]), ["Android TV", "Eigen profiel", "LG webOS"]);
});

test("a newly paired Player keeps unknown runtime until its own heartbeat without losing historical events", () => {
  const history = [{ id: "old-contact", deviceId: "old-player", runtimeState: "PLAYING" }, { id: "own-contact", deviceId: "current-player", runtimeState: "READY" }];
  assert.deepEqual(currentPlayerHeartbeats({ id: "current-player" }, history), [history[1]]);
  assert.deepEqual(currentPlayerHeartbeats({ id: "new-player" }, history), []);
  assert.deepEqual(currentPlayerHeartbeats(null, history), []);
  assert.deepEqual(history.map(heartbeat => heartbeat.id), ["old-contact", "own-contact"]);
});
