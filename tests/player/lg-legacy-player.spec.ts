import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const deviceToken = "d".repeat(48);
const installationCredential = "i".repeat(48);
const legacyImagePath = "/__legacy-test/image.svg";
const legacyImageSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#ff5a1f"/></svg>';
const legacyImageBytes = Buffer.byteLength(legacyImageSvg);
const legacyImageChecksum = createHash("sha256")
  .update(legacyImageSvg)
  .digest("hex");
const legacySecondImagePath = "/__legacy-test/image-second.svg";
const legacySecondImageSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#175cd3"/></svg>';
const legacySecondImageBytes = Buffer.byteLength(legacySecondImageSvg);
const legacySecondImageChecksum = createHash("sha256")
  .update(legacySecondImageSvg)
  .digest("hex");
const legacyVideoPath = "/lg-probe/h264-baseline-aac.mp4";
const legacyVideoBytes = readFileSync(
  "apps/player/public/lg-probe/h264-baseline-aac.mp4"
);
const legacyVideoChecksum = createHash("sha256")
  .update(legacyVideoBytes)
  .digest("hex");

async function mockLegacyApis(
  page: Page,
  heartbeatBodies: Array<Record<string, unknown>> = [],
  manifestEtags: Array<string | undefined> = []
) {
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const etag = route.request().headers()["if-none-match"];
    manifestEtags.push(etag);
    if (etag === '"release-release-legacy"') {
      await route.fulfill({
        headers: { ETag: etag },
        status: 304
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      headers: { ETag: '"release-release-legacy"' },
      body: JSON.stringify({
        state: "PLAYING",
        fetchedAt: new Date().toISOString(),
        device: {
          id: "device-legacy",
          screenId: "screen-legacy",
          screenName: "LG Legacy",
          activeReleaseId: "release-legacy",
          desiredReleaseId: "release-legacy"
        },
        manifest: {
          schemaVersion: 1,
          tenantId: "tenant-legacy",
          playlistId: "playlist-legacy",
          releaseId: "release-legacy",
          version: 1,
          label: "Legacy bewijs",
          manifestHash: "a".repeat(64),
          publishedAt: new Date().toISOString(),
          totalDurationSeconds: 5,
          totalBytes: legacyImageBytes,
          items: [
            {
              id: "legacy-image",
              kind: "image",
              title: "Legacy testbeeld",
              durationSeconds: 5,
              fitMode: "contain",
              muted: true,
              source: {
                url: legacyImagePath,
                mimeType: "image/svg+xml",
                bytes: legacyImageBytes,
                checksumSha256: legacyImageChecksum
              }
            }
          ]
        },
        diagnostics: {
          syncStatus: "online",
          lastSuccessfulSyncAt: new Date().toISOString(),
          nextSyncReason: "test"
        }
      })
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    heartbeatBodies.push(
      (route.request().postDataJSON() ?? {}) as Record<string, unknown>
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
}

async function mockEditorialArenaLegacyApis(
  page: Page,
  orientation: "landscape" | "portrait" = "landscape",
  newsVariant: "fullscreen_gradient" | "hero_split" = "hero_split"
) {
  const heroMediaAssetId = "10000000-0000-4000-8000-000000000041";
  const qrMediaAssetId = "10000000-0000-4000-8000-000000000042";
  const fullscreen = newsVariant === "fullscreen_gradient";
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "editorial-news",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Editorial Arena nieuws",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: fullscreen ? {
          [heroMediaAssetId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          },
          [qrMediaAssetId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        } : undefined,
        data: {
          data: {
            articles: [{
              author: "VeyoCast redactie",
              heroMediaAssetId: fullscreen ? heroMediaAssetId : undefined,
              intro: "De volledige HTML/CSS-renderketen werkt ook op de legacy Player.",
              link: fullscreen ? "https://example.test/nieuws/legacy" : undefined,
              publishedAt: "2026-08-03T18:00:00.000Z",
              qrMediaAssetId: fullscreen ? qrMediaAssetId : undefined,
              title: "Oos Kesbeke: een fijnproever ben ik niet, ik vind het lekker of niet"
            }],
            generatedAt: "2026-08-03T18:00:00.000Z",
            secondsPerSlide: 5,
            sourceName: "Clubnieuws"
          },
          editorial: { newsVariant },
          type: "news"
        },
        orientation,
        schemaVersion: 1,
        slideType: "news",
        snapshotHash: "b".repeat(64),
        snapshotId: "11111111-1111-4111-8111-111111111111",
        templateSlug: `editorial-arena-nieuws-dark-${orientation}`,
        templateVersionId: "22222222-2222-4222-8222-222222222222"
      }
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
}

type FieldFlowSportSlideType =
  | "sport_sponsor"
  | "sport_team"
  | "sport_trainings"
  | "sport_volunteers";

const fieldFlowSportFamilies: Record<FieldFlowSportSlideType, string> = {
  sport_sponsor: "sponsor-spotlight",
  sport_team: "team-roster",
  sport_trainings: "training-schedule",
  sport_volunteers: "volunteer-call"
};

type FieldFlowSportLegacyOptions = {
  allOptionalMatchFields?: boolean;
  frozenRoyalCurrentV2?: boolean;
  mixedCancellation?: boolean;
  showTime?: boolean;
};

async function mockFieldFlowSportLegacyApis(
  page: Page,
  slideType: FieldFlowSportSlideType | "sport_program" | "sport_results",
  orientation: "landscape" | "portrait",
  mode: "dark" | "light",
  itemCount = 8,
  displayColumns: "one" | "two" = "one",
  options: FieldFlowSportLegacyOptions = {}
) {
  const imageAssetId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const matchSlide = slideType === "sport_program" || slideType === "sport_results";
  const allOptionalMatchFields = matchSlide && options.allOptionalMatchFields === true;
  const family = slideType === "sport_program"
    ? "fixture-list"
    : slideType === "sport_results"
      ? "result-list"
      : fieldFlowSportFamilies[slideType];
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: `fieldflow-${slideType}`,
      kind: "image",
      mimeType: "image/svg+xml",
      title: `FieldFlow ${family}`,
      url: legacyImagePath
    });
    const items = Array.from({ length: itemCount }, (_, index) => ({
      awayLogoMediaAssetId: matchSlide ? imageAssetId : undefined,
      awayRoom: allOptionalMatchFields ? `Uit ${index + 1}` : undefined,
      awayScore: slideType === "sport_results" ? 1 : undefined,
      awayTeam: matchSlide ? `Uit ${index + 1}` : undefined,
      cancelled: options.mixedCancellation === true && index === 1,
      date: matchSlide ? "12-09-2026" : undefined,
      field: matchSlide ? `Veld ${index + 1}` : undefined,
      homeLogoMediaAssetId: matchSlide ? imageAssetId : undefined,
      homeRoom: allOptionalMatchFields ? `Thuis ${index + 1}` : undefined,
      homeScore: slideType === "sport_results" ? 2 : undefined,
      homeTeam: matchSlide ? `Thuis ${index + 1}` : undefined,
      id: `${slideType}-${index + 1}`,
      officials: allOptionalMatchFields
        ? [{ displayName: `Scheidsrechter ${index + 1}` }]
        : undefined,
      time: matchSlide ? "08:30" : undefined,
      venue: matchSlide ? `Veld ${index + 1}` : undefined,
      venueName: matchSlide ? "Sportpark FieldFlow" : undefined,
      logoMediaAssetId: slideType === "sport_sponsor" ? imageAssetId : null,
      photoMediaAssetId: slideType === "sport_team" ? imageAssetId : null,
      primary: matchSlide
        ? `Thuis ${index + 1} – Uit ${index + 1}`
        : slideType === "sport_team"
          ? `Selectiespeler met lange naam ${index + 1}`
          : slideType === "sport_sponsor"
            ? `Clubpartner ${index + 1}`
            : slideType === "sport_trainings"
              ? `Team onder ${11 + index}`
              : `Vrijwilligersrol ${index + 1}`,
      secondary: slideType === "sport_trainings"
        ? "Dinsdag en donderdag · 19:30"
        : slideType === "sport_volunteers"
          ? "Gastheer of gastvrouw op wedstrijddagen"
          : "Eerste selectie",
      status: options.mixedCancellation === true && index === 1
        ? "Afgelast"
        : slideType === "sport_program"
          ? "Programma"
          : slideType === "sport_results"
            ? "Definitief"
          : slideType === "sport_volunteers"
            ? "Open rol"
            : "Gepubliceerd",
      meta: slideType === "sport_sponsor"
        ? "Samen sterk voor de vereniging"
        : "Sportpark FieldFlow"
    }));
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [imageAssetId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          ...(options.frozenRoyalCurrentV2
            ? { _veyocastThemeRuntime: { version: 2 } }
            : {}),
          brand: {
            clubName: "Sportvereniging FieldFlow",
            primaryColor: "#169B62"
          },
          sport: {
            competition: { name: "Vierde klasse" },
            displayConfig: {
              columns: displayColumns,
              ...(allOptionalMatchFields ? {
                showAwayDressingRoom: true,
                showAwayLogo: true,
                showDate: true,
                showHomeDressingRoom: true,
                showHomeLogo: true,
                showReferee: true,
                showSportpark: true,
                showTime: options.showTime !== false
              } : {}),
              showField: true,
              showHomeAway: true,
              showLogo: true
            },
            items,
            pool: { name: "Poule A" },
            season: "2026/2027",
            title: slideType === "sport_program"
              ? "Clubprogramma komende 7 dagen"
              : slideType === "sport_results"
                ? "Clubuitslagen afgelopen 7 dagen"
              : slideType === "sport_team"
                ? "Ons team"
                : slideType === "sport_sponsor"
                  ? "Clubpartners"
                  : slideType === "sport_trainings"
                    ? "Trainingen"
                    : "Vrijwilligers"
          },
          themePresentation: options.frozenRoyalCurrentV2 ? {
            appearance: {
              designRevision: "royal-current-v8",
              motionEnabled: false,
              palette: {
                background: "club",
                primary: "#2459ED",
                secondary: null,
                version: 1
              },
              schemaVersion: 2,
              typography: {
                baseScale: 1,
                bodyFontRef: "vc-source-serif-4-v1",
                displayFontRef: "vc-anton-v1",
                sportScale: 1
              }
            },
            resolvedMode: { mode, reason: "fixed" },
            selection: {
              accent: null,
              categoryOverrides: [],
              modePolicy: { kind: "fixed", mode },
              ref: { catalog: "v2", id: "fieldflow", version: "3.0.0" },
              support: null
            },
            snapshotVersion: 2
          } : {
            resolvedMode: { mode, reason: "fixed" },
            selection: {
              accent: null,
              categoryOverrides: [],
              modePolicy: { kind: "fixed", mode },
              ref: { catalog: "v2", id: "fieldflow", version: "3.0.0" },
              support: null
            }
          },
          type: slideType
        },
        orientation,
        schemaVersion: 1,
        slideType,
        snapshotHash: "f".repeat(64),
        snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        templateSlug: `editorial-arena-${slideType.replaceAll("_", "-")}-${mode}-${orientation}`,
        templateVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

async function mockRoyalCurrentLedLegacyApis(page: Page) {
  const connectionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "royal-current-live-match",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Royal Current live wedstrijd",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        data: {
          _veyocastThemeRuntime: { version: 2 },
          brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#2459ED" },
          liveMatch: {
            configuration: {
              accentMode: "club",
              outsideMatchBehavior: "last_known",
              showClock: true,
              showStatus: true,
              showTimeline: false,
              template: "scoreboard",
              title: "Live vanaf Sportpark FieldFlow"
            },
            connectionId,
            connectionName: "FieldFlow live",
            state: {
              away: { logoUrl: null, name: "Bezoekers O23-1", score: 1 },
              clock: {
                anchorAt: "2026-09-09T12:30:00.000Z",
                anchorSeconds: 2_745,
                direction: "up",
                maxSeconds: 5_400,
                running: false
              },
              home: { logoUrl: null, name: "FieldFlow O23-1", score: 2 },
              matchKey: "royal-current-live-match",
              periodLabel: "Tweede helft",
              schemaVersion: 1,
              sourceUpdatedAt: "2026-09-09T12:30:00.000Z",
              staleAfter: "2026-09-09T13:00:00.000Z",
              stateRevision: "42",
              status: "live",
              timeline: []
            }
          },
          themePresentation: {
            appearance: {
              designRevision: "royal-current-v8",
              motionEnabled: false,
              palette: {
                background: "club",
                primary: "#2459ED",
                secondary: null,
                version: 1
              },
              schemaVersion: 2,
              typography: {
                baseScale: 1,
                bodyFontRef: "vc-source-serif-4-v1",
                displayFontRef: "vc-anton-v1",
                sportScale: 1
              }
            },
            resolvedMode: { mode: "light", reason: "fixed" },
            selection: {
              accent: null,
              categoryOverrides: [],
              modePolicy: { kind: "fixed", mode: "light" },
              ref: { catalog: "v2", id: "fieldflow", version: "3.0.0" },
              support: null
            },
            snapshotVersion: 2
          },
          type: "ledscores_live_match"
        },
        orientation: "landscape",
        schemaVersion: 1,
        slideType: "ledscores_live_match",
        snapshotHash: "e".repeat(64),
        snapshotId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        templateSlug: "royal-current-live-match-light-landscape",
        templateVersionId: "ffffffff-ffff-4fff-8fff-ffffffffffff"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

async function mockEditorialStandingLegacyApis(page: Page) {
  const logoId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "editorial-standing",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Editorial Arena stand",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [logoId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          brand: {
            clubName: "Duindorp sv",
            logoMediaAssetId: logoId,
            primaryColor: "#ff5a1f"
          },
          sport: {
            competition: { name: "Mannen KNVB beker amateurs" },
            items: ["CVC Reeuwijk 1", "Duindorp sv 1", "LSVV 70 1", "TAVV 1"]
              .map((teamName, index) => ({
                drawn: 0,
                form: [],
                goalDifference: 0,
                id: `standing-team-${index + 1}`,
                logoMediaAssetId: logoId,
                lost: 0,
                played: 0,
                points: 0,
                position: index + 1,
                selected: index === 1,
                teamName,
                won: 0
              })),
            pool: { name: "Poulefase 30" },
            season: "2026/2027",
            title: "Stand"
          },
          type: "sport_standing"
        },
        orientation: "portrait",
        schemaVersion: 1,
        slideType: "sport_standing",
        snapshotHash: "c".repeat(64),
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateSlug: "editorial-arena-competitiestand-dark-portrait",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
}

