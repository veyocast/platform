import { describe, expect, it } from "vitest";
import { syncPlaybackEvidence } from "./sync-playback-evidence";

const now = Date.parse("2026-10-17T12:00:00Z");
const device = {
  status: "paired", active_release_id: "lkg", desired_release_id: "next", last_error_code: null,
  last_seen_at: "2026-10-17T11:59:00Z",
  current_sync_detail: { publicationTrace: { releaseId: "lkg", firstFrameAt: "2026-10-17T10:00:00Z" } }
};
describe("separate contact, requested release and visible-frame evidence", () => {
  it("does not treat a fresh heartbeat and active ID as playback proof", () => {
    expect(syncPlaybackEvidence({ ...device, current_sync_detail: {} }, now))
      .toMatchObject({ contact: "online", confirmedReleaseId: null, desiredConfirmed: false });
  });
  it("keeps the confirmed old release while a different target downloads", () => {
    expect(syncPlaybackEvidence(device, now)).toMatchObject({ confirmedReleaseId: "lkg", desiredConfirmed: false });
    expect(syncPlaybackEvidence({ ...device, desired_release_id: "lkg" }, now).desiredConfirmed).toBe(true);
  });
  it("retains historical proof on loss of contact without calling it currently confirmed", () => {
    expect(syncPlaybackEvidence(device, now + 10 * 60_000))
      .toMatchObject({ contact: "stale", confirmedReleaseId: "lkg", desiredConfirmed: false });
  });
  it("rejects mismatched, future or invalid frame evidence and revoked identities", () => {
    for (const trace of [
      { releaseId: "next", firstFrameAt: "2026-10-17T10:00:00Z" },
      { releaseId: "lkg", firstFrameAt: "2026-10-17T12:01:00Z" },
      { releaseId: "lkg", firstFrameAt: "invalid" }
    ]) expect(syncPlaybackEvidence({ ...device, current_sync_detail: { publicationTrace: trace } }, now).confirmedReleaseId).toBeNull();
    expect(syncPlaybackEvidence({ ...device, last_error_code: "VIDEO_PLAYBACK_ERROR" }, now)).toMatchObject({confirmedReleaseId:"lkg",publicationKind:"error",desiredConfirmed:false});
    expect(syncPlaybackEvidence({ ...device, status: "revoked" }, now).confirmedReleaseId).toBeNull();
  });
  it("keeps contact independent of a playback error and rejects future device timestamps", () => {
    expect(syncPlaybackEvidence({ ...device, last_error_code: "VIDEO_PLAYBACK_ERROR" }, now))
      .toMatchObject({ contact: "online", confirmedReleaseId: "lkg", needsAttention: true });
    expect(syncPlaybackEvidence({ ...device, last_seen_at: "2026-10-17T12:02:00Z",
      current_sync_detail: { publicationTrace: { releaseId: "lkg", firstFrameAt: "2026-10-17T12:01:00Z" } } }, now))
      .toMatchObject({ contact: "unknown", confirmedReleaseId: null, desiredConfirmed: false, needsAttention: true });
  });
});

it("SCR-03 keeps receipt/download separate and retains verified history after a later error",()=>{
 const preparing={...device,desired_release_id:"lkg",current_sync_detail:{publicationTrace:{releaseId:"lkg",receivedAt:"2026-10-17T11:00:00Z",downloadStartedAt:"2026-10-17T11:01:00Z"}}};
 expect(syncPlaybackEvidence(preparing,now)).toMatchObject({contact:"online",confirmedReleaseId:null,desiredConfirmed:false});
 expect(syncPlaybackEvidence({...device,desired_release_id:"lkg",last_error_code:"DECODER_FAILED"},now)).toMatchObject({health:{kind:"online"},confirmedReleaseId:"lkg",confirmedAt:"2026-10-17T10:00:00Z",desiredConfirmed:false,publicationKind:"error"});
 expect(syncPlaybackEvidence({...device,desired_release_id:"lkg"},now,"maintenance")).toMatchObject({health:{kind:"maintenance"},confirmedReleaseId:"lkg",desiredConfirmed:false});
});

it("SCR-03 uses authoritative assignment including null, and only absent fields fall back", () => {
  expect(syncPlaybackEvidence(device, now, "active", "lkg")).toMatchObject({ desiredReleaseId: "lkg", desiredConfirmed: true });
  expect(syncPlaybackEvidence(device, now, "active", null)).toMatchObject({ desiredReleaseId: null, desiredConfirmed: false, publicationKind: "unconfirmed", confirmedReleaseId: "lkg" });
  expect(syncPlaybackEvidence(device, now, "active", undefined).desiredReleaseId).toBe("next");
});
