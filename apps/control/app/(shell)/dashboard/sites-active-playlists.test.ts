import { describe, expect, it } from "vitest";
import { countConfirmedActivePlaylists } from "./sites-active-playlists";
import type { TenantOverview } from "../../../lib/control-overview";

const now = Date.parse("2026-10-11T10:00:00Z");
const recent = "2026-10-11T09:59:00Z";
const heartbeat = (screen: string, release = "release-a", state = "PLAYING", at = recent) => ({
  screen_id: screen, active_release_id: release, runtime_state: state, created_at: at
});
const fixture = (): Pick<TenantOverview, "devices" | "heartbeats" | "screens" | "releases" | "playlists"> => ({
  devices: ["screen-a", "screen-b", "screen-c"].map((screen_id) => ({
    id: `device-${screen_id}`, screen_id, status: "paired", active_release_id: "release-a", desired_release_id: "release-a",
    last_error_at: null, last_error_code: null, last_seen_at: recent, storage_quota_bytes: null, storage_used_bytes: null,
    current_sync_phase: "active", current_sync_detail: { publicationTrace: { releaseId: "release-a", firstFrameAt: recent } }
  })),
  screens: ["screen-a", "screen-b", "screen-c"].map(id => ({id,name:id,status:"active",location:null,assigned_playlist_id:"playlist-a",assigned_release_id:"release-a",created_at:recent})),
  playlists: ["playlist-a", "playlist-b"].map(id => ({id,name:"Dezelfde zichtbare naam",status:"published",updated_at:recent})),
  releases: [{id:"release-a",playlist_id:"playlist-a",version:1,published_at:recent},{id:"release-b",playlist_id:"playlist-b",version:1,published_at:recent}],
  heartbeats: [heartbeat("screen-a"), heartbeat("screen-b"), heartbeat("screen-c")]
});
describe("Nu actief telt bevestigde afspeellijsten", () => {
  it("telt drie echte schermframes van dezelfde playlist eenmaal", () => {
    expect(countConfirmedActivePlaylists(fixture(),now)).toBe(1);
  });
  it("onderscheidt playlist-identiteiten met dezelfde zichtbare naam", () => {
    const data=fixture();data.heartbeats[1]=heartbeat("screen-b","release-b","READY");
    data.devices[1]!.active_release_id="release-b";
    data.devices[1]!.current_sync_detail={ publicationTrace: { releaseId: "release-b", firstFrameAt: recent } };
    expect(countConfirmedActivePlaylists(data,now)).toBe(2);
  });
  it("accepteert recente READY- en offline LKG-frames", () => {
    const data=fixture();data.heartbeats=[heartbeat("screen-a","release-a","READY"),heartbeat("screen-b","release-b","OFFLINE_PLAYING")];
    data.devices[1]!.active_release_id="release-b";
    data.devices[1]!.current_sync_detail={ publicationTrace: { releaseId: "release-b", firstFrameAt: recent } };
    expect(countConfirmedActivePlaylists(data,now)).toBe(2);
  });
  it("laat de laatste ongesorteerde STARTING-status een oudere PLAYING-status vervangen", () => {
    const data=fixture();data.heartbeats=[heartbeat("screen-a"),heartbeat("screen-a","release-a","STARTING","2026-10-11T09:59:50Z")];
    expect(countConfirmedActivePlaylists(data,now)).toBe(0);
  });
  it("telt stale, toekomstige en ongeldige timestamps niet mee", () => {
    const data=fixture();data.heartbeats=[heartbeat("screen-a","release-a","PLAYING","2026-10-11T09:55:00Z"),heartbeat("screen-b","release-b","PLAYING","2026-10-11T10:01:00Z"),heartbeat("screen-c","release-a","PLAYING","ongeldig")];
    expect(countConfirmedActivePlaylists(data,now)).toBe(0);
  });
  it("telt onbekende screens/releases/playlists en inactieve schermen niet mee", () => {
    const data=fixture();data.screens[0]!.status="archived";data.releases[1]!.playlist_id="outside-scoped-playlists";data.heartbeats=[heartbeat("screen-a"),heartbeat("screen-b","unknown-release"),heartbeat("screen-c","release-b"),heartbeat("outside-scoped-screens")];
    expect(countConfirmedActivePlaylists(data,now)).toBe(0);
  });
});