async function mockVisitorArrivalsLegacyApis(page: Page) {
  const awayLogoId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "visitor-arrivals",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Bezoekers welkom",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [awayLogoId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          brand: { clubName: "Duindorp sv", primaryColor: "#ff5a1f" },
          sport: {
            arrivalConfig: { cardCount: 4, emptyBehavior: "skip", motionPreset: "auto" },
            items: [
              {
                awayRoom: "2",
                awayTeam: "Bezoekers FC",
                date: "07-09-2026",
                field: "1",
                homeMatch: true,
                homeRoom: "1",
                homeTeam: "Duindorp sv JO15-1",
                id: "home-fixture",
                kickoffAt: "2026-09-07T12:30:00.000Z",
                kickoffTime: "14:30",
                logoMediaAssetId: awayLogoId,
                meta: "Kleedkamer 2 · Veld 1",
                officials: [{ displayName: "Sam Scheidsrechter" }],
                primary: "Bezoekers FC",
                secondary: "Aankomst 13:00 · Aanvang 14:30",
                status: "Welkom bij {{club}}",
                venueName: "Sportpark Houtrust"
              },
              {
                homeMatch: false,
                id: "away-fixture",
                logoMediaAssetId: awayLogoId,
                meta: "Uitwedstrijd",
                primary: "Duindorp sv 1",
                secondary: "Aanvang 15:00",
                status: "Welkom bij {{club}}"
              }
            ],
            pageDurationSeconds: 12,
            timezone: "Europe/Amsterdam",
            title: "Welkom op ons sportpark"
          },
          type: "sport_visitor_arrivals"
        },
        orientation: "landscape",
        schemaVersion: 1,
        slideType: "sport_visitor_arrivals",
        snapshotHash: "c".repeat(64),
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateSlug: "editorial-arena-bezoekers-aankomst-light-landscape",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

async function mockEditorialPriceListLegacyApis(page: Page) {
  const imageId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "editorial-price-list",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Editorial Arena prijslijst",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {
          [imageId]: {
            bytes: legacyImageBytes,
            checksumSha256: legacyImageChecksum,
            mimeType: "image/svg+xml",
            url: legacyImagePath
          }
        },
        data: {
          brand: {
            clubName: "Duindorp sv",
            logoMediaAssetId: imageId,
            primaryColor: "#ff5a1f"
          },
          priceList: {
            sections: (["left", "right"] as const).map((column, columnIndex) => ({
              column,
              id: `legacy-${column}`,
              name: column === "left" ? "Dranken" : "Snacks",
              order: columnIndex,
              products: Array.from({ length: 8 }, (_, index) => ({
                description: "Clubprijs",
                formattedPrice: `€ ${index + 2},50`,
                id: `${column}-${index}`,
                imageMediaAssetId: index === 0 ? imageId : null,
                name: `${column === "left" ? "Drank" : "Snack"} ${index + 1}`,
                photoVisible: index !== 2
              }))
            })),
            title: "Prijslijst"
          },
          type: "price_list"
        },
        orientation: "portrait",
        schemaVersion: 1,
        slideType: "price_list",
        snapshotHash: "c".repeat(64),
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateSlug: "editorial-arena-prijslijst-dark-portrait",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

async function mockMenuStudioPortraitLegacyApis(page: Page, { loose = false } = {}) {
  await page.route("**/api/player/installation", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ bound: true, installationCredential, ok: true })
  }));
  await page.route(`**${legacyImagePath}`, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: legacyImageSvg
  }));
  await page.route("**/api/player/manifest?legacy=*", (route) => {
    const envelope = legacyEnvelope({
      bytes: legacyImageBytes,
      checksumSha256: legacyImageChecksum,
      id: "menu-studio-portrait",
      kind: "image",
      mimeType: "image/svg+xml",
      title: "Menu Studio portrait",
      url: legacyImagePath
    });
    Object.assign(envelope.manifest.items[0]!, {
      dynamicTemplate: {
        assets: {},
        data: {
          menuDocument: {
            schemaVersion: "menu-document.v2",
            title: "Nieuw menu",
            pages: [{
              id: "page-portrait",
              order: 0,
              blocks: [{
                ...(loose ? { flowAcrossColumns: true, headingVisible: false } : {}),
                id: "category-hardloper",
                layout: {
                  landscape: { h: 320, rotation: 0, w: 800, x: 1010, y: 248 },
                  portrait: { h: 420, rotation: 0, w: 936, x: 72, y: 348 }
                },
                labelOverride: "Hardloper, frisdrank",
                order: 0,
                productNodes: Array.from({ length: loose ? 8 : 3 }, (_, index) =>
                  loose && index === 1
                    ? {
                        display: { maxLines: 2 },
                        id: "product-group-cola",
                        kind: "product-group",
                        order: index,
                        pricePolicy: "shared",
                        secondaryLineItems: [
                          {
                            id: "group-line-regular",
                            kind: "linked-product",
                            snapshotFallback: {
                              available: true,
                              name: "Cola regular",
                              price: { amountMinor: 275, currency: "EUR" }
                            }
                          },
                          { id: "group-line-zero", kind: "free-text", label: "Cola zero" }
                        ],
                        sharedPrice: { amountMinor: 275, currency: "EUR" },
                        title: "Cola naar keuze"
                      }
                    : {
                        id: `product-aa-drink-${index}`,
                        kind: "product",
                        order: index,
                        snapshotFallback: {
                          available: true,
                          name: index === 0
                            ? "AA Drink"
                            : index === 1
                              ? "Chaudfontaine mineraalwater bruisend"
                              : index === 2
                                ? "Verse ambachtelijke vegetarische clubsandwich deluxe"
                                : `Product ${index + 1}`,
                          price: { amountMinor: 250 + index * 10, currency: "EUR" },
                          variantLabel: index === 0 ? "AA Drink · Naar keuze" : null
                        }
                      }
                ),
                source: { sourceName: "Hardloper, frisdrank" },
                type: "category"
              }]
            }]
          },
          themePresentation: {
            resolvedMode: { mode: "dark" },
            selection: {
              accent: "#30bced",
              ref: { catalog: "v2", id: "obsidian", version: "1.0.0" }
            }
          },
          type: "price_list"
        },
        orientation: "portrait",
        schemaVersion: 1,
        slideType: "price_list",
        snapshotHash: "d".repeat(64),
        snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        templateSlug: "editorial-arena-prijslijst-dark-portrait",
        templateVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      }
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ automation: null, ok: true })
  }));
  await page.route("**/api/player/commands", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ commands: [], ok: true, serverTime: new Date().toISOString() })
  }));
}

test("LG Legacy Player gebruikt een statische shell en lokale afbeelding", async ({
  page
}) => {
  const heartbeatBodies: Array<Record<string, unknown>> = [];
  const manifestEtags: Array<string | undefined> = [];
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await mockLegacyApis(page, heartbeatBodies, manifestEtags);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );
  await page.goto(`${playerURL}/lg/legacy`);

  const image = page.locator("#media-root > img");
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#watermark")).toHaveClass("visible");
  await expect(page.locator("#media-root > *")).toHaveCount(1);
  await expect.poll(() => heartbeatBodies.length).toBeGreaterThan(0);
  expect(heartbeatBodies.at(-1)).toMatchObject({
    runtimeState: "PLAYING",
    syncPhase: "active"
  });
  await expect
    .poll(() =>
      page.evaluate(
        async (cacheKey) =>
          Boolean(
            await (
              await caches.open("veyocast-player-assets-v1")
            ).match(cacheKey)
          ),
        `/__veyocast-player-cache/${legacyImageChecksum}`
      )
    )
    .toBe(true);
  await image.evaluate((element) => {
    element.setAttribute("data-playback-instance", "unchanged");
    window.dispatchEvent(new Event("online"));
  });
  await expect.poll(() => manifestEtags.at(-1)).toBe(
    '"release-release-legacy"'
  );
  await expect(image).toHaveAttribute("data-playback-instance", "unchanged");
  manifestEtags.length = 0;
  await page.reload();
  await expect(page.locator("#media-root > img")).toBeVisible();
  await expect.poll(() => manifestEtags[0]).toBe(
    '"release-release-legacy"'
  );
  expect(
    requestedUrls.filter((url) => url.endsWith(legacyImagePath))
  ).toHaveLength(1);
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);
});

