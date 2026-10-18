import { describe, expect, it } from "vitest";
import { createDynamicTemplateView } from "../src/dynamic-template-view";
import {
  sportDynamicSlideTypes,
  sportlinkBirthdayConfigurationSchema,
  syncSlidePresentationSchema,
  type PlayerDynamicTemplatePayload,
  type SyncContentFamily,
} from "@veyocast/contracts";
import {
  projectSyncDynamicSnapshot,
  resolveSyncDynamicAsset,
  syncDynamicFamilies,
} from "../src/sync-dynamic-projector";

const now = new Date("2026-10-18T12:00:00Z");
const seed = (family: SyncContentFamily) =>
  syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: "sync-v1",
    sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
    family,
    orientation: "landscape",
    theme: "fieldflow",
    name: "Eigen ontwerp",
    title: "Eigen titel",
    club: { name: "Club A" },
    style: {},
  });
const payload = (
  slideType: PlayerDynamicTemplatePayload["slideType"],
  data: Record<string, unknown>,
): PlayerDynamicTemplatePayload => ({
  schemaVersion: 1,
  orientation: "landscape",
  slideType,
  snapshotId: "10000000-0000-4000-8000-000000000226",
  snapshotHash: "a".repeat(64),
  templateVersionId: "20000000-0000-4000-8000-000000000226",
  templateSlug: "canonical-test-snapshot",
  data: { type: slideType, brand: { clubName: "Club A" }, ...data },
});
const item = (index = 0) => ({
  id: `item-${index}`,
  primary: `Eigen naam ${index}`,
  secondary: "Eigen context",
  homeTeam: `Thuis ${index}`,
  awayTeam: `Uit ${index}`,
  homeScore: 3,
  homeMatch: true,
  awayScore: 1,
  homeRoom: "A1",
  awayRoom: "B2",
  field: "2",
  kickoffTime: "14:30",
  kickoffAt: "2026-10-20T12:30:00Z",
  date: "20-10-2026",
  time: "14:30",
  status: "scheduled",
  selected: index === 2,
});
function presentation(result: ReturnType<typeof projectSyncDynamicSnapshot>) {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw Error(result.code);
  return result.presentation;
}

