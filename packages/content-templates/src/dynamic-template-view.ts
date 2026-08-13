import {
  editorialArenaActiveSlideTypes,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";

import {
  paginatePriceList,
  type PriceListRenderPage,
  type ResolvedPriceListItem,
  type ResolvedPriceListSection
} from "./price-list";

export type DynamicTemplateTheme = "dark" | "light";

export type DynamicTemplateListItem = {
  awayRoom: string;
  awayScore: number | null;
  awayTeam: string;
  competition: string;
  date: string;
  homeRoom: string;
  homeScore: number | null;
  homeTeam: string;
  id: string;
  meta: string;
  officials: string[];
  primary: string;
  secondary: string;
  status: string;
  time: string;
  venue: string;
};

export type DynamicTemplateMenuItem = {
  category: string;
  description: string;
  id: string;
  imageUrl: string;
  name: string;
  price: string;
  variant: string;
};

export type DynamicTemplateNewsItem = {
  author: string;
  date: string;
  heroUrl: string;
  id: string;
  intro: string;
  link: string;
  qrUrl: string;
  source: string;
  title: string;
};

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
};

export type DynamicTemplateStandingForm = "draw" | "loss" | "win";

export type DynamicTemplatePage =
  | { items: DynamicTemplateMenuItem[]; kind: "menu" }
  | { kind: "price-list"; page: PriceListRenderPage }
  | { item: DynamicTemplateNewsItem | null; kind: "news" }
  | {
      awayTeam: string;
      homeTeam: string;
      item: DynamicTemplateListItem | null;
      kind: "match";
    }
  | { items: DynamicTemplateStandingItem[]; kind: "standing" }
  | { items: DynamicTemplateListItem[]; kind: "sport-list" };

export type DynamicTemplateView = {
  accentColor: string;
  clubLogoUrl: string;
  clubName: string;
  emptyState: string;
  orientation: PlayerDynamicTemplatePayload["orientation"];
  pageDurationMs?: number;
  pages: DynamicTemplatePage[];
  providerLogoUrl: string;
  slideType: PlayerDynamicTemplatePayload["slideType"];
  snapshotId: string;
  sourceLabel: string;
  standingContext?: {
    competition: string;
    pool: string;
    season: string;
  };
  templateStyle: "default" | "standing-club-edition";
  theme: DynamicTemplateTheme;
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
  "sport_results",
  "sport_sponsor",
  "sport_standing",
  "sport_team",
  "sport_trainings",
  "sport_volunteers"
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const snapshotHashPattern = /^[a-f0-9]{64}$/;
const templateSlugPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;

export function createDynamicTemplateView(
  value: unknown
): DynamicTemplateView | null {
  const payload = parseDynamicTemplatePayload(value);
  if (!payload) return null;
  if (
    !editorialArenaActiveSlideTypes.includes(
      payload.slideType as (typeof editorialArenaActiveSlideTypes)[number]
    )
  ) {
    return null;
  }
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

  if (payload.slideType === "menu") {
    const menu = readRecord(data.menu) ?? readRecord(data.data);
    const items = readArray(menu?.products)
      .map((item) => toMenuItem(item, payload))
      .filter((item): item is DynamicTemplateMenuItem => item !== null);
    return {
      accentColor,
      clubLogoUrl,
      clubName,
      emptyState: items.length ? "" : "Er zijn nu geen beschikbare producten.",
      orientation: payload.orientation,
      pages: paginate(items, payload.orientation === "portrait" ? 10 : 8).map(
        (page) => ({ items: page, kind: "menu" as const })
      ),
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Clubkantine",
      templateStyle: "default",
      theme,
      title: safeText(menu?.title, "Menu vandaag")
    };
  }

  if (payload.slideType === "price_list") {
    const priceList = readRecord(data.priceList);
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
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Prijzen uit de clubkantine",
      templateStyle: "default",
      theme,
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
      accentColor,
      clubLogoUrl,
      clubName,
      emptyState: articles.length ? "" : "Er zijn nu geen nieuwsberichten.",
      orientation: payload.orientation,
      pageDurationMs: secondsPerSlide * 1_000,
      pages: (articles.length ? articles : [null]).map((item) => ({
        item,
        kind: "news" as const
      })),
      providerLogoUrl: dynamicAssetUrl(
        news?.providerLogoMediaAssetId,
        payload
      ),
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: safeText(news?.sourceName, "Clubnieuws"),
      templateStyle: "default",
      theme,
      title: safeText(news?.title, "Nieuws")
    };
  }

  const sport = readRecord(data.sport);
  const items = readArray(sport?.items)
    .map(toListItem)
    .filter((item): item is DynamicTemplateListItem => item !== null);
  const title = safeText(sport?.title, sportTitle(payload.slideType));
  const emptyState = items.length
    ? ""
    : sportEmptyState(safeText(sport?.emptyStateCode, ""));

  if (matchSlideTypes.has(payload.slideType)) {
    const item = items[0] ?? null;
    const [homeTeam, awayTeam] = splitTeams(item?.primary ?? "");
    return {
      accentColor,
      clubLogoUrl,
      clubName,
      emptyState,
      orientation: payload.orientation,
      pages: [{ awayTeam, homeTeam, item, kind: "match" }],
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Match centre",
      templateStyle: "default",
      theme,
      title
    };
  }

  if (
    payload.slideType === "sport_standing"
  ) {
    const standingItems = readArray(sport?.items)
      .map((item) => toStandingItem(item, payload))
      .filter((item): item is DynamicTemplateStandingItem => item !== null);
    const competition = readRecord(sport?.competition);
    const pool = readRecord(sport?.pool);
    const perPage = payload.orientation === "portrait" ? 18 : 10;
    return {
      accentColor,
      clubLogoUrl: clubLogoUrl ||
        standingItems.find((item) => item.selected && item.logoUrl)?.logoUrl ||
        "",
      clubName,
      emptyState,
      orientation: payload.orientation,
      pages: paginate(standingItems, perPage).map((page) => ({
        items: page,
        kind: "standing" as const
      })),
      providerLogoUrl: "",
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Live uit Sportlink Club.Dataservice",
      standingContext: {
        competition: safeText(competition?.name, "Competitie"),
        pool: safeText(pool?.name, ""),
        season: safeText(sport?.season, "")
      },
      templateStyle: "standing-club-edition",
      theme,
      title
    };
  }

  const perPage = payload.orientation === "portrait" ? 6 : 8;
  return {
    accentColor,
    clubLogoUrl,
    clubName,
    emptyState,
    orientation: payload.orientation,
    pages: paginate(items, perPage).map((page) => ({
      items: page,
      kind: "sport-list" as const
    })),
    providerLogoUrl: "",
    slideType: payload.slideType,
    snapshotId: payload.snapshotId,
    sourceLabel: sportLabel(payload.slideType),
    templateStyle: "default",
    theme,
    title
  };
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
    won: safeNullableInteger(item.won)
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
    if (
      !uuidPattern.test(assetId) ||
      !asset ||
      Object.keys(asset).some(
        (key) =>
          !["bytes", "checksumSha256", "mimeType", "url"].includes(key)
      ) ||
      !Number.isInteger(asset.bytes) ||
      Number(asset.bytes) <= 0 ||
      Number(asset.bytes) > 8_000_000 ||
      typeof asset.checksumSha256 !== "string" ||
      !snapshotHashPattern.test(asset.checksumSha256) ||
      !isDynamicImageMimeType(asset.mimeType) ||
      typeof asset.url !== "string" ||
      asset.url.length < 1 ||
      asset.url.length > 4_096 ||
      !isSafeDynamicAssetUrl(asset.url)
    ) {
      return null;
    }
    parsed[assetId] = {
      bytes: Number(asset.bytes),
      checksumSha256: asset.checksumSha256,
      mimeType: asset.mimeType,
      url: asset.url
    };
  }
  return parsed;
}