test("LG Legacy Player toont een Goal Alert en bevestigt de weergave per scherm", async ({
  page
}) => {
  const acknowledgements: Array<{ deliveryId?: string; status?: string }> = [];
  let rejectedRenderedAcknowledgement = false;
  let realtimeAuthorization: string | undefined;
  let realtimeRequests = 0;
  await mockLegacyApis(page);
  await page.route("**/api/player/realtime/ack", async (route) => {
    const acknowledgement = JSON.parse(route.request().postData() ?? "{}") as {
      deliveryId?: string;
      status?: string;
    };
    acknowledgements.push(acknowledgement);
    if (acknowledgement.status === "rendered" && !rejectedRenderedAcknowledgement) {
      rejectedRenderedAcknowledgement = true;
      await route.fulfill({ status: 503 });
      return;
    }
    await route.fulfill({
      body: JSON.stringify({ ok: true }),
      contentType: "application/json"
    });
  });
  await page.route("**/api/player/realtime", async (route) => {
    realtimeRequests += 1;
    realtimeAuthorization = route.request().headers().authorization;
    if (realtimeRequests > 1) {
      await route.fulfill({ status: 401 });
      return;
    }
    const now = Date.now();
    await route.fulfill({
      body: legacyGoalSse({
        deliveryId: "99999999-9999-4999-8999-999999999999",
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        executeAt: new Date(now + 250).toISOString(),
        expiresAt: new Date(now + 4_000).toISOString(),
        scene: { landscape: {}, portrait: {} },
        serverTime: new Date(now).toISOString()
      }),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-store, no-transform" }
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  const image = page.locator("#media-root > img");
  const overlay = page.locator("#goal-overlay");
  await expect(image).toBeVisible();
  await image.evaluate((element) => {
    element.setAttribute("data-playback-instance", "legacy-goal-underlay");
  });
  await expect(overlay).toBeVisible();
  await expect(overlay).not.toHaveAttribute("data-renderer", "canvas");
  await expect(overlay).toContainText("LEGACY GOAL!");
  await expect(overlay).toContainText("1–0");
  await expect(image).toBeVisible();
  expect(realtimeAuthorization).toBe(`Bearer ${deviceToken}`);
  await expect.poll(() => acknowledgements.some((item) =>
    item.deliveryId === "99999999-9999-4999-8999-999999999999"
      && item.status === "received"
  )).toBe(true);
  await expect.poll(() => acknowledgements.some((item) =>
    item.deliveryId === "99999999-9999-4999-8999-999999999999"
      && item.status === "rendered"
  )).toBe(true);
  await expect.poll(() => acknowledgements.filter((item) =>
    item.deliveryId === "99999999-9999-4999-8999-999999999999"
      && item.status === "rendered"
  ).length).toBeGreaterThanOrEqual(2);
  await expect(overlay).toBeHidden({ timeout: 4_000 });
  await expect(image).toHaveAttribute(
    "data-playback-instance",
    "legacy-goal-underlay"
  );
  await expect(page.locator("#media-root > *")).toHaveCount(1);
});

test("LG Legacy kiest de portrait S142-scene met video en dynamische speler", async ({
  page
}) => {
  const backgroundAssetId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const logoAssetId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  let realtimeRequests = 0;
  await page.setViewportSize({ height: 1280, width: 720 });
  await mockLegacyApis(page);
  await page.route("**/api/player/realtime/ack", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/realtime", async (route) => {
    realtimeRequests += 1;
    if (realtimeRequests > 1) {
      await route.fulfill({ status: 401 });
      return;
    }
    const currentTime = Date.now();
    await route.fulfill({
      body: legacyGoalSse({
        assets: [
          {
            checksum: legacyVideoChecksum,
            mediaAssetId: backgroundAssetId,
            mimeType: "video/mp4",
            url: playerURL + legacyVideoPath
          },
          {
            checksum: legacyImageChecksum,
            mediaAssetId: logoAssetId,
            mimeType: "image/png",
            url: playerURL + legacyImagePath
          }
        ],
        deliveryId: "99999999-9999-4999-8999-999999999998",
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
        executeAt: new Date(currentTime + 250).toISOString(),
        expiresAt: new Date(currentTime + 4_000).toISOString(),
        logoMediaAssetId: logoAssetId,
        player: {
          id: "speler-9",
          name: "Dynamische Speler",
          number: "9",
          photoUrl: playerURL + legacyImagePath
        },
        scene: legacyCanvasScenePair(backgroundAssetId),
        serverTime: new Date(currentTime).toISOString()
      }),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-store, no-transform" }
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(playerURL + "/lg/legacy");

  const overlay = page.locator("#goal-overlay");
  const scene = overlay.locator(".goal-canvas-scene");
  const background = scene.locator("video.goal-canvas-background-media");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-orientation", "portrait");
  await expect(scene).toHaveAttribute("data-canvas-width", "1080");
  await expect(scene).toHaveAttribute("data-canvas-height", "1920");
  await expect(scene).toContainText("PORTRAIT CANVAS");
  await expect(scene).toContainText("EIGEN CANVAS HEADLINE");
  await expect(scene).toContainText("Eigen canvas subtekst");
  await expect(scene).toContainText("Dynamische Speler");
  await expect(scene).not.toContainText("LEGACY GOAL!");
  await expect(scene).not.toContainText("Kantinescherm");
  await expect(scene).not.toContainText("LANDSCAPE CANVAS");
  await expect(scene.locator('[data-canvas-layer-id="accent-shape"]'))
    .toBeVisible();
  expect(await scene.locator('[data-canvas-shape="line"]').evaluate(
    (element) => ({
      backgroundColor: element.style.backgroundColor,
      borderTopWidth: element.style.borderTopWidth,
      height: element.style.height,
      top: element.style.top
    })
  )).toEqual({
    backgroundColor: "transparent",
    borderTopWidth: "6px",
    height: "0px",
    top: "50%"
  });
  await expect(
    scene.locator('[data-goal-canvas-image-binding="scorerPhoto"] img')
  ).toBeVisible();
  await expect(
    scene.locator('[data-goal-canvas-image-binding="homeLogo"] img')
  ).toBeVisible();
  await expect(background).toBeVisible();
  expect(await background.evaluate((element) => ({
    autoplay: element.autoplay,
    loop: element.loop,
    muted: element.muted,
    playsInline: element.playsInline
  }))).toEqual({
    autoplay: true,
    loop: true,
    muted: true,
    playsInline: true
  });
  const stacking = await page.evaluate(() => ({
    overlay: Number(window.getComputedStyle(
      document.querySelector("#goal-overlay")!
    ).zIndex),
    watermark: Number(window.getComputedStyle(
      document.querySelector("#watermark")!
    ).zIndex)
  }));
  expect(stacking.watermark).toBeGreaterThan(stacking.overlay);
  await expect(page.locator("#watermark")).toHaveClass("visible");
  await expect(page.locator("#media-root > img")).toBeVisible();
  await expect(overlay).toBeHidden({ timeout: 4_000 });
});

for (const scenario of [
  {
    awayScore: 1,
    eventKind: "synthetic_test" as const,
    expectedAwayLogo: true,
    expectedEventLabel: "LIVE-TEST · TEGENDOELPUNT",
    expectedHomeLogo: false,
    expectedScoringTeamLogo: false,
    homeScore: 2,
    name: "plaatst het eigen logo bij het uitteam na een tegendoelpunt thuis",
    previousAwayScore: 1,
    previousHomeScore: 1,
    scoringSide: "opponent" as const
  },
  {
    awayScore: 2,
    eventKind: "live" as const,
    expectedAwayLogo: false,
    expectedEventLabel: "TEGENDOELPUNT",
    expectedHomeLogo: true,
    expectedScoringTeamLogo: false,
    homeScore: 1,
    name: "plaatst het eigen logo bij het thuisteam na een tegendoelpunt uit",
    previousAwayScore: 1,
    previousHomeScore: 1,
    scoringSide: "opponent" as const
  },
  {
    awayScore: 2,
    eventKind: "live" as const,
    expectedAwayLogo: true,
    expectedEventLabel: "DOELPUNT",
    expectedHomeLogo: false,
    expectedScoringTeamLogo: true,
    homeScore: 1,
    name: "gebruikt het eigen logo ook als scorerlogo bij een eigen uitgoal",
    previousAwayScore: 1,
    previousHomeScore: 1,
    scoringSide: "own" as const
  },
  {
    awayScore: 1,
    eventKind: "live" as const,
    expectedAwayLogo: false,
    expectedEventLabel: "DOELPUNT",
    expectedHomeLogo: false,
    expectedScoringTeamLogo: false,
    homeScore: 2,
    name: "wijst het eigen logo niet toe bij een onbekende scorerende ploeg",
    previousAwayScore: 1,
    previousHomeScore: 1,
    scoringSide: "unknown" as const
  }
]) {
  test(`LG Legacy canvas ${scenario.name}`, async ({ page }) => {
    const logoAssetId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    let realtimeRequests = 0;
    await page.setViewportSize({ height: 720, width: 1280 });
    await mockLegacyApis(page);
    await page.route("**/api/player/realtime/ack", (route) => route.fulfill({
      body: JSON.stringify({ ok: true }),
      contentType: "application/json"
    }));
    await page.route("**/api/player/realtime", async (route) => {
      realtimeRequests += 1;
      if (realtimeRequests > 1) {
        await route.fulfill({ status: 401 });
        return;
      }
      const currentTime = Date.now();
      await route.fulfill({
        body: legacyGoalSse({
          assets: [{
            checksum: legacyImageChecksum,
            mediaAssetId: logoAssetId,
            mimeType: "image/png",
            url: playerURL + legacyImagePath
          }],
          awayScore: scenario.awayScore,
          deliveryId: "99999999-9999-4999-8999-999999999995",
          eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae",
          eventKind: scenario.eventKind,
          executeAt: new Date(currentTime + 250).toISOString(),
          expiresAt: new Date(currentTime + 4_000).toISOString(),
          homeScore: scenario.homeScore,
          logoMediaAssetId: logoAssetId,
          previousAwayScore: scenario.previousAwayScore,
          previousHomeScore: scenario.previousHomeScore,
          scene: legacyCanvasLogoParityScenePair(),
          scoringSide: scenario.scoringSide,
          serverTime: new Date(currentTime).toISOString()
        }),
        contentType: "text/event-stream; charset=utf-8",
        headers: { "Cache-Control": "no-cache, no-store, no-transform" }
      });
    });
    await page.addInitScript(
      ({ credential, token }) => {
        localStorage.setItem("veyocast.player.deviceToken", token);
        localStorage.setItem(
          "veyocast.player.installationCredential",
          credential
        );
        localStorage.setItem(
          "veyocast.player.instanceId",
          "12345678-1234-4123-8123-123456789abc"
        );
      },
      { credential: installationCredential, token: deviceToken }
    );

    await page.goto(playerURL + "/lg/legacy");

    const scene = page.locator("#goal-overlay .goal-canvas-scene");
    await expect(scene).toBeVisible();
    await expect(
      scene.locator('[data-goal-canvas-text-binding="eventLabel"]')
    ).toHaveText(scenario.expectedEventLabel);
    await expect(
      scene.locator('[data-goal-canvas-image-binding="homeLogo"] img')
    ).toHaveCount(scenario.expectedHomeLogo ? 1 : 0);
    await expect(
      scene.locator('[data-goal-canvas-image-binding="awayLogo"] img')
    ).toHaveCount(scenario.expectedAwayLogo ? 1 : 0);
    await expect(
      scene.locator('[data-goal-canvas-image-binding="scoringTeamLogo"] img')
    ).toHaveCount(scenario.expectedScoringTeamLogo ? 1 : 0);
  });
}

test("LG Legacy canvas behoudt auteurs-tekst wanneer scorerdata ontbreekt", async ({
  page
}) => {
  let realtimeRequests = 0;
  await page.setViewportSize({ height: 720, width: 1280 });
  await mockLegacyApis(page);
  await page.route("**/api/player/realtime/ack", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/realtime", async (route) => {
    realtimeRequests += 1;
    if (realtimeRequests > 1) {
      await route.fulfill({ status: 401 });
      return;
    }
    const currentTime = Date.now();
    await route.fulfill({
      body: legacyGoalSse({
        deliveryId: "99999999-9999-4999-8999-999999999996",
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad",
        executeAt: new Date(currentTime + 250).toISOString(),
        expiresAt: new Date(currentTime + 4_000).toISOString(),
        scene: legacyCanvasAuthoredTextScenePair(),
        scorerName: null,
        serverTime: new Date(currentTime).toISOString()
      }),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-store, no-transform" }
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(playerURL + "/lg/legacy");

  const scene = page.locator("#goal-overlay .goal-canvas-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toContainText("EIGEN CANVAS HEADLINE");
  await expect(scene).toContainText("Eigen canvas subtekst");
  await expect(scene).toContainText("Onbekende scorer uit canvas");
  await expect(scene).not.toContainText("LEGACY GOAL!");
  await expect(scene).not.toContainText("Kantinescherm");
  await expect(scene).not.toContainText("Doelpunt!");
});

test("LG Legacy pagineert een canvasopstelling zonder de scene te herbouwen", async ({
  page
}) => {
  let realtimeRequests = 0;
  await page.setViewportSize({ height: 720, width: 1280 });
  await mockLegacyApis(page);
  await page.route("**/api/player/realtime/ack", (route) => route.fulfill({
    body: JSON.stringify({ ok: true }),
    contentType: "application/json"
  }));
  await page.route("**/api/player/realtime", async (route) => {
    realtimeRequests += 1;
    if (realtimeRequests > 1) {
      await route.fulfill({ status: 401 });
      return;
    }
    const currentTime = Date.now();
    await route.fulfill({
      body: legacyCanvasLineupSse({
        deliveryId: "99999999-9999-4999-8999-999999999997",
        eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac",
        executeAt: new Date(currentTime + 250).toISOString(),
        expiresAt: new Date(currentTime + 12_000).toISOString(),
        serverTime: new Date(currentTime).toISOString()
      }),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-cache, no-store, no-transform" }
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(playerURL + "/lg/legacy");

  const overlay = page.locator("#goal-overlay");
  const scene = overlay.locator(".goal-canvas-scene");
  const cards = scene.locator("[data-canvas-lineup-index]");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute("data-orientation", "landscape");
  await expect(scene).toContainText("LANDSCAPE LINEUP");
  await expect(cards).toHaveCount(12);
  await expect(scene.locator("[data-canvas-lineup-index]:visible")).toHaveCount(11);
  await scene.evaluate((element) => element.setAttribute("data-scene-stable", "yes"));
  await expect(scene.locator("[data-canvas-lineup-page]")).toHaveText("1 / 2");

  await expect(scene.locator("[data-canvas-lineup-page]"))
    .toHaveText("2 / 2", { timeout: 5_000 });
  await expect(cards.first()).toBeHidden();
  await expect(cards.last()).toBeVisible();
  await expect(scene).toHaveAttribute("data-scene-stable", "yes");
  await expect(overlay).toBeVisible();
});

test("LG webOS wordt zonder Next.js-chunks naar zichtbare Editorial Arena HTML/CSS geleid", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36"
  });
  const page = await context.newPage();
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await mockEditorialArenaLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg`);

  await expect(page).toHaveURL(/\/lg\/legacy$/);
  await expect(page.locator(".dynamic-template.editorial-arena")).toBeVisible();
  await expect(page.locator(".editorial-news")).toBeVisible();
  await expect(page.getByText("Editorial Arena", { exact: true }))
    .toHaveCount(0);
  await expect(page.getByText("Actuele clubinformatie", { exact: true }))
    .toHaveCount(0);
  await expect(page.getByRole("heading", {
    name: "Oos Kesbeke: een fijnproever ben ik niet, ik vind het lekker of niet"
  })).toBeVisible();
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#watermark")).toHaveClass("visible");
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);
  const diagnostics = await page.evaluate(() =>
    localStorage.getItem("veyocast.player.lgLegacyDiagnostics.v1")
  );
  expect(diagnostics).toContain("LEGACY_TEMPLATE_READY");
  expect(diagnostics).not.toContain("LEGACY_CLIENT_EXCEPTION");
  if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
    await page.waitForTimeout(1_400);
    await page.screenshot({
      path: "docs/screenshots/s91-editorial-arena-lg-legacy.png"
    });
  }

  await context.close();
});

test("LG Legacy schaalt ieder logisch portraitcanvas binnen een landscapeviewport", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  await mockEditorialArenaLegacyApis(page, "portrait");
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  const slide = page.locator(".dynamic-template.editorial-arena");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-canvas-width", "1080");
  await expect(slide).toHaveAttribute("data-canvas-height", "1920");
  await expect(slide).toHaveAttribute("data-viewport-fit", "contain");
  const slideBox = await slide.boundingBox();
  expect(slideBox).not.toBeNull();
  expect(slideBox!.x).toBeCloseTo(656.25, 1);
  expect(slideBox!.y).toBeCloseTo(0, 1);
  expect(slideBox!.width).toBeCloseTo(607.5, 1);
  expect(slideBox!.height).toBeCloseTo(1080, 1);
  const photoBox = await slide.locator(".editorial-news-art").boundingBox();
  expect(photoBox).not.toBeNull();
  expect(photoBox!.width / photoBox!.height).toBeCloseTo(16 / 9, 2);
  const story = slide.locator(".editorial-news-copy");
  await expect(story).toHaveCSS("justify-content", "flex-start");
  const splitSpacing = await slide.locator(".editorial-news").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      columnGap: Number.parseFloat(style.columnGap),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
      rowGap: Number.parseFloat(style.rowGap)
    };
  });
  expect(splitSpacing).toEqual({
    columnGap: 32,
    paddingLeft: 20,
    paddingRight: 20,
    rowGap: 32
  });
  const headline = page.getByRole("heading", {
    name: "Oos Kesbeke: een fijnproever ben ik niet, ik vind het lekker of niet"
  });
  await expect(headline).toHaveClass("dense");
  const meta = slide.locator(".editorial-news-meta");
  const [storyBox, metaBox] = await Promise.all([
    story.boundingBox(),
    meta.boundingBox()
  ]);
  expect(storyBox).not.toBeNull();
  expect(metaBox).not.toBeNull();
  expect(storyBox!.y + storyBox!.height - (metaBox!.y + metaBox!.height))
    .toBeLessThan(45);

  await context.close();
});

test("LG Legacy ankert fullscreen nieuws-QR zonder zichtbare URL rechtsonder", async ({
  browser
}) => {
  for (const orientation of ["landscape", "portrait"] as const) {
    await test.step(orientation, async () => {
      const context = await browser.newContext({
        reducedMotion: "reduce",
        userAgent:
          "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
        viewport: orientation === "landscape"
          ? { height: 1080, width: 1920 }
          : { height: 1920, width: 1080 }
      });
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-09-07T11:51:00.000Z"));
      await mockEditorialArenaLegacyApis(page, orientation, "fullscreen_gradient");
      await page.addInitScript(
        ({ credential, token }) => {
          localStorage.setItem("veyocast.player.deviceToken", token);
          localStorage.setItem("veyocast.player.installationCredential", credential);
          localStorage.setItem(
            "veyocast.player.instanceId",
            "12345678-1234-4123-8123-123456789abc"
          );
        },
        { credential: installationCredential, token: deviceToken }
      );

      await page.goto(`${playerURL}/lg/legacy`);
      await expect.poll(() => page.evaluate(() =>
        localStorage.getItem("veyocast.player.lgLegacyDiagnostics.v1") ?? ""
      )).toContain("LEGACY_TEMPLATE_READY");

      const layout = page.locator(
        '.editorial-news[data-news-variant="fullscreen_gradient"]'
      );
      const qr = layout.locator(":scope > .editorial-news-qr");
      await expect(layout).toBeVisible();
      await expect(page.locator(".editorial-context strong"))
        .toHaveText("Clubnieuws");
      await expect(page.locator(".editorial-context time"))
        .toHaveText("07-09-2026 | 13:51");
      await expect(page.locator(".editorial-context"))
        .not.toContainText("VeyoCast");
      await expect(qr).toHaveCount(1);
      await expect(qr).toContainText("Scan voor het artikel");
      await expect(qr.locator("small")).toHaveCount(0);
      await expect(layout).not.toContainText("example.test/nieuws/legacy");
      const geometry = await layout.evaluate((element) => {
        const layoutBox = element.getBoundingClientRect();
        const qr = element.querySelector<HTMLElement>(
          ":scope > .editorial-news-qr"
        )!;
        const qrBox = qr.getBoundingClientRect();
        const qrImageBox = qr.querySelector("img")!.getBoundingClientRect();
        const sourceBox = element.querySelector<HTMLElement>(
          ":scope > .editorial-news-art > .editorial-news-source"
        )!.getBoundingClientRect();
        return {
          bottom: layoutBox.bottom - qrBox.bottom,
          imageRight: layoutBox.right - qrImageBox.right,
          right: layoutBox.right - qrBox.right,
          sourceRight: layoutBox.right - sourceBox.right
        };
      });
      expect(geometry.bottom).toBeCloseTo(orientation === "landscape" ? 30 : 46, 0);
      expect(geometry.right).toBeCloseTo(orientation === "landscape" ? 92 : 106, 0);
      if (orientation === "landscape") {
        expect(geometry.imageRight).toBeCloseTo(92, 0);
        expect(geometry.sourceRight).toBeCloseTo(92, 0);
      }
      await context.close();
    });
  }
});

test("Static LG bewaakt de zestien FieldFlow-goldens voor de nieuwe sportfamilies", async ({
  browser
}) => {
  test.setTimeout(180_000);
  for (const [slideType, family] of Object.entries(fieldFlowSportFamilies) as Array<
    [FieldFlowSportSlideType, string]
  >) {
    for (const orientation of ["landscape", "portrait"] as const) {
      for (const mode of ["light", "dark"] as const) {
        await test.step(`${family} · ${orientation} · ${mode}`, async () => {
          const context = await browser.newContext({
            reducedMotion: "reduce",
            userAgent:
              "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
            viewport: orientation === "landscape"
              ? { height: 1080, width: 1920 }
              : { height: 1920, width: 1080 }
          });
          const page = await context.newPage();
          const pageErrors: string[] = [];
          page.on("pageerror", (error) => pageErrors.push(error.message));
          await mockFieldFlowSportLegacyApis(page, slideType, orientation, mode);
          await page.addInitScript(
            ({ credential, token }) => {
              localStorage.setItem("veyocast.player.deviceToken", token);
              localStorage.setItem("veyocast.player.installationCredential", credential);
              localStorage.setItem(
                "veyocast.player.instanceId",
                "12345678-1234-4123-8123-123456789abc"
              );
            },
            { credential: installationCredential, token: deviceToken }
          );

          await page.goto(`${playerURL}/lg/legacy`);
          const slide = page.locator(".dynamic-template.editorial-arena");
          await expect(slide).toBeVisible();
          await expect(slide).toHaveAttribute("data-theme-id", "fieldflow");
          await expect(slide).toHaveAttribute("data-slide-type", slideType);
          await expect(slide.locator(`[data-render-family="${family}"]`)).toBeVisible();
          const geometry = await slide.evaluate((element) => ({
            allImagesComplete: Array.from(element.querySelectorAll("img"))
              .every((image) => image.complete),
            clientHeight: element.clientHeight,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            scrollWidth: element.scrollWidth
          }));
          expect(geometry.scrollWidth).toBe(geometry.clientWidth);
          expect(geometry.scrollHeight).toBe(geometry.clientHeight);
          expect(geometry.allImagesComplete).toBe(true);
          expect(pageErrors).toEqual([]);
          await expect(page).toHaveScreenshot(
            `fieldflow-lg-${family}-${orientation}-${mode}.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
          await context.close();
        });
      }
    }
  }
});

test("Static LG houdt clubprogramma-item 100 via paginering bereikbaar", async ({
  browser
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-09-06T13:33:00.000Z") });
  await mockFieldFlowSportLegacyApis(
    page,
    "sport_program",
    "landscape",
    "dark",
    101
  );
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.editorial-arena");
  const pageNumber = slide.locator(".matchcentre-page-number");
  await expect(slide.locator(".legacy-fixture-row")).toHaveCount(6);
  await expect(pageNumber).toHaveText("01 / 17");
  await expect(slide.locator("footer")).not.toContainText("Match centre");

  await page.clock.runFor(80_100);

  await expect(pageNumber).toHaveText("17 / 17");
  await expect(slide.locator(".legacy-fixture-row")).toHaveCount(4);
  await expect(slide).toContainText("Thuis 100");
  await expect(slide).toContainText("Uit 100");
  await expect(slide).not.toContainText("Thuis 101");
  await context.close();
});

test("Static LG houdt wedstrijdregels op twee vaste regels en forceert portrait naar één kolom", async ({
  browser
}) => {
  for (const orientation of ["landscape", "portrait"] as const) {
    await test.step(orientation, async () => {
      const context = await browser.newContext({
        reducedMotion: "reduce",
        userAgent:
          "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
        viewport: orientation === "landscape"
          ? { height: 1080, width: 1920 }
          : { height: 1920, width: 1080 }
      });
      const page = await context.newPage();
      await mockFieldFlowSportLegacyApis(
        page,
        "sport_program",
        orientation,
        "dark",
        7,
        "two"
      );
      await page.addInitScript(
        ({ credential, token }) => {
          localStorage.setItem("veyocast.player.deviceToken", token);
          localStorage.setItem("veyocast.player.installationCredential", credential);
          localStorage.setItem(
            "veyocast.player.instanceId",
            "12345678-1234-4123-8123-123456789abc"
          );
        },
        { credential: installationCredential, token: deviceToken }
      );

      await page.goto(`${playerURL}/lg/legacy`);
      const list = page.locator(".legacy-fixture-list");
      const firstRow = list.locator(".legacy-fixture-row").first();
      await expect(list).toHaveAttribute(
        "data-columns",
        orientation === "landscape" ? "two" : "one"
      );
      await expect(list.locator(".legacy-fixture-row")).toHaveCount(7);
      const primary = firstRow.locator(":scope > .legacy-program-primary");
      const secondary = firstRow.locator(":scope > .legacy-program-secondary");
      await expect(primary).toHaveCount(1);
      await expect(secondary).toHaveCount(1);
      await expect(primary.locator(".legacy-match-date")).toHaveText("12-09-2026");
      await expect(primary.locator(".legacy-match-time")).toHaveText("08:30");
      await expect(primary.locator(".legacy-match-home-team")).toHaveText("Thuis 1");
      await expect(primary.locator(".legacy-match-separator")).toHaveText("vs.");
      await expect(primary.locator(".legacy-match-away-team")).toHaveText("Uit 1");
      await expect(primary.locator(".legacy-match-logo")).toHaveCount(2);
      await expect(secondary.locator(".legacy-match-field")).toHaveText("Veld: 1");
      await expect(secondary.locator(".legacy-match-sportpark"))
        .toHaveText("Sportpark: FieldFlow");

      const geometry = await list.evaluate((element) => {
        const rows = Array.from(element.querySelectorAll<HTMLElement>(
          ".legacy-fixture-row"
        ));
        const firstPrimary = rows[0]?.querySelector<HTMLElement>(
          ":scope > .legacy-program-primary"
        );
        const firstSecondary = rows[0]?.querySelector<HTMLElement>(
          ":scope > .legacy-program-secondary"
        );
        const primaryBox = firstPrimary?.getBoundingClientRect();
        const secondaryBox = firstSecondary?.getBoundingClientRect();
        const primarySize = firstPrimary
          ? Number.parseFloat(getComputedStyle(firstPrimary).fontSize)
          : 0;
        const secondaryStyle = firstSecondary
          ? getComputedStyle(firstSecondary)
          : null;
        return {
          fifthTop: rows[4]?.getBoundingClientRect().top ?? 0,
          gridAutoRows: getComputedStyle(element).gridAutoRows,
          heights: rows.map((row) => row.getBoundingClientRect().height),
          primaryAboveSecondary: Boolean(
            primaryBox && secondaryBox && primaryBox.bottom <= secondaryBox.top + 1
          ),
          secondaryFontRatio: secondaryStyle && primarySize
            ? Number.parseFloat(secondaryStyle.fontSize) / primarySize
            : 0,
          secondaryJustification: secondaryStyle?.justifyContent,
          secondaryTextAlign: secondaryStyle?.textAlign,
          secondTop: rows[1]?.getBoundingClientRect().top ?? 0,
          firstTop: rows[0]?.getBoundingClientRect().top ?? 0
        };
      });
      const expectedHeight = orientation === "landscape" ? 115 : 221;
      expect(geometry.gridAutoRows).toBe(`${expectedHeight}px`);
      expect(geometry.heights.every((height) => Math.abs(height - expectedHeight) < 0.1))
        .toBe(true);
      expect(geometry.primaryAboveSecondary).toBe(true);
      expect(geometry.secondaryFontRatio).toBeCloseTo(.52, 2);
      expect(geometry.secondaryJustification).toBe("flex-end");
      expect(geometry.secondaryTextAlign).toBe("right");
      if (orientation === "landscape") {
        expect(geometry.secondTop - geometry.firstTop).toBeGreaterThan(expectedHeight);
        expect(Math.abs(geometry.fifthTop - geometry.firstTop)).toBeLessThan(0.1);
      } else {
        expect(geometry.secondTop - geometry.firstTop).toBeGreaterThan(expectedHeight);
      }
      await context.close();
    });
  }
});

test("Static LG projecteert frozen Royal Current v8-wedstrijden met moderne rijmaten en paginering", async ({
  browser
}) => {
  const cases = [
    {
      expectedColumns: "two",
      expectedFirstPageRows: 12,
      expectedHeight: 96,
      itemCount: 13,
      orientation: "landscape",
      showTime: true,
      slideType: "sport_program"
    },
    {
      expectedColumns: "one",
      expectedFirstPageRows: 7,
      expectedHeight: 148,
      itemCount: 8,
      orientation: "portrait",
      showTime: true,
      slideType: "sport_program"
    },
    {
      expectedColumns: "two",
      expectedFirstPageRows: 12,
      expectedHeight: 96,
      itemCount: 13,
      orientation: "landscape",
      showTime: true,
      slideType: "sport_results"
    },
    {
      expectedColumns: "one",
      expectedFirstPageRows: 5,
      expectedHeight: 148,
      itemCount: 6,
      orientation: "portrait",
      showTime: false,
      slideType: "sport_results"
    }
  ] as const;

  for (const entry of cases) {
    await test.step(`${entry.slideType} ${entry.orientation}`, async () => {
      const context = await browser.newContext({
        reducedMotion: "reduce",
        userAgent:
          "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
        viewport: entry.orientation === "landscape"
          ? { height: 1080, width: 1920 }
          : { height: 1920, width: 1080 }
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.clock.install({ time: new Date("2026-09-09T12:30:00.000Z") });
      await mockFieldFlowSportLegacyApis(
        page,
        entry.slideType,
        entry.orientation,
        "light",
        entry.itemCount,
        "two",
        {
          allOptionalMatchFields: true,
          frozenRoyalCurrentV2: true,
          mixedCancellation: true,
          showTime: entry.showTime
        }
      );
      await page.addInitScript(
        ({ credential, token }) => {
          localStorage.setItem("veyocast.player.deviceToken", token);
          localStorage.setItem("veyocast.player.installationCredential", credential);
          localStorage.setItem(
            "veyocast.player.instanceId",
            "12345678-1234-4123-8123-123456789abc"
          );
        },
        { credential: installationCredential, token: deviceToken }
      );

      await page.goto(`${playerURL}/lg/legacy`);
      const slide = page.locator(".dynamic-template.editorial-arena");
      const rowSelector = entry.slideType === "sport_program"
        ? ".legacy-fixture-row"
        : ".legacy-result-row";
      const primarySelector = entry.slideType === "sport_program"
        ? ".legacy-program-primary"
        : ".legacy-result-primary";
      const list = slide.locator(
        entry.slideType === "sport_program"
          ? ".legacy-fixture-list"
          : ".legacy-result-list"
      );
      const rows = list.locator(rowSelector);

      await expect(slide).toBeVisible();
      await expect(slide).toHaveAttribute("data-design-revision", "royal-current-v8");
      await expect(slide).toHaveAttribute("data-royal-mode", "royal");
      await expect(slide).toHaveAttribute("data-motion-state", "off");
      const typography = await slide.evaluate((element) => {
        const heading = element.querySelector<HTMLElement>(".editorial-heading h1");
        return {
          bodyComputed: getComputedStyle(element).fontFamily,
          bodyVariable: (element as HTMLElement).style.getPropertyValue(
            "--vc-theme-body-font"
          ),
          compactResultSize: (element as HTMLElement).style.getPropertyValue(
            "--vc-theme-sport-result-size-compact"
          ),
          compactScoreSize: (element as HTMLElement).style.getPropertyValue(
            "--vc-theme-sport-score-size-compact"
          ),
          displayComputed: heading ? getComputedStyle(heading).fontFamily : "",
          displayVariable: (element as HTMLElement).style.getPropertyValue(
            "--vc-theme-display-font"
          )
        };
      });
      expect(typography.bodyVariable).toBe('"Source Serif 4"');
      expect(typography.bodyComputed).toContain("Source Serif 4");
      expect(typography.displayVariable).toBe('"Anton"');
      expect(typography.displayComputed).toContain("Anton");
      expect(typography.compactResultSize).toBe("24px");
      expect(typography.compactScoreSize).toBe("42px");
      await expect(list).toHaveAttribute("data-columns", entry.expectedColumns);
      await expect(rows).toHaveCount(entry.expectedFirstPageRows);
      await expect(slide.locator(".dynamic-page-number")).toHaveText("01 / 02");
      if (entry.showTime) {
        await expect(rows.nth(0).locator(".legacy-match-time")).toHaveText("08:30");
      } else {
        await expect(rows.nth(0).locator(".legacy-match-time-empty"))
          .toHaveAttribute("aria-hidden", "true");
        await expect(rows.nth(0).locator(".legacy-match-time"))
          .toHaveText("");
      }
      await expect(rows.nth(1).locator(".legacy-match-time"))
        .toHaveText("Afgelast");
      await expect(rows.nth(1).locator(".legacy-match-time"))
        .toHaveClass(/legacy-cancelled-kickoff/u);

      const primary = rows.first().locator(`:scope > ${primarySelector}`);
      const primaryOrder = await primary.evaluate((element) =>
        Array.from(element.children).map((child) => (child as HTMLElement).className)
      );
      if (entry.slideType === "sport_program") {
        expect(primaryOrder).toEqual([
          "legacy-match-date",
          entry.showTime
            ? "legacy-match-time"
            : "legacy-match-time legacy-match-time-empty",
          "legacy-match-logo legacy-match-home-logo",
          "legacy-match-team legacy-match-home-team",
          "legacy-match-room legacy-match-home-room",
          "legacy-match-separator",
          "legacy-match-logo legacy-match-away-logo",
          "legacy-match-team legacy-match-away-team",
          "legacy-match-room legacy-match-away-room"
        ]);
        await expect(primary.locator(".legacy-match-home-room"))
          .toHaveText("Kleedkamer Thuis 1");
        await expect(primary.locator(".legacy-match-away-room"))
          .toHaveText("Kleedkamer Uit 1");
        const secondary = rows.first().locator(":scope > .legacy-program-secondary");
        await expect(secondary.locator(":scope > *")).toHaveCount(3);
        await expect(secondary.locator(".legacy-match-referee"))
          .toHaveText("Scheidsrechter: Scheidsrechter 1");
        await expect(secondary.locator(".legacy-match-field")).toHaveText("Veld: 1");
        await expect(secondary.locator(".legacy-match-sportpark"))
          .toHaveText("Sportpark: FieldFlow");
        expect(await secondary.evaluate((element) =>
          Array.from(element.children).map((child) => (child as HTMLElement).className)
        )).toEqual([
          "legacy-match-referee",
          "legacy-match-field",
          "legacy-match-sportpark"
        ]);
      } else {
        expect(primaryOrder).toEqual([
          "legacy-match-date",
          entry.showTime
            ? "legacy-match-time"
            : "legacy-match-time legacy-match-time-empty",
          "legacy-match-logo legacy-match-home-logo",
          "legacy-match-team legacy-match-home-team",
          "legacy-result-score",
          "legacy-match-logo legacy-match-away-logo",
          "legacy-match-team legacy-match-away-team"
        ]);
      }

      const geometry = await list.evaluate((element, selector) => {
        const rowElements = Array.from(element.querySelectorAll<HTMLElement>(selector));
        const rowBoxes = rowElements.map((row) => row.getBoundingClientRect());
        const normalHome = rowElements[0]?.querySelector<HTMLElement>(
          ".legacy-match-home-team"
        )?.getBoundingClientRect();
        const cancelledHome = rowElements[1]?.querySelector<HTMLElement>(
          ".legacy-match-home-team"
        )?.getBoundingClientRect();
        return {
          cancelledHomeLeft: cancelledHome?.left ?? -1,
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          gridAutoRows: getComputedStyle(element).gridAutoRows,
          heights: rowBoxes.map((box) => box.height),
          normalHomeLeft: normalHome?.left ?? -2,
          scrollHeight: element.scrollHeight,
          scrollWidth: element.scrollWidth,
          firstTop: rowBoxes[0]?.top ?? 0,
          secondTop: rowBoxes[1]?.top ?? 0,
          splitLeft: rowBoxes[Math.ceil(rowBoxes.length / 2)]?.left ?? 0,
          splitTop: rowBoxes[Math.ceil(rowBoxes.length / 2)]?.top ?? 0
        };
      }, rowSelector);
      expect(geometry.gridAutoRows).toBe(`${entry.expectedHeight}px`);
      expect(geometry.heights.every((height) =>
        Math.abs(height - entry.expectedHeight) < .1
      )).toBe(true);
      expect(geometry.cancelledHomeLeft).toBeCloseTo(geometry.normalHomeLeft, 1);
      expect(geometry.scrollWidth).toBe(geometry.clientWidth);
      expect(geometry.scrollHeight).toBe(geometry.clientHeight);
      expect(geometry.secondTop - geometry.firstTop).toBeGreaterThan(entry.expectedHeight);
      if (entry.expectedColumns === "two") {
        expect(geometry.splitTop).toBeCloseTo(geometry.firstTop, 1);
        expect(geometry.splitLeft).toBeGreaterThan(geometry.normalHomeLeft);
      }
      expect(pageErrors).toEqual([]);

      await page.clock.runFor(5_100);
      await expect(slide.locator(".dynamic-page-number")).toHaveText("02 / 02");
      await expect(list.locator(rowSelector)).toHaveCount(1);
      await expect(list.locator(".legacy-match-home-team"))
        .toHaveText(`Thuis ${entry.itemCount}`);
      await context.close();
    });
  }
});

test("Static LG respecteert de frozen v2-fontrefs ook in Royal Current LED", async ({
  browser
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date("2026-09-09T12:30:00.000Z") });
  await mockRoyalCurrentLedLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.ledscores-live-match");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-design-revision", "royal-current-v8");
  await expect(slide).toContainText("FieldFlow O23-1");
  await expect(slide).toContainText("Bezoekers O23-1");
  const typography = await slide.evaluate((element) => {
    const heading = element.querySelector<HTMLElement>(".live-match-top h1");
    return {
      bodyComputed: getComputedStyle(element).fontFamily,
      bodyVariable: (element as HTMLElement).style.getPropertyValue(
        "--vc-theme-body-font"
      ),
      displayComputed: heading ? getComputedStyle(heading).fontFamily : "",
      displayVariable: (element as HTMLElement).style.getPropertyValue(
        "--vc-theme-display-font"
      )
    };
  });
  expect(typography.bodyVariable).toBe('"Source Serif 4"');
  expect(typography.bodyComputed).toContain("Source Serif 4");
  expect(typography.displayVariable).toBe('"Anton"');
  expect(typography.displayComputed).toContain("Anton");
  expect(pageErrors).toEqual([]);
  await context.close();
});

test("Static LG ordent uitslagen in twee landscape-kolommen gelijk aan de moderne Player", async ({
  browser
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  await mockFieldFlowSportLegacyApis(
    page,
    "sport_results",
    "landscape",
    "dark",
    12,
    "two"
  );
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const list = page.locator(".legacy-result-list");
  const rows = list.locator(".legacy-result-row");
  await expect(list).toHaveAttribute("data-columns", "two");
  await expect(rows).toHaveCount(12);
  await expect(rows.nth(0).locator(".legacy-match-home-team")).toHaveText("Thuis 1");
  await expect(rows.nth(6).locator(".legacy-match-home-team")).toHaveText("Thuis 7");

  const geometry = await list.evaluate((element) => {
    const rows = Array.from(element.querySelectorAll<HTMLElement>(
      ".legacy-result-row"
    ));
    const boxes = rows.map((row) => row.getBoundingClientRect());
    const scores = rows.map((row) => row.querySelector<HTMLElement>(
      ".legacy-result-score"
    )!.getBoundingClientRect());
    const homeTeams = rows.map((row) => row.querySelector<HTMLElement>(
      ".legacy-match-home-team"
    )!.getBoundingClientRect());
    const awayTeams = rows.map((row) => row.querySelector<HTMLElement>(
      ".legacy-match-away-team"
    )!.getBoundingClientRect());
    return {
      firstLeft: boxes[0]!.left,
      firstTop: boxes[0]!.top,
      rowHeight: boxes[0]!.height,
      secondTop: boxes[1]!.top,
      seventhLeft: boxes[6]!.left,
      seventhTop: boxes[6]!.top,
      scoresBetweenTeams: scores.map((score, index) =>
        score.left >= homeTeams[index]!.right - 1 &&
        score.right <= awayTeams[index]!.left + 1
      ),
      scrollWidth: element.scrollWidth,
      width: element.clientWidth
    };
  });
  expect(geometry.rowHeight).toBeCloseTo(115, 1);
  expect(geometry.secondTop - geometry.firstTop).toBeGreaterThan(115);
  expect(geometry.seventhTop).toBeCloseTo(geometry.firstTop, 1);
  expect(geometry.seventhLeft).toBeGreaterThan(geometry.firstLeft);
  expect(geometry.scoresBetweenTeams.every(Boolean)).toBe(true);
  expect(geometry.scrollWidth).toBe(geometry.width);
  await context.close();
});

test("Static LG houdt één uitslag compact op één regel met de score tussen de teams", async ({
  browser
}) => {
  for (const orientation of ["landscape", "portrait"] as const) {
    await test.step(orientation, async () => {
      const context = await browser.newContext({
        reducedMotion: "reduce",
        userAgent:
          "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
        viewport: orientation === "landscape"
          ? { height: 1080, width: 1920 }
          : { height: 1920, width: 1080 }
      });
      const page = await context.newPage();
      await mockFieldFlowSportLegacyApis(
        page,
        "sport_results",
        orientation,
        "dark",
        1
      );
      await page.addInitScript(
        ({ credential, token }) => {
          localStorage.setItem("veyocast.player.deviceToken", token);
          localStorage.setItem("veyocast.player.installationCredential", credential);
          localStorage.setItem(
            "veyocast.player.instanceId",
            "12345678-1234-4123-8123-123456789abc"
          );
        },
        { credential: installationCredential, token: deviceToken }
      );

      await page.goto(`${playerURL}/lg/legacy`);
      const list = page.locator(".legacy-result-list");
      const row = list.locator(".legacy-result-row");
      const primary = row.locator(":scope > .legacy-result-primary");
      const score = primary.locator(".legacy-result-score");

      await expect(list).toHaveAttribute("data-columns", "one");
      await expect(row).toHaveCount(1);
      await expect(primary).toHaveCount(1);
      await expect(primary.locator(".legacy-match-date")).toHaveText("12-09-2026");
      await expect(primary.locator(".legacy-match-time")).toHaveText("08:30");
      await expect(primary.locator(".legacy-match-home-team")).toHaveText("Thuis 1");
      await expect(primary.locator(".legacy-match-away-team")).toHaveText("Uit 1");
      await expect(primary.locator(".legacy-match-logo")).toHaveCount(2);
      await expect(score).toHaveText(/2\s*–\s*1/u);
      await expect(score).toHaveAttribute("aria-label", "Uitslag 2 tegen 1");

      const geometry = await list.evaluate((element) => {
        const rowElement = element.querySelector<HTMLElement>(".legacy-result-row")!;
        const primaryElement = rowElement.querySelector<HTMLElement>(
          ":scope > .legacy-result-primary"
        )!;
        const homeElement = primaryElement.querySelector<HTMLElement>(
          ".legacy-match-home-team"
        )!;
        const awayElement = primaryElement.querySelector<HTMLElement>(
          ".legacy-match-away-team"
        )!;
        const scoreElement = primaryElement.querySelector<HTMLElement>(
          ".legacy-result-score"
        )!;
        const listBox = element.getBoundingClientRect();
        const rowBox = rowElement.getBoundingClientRect();
        const primaryBox = primaryElement.getBoundingClientRect();
        const homeBox = homeElement.getBoundingClientRect();
        const awayBox = awayElement.getBoundingClientRect();
        const scoreBox = scoreElement.getBoundingClientRect();
        return {
          gridAutoRows: getComputedStyle(element).gridAutoRows,
          listHeight: listBox.height,
          primaryCenter: primaryBox.top + primaryBox.height / 2,
          rowCenter: rowBox.top + rowBox.height / 2,
          rowHeight: rowBox.height,
          scoreBetweenTeams:
            scoreBox.left >= homeBox.right - 1 &&
            scoreBox.right <= awayBox.left + 1
        };
      });
      const expectedHeight = orientation === "landscape" ? 115 : 314;
      expect(geometry.gridAutoRows).toBe(`${expectedHeight}px`);
      expect(geometry.rowHeight).toBeCloseTo(expectedHeight, 1);
      expect(geometry.rowHeight).toBeLessThan(geometry.listHeight / 2);
      expect(geometry.primaryCenter).toBeCloseTo(geometry.rowCenter, 1);
      expect(geometry.scoreBetweenTeams).toBe(true);
      await context.close();
    });
  }
});

test("LG Legacy toont de stand als één Editorial Arena-canvas met begrensde logo's", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockEditorialStandingLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  const slide = page.locator(".dynamic-template.editorial-arena");
  await expect(slide).toBeVisible();
  await expect(slide).toHaveAttribute("data-viewport-fit", "cover");
  await expect(slide.getByRole("heading", { name: "Stand", exact: true }))
    .toHaveCount(1);
  await expect(slide.locator(".legacy-standing-card")).toHaveCount(1);
  await expect(slide.locator(".legacy-standing-header")).toHaveCount(0);
  await expect(slide.locator(".legacy-standing-row")).toHaveCount(4);
  expect(await slide.locator(".legacy-standing-columns").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize)
  )).toBe(27);
  expect(await slide.locator(".legacy-standing-row").first().evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize)
  )).toBe(39);
  expect(await slide.locator(".legacy-standing-context").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize)
  )).toBe(19.5);

  const crestBox = await slide.locator(".editorial-crest img").boundingBox();
  expect(crestBox).not.toBeNull();
  expect(crestBox!.width).toBeLessThan(130);
  expect(crestBox!.height).toBeLessThan(130);
  const rowLogoBoxes = await slide.locator(".legacy-standing-team img")
    .evaluateAll((images) => images.map((image) => {
      const rect = image.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    }));
  expect(rowLogoBoxes).toHaveLength(4);
  expect(rowLogoBoxes.every(({ height, width }) => height <= 55 && width <= 55))
    .toBe(true);
  await expect(slide.getByText("Mannen KNVB beker amateurs", { exact: false }))
    .toHaveCount(1);

  if (process.env.CAPTURE_LG_STANDING === "1") {
    await page.screenshot({
      path: "docs/screenshots/s102-lg-standing-single-canvas.png"
    });
  }
  await context.close();
});

test("LG Legacy heet alleen bezoekers van thuiswedstrijden welkom en toont hun logo", async ({
  browser
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1080, width: 1920 }
  });
  const page = await context.newPage();
  await mockVisitorArrivalsLegacyApis(page);
  await page.clock.setFixedTime(new Date("2026-09-07T11:51:00.000Z"));
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("veyocast.player.lgLegacyDiagnostics.v1") ?? ""
  )).toContain("LEGACY_TEMPLATE_READY");
  const slide = page.locator(".dynamic-template.editorial-arena");
  await expect(slide).toBeVisible();
  await expect(slide.getByRole("heading", { level: 1 }))
    .toHaveText("Welkom bezoekende teams");
  await expect(slide.locator(".legacy-arrival-grid"))
    .toHaveAttribute("data-arrival-kind", "visitor");
  await expect(slide.locator(".legacy-arrival-grid")).toHaveAttribute("data-cards", "1");
  await expect(slide.locator(".legacy-arrival-card")).toHaveCount(1);
  await expect(slide.locator(".editorial-context strong"))
    .toHaveText("Welkom op Sportpark Houtrust!");
  await expect(slide.locator(".editorial-context time"))
    .toHaveText("07-09-2026 | 13:51");
  await expect(slide.locator(".editorial-context")).not.toContainText("VeyoCast");
  await expect(slide.getByText("07-09-2026", { exact: true })).toBeVisible();
  await expect(slide.getByText("Aanvang: 14:30", { exact: true })).toBeVisible();
  await expect(slide.getByText("Duindorp sv JO15-1", { exact: true })).toBeVisible();
  await expect(slide.getByText("Bezoekers FC", { exact: true })).toBeVisible();
  await expect(slide.getByText("Kleedkamers:", { exact: true })).toBeVisible();
  await expect(slide.getByText(/Thuis:\s*1\s*\|\s*Uit:\s*2/u)).toBeVisible();
  await expect(slide.getByText("Veld:", { exact: true })).toBeVisible();
  await expect(slide.locator(".legacy-visitor-details dd").filter({ hasText: /^1$/u }))
    .toBeVisible();
  await expect(slide.getByText("Scheidsrechter:", { exact: true })).toBeVisible();
  await expect(slide.getByText("Sam Scheidsrechter", { exact: true })).toBeVisible();
  await expect(slide.getByText(/Aankomst/)).toHaveCount(0);
  await expect(slide.getByText("Duindorp sv 1", { exact: true })).toHaveCount(0);
  await expect(slide.locator(
    ".legacy-arrival-card > i, .legacy-arrival-card > b, .legacy-arrival-card > strong"
  )).toHaveCount(0);
  await expect(slide.locator(".legacy-arrival-logo-mark img")).toHaveCount(1);
  await expect(slide.locator(".legacy-arrival-logo-backdrop")).toHaveCSS("opacity", "0.3");
  await expect(slide.locator(".legacy-arrival-logo-backdrop"))
    .toHaveCSS("object-fit", "cover");
  await expect(slide.locator(".legacy-arrival-logo-mark"))
    .toHaveCSS("background-color", "rgb(255, 255, 255)");
  const welcomeGeometry = await slide.locator(".legacy-arrival-grid").evaluate((grid) => {
    const card = grid.querySelector<HTMLElement>(".legacy-arrival-card")!;
    const details = Array.from(card.querySelectorAll<HTMLElement>(
      ".legacy-visitor-details dt, .legacy-visitor-details dd"
    ));
    const detailsList = card.querySelector<HTMLElement>(".legacy-visitor-details")!;
    const schedule = Array.from(card.querySelectorAll<HTMLElement>(
      ".legacy-visitor-schedule > time, .legacy-visitor-schedule > span"
    ));
    const teamNames = Array.from(card.querySelectorAll<HTMLElement>(
      ".legacy-visitor-teams h2 > span"
    ));
    return {
      cardWidth: card.getBoundingClientRect().width,
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
      detailsBottom: card.getBoundingClientRect().bottom - detailsList.getBoundingClientRect().bottom,
      detailsTag: detailsList.tagName,
      detailSizes: details.map((detail) => parseFloat(getComputedStyle(detail).fontSize)),
      gridWidth: grid.getBoundingClientRect().width,
      logoWidth: card.querySelector<HTMLElement>(".legacy-arrival-logo-mark")!
        .getBoundingClientRect().width,
      scheduleSizes: schedule.map((line) => parseFloat(getComputedStyle(line).fontSize)),
      teamSizes: teamNames.map((team) => parseFloat(getComputedStyle(team).fontSize))
    };
  });
  expect(welcomeGeometry.columns).toBe(2);
  expect(welcomeGeometry.cardWidth).toBeGreaterThan(welcomeGeometry.gridWidth * 0.45);
  expect(welcomeGeometry.cardWidth).toBeLessThan(welcomeGeometry.gridWidth * 0.52);
  expect(welcomeGeometry.logoWidth / welcomeGeometry.cardWidth).toBeCloseTo(0.32, 2);
  expect(welcomeGeometry.detailsBottom).toBeLessThan(72);
  expect(welcomeGeometry.detailsTag).toBe("DL");
  expect(welcomeGeometry.scheduleSizes).toEqual([46, 46]);
  expect(welcomeGeometry.teamSizes).toEqual([46, 46]);
  expect(welcomeGeometry.detailSizes).toEqual([23, 23, 23, 23, 23, 23]);
  await context.close();
});