describe("new Source projections of existing canonical snapshots", () => {
  it.each(sportDynamicSlideTypes)(
    "supports the actual %s family without broadening historical renderer identity",
    (slideType) => {
      const data =
        slideType === "sport_birthdays"
          ? {
              sport: {
                fetchedAt: now.toISOString(),
                birthdays: [
                  {
                    id: "birthday-1",
                    displayName: "Echte jarige",
                    day: 18,
                    month: 10,
                    isToday: true,
                    age: 12,
                    role: "Speler",
                    teams: [],
                  },
                ],
              },
            }
          : {
              sport: {
                items: [
                  {
                    ...item(),
                    ...(slideType === "sport_cancellations"
                      ? { status: "cancelled" }
                      : slideType === "sport_results"
                        ? {
                            status: "finished",
                            kickoffAt: "2026-10-17T12:30:00Z",
                          }
                        : {}),
                    teamName: "Eigen club",
                    position: 1,
                    played: 6,
                    points: 16,
                  },
                ],
              },
            };
      const value = payload(slideType, data),
        before = JSON.stringify(value);
      const result = presentation(
        projectSyncDynamicSnapshot(
          value,
          seed(syncDynamicFamilies[slideType][0]),
          now,
        ),
      );
      if (["sport_match_of_the_day", "sport_next_match"].includes(slideType))
        expect(result.home?.name).toBe("Thuis 0");
      else expect(result.rows.length, slideType).toBeGreaterThan(0);
      expect(result.rendererVersion).toBe("sync-v1");
      expect(result.sourceRevision).toBe(
        "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
      );
      expect(JSON.stringify(value)).toBe(before);
      expect(JSON.stringify(result)).not.toMatch(
        /Duindorp|Houtrust|HEREN 1|1950/,
      );
    },
  );
  it("keeps all seventeen standing rows and marks the selected actual row explicitly", () => {
    const value = payload("sport_standing", {
      sport: {
        items: Array.from({ length: 17 }, (_, index) => ({
          ...item(index),
          teamName: `Club ${index}`,
          position: index + 1,
          played: 6,
          points: 16 - index,
        })),
      },
    });
    const slide = presentation(
      projectSyncDynamicSnapshot(value, seed("standings"), now),
    );
    expect(slide.rows).toHaveLength(17);
    expect(slide.rows.at(-1)).toEqual(["17", "Club 16", "6", "0"]);
    expect(slide.ownRowIndexes).toEqual([2]);
  });
  it("keeps thirteen birthdays and eleven sponsor rows across source pages", () => {
    const birthdays = payload("sport_birthdays", {
      sport: {
        fetchedAt: now.toISOString(),
        birthdays: Array.from({ length: 13 }, (_, i) => ({
          id: `birthday-${i}`,
          displayName: `Jarige ${i}`,
          day: 18,
          month: 10,
          age: 20 + i,
          isToday: true,
          role: "Speler",
          teams: [],
        })),
      },
    });
    const people = presentation(
      projectSyncDynamicSnapshot(birthdays, seed("birthdays"), now),
    );
    expect(people.rows).toHaveLength(13);
    expect(people.rows.map((row) => row[2]).sort()).toEqual(
      Array.from({ length: 13 }, (_, i) => `Jarige ${i}`).sort(),
    );
    const sponsors = presentation(
      projectSyncDynamicSnapshot(
        payload("sport_sponsor", {
          sport: { items: Array.from({ length: 11 }, (_, i) => item(i)) },
        }),
        seed("sponsors"),
        now,
      ),
    );
    expect(sponsors.rows).toHaveLength(11);
    expect(sponsors.rows.at(-1)?.[0]).toBe("Eigen naam 10");
  });
  it("keeps all six news articles with their own exact QR destination", () => {
    const slide = presentation(
      projectSyncDynamicSnapshot(
        payload("news", {
          news: {
            articles: Array.from({ length: 6 }, (_, i) => ({
              externalId: `article-${i}`,
              title: `Artikel ${i}`,
              intro: `Inleiding ${i}`,
              link: `https://club.example/nieuws/${i}`,
              sourceName: "Club A",
            })),
          },
        }),
        seed("rss"),
        now,
      ),
    );
    expect(slide.news).toHaveLength(6);
    expect(slide.news.at(-1)).toMatchObject({
      title: "Artikel 5",
      url: "https://club.example/nieuws/5",
    });
  });
  it("uses actual catalog prices and keeps products on every page", () => {
    const slide = presentation(
      projectSyncDynamicSnapshot(
        payload("menu", {
          menu: {
            title: "Eigen menu",
            products: Array.from({ length: 14 }, (_, i) => ({
              id: `product-${i}`,
              name: `Product ${i}`,
              category: "Eigen categorie",
              priceMinor: 235 + i,
            })),
          },
        }),
        seed("menu"),
        now,
      ),
    );
    expect(slide.rows).toHaveLength(14);
    expect(slide.rows[0]?.[1]).toContain("2,35");
    expect(slide.rows.at(-1)?.[0]).toBe("Product 13");
    expect(slide.special).toBeUndefined();
  });
  it("rejects a wrong family or orientation and distinguishes unavailable data from an actual empty selection", () => {
    const value = payload("sport_program", { sport: { items: [] } });
    expect(projectSyncDynamicSnapshot(value, seed("menu"), now)).toEqual({
      ok: false,
      code: "SYNC_FAMILY_SCOPE_MISMATCH",
    });
    expect(
      projectSyncDynamicSnapshot(
        { ...value, orientation: "portrait" },
        seed("fixtures"),
        now,
      ).ok,
    ).toBe(false);
    expect(
      projectSyncDynamicSnapshot({ ...value, data: {} }, seed("fixtures"), now),
    ).toEqual({ ok: false, code: "SYNC_CANONICAL_DATA_UNAVAILABLE" });
    expect(
      presentation(projectSyncDynamicSnapshot(value, seed("fixtures"), now))
        .state,
    ).toBe("empty");
  });
  it("projects all seventy-five Source sponsor rows while the historical entrypoint retains its forty-row limit", () => {
    const value = payload("sport_sponsor", {
      sport: { items: Array.from({ length: 75 }, (_, i) => item(i)) },
    });
    const before = JSON.stringify(value),
      old = createDynamicTemplateView(value, now);
    expect(
      old?.pages.reduce(
        (count, page) => count + ("items" in page ? page.items.length : 0),
        0,
      ),
    ).toBe(40);
    const complete = presentation(
      projectSyncDynamicSnapshot(value, seed("sponsors"), now),
    );
    expect(complete.rows).toHaveLength(75);
    expect(complete.rows.at(-1)?.[0]).toBe("Eigen naam 74");
    expect(JSON.stringify(value)).toBe(before);
  });
  it("a QR-image asset is never used as the news article's QR destination", () => {
    const id = "30000000-0000-4000-8000-000000000226",
      value = payload("news", {
        news: {
          articles: [
            {
              externalId: "article",
              title: "Eigen nieuws",
              intro: "Eigen intro",
              link: "https://club.example/nieuws/actueel",
              qrMediaAssetId: id,
            },
          ],
        },
      });
    value.assets = {
      [id]: {
        bytes: 100,
        checksumSha256: "c".repeat(64),
        mimeType: "image/png",
        url: "https://media.example/qr-image.png",
      },
    };
    expect(
      presentation(projectSyncDynamicSnapshot(value, seed("rss"), now)).news[0]
        ?.url,
    ).toBe("https://club.example/nieuws/actueel");
  });
  it("does not label a stale or missing birthday fetch as an actual empty selection", () => {
    const value = payload("sport_birthdays", {
      sport: { fetchedAt: "2026-09-01T00:00:00Z", birthdays: [] },
    });
    expect(projectSyncDynamicSnapshot(value, seed("birthdays"), now)).toEqual({
      ok: false,
      code: "SYNC_CANONICAL_DATA_UNAVAILABLE",
    });
  });
  it.each(['scoreboard','goal'] as const)('keeps the actual LED waiting state free of unobserved teams and scores in %s',family=>{
    const value=payload('ledscores_live_match',{liveMatch:{state:{schemaVersion:1,status:'unknown',matchKey:'waiting:actual-connection',home:{name:'Thuisteam',score:0},away:{name:'Uitteam',score:0},clock:{label:'0:00'}}}});
    const result=presentation(projectSyncDynamicSnapshot(value,seed(family),now));
    expect(result.state).toBe('empty');expect(result.home).toBeUndefined();expect(result.away).toBeUndefined();expect(result.match).toBeUndefined();expect(JSON.stringify(result)).not.toMatch(/Thuisteam|Uitteam|0:00/);
  });
  it("uses the canonical LED clock and freezes it after the stored source becomes stale", () => {
    const value = payload("ledscores_live_match", {
      liveMatch: {
        state: {
          schemaVersion: 1,
          home: { name: "Eigen club", score: 2 },
          away: { name: "Eigen opponent", score: 1 },
          sourceUpdatedAt: "2026-10-18T12:00:00Z",
          staleAfter: "2026-10-18T12:00:20Z",
          clock: {
            anchorAt: "2026-10-18T12:00:00Z",
            anchorSeconds: 4044,
            running: true,
            direction: "up",
          },
          timeline: [],
        },
      },
    });
    expect(
      presentation(
        projectSyncDynamicSnapshot(
          value,
          seed("scoreboard"),
          new Date("2026-10-18T12:00:06Z"),
        ),
      ).match?.clock,
    ).toBe("67:30");
    expect(
      presentation(
        projectSyncDynamicSnapshot(
          value,
          seed("scoreboard"),
          new Date("2026-10-18T12:10:00Z"),
        ),
      ).match?.clock,
    ).toBe("67:44");
  });
  it("refuses an oversized projection rather than silently dropping provider rows", () => {
    const value = payload("sport_sponsor", {
      sport: { items: Array.from({ length: 201 }, (_, i) => item(i)) },
    });
    expect(projectSyncDynamicSnapshot(value, seed("sponsors"), now)).toEqual({
      ok: false,
      code: "SYNC_PRESENTATION_BOUNDS_EXCEEDED",
    });
  });
  it("only resolves checksummed image identities present in the canonical snapshot manifest", () => {
    const id = "30000000-0000-4000-8000-000000000226",
      value = payload("sport_program", { sport: { items: [] } });
    value.assets = {
      [id]: {
        bytes: 100,
        checksumSha256: "c".repeat(64),
        mimeType: "image/png",
        url: "blob:https://player.veyocast.nl/verified",
      },
    };
    const asset = {
      kind: "tenant" as const,
      mediaAssetId: id,
      checksumSha256: "c".repeat(64),
    };
    expect(resolveSyncDynamicAsset(value, asset)).toBe(value.assets[id]!.url);
    expect(
      resolveSyncDynamicAsset(value, {
        ...asset,
        checksumSha256: "d".repeat(64),
      }),
    ).toBeUndefined();
  });
});

