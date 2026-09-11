import {
  editorialArenaActiveSlideTypes,
  editorialArenaConfigurationSchema,
  editorialThemeConfigSchema,
  type EditorialColorTokens,
  type EditorialFocalPoint,
  type EditorialNewsVariant,
  type EditorialPricePhotoMode,
  menuDocumentV2Schema,
  type MenuDocumentV2,
  type PlayerDynamicTemplatePayload,
  type SelectableThemeId,
  type SportlinkArrivalConfig,
  sportlinkBirthdayConfigurationSchema,
  type SportlinkBirthdayConfiguration,
  type SportlinkArrivalMotionPreset,
  type ThemePresentationSnapshot
} from "@veyocast/contracts";

import {
  activeEditorialTokens,
  parseEditorialArenaConfiguration,
  resolveEditorialThemeConfig
} from "./editorial-arena-theme";
import {
  paginateEditorialRows,
  priceRowsThatFit,
  sportResultsRowsPerPage,
  sportStandingRowsPerPage
} from "./editorial-arena-layout";
import {
  paginatePriceList,
  type PriceListRenderPage,
  type ResolvedPriceListItem,
  type ResolvedPriceListSection
} from "./price-list";
import {
  resolveMenuScenePages,
  type MenuSceneAsset,
  type ResolvedMenuScenePage
} from "./menu-scene";
import {
  freezeThemePresentation,
  parseThemePresentationSnapshot,
  resolveThemeDefinition,
  themeToEditorialTokens
} from "./theme-catalog";

export type DynamicTemplateTheme = "dark" | "light";

export type DynamicTemplateListItem = {
  arrivalAt: string;
  awayLogoUrl: string;
  awayRoom: string;
  awayScore: number | null;
  awayTeam: string;
  competition: string;
  date: string;
  dressingRoom: string;
  field: string;
  homeRoom: string;
  homeMatch: boolean;
  homeLogoUrl: string;
  homeScore: number | null;
  homeTeam: string;
  id: string;
  kickoffAt: string;
  kickoffTime: string;
  logoUrl: string;
  meta: string;
  officialAssignments: Array<{ name: string; role: string }>;
  officials: string[];
  photoUrl: string;
  primary: string;
  selected: boolean;
  secondary: string;
  status: string;
  time: string;
  venue: string;
  venueName: string;
};

export type DynamicTemplateMenuItem = {
  category: string;
  description: string;
  id: string;
  imageUrl: string;
  imageFocalPoint: EditorialFocalPoint;
  name: string;
  price: string;
  variant: string;
};

export type DynamicTemplatePriceEntry =
  | { id: string; kind: "category"; name: string }
  | { item: DynamicTemplateMenuItem; kind: "product" };

export type DynamicTemplateNewsItem = {
  author: string;
  date: string;
  heroUrl: string;
  id: string;
  imageFocalPoint: EditorialFocalPoint;
  intro: string;
  link: string;
  qrUrl: string;
  source: string;
  title: string;
};

export type DynamicTemplateArrivalConfig = Pick<
  SportlinkArrivalConfig,
  | "dutyDeskText"
  | "showArrivalTime"
  | "showClubLogo"
  | "showCompetition"
  | "showDressingRoom"
  | "showField"
  | "showKickoffTime"
  | "showSponsor"
  | "showWelcome"
  | "welcomeText"
>;

export type DynamicTemplateStandingItem = {
  drawn: number | null;
  form: DynamicTemplateStandingForm[];
  goalDifference: number | null;
  goalsAgainst: number | null;
  goalsFor: number | null;
  id: string;
  lost: number | null;
  logoUrl: string;
  played: number | null;
  points: number | null;
  position: number | null;
  selected: boolean;
  teamName: string;
  won: number | null;
  zone: "playoff" | "promotion" | "relegation" | "";
};

export type DynamicTemplateStandingForm = "draw" | "loss" | "win";

export type DynamicTemplateBirthdayItem = {
  age: number | null;
  dateLabel: string;
  day: number;
  displayName: string;
  id: string;
  isToday: boolean;
  meta: string;
  month: number;
  photoUrl: string;
  role: string;
  teams: string[];
};

export type DynamicTemplatePage =
  | {
      columns: [DynamicTemplatePriceEntry[], DynamicTemplatePriceEntry[]];
      kind: "menu";
    }
  | {
      item: DynamicTemplateNewsItem | null;
      kind: "news";
      secondaryItems: DynamicTemplateNewsItem[];
    }
  | { kind: "price-list"; page: PriceListRenderPage }
  | {
      assets: Record<string, MenuSceneAsset>;
      document: MenuDocumentV2;
      kind: "menu-v2";
      page: ResolvedMenuScenePage;
    }
  | {
      awayTeam: string;
      homeTeam: string;
      item: DynamicTemplateListItem | null;
      kind: "match";
    }
  | { items: DynamicTemplateStandingItem[]; kind: "standing" }
  | {
      items: DynamicTemplateBirthdayItem[];
      kind: "birthday";
      layout: Exclude<SportlinkBirthdayConfiguration["presentation"]["layout"], "auto">;
    }
  | { items: DynamicTemplateListItem[]; kind: "arrivals" }
  | { items: DynamicTemplateListItem[]; kind: "sport-list" }
  | { items: DynamicTemplateListItem[]; kind: "team" }
  | { items: DynamicTemplateListItem[]; kind: "sponsor" }
  | { items: DynamicTemplateListItem[]; kind: "trainings" }
  | { items: DynamicTemplateListItem[]; kind: "volunteers" };

export type DynamicTemplateView = {
  accentColor: string;
  arrivalConfig?: DynamicTemplateArrivalConfig;
  arrivalMotionPreset?: SportlinkArrivalMotionPreset;
  arrivalSlots?: number;
  arrivalSponsorUrl?: string;
  birthday?: {
    backgroundUrl: string;
    configuration: SportlinkBirthdayConfiguration;
  };
  clubLogoUrl: string;
  clubName: string;
  designRevision: "legacy" | "royal-current-v8";
  emptyState: string;
  motionEnabled: boolean;
  minimumPlaybackMs?: number;
  orientation: PlayerDynamicTemplatePayload["orientation"];
  pageDurationMs?: number;
  pages: DynamicTemplatePage[];
  newsVariant: EditorialNewsVariant;
  pricePhotoMode: EditorialPricePhotoMode;
  priceCategoryPhotoModes: Record<
    string,
    "inherit" | EditorialPricePhotoMode
  >;
  providerLogoUrl: string;
  slideType: PlayerDynamicTemplatePayload["slideType"];
  snapshotId: string;
  sourceLabel: string;
  standingContext?: {
    competition: string;
    pool: string;
    season: string;
  };
  standingPinnedTeam?: DynamicTemplateStandingItem;
  sportDisplay?: {
    columns: "one" | "two";
    showAwayDressingRoom: boolean;
    showAwayLogo: boolean;
    showDate: boolean;
    showDressingRoom: boolean;
    showField: boolean;
    showHomeAway: boolean;
    showHomeDressingRoom: boolean;
    showHomeLogo: boolean;
    showLogo: boolean;
    showReferee: boolean;
    showSportpark: boolean;
    showTime: boolean;
  };
  templateStyle: "default" | "standing-club-edition";
  theme: DynamicTemplateTheme;
  themeId: SelectableThemeId;
  themePresentation: ThemePresentationSnapshot;
  themeRuntimeVersion: number;
  themeTokens: EditorialColorTokens;
  title: string;
};

