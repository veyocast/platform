import { describe, expect, it } from "vitest";

import {
  compareReleaseItems,
  evaluateReleasePreflight,
  type ReleaseComparisonItem,
  type ReleasePreflightInput
} from "../src";

const itemA: ReleaseComparisonItem = {
  assetTitle: "Welkom",
  backgroundColor: null,
  checksumSha256: "a".repeat(64),
  cropFocusX: 0.5,
  cropFocusY: 0.5,
  displayTitle: null,
  durationSeconds: 10,
  enabled: true,
  fileSizeBytes: 100,
  fitMode: "contain",
  mediaAssetId: "20000000-0000-4000-8000-000000000001",
  muted: true,
  sortOrder: 0,
  sourceItemId: "30000000-0000-4000-8000-000000000001",
  transition: "cut",
  trimEndSeconds: null,
  trimStartSeconds: 0,
  visibleFrom: null,
  visibleUntil: null,
  volumePercent: 100
};

const itemB: ReleaseComparisonItem = {
  ...itemA,
  assetTitle: "Programma",
  checksumSha256: "b".repeat(64),
  mediaAssetId: "20000000-0000-4000-8000-000000000002",
  sortOrder: 1,
  sourceItemId: "30000000-0000-4000-8000-000000000002"
};

describe("immutable release comparison", () => {
  it("returns the golden added, removed, moved and changed classification", () => {
    const itemC = {
      ...itemA,
      assetTitle: "Sponsor",
      checksumSha256: "c".repeat(64),
      fileSizeBytes: 250,
      mediaAssetId: "20000000-0000-4000-8000-000000000003",
      sortOrder: 1,
      sourceItemId: "30000000-0000-4000-8000-000000000003"
    };
    const after = [
      { ...itemB, durationSeconds: 15, sortOrder: 0 },
      itemC
    ];

    const result = compareReleaseItems([itemA, itemB], after);

    expect({
      added: result.added.map(({ assetTitle }) => assetTitle),
      bytesDelta: result.bytesDelta,
      changed: result.changed.map(({ after: item, fields }) => [item.assetTitle, fields]),
      durationDeltaSeconds: result.durationDeltaSeconds,
      moved: result.moved.map(({ after: item, from, to }) => [item.assetTitle, from, to]),
      removed: result.removed.map(({ assetTitle }) => assetTitle)
    }).toEqual({
      added: ["Sponsor"],
      bytesDelta: 150,
      changed: [["Programma", ["duration"]]],
      durationDeltaSeconds: 5,
      moved: [["Programma", 1, 0]],
      removed: ["Welkom"]
    });
  });

  it("compares the complete immutable presentation contract", () => {
    const changed = {
      ...itemA,
      backgroundColor: "#101820",
      cropFocusX: 0.25,
      displayTitle: "Welkom vanavond",
      enabled: false,
      transition: "crossfade",
      trimEndSeconds: 8,
      trimStartSeconds: 1,
      visibleFrom: "2026-08-24T18:00:00.000Z",
      volumePercent: 60
    };

    expect(compareReleaseItems([itemA], [changed]).changed[0]?.fields).toEqual([
      "background",
      "crop",
      "label",
      "enabled",
      "transition",
      "trim",
      "visibility",
      "volume"
    ]);
  });
});

const now = "2026-07-20T12:00:00.000Z";
const basePreflight: ReleasePreflightInput = {
  activeReleaseChecksums: ["a".repeat(64)],
  capabilities: { manifestSchemaVersions: [1] },
  devicePresent: true,
  heartbeatAt: "2026-07-20T11:59:00.000Z",
  now,
  previousReleaseChecksums: [],
  release: {
    items: [
      { checksumSha256: "a".repeat(64), fileSizeBytes: 100 },
      { checksumSha256: "b".repeat(64), fileSizeBytes: 200 }
    ],
    schemaVersion: 1
  },
  screenStatus: "active",
  storageQuotaBytes: 1_000_000_000,
  storageUsedBytes: 100
};

describe("per-screen release preflight", () => {
  it("counts only bytes not known in active or previous releases", () => {
    expect(evaluateReleasePreflight(basePreflight)).toEqual({
      availableBytes: 999_999_900,
      missingBytes: 200,
      reasons: [],
      status: "ready"
    });
  });

  it("never treats stale heartbeat storage as proof", () => {
    expect(evaluateReleasePreflight({
      ...basePreflight,
      heartbeatAt: "2026-07-20T11:30:00.000Z"
    })).toEqual({
      availableBytes: null,
      missingBytes: null,
      reasons: ["HEARTBEAT_STALE", "STORAGE_UNKNOWN"],
      status: "unknown"
    });
  });

  it("keeps fresh heartbeat storage unknown when that measurement is absent", () => {
    expect(evaluateReleasePreflight({
      ...basePreflight,
      storageQuotaBytes: null,
      storageUsedBytes: null
    })).toMatchObject({
      availableBytes: null,
      missingBytes: null,
      reasons: ["STORAGE_UNKNOWN"],
      status: "unknown"
    });
  });

  it("blocks incompatible manifests and insufficient fresh storage deterministically", () => {
    const result = evaluateReleasePreflight({
      ...basePreflight,
      activeReleaseChecksums: [],
      capabilities: { manifestSchemaVersions: [2] },
      storageQuotaBytes: 150,
      storageUsedBytes: 0
    });

    expect(result.status).toBe("blocked");
    expect(result.reasons).toEqual([
      "MANIFEST_INCOMPATIBLE",
      "STORAGE_INSUFFICIENT"
    ]);
  });

  it("uses unknown for an unpaired target instead of inventing cache facts", () => {
    const result = evaluateReleasePreflight({
      ...basePreflight,
      capabilities: null,
      devicePresent: false,
      heartbeatAt: null,
      storageQuotaBytes: null,
      storageUsedBytes: null
    });

    expect(result).toMatchObject({
      availableBytes: null,
      missingBytes: null,
      reasons: ["DEVICE_MISSING", "MANIFEST_COMPATIBILITY_UNKNOWN"],
      status: "unknown"
    });
  });
});
