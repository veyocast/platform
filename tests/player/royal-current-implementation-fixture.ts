import type {
  EditorialNewsVariant,
  PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import {
  createRoyalCurrentAppearance,
  createRoyalCurrentSelection,
  createRoyalCurrentTheme
} from "@veyocast/content-templates";
import {
  freezeThemePresentation,
  themeCatalog
} from "@veyocast/content-templates/theme-catalog";

export type RoyalCurrentReferenceCase = {
  background: "club";
  font: "Roboto";
  height: 1080 | 1920;
  id: string;
  mode: "glass" | "royal";
  motion: false;
  orientation: "landscape" | "portrait";
  path: string;
  primary: "#2459ed";
  secondary: null;
  slide_id: RoyalCurrentReferenceSlideId;
  slide_index: string;
  source: string;
  title: string;
  type_scale: 1;
  variant: string;
  width: 1080 | 1920;
};

export type RoyalCurrentReferenceSlideId =
  | "engage_poll"
  | "led_goal_own"
  | "ledscores_live_match"
  | "menu"
  | "news"
  | "price_list"
  | "sport_activities"
  | "sport_birthdays"
  | "sport_cancellations"
  | "sport_dressing_rooms"
  | "sport_match_of_the_day"
  | "sport_next_match"
  | "sport_officials"
  | "sport_program"
  | "sport_referee_arrivals"
  | "sport_results"
  | "sport_standing"
  | "sport_visitor_arrivals";

export const royalCurrentFixtureInstant = "2026-09-09T12:00:00.000Z";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const snapshotId = "71000000-0000-4000-8000-000000000001";
const templateVersionId = "71000000-0000-4000-8000-000000000002";
const imageId = "71000000-0000-4000-8000-000000000003";
const clubLogoId = "71000000-0000-4000-8000-000000000004";
const awayLogoId = "71000000-0000-4000-8000-000000000005";
const qrId = "71000000-0000-4000-8000-000000000006";

const thumbnailSlideIds = [
  "menu",
  "news",
  "price_list",
  "sport_activities",
  "sport_birthdays",
  "sport_cancellations",
  "sport_dressing_rooms",
  "sport_match_of_the_day",
  "sport_next_match",
  "sport_officials",
  "sport_program",
  "sport_referee_arrivals",
  "sport_results",
  "sport_standing",
  "sport_visitor_arrivals"
] as const satisfies readonly PlayerDynamicTemplatePayload["slideType"][];

export type ThumbnailReferenceSlideId = (typeof thumbnailSlideIds)[number];

export function isThumbnailReferenceCase(
  reference: RoyalCurrentReferenceCase
): reference is RoyalCurrentReferenceCase & { slide_id: ThumbnailReferenceSlideId } {
  return (thumbnailSlideIds as readonly string[]).includes(reference.slide_id);
}

export function referenceMode(reference: RoyalCurrentReferenceCase) {
  return reference.mode === "glass" ? "dark" as const : "light" as const;
}

export function buildRoyalCurrentImplementationPayload(
  reference: RoyalCurrentReferenceCase
): PlayerDynamicTemplatePayload {
  if (!isThumbnailReferenceCase(reference)) {
    throw new Error(`${reference.slide_id} heeft geen Editorial Arena-/thumbnail-slideType.`);
  }
  return buildPayload(reference, reference.slide_id);
}

/**
 * Engage and realtime goal moments have no DynamicTemplate slideType. This
 * carrier is only their immutable release theme authority; the production
 * Player still renders EngagePlaybackMedia/LedScoresGoalOverlay, not this
 * Editorial Arena payload.
 */
export function buildRoyalCurrentThemeCarrier(
  reference: RoyalCurrentReferenceCase
): PlayerDynamicTemplatePayload {
  return {
    ...buildPayload(reference, "sport_activities"),
    assets: undefined
  };
}

export function buildRoyalCurrentLiveMatchPayload(
  reference: RoyalCurrentReferenceCase
): PlayerDynamicTemplatePayload {
  const presentation = frozenPresentation(reference);
  const mode = referenceMode(reference);
  return {
    data: {
      _veyocastThemeRuntime: { version: 2 },
      liveMatch: {
        configuration: {
          accentMode: "club",
          outsideMatchBehavior: "last_known",
          showClock: true,
          showStatus: true,
          showTimeline: true,
          template: "match_center",
          timelineLimit: 5,
          title: "Live vanaf Sportpark Duindorp"
        },
        connectionId: "71000000-0000-4000-8000-000000000071",
        connectionName: "Duindorp live",
        state: {
          away: { logoUrl: null, name: "Quick O23-1", score: 1 },
          clock: {
            anchorAt: royalCurrentFixtureInstant,
            anchorSeconds: 2_745,
            direction: "up",
            maxSeconds: 5_400,
            running: false
          },
          home: { logoUrl: null, name: "Duindorp sv O23-1", score: 2 },
          matchKey: "royal-current-live-match",
          periodLabel: "Tweede helft",
          schemaVersion: 1,
          sequence: 42,
          sourceUpdatedAt: royalCurrentFixtureInstant,
          staleAfter: "2026-09-09T13:00:00.000Z",
          stateRevision: "42",
          status: "live",
          timeline: [
            {
              awayScore: 1,
              clockLabel: "46'",
              homeScore: 2,
              id: "royal-current-live-goal",
              kind: "goal",
              label: "Doelpunt Duindorp sv O23-1",
              occurredAt: royalCurrentFixtureInstant,
              playerName: "M. de Jong",
              side: "home"
            }
          ]
        }
      },
      themePresentation: presentation,
      type: "ledscores_live_match"
    },
    orientation: reference.orientation,
    schemaVersion: 1,
    slideType: "ledscores_live_match",
    snapshotHash: hashFor(reference, "d"),
    snapshotId,
    templateSlug: `royal-current-live-match-${mode}-${reference.orientation}`,
    templateVersionId
  };
}

export function fixtureMarker(reference: RoyalCurrentReferenceCase) {
  if (reference.slide_id === "news") {
    return `[data-render-family="news"][data-news-variant="${reference.variant}"]`;
  }
  if (reference.slide_id === "sport_visitor_arrivals") {
    return `[data-render-family="visitor-arrivals"][data-slots="${reference.variant}"]`;
  }
  return {
    menu: '[data-render-family="menu"]',
    price_list: '[data-render-family="price-list"]',
    sport_activities: '[data-render-family="activities"]',
    sport_birthdays: '[data-render-family="birthdays"]',
    sport_cancellations: '[data-render-family="cancellations"]',
    sport_dressing_rooms: '[data-render-family="dressing-rooms"]',
    sport_match_of_the_day: '[data-render-family="match-of-the-day"]',
    sport_next_match: '[data-render-family="next-match"]',
    sport_officials: '[data-render-family="officials"]',
    sport_program: '[data-render-family="program"]',
    sport_referee_arrivals: '[data-render-family="referee-arrivals"]',
    sport_results: '[data-render-family="results"]',
    sport_standing: '[data-render-family="standing"]'
  }[reference.slide_id] ?? "";
}

function buildPayload(
  reference: RoyalCurrentReferenceCase,
  slideType: ThumbnailReferenceSlideId
): PlayerDynamicTemplatePayload {
  const presentation = frozenPresentation(reference);
  const mode = referenceMode(reference);
  const selection = createRoyalCurrentSelection(
    { background: "club", primary: "#2459ed", secondary: null, version: 1 },
    themeCatalog.fieldflow.version,
    mode
  );
  const shared = {
    _veyocastThemeRuntime: { version: 2 },
    brand: {
      clubName: "Duindorp SV",
      logoMediaAssetId: clubLogoId,
      primaryColor: "#2459ed"
    },
    editorial: {
      newsFocalPoint: { x: 0.64, y: 0.36 },
      newsVariant: newsVariant(reference),
      pricePhotoMode: "show" as const,
      schemaVersion: 2 as const,
      theme: createRoyalCurrentTheme(undefined, mode),
      themeSelection: selection
    },
    themePresentation: presentation
  };
  return {
    assets: fixtureAssets(),
    data: slideType === "news"
      ? { ...shared, news: newsFixture() }
      : slideType === "menu"
        ? { ...shared, menu: menuFixture() }
        : slideType === "price_list"
          ? { ...shared, priceList: priceListFixture() }
          : slideType === "sport_birthdays"
            ? { ...shared, sport: birthdayFixture(mode) }
            : { ...shared, sport: sportFixture(reference, slideType) },
    orientation: reference.orientation,
    schemaVersion: 1,
    slideType,
    snapshotHash: hashFor(reference, "b"),
    snapshotId,
    templateSlug: `royal-current-${slideType.replaceAll("_", "-")}-${mode}-${reference.orientation}`,
    templateVersionId
  };
}

function frozenPresentation(reference: RoyalCurrentReferenceCase) {
  const mode = referenceMode(reference);
  const style = {
    background: "club" as const,
    primary: "#2459ed",
    secondary: null,
    version: 1 as const
  };
  const selection = createRoyalCurrentSelection(
    style,
    themeCatalog.fieldflow.version,
    mode
  );
  const frozen = freezeThemePresentation({
    appearance: createRoyalCurrentAppearance(style),
    instant: royalCurrentFixtureInstant,
    selection,
    settingsRevision: 161,
    timezone: "Europe/Amsterdam"
  });
  return {
    ...frozen,
    appearance: {
      ...createRoyalCurrentAppearance(style),
      motionEnabled: false
    },
    snapshotVersion: 2 as const
  };
}

function fixtureAssets(): NonNullable<PlayerDynamicTemplatePayload["assets"]> {
  return {
    [awayLogoId]: asset("away-team-logo-fixture.svg", "e"),
    [clubLogoId]: asset("away-team-logo-fixture.svg", "c"),
    [imageId]: asset("editorial-arena-fixture.svg", "a"),
    [qrId]: asset("royal-current-news-qr.svg", "f")
  };
}

function asset(path: string, checksumNibble: string) {
  return {
    bytes: path === "royal-current-news-qr.svg" ? 2_468 : 481,
    checksumSha256: checksumNibble.repeat(64),
    mimeType: "image/svg+xml" as const,
    url: `${playerURL}/${path}`
  };
}

function newsFixture() {
  return {
    articles: Array.from({ length: 4 }, (_, index) => ({
      author: index === 0 ? "Redactie Duindorp" : "Clubredactie",
      canonicalLink: `https://www.veyocast.nl/clubnieuws/royal-current-${index + 1}`,
      externalId: `royal-current-news-${index + 1}`,
      heroMediaAssetId: imageId,
      intro: index === 0
        ? "De vereniging opent dit weekend het vernieuwde hoofdveld. Leden, bezoekers en vrijwilligers zijn van harte welkom bij het feestelijke programma."
        : "Een tweede volledig nieuwsbericht maakt de productiecompositie en vaste pagina-inhoud aantoonbaar.",
      link: `https://www.veyocast.nl/clubnieuws/royal-current-${index + 1}`,
      publishedAt: `2026-09-0${8 - index}T09:00:00.000Z`,
      qrMediaAssetId: qrId,
      sourceName: "Clubnieuws",
      title: index === 0
        ? "Duindorp opent het vernieuwde hoofdveld"
        : `Verenigingsnieuws nummer ${index + 1}`
    })),
    providerLogoMediaAssetId: clubLogoId,
    secondsPerSlide: 12,
    sourceName: "Clubnieuws",
    title: "Clubnieuws"
  };
}

function menuFixture() {
  return {
    products: Array.from({ length: 12 }, (_, index) => ({
      active: true,
      available: true,
      category: index < 6 ? "Warme dranken" : "Snacks",
      currency: "EUR",
      description: "Vers bereid in ons clubhuis",
      externalId: `menu-product-${index + 1}`,
      id: `72000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      imageMediaAssetId: index % 2 === 0 ? imageId : null,
      name: index === 0 ? "Koffie" : `Clubproduct ${index + 1}`,
      priceMinor: 220 + index * 25,
      sortOrder: index,
      sourceUpdatedAt: royalCurrentFixtureInstant
    })),
    title: "Menu van het clubhuis"
  };
}

function priceListFixture() {
  return {
    sections: ["left", "right"].map((column, columnIndex) => ({
      column,
      id: `price-${column}`,
      name: columnIndex === 0 ? "Warme dranken" : "Broodjes",
      order: columnIndex,
      products: Array.from({ length: 6 }, (_, index) => ({
        description: "Vers en lokaal bereid",
        formattedPrice: `€ ${(2.5 + columnIndex + index * 0.4).toFixed(2).replace(".", ",")}`,
        id: `price-${column}-${index + 1}`,
        imageFocalPoint: { x: 0.5, y: 0.42 },
        imageMediaAssetId: imageId,
        name: index === 0 && columnIndex === 1
          ? "Broodje van de week"
          : `Product ${columnIndex * 6 + index + 1}`,
        photoVisible: index === 0
      }))
    })),
    title: "Prijslijst"
  };
}

function sportFixture(
  reference: RoyalCurrentReferenceCase,
  slideType: Exclude<ThumbnailReferenceSlideId, "menu" | "news" | "price_list" | "sport_birthdays">
) {
  const matches = Array.from({ length: 8 }, (_, index) => match(index));
  const title = {
    sport_activities: "Activiteiten op de club",
    sport_cancellations: "Afgelaste wedstrijden",
    sport_dressing_rooms: "Veld- en kleedkamerindeling",
    sport_match_of_the_day: "Wedstrijd van de dag",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Wedstrijdofficials",
    sport_program: "Programma vandaag",
    sport_referee_arrivals: "Aankomst scheidsrechters",
    sport_results: "Laatste uitslagen",
    sport_standing: "Stand van de poule",
    sport_visitor_arrivals: "Welkom bezoekende teams"
  }[slideType];
  if (slideType === "sport_standing") {
    return {
      competition: { name: "Vierde divisie" },
      items: Array.from({ length: 12 }, (_, index) => ({
        drawn: index % 3,
        form: ["win", index % 2 ? "draw" : "loss", "win"],
        goalDifference: 24 - index * 2,
        goalsAgainst: 9 + index,
        goalsFor: 33 - index,
        id: `standing-${index + 1}`,
        logoMediaAssetId: index === 3 ? clubLogoId : awayLogoId,
        lost: index % 4,
        played: 12,
        points: 31 - index,
        position: index + 1,
        selected: index === 3,
        teamName: index === 3 ? "Duindorp sv 1" : `Vereniging ${index + 1}`,
        won: 9 - index % 4,
        zone: index < 2 ? "promotion" : index > 9 ? "relegation" : ""
      })),
      pool: { name: "Poule A" },
      season: "2026/2027",
      title
    };
  }
  if (slideType === "sport_activities") {
    return {
      items: Array.from({ length: 3 }, (_, index) => ({
        date: `${12 + index}-09-2026`,
        id: `activity-${index + 1}`,
        photoMediaAssetId: imageId,
        primary: ["Jeugdclinic", "Vrijwilligersavond", "Familietoernooi"][index],
        secondary: "Voor alle leden en supporters",
        time: `${18 + index}:30`,
        venueName: "Sportpark Duindorp"
      })),
      title
    };
  }
  if (slideType === "sport_referee_arrivals") {
    return {
      arrivalConfig: {
        cardCount: 2,
        dutyDeskText: "Melden bij het wedstrijdsecretariaat",
        emptyBehavior: "neutral",
        motionPreset: "aurora-rise",
        pageDurationSeconds: 12,
        showArrivalTime: true,
        showClubLogo: true,
        showCompetition: true,
        showDressingRoom: true,
        showField: true,
        showKickoffTime: true,
        showSponsor: false,
        showWelcome: true,
        welcomeText: "Welkom bij {{club}}"
      },
      items: matches.slice(0, 2).map((item, index) => ({
        ...item,
        arrivalAt: `2026-09-10T${String(11 + index).padStart(2, "0")}:45:00.000Z`,
        logoMediaAssetId: awayLogoId,
        primary: index ? "R. de Boer" : "S. de Vries",
        status: "Scheidsrechter"
      })),
      title
    };
  }
  if (slideType === "sport_visitor_arrivals") {
    const cardCount = Number(reference.variant);
    return {
      arrivalConfig: {
        cardCount,
        dutyDeskText: "Melden bij ontvangst",
        emptyBehavior: "neutral",
        motionPreset: "aurora-rise",
        pageDurationSeconds: 12,
        showArrivalTime: true,
        showClubLogo: true,
        showCompetition: true,
        showDressingRoom: true,
        showField: true,
        showKickoffTime: true,
        showSponsor: false,
        showWelcome: true,
        welcomeText: "Welkom {{team}} bij {{club}}"
      },
      items: matches.slice(0, cardCount),
      title
    };
  }
  if (slideType === "sport_match_of_the_day" || slideType === "sport_next_match") {
    return { items: [matches[0]], title };
  }
  if (slideType === "sport_cancellations") {
    return {
      displayConfig: fullDisplayConfig(),
      items: matches.slice(0, 5).map((item) => ({
        ...item,
        status: "Afgelast",
        time: ""
      })),
      title
    };
  }
  if (slideType === "sport_results") {
    return {
      displayConfig: fullDisplayConfig(),
      items: matches.slice(0, 6).map((item, index) => ({
        ...item,
        awayScore: index === 5 ? null : index % 3,
        date: "08-09-2026",
        homeScore: index === 5 ? null : 3 - index % 3,
        kickoffAt: `2026-09-08T${String(12 + index).padStart(2, "0")}:30:00.000Z`,
        status: index === 5 ? "Nog niet bekend" : "Gespeeld"
      })),
      title
    };
  }
  return {
    displayConfig: fullDisplayConfig(),
    items: matches.slice(0, slideType === "sport_program" ? 6 : 5),
    title
  };
}

function match(index: number) {
  const homeTeam = index % 2 === 0 ? `Duindorp sv JO${13 + index}-1` : `Thuisclub ${index + 1}`;
  const awayTeam = index % 2 === 0 ? `Quick JO${13 + index}-2` : `Duindorp sv O${12 + index}-1`;
  return {
    arrivalAt: `2026-09-10T${String(10 + index).padStart(2, "0")}:45:00.000Z`,
    awayLogoMediaAssetId: awayLogoId,
    awayRoom: String(index + 11),
    awayTeam,
    competition: "Competitie · Poule A",
    date: "10-09-2026",
    field: String(index + 1),
    homeLogoMediaAssetId: clubLogoId,
    homeMatch: true,
    homeRoom: String(index + 1),
    homeTeam,
    id: `match-${index + 1}`,
    kickoffAt: `2026-09-10T${String(12 + index).padStart(2, "0")}:30:00.000Z`,
    kickoffTime: `${String(14 + index).padStart(2, "0")}:30`,
    logoMediaAssetId: awayLogoId,
    meta: "Competitie · Poule A",
    officials: [{ displayName: index ? "R. de Boer" : "S. de Vries", role: "Scheidsrechter" }],
    primary: `${homeTeam} – ${awayTeam}`,
    secondary: "Competitie · Poule A",
    status: "Gepland",
    time: `${String(14 + index).padStart(2, "0")}:30`,
    venue: `Veld ${index + 1}`,
    venueName: "Sportpark Duindorp"
  };
}

function fullDisplayConfig() {
  return {
    columns: "one",
    showAwayDressingRoom: true,
    showAwayLogo: true,
    showDate: true,
    showField: true,
    showHomeAway: true,
    showHomeDressingRoom: true,
    showHomeLogo: true,
    showReferee: true,
    showSportpark: true,
    showTime: true
  };
}

function birthdayFixture(mode: "dark" | "light") {
  return {
    birthdays: [
      {
        age: 18,
        day: 9,
        displayDate: "2026-09-09",
        displayName: "Noa van Dijk",
        externalId: "birthday-noa",
        matchStatus: "matched",
        month: 9,
        normalizedName: "noa van dijk",
        photoMediaAssetId: imageId,
        role: "Speler",
        teamIds: ["jo19-1"],
        teams: ["JO19-1"]
      },
      {
        age: 42,
        day: 10,
        displayDate: "2026-09-10",
        displayName: "Sam de Jong",
        externalId: "birthday-sam",
        matchStatus: "matched",
        month: 9,
        normalizedName: "sam de jong",
        photoMediaAssetId: imageId,
        role: "Trainer",
        teamIds: ["senioren-1"],
        teams: ["Senioren 1"]
      }
    ],
    configuration: {
      emptyBehavior: "neutral",
      period: { days: 7, mode: "next_7_days" },
      presentation: {
        backgroundColor: "#111827",
        backgroundMediaAssetId: imageId,
        cardStyle: "glass",
        confetti: true,
        gradientOverlay: true,
        layout: "celebration_grid",
        logoPosition: "top_left",
        maxPerLandscapePage: 4,
        maxPerPortraitPage: 3,
        motion: false,
        pageDurationSeconds: 8,
        radius: "lg",
        textAlign: "left",
        themeMode: mode,
        useTenantTheme: true
      },
      schemaVersion: 1,
      selection: {
        emphasizeToday: true,
        includeWithoutTeam: true,
        includeUnknownRoles: true,
        nameMode: "full",
        roleFilter: "all",
        selectedRoles: [],
        selectedTeamIds: [],
        showAge: true,
        showDate: true,
        showDayOfWeek: true,
        showPhoto: true,
        showRole: true,
        showTeam: true,
        teamSelectionMode: "all"
      },
      title: "Jarig bij Duindorp"
    },
    fetchedAt: royalCurrentFixtureInstant,
    freshness: "fresh",
    generatedAt: royalCurrentFixtureInstant,
    timezone: "Europe/Amsterdam",
    title: "Jarig bij Duindorp"
  };
}

function newsVariant(reference: RoyalCurrentReferenceCase): EditorialNewsVariant {
  return reference.slide_id === "news" && [
    "fullscreen_gradient",
    "hero_split",
    "news_grid",
    "text_only"
  ].includes(reference.variant)
    ? reference.variant as EditorialNewsVariant
    : "hero_split";
}

function hashFor(reference: RoyalCurrentReferenceCase, fallback: string) {
  const nibble = reference.id.match(/^([0-9a-f])/iu)?.[1]?.toLowerCase() ?? fallback;
  return nibble.repeat(64);
}