const matchSlideTypes = new Set([
  "sport_match_of_the_day",
  "sport_next_match"
]);
const dynamicSlideTypes = new Set<PlayerDynamicTemplatePayload["slideType"]>([
  "menu",
  "price_list",
  "news",
  "sport_activities",
  "sport_birthdays",
  "sport_cancellations",
  "sport_dressing_rooms",
  "sport_match_of_the_day",
  "sport_next_match",
  "sport_officials",
  "sport_period_standing",
  "sport_program",
  "sport_referee_arrivals",
  "sport_results",
  "sport_sponsor",
  "sport_standing",
  "sport_team",
  "sport_trainings",
  "sport_volunteers",
  "sport_visitor_arrivals"
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const snapshotHashPattern = /^[a-f0-9]{64}$/;
const templateSlugPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;

export const royalStandingScrollMetrics = {
  endHoldMs: 3_000,
  landscape: {
    rowGap: 0,
    rowHeight: 70,
    viewportHeight: 498
  },
  portrait: {
    rowGap: 14,
    rowHeight: 220,
    viewportHeight: 1_198
  },
  speedPxPerSecond: 34,
  startHoldMs: 3_000
} as const;

export function royalStandingScrollDistance(
  itemCount: number,
  orientation: PlayerDynamicTemplatePayload["orientation"]
) {
  const count = Math.max(0, Math.floor(itemCount));
  const geometry = royalStandingScrollMetrics[orientation];
  const contentHeight = count * geometry.rowHeight +
    Math.max(0, count - 1) * geometry.rowGap;
  return Math.max(0, contentHeight - geometry.viewportHeight);
}

export function royalStandingPlaybackDurationMs(
  itemCount: number,
  orientation: PlayerDynamicTemplatePayload["orientation"]
) {
  const distance = royalStandingScrollDistance(itemCount, orientation);
  return royalStandingScrollMetrics.startHoldMs +
    Math.ceil(distance / royalStandingScrollMetrics.speedPxPerSecond * 1_000) +
    royalStandingScrollMetrics.endHoldMs;
}

/**
 * Motion-on is one continuous standings scene: pagination would otherwise
 * remount the rail before the final team has entered the viewport. Motion-off
 * deliberately keeps the quiet, bounded pages produced by the view model.
 */
export function royalStandingPlaybackPages(
  pages: DynamicTemplatePage[],
  autoScroll: boolean
): DynamicTemplatePage[] {
  if (!autoScroll) return pages;
  const items = pages.flatMap((page) =>
    page.kind === "standing" ? page.items : []
  );
  return [{ items, kind: "standing" }];
}

export function royalStandingScrollOffset(
  elapsedMs: number,
  maximumScrollTop: number
) {
  const maximum = Math.max(0, maximumScrollTop);
  const movingMs = Math.max(0, elapsedMs - royalStandingScrollMetrics.startHoldMs);
  return Math.min(
    maximum,
    movingMs / 1_000 * royalStandingScrollMetrics.speedPxPerSecond
  );
}

export function createDynamicTemplateView(
  value: unknown,
  now = new Date()
): DynamicTemplateView | null {
  return createDynamicTemplateViewInternal(value, false, now);
}

/** Fixture-only entrypoint for typed families without a live provider gate. */
export function createDynamicTemplateFixtureView(
  value: unknown,
  now = new Date()
): DynamicTemplateView | null {
  return createDynamicTemplateViewInternal(value, true, now);
}

function createDynamicTemplateViewInternal(
  value: unknown,
  allowFixtureOnly: boolean,
  now: Date
): DynamicTemplateView | null {
  const payload = parseDynamicTemplatePayload(value);
  if (!payload) return null;
  if (
    !dynamicSlideTypes.has(payload.slideType) ||
    (!allowFixtureOnly && !editorialArenaActiveSlideTypes.includes(
      payload.slideType as (typeof editorialArenaActiveSlideTypes)[number]
    ))
  ) return null;
  const data = payload.data;
  const accentColor = safeColor(
    readRecord(data.brand)?.primaryColor,
    "#FF5C20"
  );
  const brand = readRecord(data.brand);
  const clubLogoUrl = dynamicAssetUrl(brand?.logoMediaAssetId, payload);
  const clubName = safeText(brand?.clubName, "Vereniging");
  const theme: DynamicTemplateTheme = payload.templateSlug.includes("dark")
    ? "dark"
    : "light";
  const configuredEditorial = editorialArenaConfigurationSchema.safeParse(
    data.editorial
  );
  const editorial = configuredEditorial.success
    ? configuredEditorial.data
    : parseEditorialArenaConfiguration(data.editorial, {
        accent: accentColor,
        mode: theme
      });
  const frozenPresentation = parseThemePresentationSnapshot(data.themePresentation);
  const themePresentation = frozenPresentation ?? freezeThemePresentation({
    instant: "1970-01-01T00:00:00.000Z",
    selection: {
      accent: accentColor,
      categoryOverrides: [],
      modePolicy: {
        kind: "fixed",
        mode: configuredEditorial.success ? editorial.theme.mode : theme
      },
      ref: { catalog: "v2", id: "editorial", version: "1.0.0" },
      support: null
    },
    timezone: "UTC"
  });
  const themeDefinition = resolveThemeDefinition(themePresentation.selection);
  const royalCurrentPresentation = themeDefinition.id === "fieldflow" &&
    themePresentation.snapshotVersion === 2 &&
    themePresentation.appearance.schemaVersion === 2 &&
    themePresentation.appearance.designRevision === "royal-current-v8";
  const themeRuntimeVersion = Math.max(
    0,
    Number(readRecord(data._veyocastThemeRuntime)?.version) || 0
  );
  const tenantThemeOverrides = editorialThemeConfigSchema.safeParse(
    data._veyocastThemeColorOverrides
  );
  const themeTokens = royalCurrentPresentation
    ? tenantThemeOverrides.success
      ? tenantThemeOverrides.data[themePresentation.resolvedMode.mode]
      : themeToEditorialTokens(themePresentation)
    : configuredEditorial.success
      ? editorial.theme[themePresentation.resolvedMode.mode]
      : frozenPresentation
        ? themeToEditorialTokens(themePresentation)
        : activeEditorialTokens(editorial.theme);
  const themeIdentity = {
    designRevision: royalCurrentPresentation
      ? "royal-current-v8" as const
      : "legacy" as const,
    motionEnabled: themePresentation.snapshotVersion === 2 &&
      themePresentation.appearance.schemaVersion === 2
      ? themePresentation.appearance.motionEnabled
      : true,
    themeId: themeDefinition.id,
    themePresentation,
    themeRuntimeVersion
  };

  if (payload.slideType === "menu") {
    const menu = readRecord(data.menu) ?? readRecord(data.data);
    const items = readArray(menu?.products)
      .map((item) => toMenuItem(item, payload))
      .filter((item): item is DynamicTemplateMenuItem => item !== null);
    return {
      accentColor: themeTokens.accent,
      clubLogoUrl,
      clubName,
      emptyState: items.length ? "" : "Er zijn nu geen beschikbare producten.",
      orientation: payload.orientation,
      pages: buildPriceListPages(
        items,
        payload.orientation,
        editorial.priceList?.columns,
        themeIdentity.designRevision === "royal-current-v8"
      ),
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes:
        editorial.priceList?.categoryPhotoModes ?? {},
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Clubkantine",
      templateStyle: "default",
      theme,
      ...themeIdentity,
      themeTokens,
      title: safeText(menu?.title, "Menu vandaag")
    };
  }

  if (payload.slideType === "price_list") {
    const priceList = readRecord(data.priceList);
    const menuDocument = menuDocumentV2Schema.safeParse(
      data.menuDocument ?? priceList?.menuDocument
    );
    if (menuDocument.success) {
      const pages = resolveMenuScenePages(menuDocument.data, payload.orientation);
      const assets = Object.fromEntries(menuDocument.data.assets.flatMap((asset) => {
        const url = dynamicAssetUrl(asset.assetId, payload);
        const payloadAsset = payload.assets?.[asset.assetId];
        return url ? [[asset.assetId, {
          kind: asset.kind,
          mimeType: payloadAsset?.mimeType,
          posterUrl: payloadAsset?.posterUrl,
          url
        } satisfies MenuSceneAsset]] : [];
      }));
      return {
        accentColor: menuDocument.data.theme.brand.accent,
        clubLogoUrl,
        clubName,
        emptyState: pages.length ? "" : "Dit menu bevat nog geen renderbare inhoud.",
        orientation: payload.orientation,
        pages: pages.map((page) => ({
          assets,
          document: menuDocument.data,
          kind: "menu-v2" as const,
          page
        })),
        newsVariant: editorial.newsVariant,
        pricePhotoMode: editorial.pricePhotoMode,
        priceCategoryPhotoModes: {},
        providerLogoUrl: "",
        slideType: payload.slideType,
        snapshotId: payload.snapshotId,
        sourceLabel: "Menu Studio",
        templateStyle: "default",
        theme: menuDocument.data.theme.mode,
        ...themeIdentity,
        themeId: menuDocument.data.theme.themeId,
        themeTokens,
        title: menuDocument.data.title || "Menu"
      };
    }
    const sections = readArray(priceList?.sections)
      .map((section) => toPriceListSection(section, payload))
      .filter((section): section is ResolvedPriceListSection => section !== null);
    const pages = paginatePriceList(sections, payload.orientation);
    return {
      accentColor,
      clubLogoUrl,
      clubName,
      emptyState: sections.length ? "" : "Er zijn geen producten geselecteerd.",
      orientation: payload.orientation,
      pages: pages.map((page) => ({ kind: "price-list" as const, page })),
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes: {},
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Prijzen uit de clubkantine",
      templateStyle: "default",
      theme,
      ...themeIdentity,
      themeTokens,
      title: safeText(priceList?.title, "Prijslijst")
    };
  }

  if (payload.slideType === "news") {
    const news = readRecord(data.news) ?? readRecord(data.data);
    const articles = uniqueLatestNewsItems(readArray(news?.articles)
      .map((article) => toNewsItem(article, news, payload))
      .filter((item): item is DynamicTemplateNewsItem => item !== null));
    const secondsPerSlide = safeInteger(news?.secondsPerSlide, 5, 120, 5);
    return {
      accentColor: themeTokens.accent,
      clubLogoUrl,
      clubName,
      emptyState: articles.length ? "" : "Er zijn nu geen nieuwsberichten.",
      orientation: payload.orientation,
      pageDurationMs: secondsPerSlide * 1_000,
      pages: buildNewsPages(
        articles,
        editorial.newsVariant,
        themeIdentity.designRevision === "royal-current-v8"
      ),
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes: {},
      providerLogoUrl: dynamicAssetUrl(
        news?.providerLogoMediaAssetId,
        payload
      ),
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: safeText(news?.sourceName, "Clubnieuws"),
      templateStyle: "default",
      theme,
      ...themeIdentity,
      themeTokens,
      title: safeText(news?.title, "Nieuws")
    };
  }

  const sport = readRecord(data.sport);
  const displayConfig = readRecord(sport?.displayConfig);
  const legacyShowLogo = displayConfig?.showLogo !== false;
  const legacyShowDressingRoom = typeof displayConfig?.showDressingRoom === "boolean"
    ? displayConfig.showDressingRoom
    : payload.slideType === "sport_dressing_rooms";
  const showAwayDressingRoom =
    typeof displayConfig?.showAwayDressingRoom === "boolean"
      ? displayConfig.showAwayDressingRoom
      : legacyShowDressingRoom;
  const showAwayLogo = typeof displayConfig?.showAwayLogo === "boolean"
    ? displayConfig.showAwayLogo
    : legacyShowLogo;
  const showHomeDressingRoom =
    typeof displayConfig?.showHomeDressingRoom === "boolean"
      ? displayConfig.showHomeDressingRoom
      : legacyShowDressingRoom;
  const showHomeLogo = typeof displayConfig?.showHomeLogo === "boolean"
    ? displayConfig.showHomeLogo
    : legacyShowLogo;
  const sportDisplay = {
    columns: displayConfig?.columns === "two" ? "two" as const : "one" as const,
    showAwayDressingRoom,
    showAwayLogo,
    showDate: displayConfig?.showDate !== false,
    showDressingRoom: showHomeDressingRoom || showAwayDressingRoom,
    showField: displayConfig?.showField !== false,
    showHomeAway: displayConfig?.showHomeAway !== false,
    showHomeDressingRoom,
    showHomeLogo,
    showLogo: showHomeLogo || showAwayLogo,
    showReferee: typeof displayConfig?.showReferee === "boolean"
      ? displayConfig.showReferee
      : payload.slideType === "sport_officials",
    showSportpark: displayConfig?.showSportpark !== false,
    showTime: displayConfig?.showTime !== false
  };
  const sportItemLimit = payload.slideType === "sport_program" ||
    payload.slideType === "sport_results"
    ? 100
    : 40;
  const mappedItems = readArray(sport?.items, sportItemLimit)
    .map((item) => toListItem(item, payload))
    .filter((item): item is DynamicTemplateListItem => item !== null);
  const items = payload.slideType === "sport_visitor_arrivals"
    ? resolveVisitorArrivalItems(
        mappedItems.filter((item) => item.homeMatch),
        now,
        themePresentation.resolvedMode.timezone,
        themeIdentity.designRevision === "royal-current-v8"
      )
    : mappedItems;
  const title = payload.slideType === "sport_visitor_arrivals" &&
    themeIdentity.designRevision !== "royal-current-v8"
    ? sportTitle(payload.slideType)
    : safeText(sport?.title, sportTitle(payload.slideType));
  const emptyState = items.length
    ? ""
    : sportEmptyState(safeText(sport?.emptyStateCode, ""));

  if (payload.slideType === "sport_birthdays") {
    const parsedConfiguration = sportlinkBirthdayConfigurationSchema.safeParse(
      readRecord(sport?.configuration) ?? {}
    );
    const configuration = parsedConfiguration.success
      ? parsedConfiguration.data
      : sportlinkBirthdayConfigurationSchema.parse({});
    const birthdays = resolveBirthdayItems({
      configuration,
      now,
      payload,
      sport
    });
    const configuredPageSize = payload.orientation === "portrait"
      ? configuration.presentation.maxPerPortraitPage
      : configuration.presentation.maxPerLandscapePage;
    const pageSize = themeIdentity.designRevision === "royal-current-v8"
      ? Math.min(3, configuredPageSize)
      : configuredPageSize;
    const birthdayPages = (birthdays.length ? paginate(birthdays, pageSize) : []).map((page) => ({
      items: page,
      kind: "birthday" as const,
      layout: resolveBirthdayLayout(configuration.presentation.layout, page.length)
    }));
    if (!birthdayPages.length && configuration.emptyBehavior === "neutral") {
      birthdayPages.push({
        items: [],
        kind: "birthday",
        layout: "spotlight"
      });
    }
    const birthdayThemeTokens = configuration.presentation.useTenantTheme
      ? themeTokens
      : activeEditorialTokens(resolveEditorialThemeConfig({
        accent: accentColor,
        mode: configuration.presentation.themeMode
      }));
    return {
      accentColor: birthdayThemeTokens.accent,
      birthday: {
        backgroundUrl: dynamicAssetUrl(
          configuration.presentation.backgroundMediaAssetId,
          payload
        ),
        configuration
      },
      clubLogoUrl,
      clubName,
      emptyState: birthdays.length
        ? ""
        : configuration.emptyBehavior === "neutral"
          ? "Vandaag staat de vereniging centraal."
          : "",
      orientation: payload.orientation,
      pageDurationMs: configuration.presentation.pageDurationSeconds * 1_000,
      pages: birthdayPages,
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes: {},
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Van harte namens de vereniging",
      templateStyle: "default",
      theme: configuration.presentation.useTenantTheme
        ? theme
        : configuration.presentation.themeMode,
      ...themeIdentity,
      themeTokens: birthdayThemeTokens,
      title: configuration.title
    };
  }

  if (matchSlideTypes.has(payload.slideType)) {
    const item = items[0] ?? null;
    const [homeTeam, awayTeam] = splitTeams(item?.primary ?? "");
    return {
      accentColor: themeTokens.accent,
      clubLogoUrl,
      clubName,
      emptyState,
      orientation: payload.orientation,
      pages: [{ awayTeam, homeTeam, item, kind: "match" }],
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes: {},
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Match centre",
      sportDisplay,
      templateStyle: "default",
      theme,
      ...themeIdentity,
      themeTokens,
      title
    };
  }

  if (
    payload.slideType === "sport_standing" ||
    payload.slideType === "sport_period_standing"
  ) {
    const standingItems = readArray(sport?.items)
      .map((item) => toStandingItem(item, payload))
      .filter((item): item is DynamicTemplateStandingItem => item !== null);
    const competition = readRecord(sport?.competition);
    const pool = readRecord(sport?.pool);
    const standingPinnedTeam = standingItems.find((item) => item.selected);
    const standingPageSize = themeIdentity.designRevision === "royal-current-v8"
      ? payload.orientation === "landscape" ? 7 : 4
      : sportStandingRowsPerPage;
    return {
      accentColor: themeTokens.accent,
      clubLogoUrl: clubLogoUrl ||
        standingItems.find((item) => item.selected && item.logoUrl)?.logoUrl ||
        "",
      clubName,
      emptyState,
      minimumPlaybackMs: themeIdentity.designRevision === "royal-current-v8" &&
        themeIdentity.motionEnabled
        ? royalStandingPlaybackDurationMs(standingItems.length, payload.orientation)
        : undefined,
      orientation: payload.orientation,
      pages: paginateEditorialRows(
        standingItems,
        standingPageSize
      ).map((page) => ({
        items: page,
        kind: "standing" as const
      })),
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes: {},
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Live uit Sportlink Club.Dataservice",
      standingContext: {
        competition: safeText(competition?.name, "Competitie"),
        pool: safeText(pool?.name, ""),
        season: safeText(sport?.season, "")
      },
      standingPinnedTeam,
      sportDisplay,
      templateStyle: "standing-club-edition",
      theme,
      ...themeIdentity,
      themeTokens,
      title
    };
  }

  if (["sport_visitor_arrivals", "sport_referee_arrivals"].includes(payload.slideType)) {
    const arrivalConfig = readRecord(sport?.arrivalConfig);
    const resolvedArrivalConfig = resolveArrivalConfig(arrivalConfig);
    const visitorArrivals = payload.slideType === "sport_visitor_arrivals";
    const royalCurrent = themeIdentity.designRevision === "royal-current-v8";
    const cardsPerPage = visitorArrivals
      ? royalCurrent
        ? safeInteger(arrivalConfig?.cardCount, 1, 3, 3)
        : 2
      : royalCurrent
        ? safeInteger(arrivalConfig?.cardCount, 1, 4, 2)
        : safeInteger(arrivalConfig?.cardCount, 1, 4, 4);
    const pageDurationSeconds = safeInteger(
      arrivalConfig?.pageDurationSeconds ?? sport?.pageDurationSeconds,
      5,
      120,
      5
    );
    return {
      accentColor: themeTokens.accent,
      arrivalConfig: resolvedArrivalConfig,
      arrivalMotionPreset: safeArrivalMotionPreset(arrivalConfig?.motionPreset),
      arrivalSlots: visitorArrivals && royalCurrent ? cardsPerPage : undefined,
      arrivalSponsorUrl: !visitorArrivals && resolvedArrivalConfig.showSponsor
        ? dynamicAssetUrl(
            arrivalConfig ? arrivalConfig.sponsorMediaAssetId : null,
            payload
          )
        : "",
      clubLogoUrl,
      clubName,
      emptyState: items.length ? "" : safeText(
        arrivalConfig?.placeholderText,
        payload.slideType === "sport_visitor_arrivals"
          ? "Er worden nu geen teams verwacht."
          : "Er worden nu geen scheidsrechters verwacht."
      ),
      orientation: payload.orientation,
      pageDurationMs: pageDurationSeconds * 1_000,
      pages: paginate(items, cardsPerPage).map((page) => ({
        items: page,
        kind: "arrivals" as const
      })),
      newsVariant: editorial.newsVariant,
      pricePhotoMode: editorial.pricePhotoMode,
      priceCategoryPhotoModes: {},
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: payload.slideType === "sport_visitor_arrivals"
        ? "Welkom op ons sportpark"
        : "Ontvangst wedstrijdofficials",
      sportDisplay,
      templateStyle: "default",
      theme,
      ...themeIdentity,
      themeTokens,
      title
    };
  }

  const columnMultiplier = payload.orientation === "landscape" &&
    sportDisplay?.columns === "two" ? 2 : 1;
  const royalFixtureFamily = [
    "sport_cancellations",
    "sport_dressing_rooms",
    "sport_officials"
  ].includes(payload.slideType);
  const perPage = themeIdentity.designRevision === "royal-current-v8" &&
    payload.slideType === "sport_sponsor"
    ? 1
    : themeIdentity.designRevision === "royal-current-v8" &&
      payload.slideType === "sport_activities"
      ? 3
    : themeIdentity.designRevision === "royal-current-v8" && royalFixtureFamily
      ? payload.orientation === "portrait" ? 7 : 5
    : payload.slideType === "sport_results"
      ? sportResultsRowsPerPage[payload.orientation] * columnMultiplier
      : payload.slideType === "sport_program"
        ? (payload.orientation === "portrait" ? 7 : 6) * columnMultiplier
        : payload.orientation === "portrait" ? 6 : 8;
  const listPageKind = payload.slideType === "sport_team"
    ? "team"
    : payload.slideType === "sport_sponsor"
      ? "sponsor"
      : payload.slideType === "sport_trainings"
        ? "trainings"
        : payload.slideType === "sport_volunteers"
          ? "volunteers"
          : "sport-list";
  return {
    accentColor: themeTokens.accent,
    clubLogoUrl,
    clubName,
    emptyState,
    orientation: payload.orientation,
    pages: paginate(items, perPage).map((page) => ({
      items: page,
      kind: listPageKind
    })),
    newsVariant: editorial.newsVariant,
    pricePhotoMode: editorial.pricePhotoMode,
    priceCategoryPhotoModes: {},
    providerLogoUrl: "",
    slideType: payload.slideType,
    snapshotId: payload.snapshotId,
    sourceLabel: sportLabel(payload.slideType),
    sportDisplay,
    templateStyle: "default",
    theme,
    ...themeIdentity,
    themeTokens,
    title
  };
}

function resolveBirthdayItems({
  configuration,
  now,
  payload,
  sport
}: {
  configuration: SportlinkBirthdayConfiguration;
  now: Date;
  payload: PlayerDynamicTemplatePayload;
  sport: Record<string, unknown> | null;
}): DynamicTemplateBirthdayItem[] {
  const timezone = safeText(sport?.timezone, "Europe/Amsterdam");
  const fetchedAt = new Date(safeText(sport?.fetchedAt, ""));
  if (!Number.isFinite(fetchedAt.valueOf()) ||
    now.valueOf() - fetchedAt.valueOf() > 21 * 86_400_000) return [];
  const today = localDateParts(now, timezone);
  const maximumDays = configuration.emptyBehavior === "today_only"
    ? 0
    : configuration.period.days - 1;
  return readArray(sport?.birthdays ?? sport?.items).flatMap((value) => {
    const birthday = readRecord(value);
    const displayName = safeText(birthday?.displayName ?? birthday?.primary, "");
    const month = safeInteger(birthday?.month, 1, 12, 0);
    const day = safeInteger(birthday?.day, 1, 31, 0);
    if (!birthday || !displayName || !month || !day) return [];
    const distance = nextBirthdayDistance(today, month, day);
    if (distance < 0 || distance > maximumDays) return [];
    const occurrence = nextBirthdayDate(today, month, day);
    const role = safeText(birthday.role, "");
    const teams = readArray(birthday.teams).flatMap((team) => {
      const value = readRecord(team);
      const name = safeText(value?.name ?? team, "");
      return name ? [name] : [];
    });
    const teamIds = readArray(birthday.teamIds ?? birthday.teams).flatMap((team) => {
      const value = readRecord(team);
      const id = safeText(value?.externalId ?? team, "");
      return id ? [id] : [];
    });
    const teamSelectionMode = configuration.selection.teamSelectionMode ?? (
      configuration.selection.selectedTeamIds.length ? "selected" : "all"
    );
    const includeWithoutTeam = configuration.selection.includeWithoutTeam ??
      teamSelectionMode === "all";
    const selectedTeamMatches = teamIds.some((id) =>
      configuration.selection.selectedTeamIds.includes(id)
    );
    const legacyServerFilteredSnapshot =
      !configuration.selection.showTeam &&
      configuration.selection.selectedTeamIds.length > 0 &&
      configuration.selection.teamSelectionMode === undefined &&
      configuration.selection.includeWithoutTeam === undefined;
    if (teamSelectionMode === "all") {
      if (!includeWithoutTeam && !teamIds.length) return [];
    } else if (
      !selectedTeamMatches &&
      !(includeWithoutTeam && !teamIds.length) &&
      !legacyServerFilteredSnapshot
    ) {
      return [];
    }
    const normalizedRole = role.toLocaleLowerCase("nl-NL");
    const isPlayer = ["speler", "player"].includes(normalizedRole);
    const isStaff = [
      "trainer", "coach", "leider", "staf", "staff", "verzorger", "teammanager"
    ].includes(normalizedRole);
    if (!role && !configuration.selection.includeUnknownRoles) return [];
    if (configuration.selection.roleFilter === "players" && !isPlayer) return [];
    if (configuration.selection.roleFilter === "staff" && !isStaff) return [];
    if (configuration.selection.roleFilter === "selected" &&
      !configuration.selection.selectedRoles.some((selected) =>
        selected.toLocaleLowerCase("nl-NL") === normalizedRole
      )) return [];
    return [{
      age: configuration.selection.showAge
        ? safeNullableInteger(birthday.age)
        : null,
      dateLabel: configuration.selection.showDate
        ? formatBirthdayDate(occurrence, configuration.selection.showDayOfWeek)
        : "",
      day,
      displayName: formatBirthdayName(displayName, configuration.selection.nameMode),
      id: safeText(birthday.id ?? birthday.externalId, `${month}-${day}-${displayName}`),
      isToday: distance === 0,
      meta: [
        configuration.selection.showRole ? role : "",
        configuration.selection.showTeam ? teams.join(", ") : ""
      ].filter(Boolean).join(" · "),
      month,
      photoUrl: configuration.selection.showPhoto
        ? dynamicAssetUrl(birthday.photoMediaAssetId, payload)
        : "",
      role,
      teams
    }];
  }).sort((left, right) => {
    const leftDistance = nextBirthdayDistance(today, left.month, left.day);
    const rightDistance = nextBirthdayDistance(today, right.month, right.day);
    return Number(right.isToday) - Number(left.isToday) ||
      leftDistance - rightDistance ||
      left.displayName.localeCompare(right.displayName, "nl-NL");
  });
}

function resolveBirthdayLayout(
  configured: SportlinkBirthdayConfiguration["presentation"]["layout"],
  count: number
) {
  if (configured !== "auto") return configured;
  if (count <= 1) return "spotlight" as const;
  if (count <= 4) return "celebration_grid" as const;
  return "birthday_roll" as const;
}

function localDateParts(value: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit", month: "2-digit", timeZone: timezone, year: "numeric"
    }).formatToParts(value);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return { day: read("day"), month: read("month"), year: read("year") };
  } catch {
    return { day: value.getUTCDate(), month: value.getUTCMonth() + 1, year: value.getUTCFullYear() };
  }
}