describe("canonical Source policy and menu boundaries", () => {
  it("respects the existing birthday name, age and date visibility policy", () => {
    const value = payload("sport_birthdays", {
      sport: {
        fetchedAt: now.toISOString(),
        birthdays: [
          {
            id: "person",
            displayName: "Robin Voorbeeld",
            day: 18,
            month: 10,
            age: 42,
            role: "Speler",
            teams: [],
          },
        ],
        configuration: sportlinkBirthdayConfigurationSchema.parse({
          selection: { nameMode: "first", showAge: false, showDate: false },
        }),
      },
    });
    const slide = presentation(
      projectSyncDynamicSnapshot(value, seed("birthdays"), now),
    );
    expect(slide.rows[0]).toEqual(["", "", "Robin", "Speler"]);
    expect(JSON.stringify(slide)).not.toMatch(/Voorbeeld|42 jaar/);
  });
  it("keeps the full Source news introduction while the historical renderer retains its original text limit", () => {
    const intro = "Eigen tekst. ".repeat(180).trim(),
      value = payload("news", {
        news: {
          articles: [
            {
              externalId: "long",
              title: "Eigen artikel",
              intro,
              link: "https://club.example/lang",
            },
          ],
        },
      });
    expect(
      presentation(projectSyncDynamicSnapshot(value, seed("rss"), now)).news[0]
        ?.intro,
    ).toBe(intro);
    const legacy = createDynamicTemplateView(value, now)?.pages[0];
    expect(legacy?.kind === "news" && legacy.item?.intro.length).toBe(500);
  });
  it("projects every typed Menu Studio v2 product without changing its document or prices", () => {
    const document = {
      assets: [],
      createdAt: "2026-10-18T12:00:00Z",
      updatedAt: "2026-10-18T12:00:00Z",
      id: "menu-source",
      tenantId: "tenant-a",
      schemaVersion: "menu-document.v2",
      revision: 1,
      title: "Eigen lunch",
      theme: {
        brand: { accent: "#006d73" },
        mode: "light",
        themeId: "editorial",
        themeVersion: "1.0.0",
      },
      pages: [
        {
          id: "page-1",
          order: 0,
          blocks: [
            {
              id: "category-1",
              order: 0,
              type: "category",
              source: {
                source: "manual",
                sourceCategoryId: "food",
                sourceName: "Eigen kaart",
              },
              layout: {
                landscape: { h: 704, w: 846, x: 96, y: 248, rotation: 0 },
                portrait: { h: 1388, w: 936, x: 72, y: 348, rotation: 0 },
              },
              productNodes: Array.from({ length: 24 }, (_, i) => ({
                id: `placement-${i}`,
                kind: "product",
                order: i,
                productRef: { source: "manual", productId: `product-${i}` },
                snapshotFallback: {
                  available: true,
                  name: `Eigen product ${i}`,
                  price: {
                    amountMinor: 235 + i,
                    currency: "EUR",
                    taxMode: "inclusive",
                  },
                },
              })),
            },
          ],
        },
      ],
    };
    for (const type of ["menu", "price_list"] as const) {
      const value = payload(
          type,
          type === "menu"
            ? { menuDocument: document }
            : { priceList: { menuDocument: document } },
        ),
        before = JSON.stringify(value),
        slide = presentation(
          projectSyncDynamicSnapshot(value, seed("menu"), now),
        );
      expect(slide.rows).toHaveLength(24);
      expect(slide.rows.at(-1)?.[0]).toBe("Eigen product 23");
      expect(slide.rows[0]?.[1]).toContain("2,35");
      expect(JSON.stringify(value)).toBe(before);
    }
  });
});
