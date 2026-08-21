import { describe, expect, it } from "vitest";

import {
  formatPairingCode,
  invitationStatuses,
  getMediaKindForMimeType,
  getPlaylistReleaseLabel,
  getTenantMediaOriginalPath,
  isAllowedMediaMimeType,
  mediaAllowedMimeTypes,
  mediaAssetStatuses,
  mediaMaxVideoBytes,
  mediaMaxVideoDurationSeconds,
  mediaProcessingJobStatuses,
  mediaUploadSessionStatuses,
  mediaVariantTypes,
  playlistItemDurationSeconds,
  playlistItemFitModes,
  playlistStatuses,
  pairingSessionStatuses,
  playerDeviceStatuses,
  platformRoles,
  platformTenantMutationRoles,
  screenOrientations,
  screenStatuses,
  tenantAdministrationRoles,
  tenantRoles,
  tenantStatuses,
  tenantWriteRoles
} from "../src";

describe("@veyocast/database role constants", () => {
  it("keeps canonical platform roles in database order", () => {
    expect(platformRoles).toEqual([
      "platform_owner",
      "platform_admin",
      "platform_support",
      "platform_viewer"
    ]);
  });

  it("keeps canonical tenant roles and capability groups explicit", () => {
    expect(tenantRoles).toEqual([
      "tenant_owner",
      "tenant_admin",
      "tenant_editor",
      "tenant_viewer"
    ]);
    expect(tenantAdministrationRoles).toEqual(["tenant_owner", "tenant_admin"]);
    expect(tenantWriteRoles).toEqual(["tenant_owner", "tenant_admin", "tenant_editor"]);
  });

  it("keeps status unions aligned with database enums", () => {
    expect(platformTenantMutationRoles).toEqual(["platform_owner", "platform_admin"]);
    expect(tenantStatuses).toEqual(["active", "paused", "archived"]);
    expect(invitationStatuses).toEqual(["pending", "accepted", "revoked", "expired"]);
  });

  it("keeps canonical media statuses and processing limits explicit", () => {
    expect(mediaAssetStatuses).toEqual([
      "uploading",
      "processing",
      "ready",
      "validation_failed",
      "quarantined",
      "deleted"
    ]);
    expect(mediaUploadSessionStatuses).toEqual([
      "pending",
      "uploaded",
      "expired",
      "cancelled"
    ]);
    expect(mediaVariantTypes).toEqual(["original", "thumbnail", "player_1080p"]);
    expect(mediaProcessingJobStatuses).toEqual([
      "queued",
      "processing",
      "completed",
      "failed"
    ]);
    expect(mediaMaxVideoBytes).toBe(524_288_000);
    expect(mediaMaxVideoDurationSeconds).toBe(300);
  });

  it("keeps playlist release contracts explicit", () => {
    expect(playlistStatuses).toEqual(["draft", "published", "archived"]);
    expect(playlistItemFitModes).toEqual(["contain", "cover"]);
    expect(playlistItemDurationSeconds).toEqual({
      default: 10,
      maximum: 3600,
      minimum: 5
    });
    expect(
      getPlaylistReleaseLabel({
        playlistName: " Zomerroute ",
        version: 3
      })
    ).toBe("Zomerroute v3");
  });

  it("keeps screen, device and pairing contracts explicit", () => {
    expect(screenStatuses).toEqual(["active", "maintenance", "disabled"]);
    expect(playerDeviceStatuses).toEqual(["paired", "revoked", "disabled"]);
    expect(pairingSessionStatuses).toEqual([
      "pending",
      "claimed",
      "expired",
      "cancelled"
    ]);
    expect(screenOrientations).toEqual(["landscape", "portrait"]);
    expect(formatPairingCode("ab-12c3")).toBe("AB1 2C3");
  });

  it("maps allowed media MIME types to the database asset kind", () => {
    expect(mediaAllowedMimeTypes).toEqual([
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/svg+xml",
      "image/webp",
      "video/mp4",
      "video/webm"
    ]);
    expect(getMediaKindForMimeType("image/webp")).toBe("image");
    expect(getMediaKindForMimeType("video/mp4")).toBe("video");
    expect(getMediaKindForMimeType("image/svg+xml")).toBe("image");
    expect(getMediaKindForMimeType("video/webm")).toBe("video");
    expect(isAllowedMediaMimeType("image/png")).toBe(true);
    expect(isAllowedMediaMimeType("application/x-msdownload")).toBe(false);
  });

  it("builds tenant-scoped media storage paths", () => {
    expect(
      getTenantMediaOriginalPath({
        assetId: "20000000-0000-4000-8000-000000000003",
        fileName: "Poster final WEBP.webp",
        tenantId: "10000000-0000-4000-8000-000000000001"
      })
    ).toBe(
      "tenants/10000000-0000-4000-8000-000000000001/assets/20000000-0000-4000-8000-000000000003/original/poster-final-webp.webp"
    );
  });
});