function nextBirthdayDate(
  today: { day: number; month: number; year: number },
  month: number,
  day: number
) {
  const current = Date.UTC(today.year, today.month - 1, today.day);
  for (let year = today.year; year <= today.year + 8; year += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() + 1 === month && candidate.getUTCDate() === day &&
      candidate.valueOf() >= current) return candidate;
  }
  return new Date(NaN);
}

function nextBirthdayDistance(
  today: { day: number; month: number; year: number },
  month: number,
  day: number
) {
  const candidate = nextBirthdayDate(today, month, day);
  if (!Number.isFinite(candidate.valueOf())) return -1;
  return Math.round((candidate.valueOf() - Date.UTC(
    today.year, today.month - 1, today.day
  )) / 86_400_000);
}

function formatBirthdayDate(value: Date, showWeekday: boolean) {
  if (!Number.isFinite(value.valueOf())) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    ...(showWeekday ? { weekday: "long" as const } : {})
  }).format(value);
}

function formatBirthdayName(
  value: string,
  mode: SportlinkBirthdayConfiguration["selection"]["nameMode"]
) {
  const parts = value.trim().split(/\s+/u);
  if (mode === "first") return parts[0] ?? value;
  if (mode === "first_last_initial" && parts.length > 1) {
    return `${parts[0]} ${parts.at(-1)?.[0]?.toLocaleUpperCase("nl-NL")}.`;
  }
  return value;
}