function isDynamicImageMimeType(
  value: unknown
): value is "image/jpeg" | "image/png" | "image/webp" {
  return (
    value === "image/jpeg" ||
    value === "image/png" ||
    value === "image/webp"
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

export function dynamicTemplatePageDurationMs(
  durationSeconds: number,
  pageCount: number,
  configuredPageDurationMs?: number
) {
  if (
    configuredPageDurationMs &&
    Number.isFinite(configuredPageDurationMs)
  ) {
    return Math.min(120_000, Math.max(5_000, configuredPageDurationMs));
  }
  const effectiveDuration = Math.max(
    5_000,
    durationSeconds * 1_000,
    pageCount * 5_000
  );
  if (pageCount <= 1) return effectiveDuration;
  return Math.floor(effectiveDuration / pageCount);
}

export function dynamicTemplateMinimumPlaybackMs(value: unknown) {
  const view = createDynamicTemplateView(value);
  return view
    ? Math.max(5_000, view.pages.length * (view.pageDurationMs ?? 5_000))
    : 0;
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
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= -999 && numeric <= 999
    ? numeric
    : null;
}

function toListItem(value: unknown): DynamicTemplateListItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const primary = safeText(item.primary, "");
  if (!primary) return null;
  return {
    awayRoom: safeText(item.awayRoom, ""),
    awayScore: safeNullableScore(item.awayScore),
    awayTeam: safeText(item.awayTeam, ""),
    competition: safeText(item.competition, ""),
    date: safeText(item.date, ""),
    homeRoom: safeText(item.homeRoom, ""),
    homeScore: safeNullableScore(item.homeScore),
    homeTeam: safeText(item.homeTeam, ""),
    id: safeText(item.id, primary),
    meta: safeText(item.meta, ""),
    officials: readArray(item.officials)
      .flatMap((value) => {
        const official = readRecord(value);
        const name = safeText(official?.displayName, "");
        return name ? [name] : [];
      })
      .slice(0, 8),
    primary,
    secondary: safeText(item.secondary, ""),
    status: safeText(item.status, ""),
    time: safeText(item.time, ""),
    venue: safeText(item.venue, "")
  };
}

function safeNullableScore(value: unknown) {
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

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, 40) : [];
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
    sport_results: "Uitslagen",
    sport_sponsor: "Partner van de week",
    sport_standing: "Stand"
  };
  return titles[slideType] ?? "Clubnieuws";
}

function sportLabel(slideType: PlayerDynamicTemplatePayload["slideType"]) {
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
