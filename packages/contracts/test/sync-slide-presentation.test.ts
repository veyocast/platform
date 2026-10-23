import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import syncSlideJsonSchema from "../src/sync-slide-json-schema.json";
import {
  syncContentFamilies,
  syncSlideAssetSchema,
  syncSlideAssets,
  syncSlidePresentationSchema,
  syncSlidePageCount,
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
        "../../../supabase/migrations/20261023140732_sync_onzetrots_v9.sql",
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
  it("preserves legacy poll duration and requires explicit complete paging for thirteen to twenty-four options", () => {
    const options = (count: number) => Array.from({ length: count }, (_, i) => ({
      id: `26200000-0000-4000-8000-${String(i).padStart(12, "0")}`, label: `Keuze ${i + 1}`, votes: i,
    }));
    const poll = { id: tenantAsset.mediaAssetId, title: "Kies je activiteit", status: "live", visibility: "live" };
    const parse = (value: unknown) => syncSlidePresentationSchema.safeParse({ ...base(), family: "engage", poll: value });
    for (const count of [2, 12, 13, 24]) {
      const paged = parse({ ...poll, optionsPerPage: 4, options: options(count) });
      expect(paged.success).toBe(true);
      if (!paged.success) throw Error("paged campaign rejected");
      expect(paged.data.poll?.options).toEqual(options(count));
      expect(syncSlidePageCount(paged.data)).toBe(Math.ceil(count / 4));
      const legacy = parse({ ...poll, options: options(count) });
      expect(legacy.success).toBe(count <= 12);
      if (legacy.success) {
        expect(syncSlidePageCount(legacy.data)).toBe(1);
        expect(legacy.data.poll).not.toHaveProperty("optionsPerPage");
      }
    }
    for (const count of [1, 25]) expect(parse({ ...poll, optionsPerPage: 4, options: options(count) }).success).toBe(false);
    expect(parse({ ...poll, optionsPerPage: 12, options: options(24) }).success).toBe(false);
    expect(parse({ ...poll, optionsPerPage: 4, options: options(24).map(option => ({ ...option, label: "x".repeat(161) })) }).success).toBe(false);
    expect(parse({ ...poll, optionsPerPage: 4, options: [options(2)[0], options(2)[0]] }).success).toBe(false);
    for (const visibility of ["after_vote", "after_close"])
      expect(parse({ ...poll, visibility, optionsPerPage: 4, options: options(24) }).success).toBe(false);
    const original = readFileSync(new URL("../../../supabase/migrations/20261018002000_sync_studio_authoring.sql", import.meta.url), "utf8");
    expect(JSON.parse(original.split("$sync_schema$")[1]!).properties.poll.properties.options.maxItems).toBe(12);
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