export const welcomeMotionPresets = [
  "aurora-rise",
  "spotlight-bloom",
  "kinetic-split",
  "prism-swipe",
  "grand-flip"
] as const;

export function resolveWelcomeMotionPreset(
  configured: SportlinkArrivalMotionPreset | undefined,
  pageIndex: number,
  itemIndex: number,
  pageSize: number
) {
  if (configured && configured !== "auto") return configured;
  const absoluteIndex = Math.max(0, pageIndex) * Math.max(1, pageSize) +
    Math.max(0, itemIndex);
  return welcomeMotionPresets[absoluteIndex % welcomeMotionPresets.length]!;
}

function safeArrivalMotionPreset(value: unknown): SportlinkArrivalMotionPreset {
  return value === "aurora-rise" || value === "spotlight-bloom" ||
    value === "kinetic-split" || value === "prism-swipe" ||
    value === "grand-flip"
    ? value
    : "auto";
}

function toPriceListSection(
  value: unknown,
  payload: PlayerDynamicTemplatePayload
): ResolvedPriceListSection | null {
  const section = readRecord(value);
  if (!section || (section.column !== "left" && section.column !== "right")) {
    return null;
  }
  const id = safeText(section.id, "");
  const name = safeText(section.name, "");
  if (!id || !name) return null;
  const products = readArray(section.products)
    .map((product) => toPriceListItem(product, payload))
    .filter((product): product is ResolvedPriceListItem => product !== null);
  if (!products.length) return null;
  return {
    column: section.column,
    id,
    name,
    order: safeInteger(section.order, 0, 100_000, 0),
    products
  };
}