test("LG Legacy toont de prijslijst één-op-één in het portraitcanvas", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockEditorialPriceListLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.editorial-arena");
  await expect(slide).toBeVisible();
  await expect(slide.getByRole("heading", { name: "Prijslijst", exact: true }))
    .toHaveCount(1);
  await expect(slide.locator(".legacy-price-grid")).toHaveCount(1);
  await expect(slide.locator(".legacy-price-column")).toHaveCount(2);
  await expect(slide.locator(".legacy-price-product")).toHaveCount(16);
  await expect(slide.locator(".legacy-price-media")).toHaveCount(16);
  expect(await slide.locator(".legacy-price-copy strong").first().evaluate(
    (element) => getComputedStyle(element).fontSize
  )).toBe("28px");
  const slideBox = await slide.boundingBox();
  expect(slideBox).toEqual(expect.objectContaining({ height: 1920, width: 1080 }));
  if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
    await page.screenshot({
      path: "docs/screenshots/s103-editorial-arena-price-list-lg-legacy.png"
    });
  }
  await context.close();
});

test("LG Legacy toont Menu Studio v2 portrait als één brede bovenuitgelijnde kolom", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockMenuStudioPortraitLegacyApis(page);
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.menu-studio-v2.portrait");
  await expect(slide).toBeVisible();
  await expect(slide.locator(".editorial-heading p")).toHaveText("Menu");
  await expect(slide.getByRole("heading", { name: "Nieuw menu", exact: true }))
    .toHaveCount(1);
  await expect(slide.locator(".legacy-price-column")).toHaveCount(1);
  await expect(slide.locator(".legacy-price-category"))
    .toHaveText("Hardloper, frisdrank");
  await expect(slide.locator(".legacy-price-copy strong").first()).toHaveText("AA Drink");
  await expect(slide.locator(".legacy-price-product > b").first()).toHaveText("€ 2,50");
  await expect(slide.locator("footer > span").first()).toHaveText("Prijslijst");
  await expect(slide.locator(".dynamic-page-number")).toHaveText("1 / 1");

  const geometry = await slide.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>(".legacy-price-grid")!;
    const column = element.querySelector<HTMLElement>(".legacy-price-column")!;
    const category = element.querySelector<HTMLElement>(".legacy-price-category")!;
    const footer = element.querySelector<HTMLElement>("footer")!;
    const header = element.querySelector<HTMLElement>("header")!;
    const product = element.querySelector<HTMLElement>(".legacy-price-product")!;
    const title = element.querySelector<HTMLElement>(".editorial-heading h1")!;
    const productName = element.querySelector<HTMLElement>(".legacy-price-copy strong")!;
    return {
      categoryBottom: category.getBoundingClientRect().bottom,
      categoryFontSize: getComputedStyle(category).fontSize,
      column: column.getBoundingClientRect().toJSON(),
      gridColumns: getComputedStyle(grid).gridTemplateColumns,
      footerFontSize: getComputedStyle(footer).fontSize,
      headerBorderColor: getComputedStyle(header).borderBottomColor,
      productFontSize: getComputedStyle(productName).fontSize,
      productTop: product.getBoundingClientRect().top,
      titleFontSize: getComputedStyle(title).fontSize
    };
  });
  expect(geometry.gridColumns).toBe("936px");
  expect(geometry.column).toEqual(expect.objectContaining({ height: 1388, width: 936, x: 72 }));
  expect(geometry.productTop).toBe(geometry.categoryBottom + 10);
  expect(geometry.categoryFontSize).toBe("34px");
  expect(geometry.footerFontSize).toBe("20px");
  expect(geometry.headerBorderColor).toBe("rgb(48, 188, 237)");
  expect(geometry.productFontSize).toBe("32px");
  expect(geometry.titleFontSize).toBe("72px");

  const productNames = slide.locator(".legacy-price-copy strong");
  await expect(productNames.nth(1)).toHaveClass(/legacy-price-title-compact/);
  await expect(productNames.nth(2)).toHaveClass(/legacy-price-title-dense/);
  expect(await productNames.evaluateAll((elements) => elements.slice(0, 3).map(
    (element) => getComputedStyle(element).fontSize
  ))).toEqual(["32px", "28px", "24px"]);

  if (process.env.CAPTURE_MENU_STUDIO_LG === "1") {
    await page.screenshot({
      path: "docs/screenshots/s118-menu-studio-lg-legacy-portrait.png"
    });
  }
  await context.close();
});

