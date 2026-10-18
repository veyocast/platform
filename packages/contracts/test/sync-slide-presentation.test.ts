import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import syncSlideJsonSchema from "../src/sync-slide-json-schema.json";
import {
  syncContentFamilies,
  syncSlideAssetSchema,
  syncSlideAssets,
  syncSlidePresentationSchema,
  syncSlideRendererVersion,
  syncSlideSourceRevision,
  syncSystemAssets,
  sitesPresentationSchema,
} from "../src/index";

const base = () => ({
  schemaVersion: 1,
  rendererVersion: syncSlideRendererVersion,
  sourceRevision: syncSlideSourceRevision,
  family: "fixtures",
  orientation: "landscape",
  theme: "fieldflow",
  name: "Eigen programma",
  title: "Vandaag",
  club: { name: "Club A" },
  style: {},
});
const image = syncSystemAssets.find(
  (asset) => asset.path === "/assets/clubmuur-wall.webp",
)!;
const tenantAsset = {
  kind: "tenant",
  mediaAssetId: "22600000-0000-4000-8000-000000000001",
  checksumSha256: "a".repeat(64),
} as const;
describe("Sync slide input and legacy separation", () => {
  it("keeps the private database JSON Schema equal to the canonical client output", () => {
    expect(syncSlideJsonSchema).toEqual(
      z.toJSONSchema(syncSlidePresentationSchema, {
        target: "draft-7",
        io: "output",
      }),
    );
    const migration = readFileSync(
      new URL(
        "../../../supabase/migrations/20261018002000_sync_studio_authoring.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(JSON.parse(migration.split("$sync_schema$")[1]!)).toEqual(
      syncSlideJsonSchema,
    );
  });
  it("accepts all 36 exact Source families in both formats and themes", () => {
    expect(syncContentFamilies).toHaveLength(36);
    for (const family of syncContentFamilies)
      for (const orientation of ["landscape", "portrait"])
        for (const theme of ["fieldflow", "onzetrots-tv"])
          expect(
            syncSlidePresentationSchema.safeParse({
              ...base(),
              family: family.id,
              orientation,
              theme,
            }).success,
          ).toBe(true);
  });
  it("does not broaden the installed Sites decoders", () => {
    expect(sitesPresentationSchema.safeParse(base()).success).toBe(false);
    for (const change of [
      { rendererVersion: "sites-v17" },
      { sourceRevision: "0".repeat(40) },
      { html: "<script>unsafe()</script>" },
      { style: { accent: "red;position:fixed" } },
    ])
      expect(
        syncSlidePresentationSchema.safeParse({ ...base(), ...change }).success,
      ).toBe(false);
  });
  it("accepts only manifest images with their exact checksum", () => {
    expect(
      syncSlideAssetSchema.parse({
        kind: "system",
        path: image.path,
        checksumSha256: image.sha256,
      }),
    ).toMatchObject({ path: image.path });
    for (const path of [
      "/assets/logo-pack.zip",
      "/assets/inter.woff2",
      "/assets/../private.svg",
      "https://example.org/logo.svg",
    ])
      expect(
        syncSlideAssetSchema.safeParse({
          kind: "system",
          path,
          checksumSha256: image.sha256,
        }).success,
      ).toBe(false);
    expect(
      syncSlideAssetSchema.safeParse({
        kind: "system",
        path: image.path,
        checksumSha256: "b".repeat(64),
      }).success,
    ).toBe(false);
  });
  it("deduplicates all referenced club and background assets", () => {
    const slide = syncSlidePresentationSchema.parse({
      ...base(),
      club: { name: "Club A", logo: tenantAsset },
      home: { name: "Club A", logo: tenantAsset },
      away: {
        name: "Club B",
        logo: {
          ...tenantAsset,
          mediaAssetId: "22600000-0000-4000-8000-000000000002",
        },
      },
      style: { background: "photo", backgroundAsset: tenantAsset },
    });
    expect(syncSlideAssets(slide)).toHaveLength(2);
    expect(
      syncSlidePresentationSchema.safeParse({
        ...base(),
        style: { background: "photo" },
      }).success,
    ).toBe(false);
  });
  it("rejects private poll counts, repeated choices and non-public URLs", () => {
    const poll = {
      id: tenantAsset.mediaAssetId,
      title: "Wie kiezen we?",
      status: "live",
      visibility: "after_vote",
      options: [1, 2].map((index) => ({
        id: `22600000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        label: `Keuze ${index}`,
        votes: 0,
      })),
    };
    const parse = (value: unknown) =>
      syncSlidePresentationSchema.safeParse({
        ...base(),
        family: "engage",
        poll: value,
      });
    expect(parse(poll).success).toBe(true);
    expect(
      parse({
        ...poll,
        visibility: "live",
        status: "draft",
        options: poll.options.map((option) => ({ ...option, votes: 1 })),
      }).success,
    ).toBe(false);
    expect(
      parse({
        ...poll,
        options: poll.options.map((option) => ({ ...option, votes: 1 })),
      }).success,
    ).toBe(false);
    expect(
      parse({ ...poll, options: [poll.options[0], poll.options[0]] }).success,
    ).toBe(false);
    for (const publicUrl of [
      "javascript:alert(1)",
      "http://example.org/poll",
      "https://secret@example.org/poll",
    ])
      expect(parse({ ...poll, publicUrl }).success).toBe(false);
    expect(
      parse({
        ...poll,
        visibility: "after_close",
        status: "closed",
        options: poll.options.map((option) => ({ ...option, votes: 1 })),
      }).success,
    ).toBe(true);
  });
  it("bounds rows, prices, own-row markers and video origins", () => {
    for (const change of [
      { rows: Array.from({ length: 201 }, () => ["", "", "", ""]) },
      { rows: [["a", "b"]] },
      { ownRowIndexes: [0] },
      { special: { label: "Vandaag", title: "Koffie", priceCents: -1 } },
      {
        youtubeUrl: "https://youtube.com.attacker.example/watch?v=abcdefghijk",
      },
      { youtubeUrl: "https://youtube.com:8443/watch?v=abcdefghijk" },
    ])
      expect(
        syncSlidePresentationSchema.safeParse({ ...base(), ...change }).success,
      ).toBe(false);
  });
});