function toPriceListItem(
  value: unknown,
  payload: PlayerDynamicTemplatePayload
): ResolvedPriceListItem | null {
  const product = readRecord(value);
  if (!product) return null;
  const id = safeText(product.id, "");
  const name = safeText(product.name, "");
  if (!id || !name) return null;
  const photoVisible = product.photoVisible === true;
  const url = photoVisible
    ? dynamicAssetUrl(product.imageMediaAssetId, payload)
    : "";
  const focalPoint = readRecord(product.imageFocalPoint);
  const x = safeNumber(focalPoint?.x, 0, 1, 0.5);
  const y = safeNumber(focalPoint?.y, 0, 1, 0.5);
  return {
    description: safeText(product.description, ""),
    formattedPrice: safeText(product.formattedPrice, ""),
    id,
    image: url
      ? {
          alt: name,
          kind: "image",
          objectPosition: `${Math.round(x * 100)}% ${Math.round(y * 100)}%`,
          url
        }
      : { kind: "empty" },
    name,
    photoVisible
  };
}

function toStandingItem(
  value: unknown,
  payload: PlayerDynamicTemplatePayload
): DynamicTemplateStandingItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const teamName = safeText(item.teamName, "");
  if (!teamName) return null;
  return {
    drawn: safeNullableInteger(item.drawn),
    form: readStandingForm(item.form),
    goalDifference: safeNullableInteger(item.goalDifference),
    goalsAgainst: safeNullableInteger(item.goalsAgainst),
    goalsFor: safeNullableInteger(item.goalsFor),
    id: safeText(item.id, teamName),
    lost: safeNullableInteger(item.lost),
    logoUrl: dynamicAssetUrl(item.logoMediaAssetId, payload),
    played: safeNullableInteger(item.played),
    points: safeNullableInteger(item.points),
    position: safeNullableInteger(item.position),
    selected: item.selected === true,
    teamName,
    won: safeNullableInteger(item.won),
    zone: ["playoff", "promotion", "relegation"].includes(
      safeText(item.zone, "")
    )
      ? safeText(item.zone, "") as DynamicTemplateStandingItem["zone"]
      : ""
  };
}

function readStandingForm(value: unknown): DynamicTemplateStandingForm[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,;|/-]+/u)
      : [];
  return values.flatMap((entry) => {
    const normalized = typeof entry === "string"
      ? entry.trim().toLowerCase()
      : "";
    if (["w", "win", "winst", "gewonnen"].includes(normalized)) {
      return ["win" as const];
    }
    if (["g", "gl", "draw", "gelijk", "gelijkspel"].includes(normalized)) {
      return ["draw" as const];
    }
    if (["v", "loss", "verlies", "verloren"].includes(normalized)) {
      return ["loss" as const];
    }
    return [];
  }).slice(-3);
}

function parseDynamicTemplatePayload(
  value: unknown
): PlayerDynamicTemplatePayload | null {
  const payload = readRecord(value);
  if (!payload) return null;
  const allowedKeys = new Set([
    "assets",
    "data",
    "orientation",
    "schemaVersion",
    "slideType",
    "snapshotHash",
    "snapshotId",
    "templateSlug",
    "templateVersionId"
  ]);
  if (Object.keys(payload).some((key) => !allowedKeys.has(key))) return null;

  const assets = parseDynamicAssets(payload.assets);
  const data = readRecord(payload.data);
  const orientation = payload.orientation;
  const slideType = payload.slideType;
  const snapshotHash = payload.snapshotHash;
  const snapshotId = payload.snapshotId;
  const templateSlug = payload.templateSlug;
  const templateVersionId = payload.templateVersionId;
  if (
    assets === null ||
    !data ||
    payload.schemaVersion !== 1 ||
    (orientation !== "landscape" && orientation !== "portrait") ||
    !isDynamicSlideType(slideType) ||
    typeof snapshotHash !== "string" ||
    !snapshotHashPattern.test(snapshotHash) ||
    typeof snapshotId !== "string" ||
    !uuidPattern.test(snapshotId) ||
    typeof templateSlug !== "string" ||
    templateSlug !== templateSlug.trim() ||
    !templateSlugPattern.test(templateSlug) ||
    typeof templateVersionId !== "string" ||
    !uuidPattern.test(templateVersionId)
  ) {
    return null;
  }

  return {
    assets,
    data,
    orientation,
    schemaVersion: 1,
    slideType,
    snapshotHash,
    snapshotId,
    templateSlug,
    templateVersionId
  };
}