test("LG Legacy verdeelt losse Menu Studio-producten zonder categoriekop over twee gelijke kolommen", async ({
  browser
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36",
    viewport: { height: 1920, width: 1080 }
  });
  const page = await context.newPage();
  await mockMenuStudioPortraitLegacyApis(page, { loose: true });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem("veyocast.player.installationCredential", credential);
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const slide = page.locator(".dynamic-template.menu-studio-v2.portrait");
  await expect(slide).toBeVisible();
  await expect(slide.locator(".legacy-price-grid")).toHaveClass(/legacy-price-grid-two/);
  await expect(slide.locator(".legacy-price-column")).toHaveCount(2);
  await expect(slide.locator(".legacy-price-category")).toHaveCount(0);
  await expect(slide.locator(".legacy-price-column").nth(0).locator(".legacy-price-product")).toHaveCount(4);
  await expect(slide.locator(".legacy-price-column").nth(1).locator(".legacy-price-product")).toHaveCount(4);
  const styles = await slide.locator(".legacy-price-product").evaluateAll((rows) => rows.slice(0, 2).map((row) => {
    const computed = getComputedStyle(row);
    return {
      backgroundColor: computed.backgroundColor,
      height: row.getBoundingClientRect().height,
      paddingBlockEnd: computed.paddingBlockEnd,
      paddingBlockStart: computed.paddingBlockStart
    };
  }));
  expect(styles).toHaveLength(2);
  expect(styles[1]).toEqual(styles[0]);
  await page.screenshot({ path: "docs/screenshots/s125-lg-menu-loose-portrait.png" });
  await context.close();
});

