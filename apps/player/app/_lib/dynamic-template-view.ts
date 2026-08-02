import {
  playerDynamicTemplatePayloadSchema,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";

export type DynamicTemplateTheme = "dark" | "light";

export type DynamicTemplateListItem = {
  id: string;
  meta: string;
  primary: string;
  secondary: string;
  status: string;
};

export type DynamicTemplateMenuItem = {
  category: string;
  description: string;
  id: string;
  name: string;
  price: string;
};

export type DynamicTemplateNewsItem = {
  date: string;
  id: string;
  intro: string;
  source: string;
  title: string;
};

export type DynamicTemplatePage =
  | { items: DynamicTemplateMenuItem[]; kind: "menu" }
  | { item: DynamicTemplateNewsItem | null; kind: "news" }
  | {
      awayTeam: string;
      homeTeam: string;
      item: DynamicTemplateListItem | null;
      kind: "match";
    }
  | { items: DynamicTemplateListItem[]; kind: "sport-list" };

export type DynamicTemplateView = {
  accentColor: string;
  emptyState: string;
  orientation: PlayerDynamicTemplatePayload["orientation"];
  pages: DynamicTemplatePage[];
  slideType: PlayerDynamicTemplatePayload["slideType"];
  snapshotId: string;
  sourceLabel: string;
  theme: DynamicTemplateTheme;
  title: string;
};

const matchSlideTypes = new Set([
  "sport_match_of_the_day",
  "sport_next_match"
]);

export function createDynamicTemplateView(
  value: unknown
): DynamicTemplateView | null {
  const parsed = playerDynamicTemplatePayloadSchema.safeParse(value);
  if (!parsed.success) return null;
  const payload = parsed.data;
  const data = payload.data;
  const accentColor = safeColor(
    readRecord(data.brand)?.primaryColor,
    "#f15a24"
  );
  const theme: DynamicTemplateTheme = payload.templateSlug.includes("dark")
    ? "dark"
    : "light";

  if (payload.slideType === "menu") {
    const menu = readRecord(data.menu) ?? readRecord(data.data);
    const items = readArray(menu?.products)
      .map(toMenuItem)
      .filter((item): item is DynamicTemplateMenuItem => item !== null);
    return {
      accentColor,
      emptyState: items.length ? "" : "Er zijn nu geen beschikbare producten.",
      orientation: payload.orientation,
      pages: paginate(items, payload.orientation === "portrait" ? 10 : 8).map(
        (page) => ({ items: page, kind: "menu" as const })
      ),
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Clubkantine",
      theme,
      title: safeText(menu?.title, "Menu vandaag")
    };
  }

  if (payload.slideType === "news") {
    const news = readRecord(data.news) ?? readRecord(data.data);
    const articles = readArray(news?.articles)
      .map((article) => toNewsItem(article, news))
      .filter((item): item is DynamicTemplateNewsItem => item !== null);
    return {
      accentColor,
      emptyState: articles.length ? "" : "Er zijn nu geen nieuwsberichten.",
      orientation: payload.orientation,
      pages: (articles.length ? articles : [null]).map((item) => ({
        item,
        kind: "news" as const
      })),
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: safeText(news?.sourceName, "Clubnieuws"),
      theme,
      title: safeText(news?.title, "Clubnieuws")
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
      emptyState,
      orientation: payload.orientation,
      pages: [{ awayTeam, homeTeam, item, kind: "match" }],
      slideType: payload.slideType,
      snapshotId: payload.snapshotId,
      sourceLabel: "Match centre",
      theme,
      title
    };
  }

  const perPage = payload.orientation === "portrait" ? 6 : 8;
  return {
    accentColor,
    emptyState,
    orientation: payload.orientation,
    pages: paginate(items, perPage).map((page) => ({
      items: page,
      kind: "sport-list" as const
    })),
    slideType: payload.slideType,
    snapshotId: payload.snapshotId,
    sourceLabel: sportLabel(payload.slideType),
    theme,
    title
  };
}

export function dynamicTemplatePageDurationMs(
  durationSeconds: number,
  pageCount: number
) {
  if (pageCount <= 1) return Math.max(5_000, durationSeconds * 1_000);
  return Math.max(4_000, Math.floor((durationSeconds * 1_000) / pageCount));
}

function toMenuItem(value: unknown): DynamicTemplateMenuItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const name = safeText(item.name, "");
  if (!name) return null;
  return {
    category: safeText(item.category, ""),
    description: safeText(item.description, ""),
    id: safeText(item.id, name),
    name,
    price: formatPrice(item.priceMinor, safeText(item.currency, "EUR"))
  };
}

function toNewsItem(
  value: unknown,
  feed: Record<string, unknown> | null
): DynamicTemplateNewsItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const title = safeText(item.title, "");
  if (!title) return null;
  return {
    date: formatDate(item.publishedAt),
    id: safeText(item.externalId, title),
    intro: safeText(item.intro, ""),
    source: safeText(item.sourceName, safeText(feed?.sourceName, "Clubnieuws")),
    title
  };
}

function toListItem(value: unknown): DynamicTemplateListItem | null {
  const item = readRecord(value);
  if (!item) return null;
  const primary = safeText(item.primary, "");
  if (!primary) return null;
  return {
    id: safeText(item.id, primary),
    meta: safeText(item.meta, ""),
    primary,
    secondary: safeText(item.secondary, ""),
    status: safeText(item.status, "")
  };
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