function parseDynamicAssets(
  value: unknown
): NonNullable<PlayerDynamicTemplatePayload["assets"]> | null {
  if (value === undefined) return {};
  const assets = readRecord(value);
  if (!assets || Object.keys(assets).length > 201) return null;

  const parsed: NonNullable<PlayerDynamicTemplatePayload["assets"]> = {};
  for (const [assetId, candidate] of Object.entries(assets)) {
    const asset = readRecord(candidate);
    const posterKeys = [
      "posterBytes",
      "posterChecksumSha256",
      "posterMimeType",
      "posterUrl"
    ];
    const posterValues = posterKeys.map((key) => asset?.[key]);
    const hasPoster = posterValues.every((entry) => entry !== undefined);
    const incompletePoster = posterValues.some((entry) => entry !== undefined) && !hasPoster;
    if (
      !uuidPattern.test(assetId) ||
      !asset ||
      Object.keys(asset).some(
        (key) =>
          !["bytes", "checksumSha256", "mimeType", "url", ...posterKeys].includes(key)
      ) ||
      !Number.isInteger(asset.bytes) ||
      Number(asset.bytes) <= 0 ||
      Number(asset.bytes) > 524_288_000 ||
      typeof asset.checksumSha256 !== "string" ||
      !snapshotHashPattern.test(asset.checksumSha256) ||
      !isDynamicAssetMimeType(asset.mimeType) ||
      typeof asset.url !== "string" ||
      asset.url.length < 1 ||
      asset.url.length > 4_096 ||
      !isSafeDynamicAssetUrl(asset.url) ||
      incompletePoster ||
      (hasPoster && (
        !Number.isInteger(asset.posterBytes) ||
        Number(asset.posterBytes) <= 0 ||
        Number(asset.posterBytes) > 50_000_000 ||
        typeof asset.posterChecksumSha256 !== "string" ||
        !snapshotHashPattern.test(asset.posterChecksumSha256) ||
        asset.posterMimeType !== "image/png" ||
        typeof asset.posterUrl !== "string" ||
        asset.posterUrl.length < 1 ||
        asset.posterUrl.length > 4_096 ||
        !isSafeDynamicAssetUrl(asset.posterUrl)
      ))
    ) {
      return null;
    }
    parsed[assetId] = {
      bytes: Number(asset.bytes),
      checksumSha256: asset.checksumSha256,
      mimeType: asset.mimeType,
      ...(hasPoster ? {
        posterBytes: Number(asset.posterBytes),
        posterChecksumSha256: String(asset.posterChecksumSha256),
        posterMimeType: "image/png" as const,
        posterUrl: String(asset.posterUrl)
      } : {}),
      url: asset.url
    };
  }
  return parsed;
}

function isDynamicAssetMimeType(
  value: unknown
): value is NonNullable<PlayerDynamicTemplatePayload["assets"]>[string]["mimeType"] {
  return (
    value === "image/gif" ||
    value === "image/jpeg" ||
    value === "image/png" ||
    value === "image/svg+xml" ||
    value === "image/webp" ||
    value === "video/mp4"
  );
}

function isDynamicSlideType(
  value: unknown
): value is PlayerDynamicTemplatePayload["slideType"] {
  return (
    typeof value === "string" &&
    dynamicSlideTypes.has(value as PlayerDynamicTemplatePayload["slideType"])
  );
}

export function formatMatchCentrePageCounter(
  pageIndex: number,
  pageCount: number
) {
  return `${String(pageIndex + 1).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`;
}

export function formatMatchCentreClock(
  value: Date | number | string,
  timezone: string
) {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.valueOf())) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).formatToParts(instant);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return [
      `${read("day")}-${read("month")}-${read("year")}`,
      `${read("hour")}:${read("minute")}`
    ].join(" | ");
  } catch {
    return [
      [
        padClockPart(instant.getUTCDate()),
        padClockPart(instant.getUTCMonth() + 1),
        String(instant.getUTCFullYear())
      ].join("-"),
      [
        padClockPart(instant.getUTCHours()),
        padClockPart(instant.getUTCMinutes())
      ].join(":")
    ].join(" | ");
  }
}

function padClockPart(value: number) {
  return String(value).padStart(2, "0");
}

export function dynamicTemplatePageDurationMs(
  durationSeconds: number,
  pageCount: number,
  configuredPageDurationMs?: number
) {
  if (
    configuredPageDurationMs &&
    Number.isFinite(configuredPageDurationMs)
  ) {
    const perPageDuration = Math.min(120_000, Math.max(5_000, configuredPageDurationMs));
    return pageCount <= 1 ? Math.max(10_000, perPageDuration) : perPageDuration;
  }
  const effectiveDuration = Math.max(
    10_000,
    durationSeconds * 1_000,
    pageCount * 5_000
  );
  if (pageCount <= 1) return effectiveDuration;
  return Math.floor(effectiveDuration / pageCount);
}

export function dynamicTemplateMinimumPlaybackMs(value: unknown) {
  const view = createDynamicTemplateView(value);
  if (!view) return 0;
  return Math.max(
    5_000,
    view.pages.length * (view.pageDurationMs ?? 5_000),
    view.minimumPlaybackMs ?? 0
  );
}

export type DynamicTemplateEligibilityState =
  | "eligible"
  | "ineligible"
  | "invalid"
  | "loading"
  | "stale";

/**
 * Resolves the single content gate used by both the Player and previews. A
 * dynamic slide is playable only when its validated view contains at least
 * one renderable page; empty provider snapshots never become blank frames.
 */
export function evaluateDynamicTemplateEligibility(
  value: unknown,
  now = new Date()
): DynamicTemplateEligibilityState {
  const payload = parseDynamicTemplatePayload(value);
  if (!payload) return "invalid";

  const view = createDynamicTemplateView(payload, now);
  if (!view) return "invalid";
  if (dynamicTemplateHasRenderableContent(view)) return "eligible";

  // A snapshot with an explicit future fetch window is still loading. This
  // keeps the state deterministic while allowing diagnostics to distinguish it
  // from a valid but empty provider result.
  const sport = readRecord(payload.data.sport);
  if (sport?.stale === true || safeText(sport?.status, "") === "stale") {
    return "stale";
  }
  const fetchedAt = Date.parse(safeText(sport?.fetchedAt, ""));
  if (Number.isFinite(fetchedAt) && fetchedAt > now.valueOf()) return "loading";
  return "ineligible";
}

export function dynamicTemplateHasRenderableContent(
  value: unknown | DynamicTemplateView,
  now = new Date()
) {
  const view = isDynamicTemplateView(value)
    ? value
    : createDynamicTemplateView(value, now);
  if (!view) return false;
  return view.pages.some(dynamicTemplatePageHasRenderableContent);
}

export function dynamicTemplateShouldSkip(value: unknown) {
  return evaluateDynamicTemplateEligibility(value) !== "eligible";
}

function isDynamicTemplateView(value: unknown): value is DynamicTemplateView {
  return Boolean(
    value &&
      typeof value === "object" &&
      "pages" in value &&
      Array.isArray((value as { pages?: unknown }).pages)
  );
}

function dynamicTemplatePageHasRenderableContent(page: DynamicTemplatePage) {
  switch (page.kind) {
    case "match":
      return page.item !== null;
    case "menu":
      return page.columns.some((column) => column.length > 0);
    case "menu-v2":
      return page.page.columns.left.length > 0 ||
        page.page.columns.right.length > 0 ||
        page.page.floatingBlocks.length > 0;
    case "price-list":
      return page.page.columns.left.length > 0 || page.page.columns.right.length > 0;
    case "news":
      return page.item !== null || page.secondaryItems.length > 0;
    default:
      return page.items.length > 0;
  }
}

function toMenuItem(
  value: unknown,
  payload: PlayerDynamicTemplatePayload
): DynamicTemplateMenuItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const name = safeText(item.name, "");
  if (!name) return null;
  return {
    category: safeText(item.category, ""),
    description: safeText(item.description, ""),
    id: safeText(item.id, name),
    imageUrl: dynamicAssetUrl(item.imageMediaAssetId, payload),
    imageFocalPoint: readFocalPoint(
      readRecord(payload.data.editorial)?.priceList,
      safeText(item.id, name)
    ),
    name,
    price: formatPrice(item.priceMinor, safeText(item.currency, "EUR")),
    variant: safeText(item.variantLine, "")
  };
}

function toNewsItem(
  value: unknown,
  feed: Record<string, unknown> | null,
  payload: PlayerDynamicTemplatePayload
): DynamicTemplateNewsItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const title = safeText(item.title, "");
  if (!title) return null;
  return {
    author: safeText(item.author, ""),
    date: formatDate(item.publishedAt),
    heroUrl: dynamicAssetUrl(item.heroMediaAssetId, payload),
    id: safeText(item.externalId, title),
    imageFocalPoint: readEditorialNewsFocalPoint(payload.data.editorial),
    intro: safeText(item.intro, ""),
    link: safePublicLink(item.link),
    qrUrl: dynamicAssetUrl(item.qrMediaAssetId, payload),
    source: safeText(item.sourceName, safeText(feed?.sourceName, "Clubnieuws")),
    title
  };
}