test("LG Legacy Player downloadt en speelt video vanuit één lokale Blob", async ({
  page
}) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        legacyEnvelope({
          bytes: legacyVideoBytes.byteLength,
          checksumSha256: legacyVideoChecksum,
          id: "legacy-video",
          kind: "video",
          mimeType: "video/mp4",
          title: "Lokale Legacy-video",
          url: legacyVideoPath
        })
      )
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  const video = page.locator("#media-root > video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => video.evaluate((element) => !element.paused))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        async (cacheKey) =>
          Boolean(
            await (
              await caches.open("veyocast-player-assets-v1")
            ).match(cacheKey)
          ),
        `/__veyocast-player-cache/${legacyVideoChecksum}`
      )
    )
    .toBe(true);
  expect(
    requestedUrls.filter((url) => url.endsWith(legacyVideoPath))
  ).toHaveLength(1);
});

test("LG Legacy Player houdt het oude beeld zichtbaar tot de nieuwe lokale release klaar is", async ({
  page
}) => {
  let desiredRelease = "release-first";
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route(`**${legacySecondImagePath}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacySecondImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    const etag = `"release-${desiredRelease}"`;
    if (route.request().headers()["if-none-match"] === etag) {
      await route.fulfill({ headers: { ETag: etag }, status: 304 });
      return;
    }
    const second = desiredRelease === "release-second";
    await route.fulfill({
      contentType: "application/json",
      headers: { ETag: etag },
      body: JSON.stringify(
        imageReleaseEnvelope({
          activeReleaseId: second ? "release-first" : desiredRelease,
          bytes: second ? legacySecondImageBytes : legacyImageBytes,
          checksumSha256: second
            ? legacySecondImageChecksum
            : legacyImageChecksum,
          path: second ? legacySecondImagePath : legacyImagePath,
          releaseId: desiredRelease
        })
      )
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);
  const firstImage = page.locator("#media-root > img");
  await expect(firstImage).toBeVisible();
  await firstImage.evaluate((element) => {
    element.setAttribute("data-release", "first");
  });
  desiredRelease = "release-second";

  const uninterrupted = await page.evaluate(async () => {
    let visibleAtEverySample = true;
    const endAt = Date.now() + 2_500;
    window.dispatchEvent(new Event("online"));
    while (Date.now() < endAt) {
      const hasVisibleMedia = Array.from(
        document.querySelectorAll("#media-root > .legacy-media-layer")
      ).some((element) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0.01
        );
      });
      if (!hasVisibleMedia) visibleAtEverySample = false;
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    }
    return visibleAtEverySample;
  });

  expect(uninterrupted).toBe(true);
  await expect(page.locator('[data-release="first"]')).toHaveCount(0);
  await expect(page.locator("#media-root > img")).toBeVisible();
  expect(
    requestedUrls.filter((url) => url.endsWith(legacySecondImagePath))
  ).toHaveLength(1);
});

test("LG Legacy Player herstelt een lokaal verwijderde schermcredential uit de actieve release", async ({
  page
}) => {
  const installationAuthorizations: Array<string | undefined> = [];
  let pairingRequests = 0;
  const envelope = cachedImageEnvelope("credential-recovery-image");

  await page.route("**/api/player/installation", async (route) => {
    installationAuthorizations.push(
      route.request().headers()["authorization"]
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/pairing", async (route) => {
    pairingRequests += 1;
    await route.fulfill({ status: 429 });
  });
  await page.route(`**${legacyImagePath}`, async (route) => {
    await route.fulfill({
      contentType: "image/svg+xml",
      body: legacyImageSvg
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(envelope)
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });

  await page.goto(`${playerURL}/healthz`);
  await page.evaluate(
    async ({ credential, release, token }) => {
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
      localStorage.removeItem("veyocast.player.deviceToken");
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("veyocast-player-cache-v1", 2);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains("activeReleases")) {
            open.result.createObjectStore("activeReleases", {
              keyPath: "deviceToken"
            });
          }
          if (!open.result.objectStoreNames.contains("previousReleases")) {
            open.result.createObjectStore("previousReleases", {
              keyPath: "deviceToken"
            });
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("activeReleases", "readwrite");
        transaction.objectStore("activeReleases").put({
          activatedAt: new Date().toISOString(),
          assets: [],
          deviceToken: token,
          envelope: release
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
    },
    {
      credential: installationCredential,
      release: envelope,
      token: deviceToken
    }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#media-root > img")).toBeVisible();
  await expect.poll(() => installationAuthorizations.at(-1)).toBe(
    `Bearer ${deviceToken}`
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("veyocast.player.deviceToken")
      )
    )
    .toBe(deviceToken);
  expect(pairingRequests).toBe(0);
});

test("LG Legacy Player voltooit remote recovery ondanks een twee uur voorlopende tv-klok", async ({
  page
}) => {
  const recoveredDeviceToken = "r".repeat(48);
  const phases: string[] = [];
  const serverNow = Date.now() - 2 * 60 * 60 * 1_000;
  const commandId = "33333333-3333-4333-8333-333333333333";
  const commandNonce = "44444444-4444-4444-8444-444444444444";
  let completed = false;

  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: true,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        device: {
          activeReleaseId: null,
          desiredReleaseId: null,
          id: "device-clock-skew",
          screenId: "screen-clock-skew",
          screenName: "LG kloktest"
        },
        state: "READY"
      })
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ automation: null, ok: true })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    if (route.request().method() === "GET") {
      const expiresAt = new Date(serverNow + 15 * 60 * 1_000)
        .toISOString()
        .replace(/(\.\d{3})Z$/, "$1000+00:00");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          commands: completed
            ? []
            : [{
                commandType: "RECOVER_PAIRING",
                createdAt: new Date(serverNow).toISOString(),
                expiresAt,
                id: commandId,
                nonce: commandNonce,
                payload: {}
              }],
          ok: true,
          serverTime: new Date(serverNow).toISOString()
        })
      });
      return;
    }

    const requestBody = route.request().postDataJSON() as {
      phase?: string;
    };
    phases.push(requestBody.phase ?? "missing");
    if (requestBody.phase === "completed") completed = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...(requestBody.phase === "completed"
          ? {
              commandType: "RECOVER_PAIRING",
              deviceToken: recoveredDeviceToken
            }
          : {}),
        ok: true
      })
    });
  });
  await page.addInitScript(
    ({ credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
    },
    { credential: installationCredential, token: deviceToken }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  await expect
    .poll(() => phases, { timeout: 15_000 })
    .toEqual(["acknowledged", "completed"]);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("veyocast.player.deviceToken")
      )
    )
    .toBe(recoveredDeviceToken);
  await expect(page.getByRole("heading", { name: "Wachten op content" }))
    .toBeVisible();
});

test("LG Legacy Player toont pairing zonder witte of horizontaal overlopende pagina", async ({
  page
}) => {
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: false,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/pairing", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        deviceToken,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        pairingCode: "LGX 691"
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        state: "UNPAIRED",
        error: {
          cause: "Koppelcode is nog niet geclaimd.",
          code: "PAIRING_PENDING",
          effect: "Wachten",
          recovery: "Claim de code."
        }
      })
    });
  });
  await page.setViewportSize({ width: 960, height: 540 });

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#pairing-code")).toHaveText("LGX 691");
  await expect(page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(5, 5, 5)"
  );
});

test("LG Legacy Player roteert een geldige code niet door een voorlopende TV-klok", async ({
  page
}) => {
  let pairingRequests = 0;
  let heartbeatRequests = 0;
  const requestNonces: string[] = [];

  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bound: false,
        installationCredential,
        ok: true
      })
    });
  });
  await page.route("**/api/player/pairing", async (route) => {
    pairingRequests += 1;
    requestNonces.push(
      route.request().headers()["x-veyocast-pairing-request"] ?? ""
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        deviceToken,
        expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString(),
        pairingCode: "CLK 748"
      })
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    heartbeatRequests += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          cause: "Koppelcode is nog niet geclaimd.",
          code: "PAIRING_PENDING"
        },
        ok: false
      })
    });
  });
  await page.route("**/api/player/commands", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        commands: [],
        ok: true,
        serverTime: new Date().toISOString()
      })
    });
  });

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.locator("#pairing-code")).toHaveText("CLK 748");
  await expect
    .poll(() => heartbeatRequests, { timeout: 8_000 })
    .toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(1_500);
  expect(pairingRequests).toBe(1);
  expect(requestNonces).toHaveLength(1);
  expect(requestNonces[0]).toMatch(/^[a-f0-9-]{20,80}$/);
  await expect(page.locator("#pairing-code")).toHaveText("CLK 748");
  await expect(page.getByText("PAIRING_RATE_LIMITED")).toHaveCount(0);
});

function cachedImageEnvelope(itemId: string) {
  return legacyEnvelope({
    bytes: legacyImageBytes,
    checksumSha256: legacyImageChecksum,
    id: itemId,
    kind: "image",
    mimeType: "image/svg+xml",
    title: "Legacy herstelbeeld",
    url: legacyImagePath
  });
}

function legacyEnvelope(item: {
  bytes: number;
  checksumSha256: string;
  id: string;
  kind: "image" | "video";
  mimeType: string;
  title: string;
  url: string;
}) {
  return {
    state: "PLAYING",
    fetchedAt: new Date().toISOString(),
    device: {
      id: "device-legacy",
      screenId: "screen-legacy",
      screenName: "LG Legacy",
      activeReleaseId: "release-legacy",
      desiredReleaseId: "release-legacy"
    },
    manifest: {
      schemaVersion: 1,
      tenantId: "tenant-legacy",
      playlistId: "playlist-legacy",
      releaseId: "release-legacy",
      version: 1,
      label: "Legacy herstelbewijs",
      manifestHash: "a".repeat(64),
      publishedAt: new Date().toISOString(),
      totalDurationSeconds: 5,
      totalBytes: item.bytes,
      items: [
        {
          id: item.id,
          kind: item.kind,
          title: item.title,
          durationSeconds: 5,
          fitMode: "contain",
          muted: true,
          source: {
            url: item.url,
            mimeType: item.mimeType,
            bytes: item.bytes,
            checksumSha256: item.checksumSha256
          }
        }
      ]
    },
    diagnostics: {
      syncStatus: "online",
      lastSuccessfulSyncAt: new Date().toISOString(),
      nextSyncReason: "test"
    }
  };
}

function imageReleaseEnvelope({
  activeReleaseId,
  bytes,
  checksumSha256,
  path,
  releaseId
}: {
  activeReleaseId: string;
  bytes: number;
  checksumSha256: string;
  path: string;
  releaseId: string;
}) {
  const envelope = legacyEnvelope({
    bytes,
    checksumSha256,
    id: `${releaseId}-image`,
    kind: "image",
    mimeType: "image/svg+xml",
    title: releaseId,
    url: path
  });
  envelope.device.activeReleaseId = activeReleaseId;
  envelope.device.desiredReleaseId = releaseId;
  envelope.manifest.releaseId = releaseId;
  envelope.manifest.manifestHash = checksumSha256;
  envelope.manifest.items[0]!.durationSeconds = 1;
  return envelope;
}

function legacyGoalSse({
  assets = [],
  awayScore = 0,
  deliveryId,
  eventId,
  eventKind = "synthetic_test",
  executeAt,
  expiresAt,
  homeScore = 1,
  logoMediaAssetId,
  player,
  previousAwayScore = 0,
  previousHomeScore = 0,
  scorerName = "Legacy Player",
  scoringSide = "own",
  scene,
  serverTime
}: {
  assets?: Array<Record<string, unknown>>;
  awayScore?: number;
  deliveryId: string;
  eventId: string;
  eventKind?: "live" | "synthetic_test";
  executeAt: string;
  expiresAt: string;
  homeScore?: number;
  logoMediaAssetId?: string;
  player?: Record<string, unknown>;
  previousAwayScore?: number;
  previousHomeScore?: number;
  scorerName?: string | null;
  scoringSide?: "opponent" | "own" | "unknown";
  scene?: Record<string, unknown>;
  serverTime: string;
}) {
  const payload: Record<string, unknown> = {
    awayScore,
    awayTeam: "Tegenstander",
    design: {
      animation: "none",
      headline: "LEGACY GOAL!",
      logoPosition: "left",
      palette: "electric-orange",
      scorerFallback: "Doelpunt!",
      secondaryText: "Kantinescherm",
      showClock: false,
      showPreviousScore: true,
      showScorer: true,
      typography: "display"
    },
    durationMs: 2_000,
    eventId,
    eventKind,
    homeScore,
    homeTeam: "Duindorp sv 1",
    previousAwayScore,
    previousHomeScore,
    scoringSide,
    underlayPolicy: "pause"
  };
  if (logoMediaAssetId) payload.logoMediaAssetId = logoMediaAssetId;
  if (player) payload.player = player;
  if (scorerName) payload.scorerName = scorerName;
  if (scene) payload.scene = scene;
  return `event: goal\ndata: ${JSON.stringify({
    alertVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    assets,
    executeAt,
    expiresAt,
    id: deliveryId,
    kind: "goal",
    payload,
    screenId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    serverTime
  })}\n\n`;
}

function legacyCanvasScenePair(backgroundAssetId: string) {
  return {
    landscape: {
      background: {
        angle: 90,
        from: "#0a0a0a",
        kind: "gradient",
        to: "#315cff"
      },
      layers: [
        legacyCanvasTextLayer({
          id: "landscape-marker",
          text: "LANDSCAPE CANVAS",
          x: 120,
          y: 120
        })
      ],
      orientation: "landscape"
    },
    portrait: {
      background: {
        kind: "media",
        mediaAssetId: backgroundAssetId,
        objectFit: "cover",
        overlayColor: "#0a0a0a",
        overlayOpacity: 0.35
      },
      layers: [
        {
          fill: "#ff5c20",
          height: 520,
          id: "accent-shape",
          name: "Accentvlak",
          shape: "rectangle",
          type: "shape",
          width: 1080,
          x: 0,
          y: 0,
          zIndex: 0
        },
        legacyCanvasTextLayer({
          id: "portrait-marker",
          text: "PORTRAIT CANVAS",
          x: 72,
          y: 100,
          zIndex: 1
        }),
        legacyCanvasTextLayer({
          binding: "scorerName",
          id: "scorer-name",
          text: "Onbekende scorer",
          x: 72,
          y: 350,
          zIndex: 2
        }),
        {
          binding: "scorerPhoto",
          height: 760,
          id: "scorer-photo",
          name: "Spelersfoto",
          objectFit: "cover",
          type: "image",
          width: 936,
          x: 72,
          y: 720,
          zIndex: 3
        },
        {
          binding: "homeLogo",
          height: 220,
          id: "home-logo",
          name: "Thuisteamlogo",
          objectFit: "contain",
          type: "image",
          width: 220,
          x: 72,
          y: 1540,
          zIndex: 4
        },
        {
          fill: "#ff5c20",
          height: 80,
          id: "center-line",
          name: "Scheidingslijn",
          shape: "line",
          stroke: "#fafaf7",
          strokeWidth: 6,
          type: "shape",
          width: 936,
          x: 72,
          y: 1780,
          zIndex: 5
        },
        legacyCanvasTextLayer({
          binding: "headline",
          id: "authored-headline",
          text: "EIGEN CANVAS HEADLINE",
          x: 72,
          y: 500,
          zIndex: 6
        }),
        legacyCanvasTextLayer({
          binding: "secondaryText",
          id: "authored-secondary",
          text: "Eigen canvas subtekst",
          x: 72,
          y: 620,
          zIndex: 7
        })
      ],
      orientation: "portrait"
    }
  };
}

function legacyCanvasAuthoredTextScenePair() {
  function authoredScene(orientation: "landscape" | "portrait") {
    return {
      background: { color: "#0a0a0a", kind: "solid" },
      layers: [
        legacyCanvasTextLayer({
          binding: "headline",
          id: orientation + "-headline",
          text: "EIGEN CANVAS HEADLINE",
          x: 72,
          y: 120,
          zIndex: 0
        }),
        legacyCanvasTextLayer({
          binding: "secondaryText",
          id: orientation + "-secondary",
          text: "Eigen canvas subtekst",
          x: 72,
          y: 340,
          zIndex: 1
        }),
        legacyCanvasTextLayer({
          binding: "scorerName",
          id: orientation + "-scorer",
          text: "Onbekende scorer uit canvas",
          x: 72,
          y: 560,
          zIndex: 2
        })
      ],
      orientation
    };
  }
  return {
    landscape: authoredScene("landscape"),
    portrait: authoredScene("portrait")
  };
}

function legacyCanvasLogoParityScenePair() {
  function imageLayer(
    binding: "awayLogo" | "homeLogo" | "scoringTeamLogo",
    index: number
  ) {
    return {
      binding,
      height: 220,
      id: binding.replace(/[A-Z]/g, (match) => "-" + match.toLowerCase()),
      name: binding,
      objectFit: "contain",
      type: "image",
      width: 220,
      x: 72 + index * 280,
      y: 360,
      zIndex: index + 1
    };
  }
  function scene(orientation: "landscape" | "portrait") {
    return {
      background: { color: "#0a0a0a", kind: "solid" },
      layers: [
        legacyCanvasTextLayer({
          binding: "eventLabel",
          id: orientation + "-event-label",
          text: "DOELPUNT",
          x: 72,
          y: 100,
          zIndex: 0
        }),
        imageLayer("homeLogo", 0),
        imageLayer("awayLogo", 1),
        imageLayer("scoringTeamLogo", 2)
      ],
      orientation
    };
  }
  return {
    landscape: scene("landscape"),
    portrait: scene("portrait")
  };
}

function legacyCanvasTextLayer({
  binding,
  id,
  text,
  x,
  y,
  zIndex = 0
}: {
  binding?: string;
  id: string;
  text: string;
  x: number;
  y: number;
  zIndex?: number;
}) {
  return {
    ...(binding ? { binding } : {}),
    fill: "#fafaf7",
    fontFamily: "Inter Tight",
    fontSize: 96,
    fontWeight: 900,
    height: 180,
    id,
    name: id,
    text,
    type: "text",
    width: 936,
    x,
    y,
    zIndex
  };
}

function legacyCanvasLineupScenePair() {
  function lineupScene(
    orientation: "landscape" | "portrait",
    marker: string,
    columns: number
  ) {
    const portrait = orientation === "portrait";
    return {
      background: { color: "#0a0a0a", kind: "solid" },
      layers: [
        legacyCanvasTextLayer({
          id: orientation + "-lineup-marker",
          text: marker,
          x: portrait ? 56 : 72,
          y: portrait ? 60 : 44
        }),
        {
          accentColor: "#ff5c20",
          cardColor: "#151719",
          columns,
          gap: 18,
          height: portrait ? 1460 : 760,
          id: "lineup-grid",
          name: "Opstelling",
          showName: true,
          showNumber: true,
          showPhoto: true,
          textColor: "#fafaf7",
          type: "lineup",
          width: portrait ? 968 : 1776,
          x: portrait ? 56 : 72,
          y: portrait ? 300 : 250,
          zIndex: 1
        }
      ],
      orientation
    };
  }
  return {
    landscape: lineupScene("landscape", "LANDSCAPE LINEUP", 4),
    portrait: lineupScene("portrait", "PORTRAIT LINEUP", 2)
  };
}

function legacyCanvasLineupSse({
  deliveryId,
  eventId,
  executeAt,
  expiresAt,
  serverTime
}: {
  deliveryId: string;
  eventId: string;
  executeAt: string;
  expiresAt: string;
  serverTime: string;
}) {
  const lineup = Array.from({ length: 12 }, (_, index) => ({
    id: "speler-" + String(index + 1),
    name: "Speler " + String(index + 1),
    number: String(index + 1),
    photoUrl: null
  }));
  return "event: match_overlay\ndata: " + JSON.stringify({
    alertVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    assets: [],
    executeAt,
    expiresAt,
    id: deliveryId,
    kind: "match_overlay",
    payload: {
      away: { name: "Uitteam", score: 0, teamKey: "away-1" },
      design: {
        animation: "none",
        headline: "Onze opstelling",
        palette: "ink-black",
        template: "team-grid"
      },
      durationMs: 9_000,
      eventId,
      eventKind: "synthetic_test",
      home: { name: "Duindorp sv 1", score: 0, teamKey: "home-1" },
      lineup,
      lineupPageDurationMs: 4_000,
      overlayKind: "lineup",
      ownTeamKeys: ["home-1"],
      scene: legacyCanvasLineupScenePair(),
      side: "home",
      underlayPolicy: "pause"
    },
    screenId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    serverTime
  }) + "\n\n";
}

test("LG Legacy Player herstelt een reeds geverifieerde last-known-good release", async ({
  page
}) => {
  const checksum = legacyImageChecksum;
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INSTALLATION_API_UNAVAILABLE" },
        ok: false
      })
    });
  });
  await page.route("**/api/player/manifest?legacy=*", async (route) => {
    await route.abort("failed");
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.abort("failed");
  });
  await page.goto(`${playerURL}/healthz`);
  await page.evaluate(
    async ({ cacheBytes, cacheChecksum, cachedImage, credential, token }) => {
      localStorage.setItem("veyocast.player.deviceToken", token);
      localStorage.setItem(
        "veyocast.player.installationCredential",
        credential
      );
      localStorage.setItem(
        "veyocast.player.instanceId",
        "12345678-1234-4123-8123-123456789abc"
      );
      const envelope = {
        state: "PLAYING",
        fetchedAt: new Date().toISOString(),
        device: {
          id: "device-offline",
          screenId: "screen-offline",
          screenName: "LG Offline",
          activeReleaseId: "release-offline",
          desiredReleaseId: "release-offline"
        },
        manifest: {
          schemaVersion: 1,
          tenantId: "tenant-offline",
          playlistId: "playlist-offline",
          releaseId: "release-offline",
          version: 1,
          label: "Last-known-good",
          manifestHash: "d".repeat(64),
          publishedAt: new Date().toISOString(),
          totalDurationSeconds: 5,
          totalBytes: cacheBytes,
          items: [
            {
              id: "offline-image",
              kind: "image",
              title: "Offline bewijs",
              durationSeconds: 5,
              fitMode: "contain",
              muted: true,
              source: {
                url: "https://expired.invalid/offline.svg",
                mimeType: "image/svg+xml",
                bytes: cacheBytes,
                checksumSha256: cacheChecksum
              }
            }
          ]
        },
        diagnostics: {
          syncStatus: "online",
          lastSuccessfulSyncAt: new Date().toISOString(),
          nextSyncReason: "cached"
        }
      };
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("veyocast-player-cache-v1", 2);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains("activeReleases")) {
            open.result.createObjectStore("activeReleases", {
              keyPath: "deviceToken"
            });
          }
          if (!open.result.objectStoreNames.contains("previousReleases")) {
            open.result.createObjectStore("previousReleases", {
              keyPath: "deviceToken"
            });
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("activeReleases", "readwrite");
        transaction.objectStore("activeReleases").put({
          activatedAt: new Date().toISOString(),
          assets: [{
            bytes: cacheBytes,
            cacheKey: `/__veyocast-player-cache/${cacheChecksum}`,
            checksumSha256: cacheChecksum,
            itemId: "offline-image",
            kind: "media",
            url: "https://expired.invalid/offline.svg"
          }],
          deviceToken: token,
          envelope
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
      const cache = await caches.open("veyocast-player-assets-v1");
      await cache.put(
        `/__veyocast-player-cache/${cacheChecksum}`,
        new Response(
          cachedImage,
          {
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Length": String(cacheBytes),
              "Content-Type": "image/svg+xml"
            }
          }
        )
      );
    },
    {
      cacheBytes: legacyImageBytes,
      cacheChecksum: checksum,
      cachedImage: legacyImageSvg,
      credential: installationCredential,
      token: deviceToken
    }
  );

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(
    page.locator("#media-root > img.visible:not(.retiring)")
  ).toBeVisible();
  await expect(page.locator("#offline")).toHaveClass("visible");
  await expect(page.locator("#status")).toBeHidden();
  await expect(page.locator("#media-root > *")).toHaveCount(1);
});