function uniqueLatestNewsItems(items: DynamicTemplateNewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = canonicalNewsLink(item.link) || `id:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalNewsLink(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const normalized = key.toLowerCase();
      if (
        normalized.startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(normalized)
      ) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function dynamicAssetUrl(
  value: unknown,
  payload: PlayerDynamicTemplatePayload
) {
  if (typeof value !== "string" || !uuidPattern.test(value)) return "";
  return payload.assets?.[value]?.url ?? "";
}

function safePublicLink(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function isSafeDynamicAssetUrl(value: string) {
  if (
    value.startsWith("/__veyocast-player-cache/") ||
    value.startsWith("blob:")
  ) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function safeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);
  return Number.isInteger(numeric)
    ? Math.min(maximum, Math.max(minimum, numeric))
    : fallback;
}

function safeNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.min(maximum, Math.max(minimum, numeric))
    : fallback;
}

function safeNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= -999 && numeric <= 999
    ? numeric
    : null;
}

function toListItem(
  value: unknown,
  payload: PlayerDynamicTemplatePayload
): DynamicTemplateListItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const primary = safeText(item.primary, "");
  if (!primary) return null;
  const officialAssignments = readArray(item.officials)
    .flatMap((value) => {
      const official = readRecord(value);
      const name = safeText(official?.displayName ?? value, "");
      return name ? [{ name, role: safeText(official?.role, "") }] : [];
    })
    .slice(0, 8);
  return {
    arrivalAt: safeText(item.arrivalAt, ""),
    awayLogoUrl: dynamicAssetUrl(item.awayLogoMediaAssetId, payload),
    awayRoom: safeText(item.awayRoom, ""),
    awayScore: safeNullableScore(item.awayScore),
    awayTeam: safeText(item.awayTeam, ""),
    competition: safeText(item.competition, ""),
    date: safeText(item.date, ""),
    dressingRoom: safeText(item.dressingRoom, ""),
    field: safeText(item.field, ""),
    homeRoom: safeText(item.homeRoom, ""),
    homeMatch: item.homeMatch === true,
    homeLogoUrl: dynamicAssetUrl(item.homeLogoMediaAssetId, payload),
    homeScore: safeNullableScore(item.homeScore),
    homeTeam: safeText(item.homeTeam, ""),
    id: safeText(item.id, primary),
    kickoffAt: safeText(item.kickoffAt, ""),
    kickoffTime: safeText(item.kickoffTime, ""),
    logoUrl: dynamicAssetUrl(item.logoMediaAssetId, payload),
    meta: safeText(item.meta, ""),
    officialAssignments,
    officials: officialAssignments.map((official) => official.name),
    photoUrl: dynamicAssetUrl(item.photoMediaAssetId, payload),
    primary,
    selected: item.selected === true,
    secondary: safeText(item.secondary, ""),
    status: safeText(item.status, ""),
    time: safeText(item.time, ""),
    venue: safeText(item.venue, ""),
    venueName: safeText(item.venueName, "")
  };
}

function resolveVisitorArrivalItems(
  items: DynamicTemplateListItem[],
  now: Date,
  timezone: string,
  royalCurrent = false
) {
  const nowMs = now.getTime();
  return items
    .map((item, index) => ({
      index,
      item: normalizeVisitorArrivalItem(item, timezone, royalCurrent),
      kickoffMs: visitorKickoffMs(item.kickoffAt)
    }))
    .sort((left, right) => {
      const leftUpcoming = left.kickoffMs !== null && left.kickoffMs >= nowMs;
      const rightUpcoming = right.kickoffMs !== null && right.kickoffMs >= nowMs;
      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
      if (left.kickoffMs !== null && right.kickoffMs !== null) {
        return leftUpcoming
          ? left.kickoffMs - right.kickoffMs
          : right.kickoffMs - left.kickoffMs;
      }
      if (left.kickoffMs !== null) return -1;
      if (right.kickoffMs !== null) return 1;
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function normalizeVisitorArrivalItem(
  item: DynamicTemplateListItem,
  timezone: string,
  royalCurrent = false
) {
  const kickoffTime = visitorArrivalClock(item);
  const field = visitorArrivalValue(item.field, "field") ||
    visitorArrivalValue(visitorMetaValue(item.meta, "field"), "field");
  const awayRoom = visitorArrivalValue(item.awayRoom, "dressing-room") ||
    visitorArrivalValue(item.dressingRoom, "dressing-room") ||
    visitorArrivalValue(visitorMetaValue(item.meta, "dressing-room"), "dressing-room");
  const homeRoom = visitorArrivalValue(item.homeRoom, "dressing-room");
  return {
    ...item,
    logoUrl: item.awayLogoUrl || item.logoUrl,
    awayRoom,
    date: item.date || formatVisitorArrivalDate(item.kickoffAt, timezone),
    dressingRoom: awayRoom,
    field,
    homeRoom,
    kickoffTime,
    meta: royalCurrent ? `Omkleden: ${awayRoom || "-"}` : `Kleedkamer: ${awayRoom || "-"}`,
    secondary: royalCurrent
      ? `Aftrap: ${kickoffTime || "-"} | Locatie: ${field || "-"}`
      : `Aanvang: ${kickoffTime || "-"} | Veld ${field || "-"}`
  };
}

export function formatVisitorArrivalDate(value: string, timezone: string) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.valueOf())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).formatToParts(instant);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${read("day")}-${read("month")}-${read("year")}`;
  } catch {
    return [
      padClockPart(instant.getUTCDate()),
      padClockPart(instant.getUTCMonth() + 1),
      String(instant.getUTCFullYear())
    ].join("-");
  }
}

export function formatVisitorVenueWelcome(value: string) {
  const venue = value.replace(/\s+/gu, " ").trim();
  if (!venue) return "Welkom op ons sportpark!";
  return `Welkom op ${venue}!`;
}

function visitorArrivalClock(item: DynamicTemplateListItem) {
  for (const candidate of [item.kickoffTime, item.time]) {
    const match = candidate.match(/(?:^|\s)([0-2]?\d:[0-5]\d)(?:\s|$)/);
    if (match?.[1]) return match[1].padStart(5, "0");
  }
  const secondaryMatch = item.secondary.match(
    /\bAanvang\s*:?\s*([0-2]?\d:[0-5]\d)\b/i
  );
  return secondaryMatch?.[1]?.padStart(5, "0") ?? "";
}

function visitorMetaValue(
  meta: string,
  kind: "dressing-room" | "field"
) {
  const pattern = kind === "field"
    ? /\bVeld\s*:?\s*([^·|]+)/i
    : /\bKleedkamer\s*:?\s*([^·|]+)/i;
  return meta.match(pattern)?.[1] ?? "";
}

function visitorArrivalValue(
  value: string,
  kind: "dressing-room" | "field"
) {
  const prefix = kind === "field"
    ? /^\s*Veld\s*:?\s*/i
    : /^\s*Kleedkamer\s*:?\s*/i;
  const normalized = value.replace(prefix, "").trim();
  return /^(?:volgt|onbekend|unknown|n\.?\/a\.?|n\.v\.?)$/iu.test(normalized)
    ? ""
    : normalized;
}

function visitorKickoffMs(value: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPriceListPages(
  items: DynamicTemplateMenuItem[],
  orientation: PlayerDynamicTemplatePayload["orientation"],
  configuredColumns?: {
    left: Array<{ category: string; kind: "category" } | { kind: "product"; productId: string }>;
    right: Array<{ category: string; kind: "category" } | { kind: "product"; productId: string }>;
  },
  royalCurrent = false
) {
  if (royalCurrent) {
    const products = new Map(items.map((item) => [item.id, item]));
    const configuredEntries = (configured: NonNullable<typeof configuredColumns>["left"]) =>
      configured.flatMap((entry): DynamicTemplatePriceEntry[] => {
        if (entry.kind === "category") {
          return [{
            id: `category-${entry.category.toLocaleLowerCase("nl-NL")}`,
            kind: "category",
            name: entry.category
          }];
        }
        const item = products.get(entry.productId);
        return item ? [{ item, kind: "product" }] : [];
      });
    const entries = configuredColumns
      ? [
          ...configuredEntries(configuredColumns.left),
          ...configuredEntries(configuredColumns.right)
        ]
      : menuEntriesFromItems(items);
    return buildRoyalMenuPages(entries, orientation);
  }
  if (configuredColumns) {
    const products = new Map(items.map((item) => [item.id, item]));
    const resolve = (configured: typeof configuredColumns.left) => configured
      .flatMap((entry): DynamicTemplatePriceEntry[] => {
        if (entry.kind === "category") {
          return [{
            id: `category-${entry.category.toLocaleLowerCase("nl-NL")}`,
            kind: "category",
            name: entry.category
          }];
        }
        const item = products.get(entry.productId);
        return item ? [{ item, kind: "product" }] : [];
      });
    const columns = [
      resolve(configuredColumns.left),
      resolve(configuredColumns.right)
    ] as const;
    const rowsPerColumn = priceRowsThatFit(orientation);
    const pageCount = Math.max(
      1,
      Math.ceil(columns[0].length / rowsPerColumn),
      Math.ceil(columns[1].length / rowsPerColumn)
    );
    return Array.from({ length: pageCount }, (_, index) => ({
      columns: [
        columns[0].slice(index * rowsPerColumn, (index + 1) * rowsPerColumn),
        columns[1].slice(index * rowsPerColumn, (index + 1) * rowsPerColumn)
      ] as [DynamicTemplatePriceEntry[], DynamicTemplatePriceEntry[]],
      kind: "menu" as const
    }));
  }
  const entries: DynamicTemplatePriceEntry[] = [];
  let currentCategory = "";
  for (const item of items) {
    const category = item.category || "Overig";
    if (category !== currentCategory) {
      entries.push({
        id: `category-${category.toLocaleLowerCase("nl-NL")}`,
        kind: "category",
        name: category
      });
      currentCategory = category;
    }
    entries.push({ item, kind: "product" });
  }
  const rowsPerColumn = priceRowsThatFit(orientation);
  const rowsPerPage = rowsPerColumn * 2;
  const chunks = paginate(entries, rowsPerPage);
  return chunks.map((chunk) => ({
    columns: [
      chunk.slice(0, rowsPerColumn),
      chunk.slice(rowsPerColumn, rowsPerPage)
    ] as [DynamicTemplatePriceEntry[], DynamicTemplatePriceEntry[]],
    kind: "menu" as const
  }));
}

function menuEntriesFromItems(items: DynamicTemplateMenuItem[]) {
  const entries: DynamicTemplatePriceEntry[] = [];
  let currentCategory = "";
  for (const item of items) {
    const category = item.category || "Overig";
    if (category !== currentCategory) {
      entries.push({
        id: `category-${category.toLocaleLowerCase("nl-NL")}`,
        kind: "category",
        name: category
      });
      currentCategory = category;
    }
    entries.push({ item, kind: "product" });
  }
  return entries;
}

function buildRoyalMenuPages(
  entries: DynamicTemplatePriceEntry[],
  orientation: PlayerDynamicTemplatePayload["orientation"]
) {
  const groups: Array<{ id: string; name: string; products: DynamicTemplateMenuItem[] }> = [];
  let active: (typeof groups)[number] | undefined;
  for (const entry of entries) {
    if (entry.kind === "category") {
      active = { id: entry.id, name: entry.name, products: [] };
      groups.push(active);
      continue;
    }
    const category = entry.item.category || "Overig";
    if (!active || active.name !== category) {
      active = {
        id: `category-${category.toLocaleLowerCase("nl-NL")}`,
        name: category,
        products: []
      };
      groups.push(active);
    }
    active.products.push(entry.item);
  }
  const productsPerPanel = orientation === "portrait" ? 6 : 5;
  const panels = groups.flatMap((group) => paginate(group.products, productsPerPanel)
    .map((products, index): DynamicTemplatePriceEntry[] => [
      {
        id: `${group.id}-${index}`,
        kind: "category",
        name: group.name
      },
      ...products.map((item) => ({ item, kind: "product" as const }))
    ]));
  return paginate(panels, 2).map((page) => ({
    columns: [page[0] ?? [], page[1] ?? []] as [
      DynamicTemplatePriceEntry[],
      DynamicTemplatePriceEntry[]
    ],
    kind: "menu" as const
  }));
}

function readFocalPoint(value: unknown, productId: string): EditorialFocalPoint {
  const priceList = readRecord(value);
  const points = readRecord(priceList?.productFocalPoints);
  return normalizeFocalPoint(points?.[productId]);
}

function readEditorialNewsFocalPoint(value: unknown): EditorialFocalPoint {
  const editorial = readRecord(value);
  return normalizeFocalPoint(editorial?.newsFocalPoint);
}

function normalizeFocalPoint(value: unknown): EditorialFocalPoint {
  const point = readRecord(value);
  const x = Number(point?.x);
  const y = Number(point?.y);
  return {
    x: Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5,
    y: Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : 0.5
  };
}

function buildNewsPages(
  articles: DynamicTemplateNewsItem[],
  variant: EditorialNewsVariant,
  royalCurrent = false
) {
  if (!articles.length) {
    return [{ item: null, kind: "news" as const, secondaryItems: [] }];
  }
  if (variant !== "news_grid") {
    return articles.map((item) => ({
      item,
      kind: "news" as const,
      secondaryItems: []
    }));
  }
  return paginate(articles, royalCurrent ? 2 : 3).map(([item, ...secondaryItems]) => ({
    item: item ?? null,
    kind: "news" as const,
    secondaryItems
  }));
}

function resolveArrivalConfig(
  value: Record<string, unknown> | null
): DynamicTemplateArrivalConfig {
  const enabled = (key: string, fallback: boolean) =>
    typeof value?.[key] === "boolean" ? value[key] as boolean : fallback;
  return {
    dutyDeskText: safeText(value?.dutyDeskText, ""),
    showArrivalTime: enabled("showArrivalTime", true),
    showClubLogo: enabled("showClubLogo", true),
    showCompetition: enabled("showCompetition", false),
    showDressingRoom: enabled("showDressingRoom", true),
    showField: enabled("showField", true),
    showKickoffTime: enabled("showKickoffTime", true),
    showSponsor: enabled("showSponsor", false),
    showWelcome: enabled("showWelcome", true),
    welcomeText: safeText(value?.welcomeText, "Welkom bij {{club}}")
  };
}

function safeNullableScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 999
    ? numeric
    : null;
}

function paginate<T>(items: T[], perPage: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage));
  }
  return pages;
}

function splitTeams(value: string) {
  const parts = value.split(/\s+[–—-]\s+/).map((part) => part.trim());
  return [
    (parts.length > 0 ? parts[0] : "") || "Thuisteam",
    parts.slice(1).join(" – ") || "Uitteam"
  ] as const;
}

function formatPrice(value: unknown, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat("nl-NL", {
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
      style: "currency"
    }).format(amount / 100);
  } catch {
    return `€ ${(amount / 100).toFixed(2).replace(".", ",")}`;
  }
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "long",
      timeZone: "Europe/Amsterdam",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function safeText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 500) : fallback;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown, maximum = 40): unknown[] {
  return Array.isArray(value) ? value.slice(0, maximum) : [];
}

function sportTitle(slideType: PlayerDynamicTemplatePayload["slideType"]) {
  const titles: Partial<
    Record<PlayerDynamicTemplatePayload["slideType"], string>
  > = {
    sport_activities: "Clubagenda",
    sport_cancellations: "Afgelastingen",
    sport_dressing_rooms: "Veld- en kleedkamerindeling",
    sport_match_of_the_day: "Wedstrijd van de dag",
    sport_next_match: "Volgende wedstrijd",
    sport_officials: "Wedstrijdofficials",
    sport_period_standing: "Periodestand",
    sport_program: "Programma van vandaag",
    sport_referee_arrivals: "Aankomst scheidsrechters",
    sport_results: "Uitslagen",
    sport_sponsor: "Partner van de week",
    sport_standing: "Stand",
    sport_visitor_arrivals: "Welkom bezoekende teams"
  };
  return titles[slideType] ?? "Clubnieuws";
}

function sportLabel(slideType: PlayerDynamicTemplatePayload["slideType"]) {
  if (slideType === "sport_visitor_arrivals") return "Welkom op ons sportpark";
  if (slideType === "sport_referee_arrivals") return "Ontvangst wedstrijdofficials";
  if (slideType.includes("standing")) return "Competitie";
  if (slideType === "sport_results") return "Laatste uitslagen";
  if (slideType === "sport_cancellations") return "Clubmelding";
  if (slideType === "sport_activities") return "Op de club";
  return "Wedstrijdcentrum";
}

function sportEmptyState(code: string) {
  const messages: Record<string, string> = {
    DATASET_DISABLED_OR_EMPTY: "Deze informatie is nog niet beschikbaar.",
    NO_ACTIVITIES: "Er staan nu geen activiteiten gepland.",
    NO_ITEMS_IN_PERIOD: "Er zijn geen wedstrijden in deze periode.",
    RESULTS_NOT_PUBLISHED: "Er zijn nog geen uitslagen gepubliceerd.",
    STANDINGS_NOT_PUBLISHED: "De stand is nog niet gepubliceerd."
  };
  return messages[code] ?? "Deze informatie is nu niet beschikbaar.";
}
