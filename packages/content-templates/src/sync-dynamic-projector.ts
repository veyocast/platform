import {
  playerDynamicTemplatePayloadSchema,
  syncDynamicFamilyMatches,
  syncSlidePresentationSchema,
  isSyncOnzeTrotsPresentation,
  type PlayerDynamicTemplatePayload,
  type SyncSlideAsset,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import {
  createCompleteDynamicTemplateView,
  type DynamicTemplateListItem,
} from "./dynamic-template-view";
import {
  readSitesLedStateFromCanonicalPayload,
  type SitesLedMatchProjection,
} from "./sites-dynamic-projector";
import {
  formatMenuMoney,
  resolveMenuProductPrice,
  resolveMenuGroupPrice,
} from "./menu-scene-model";
import {enrichSyncOnzeTrotsProjection,SyncCanonicalIdentityError} from './sync-onzetrots-projector';

export {syncDynamicFamilies} from '@veyocast/contracts';

export type SyncDynamicProjection =
  | { ok: true; presentation: SyncSlidePresentation }
  | {
      ok: false;
      code:
        | "SYNC_SNAPSHOT_INVALID"
        | "SYNC_FAMILY_SCOPE_MISMATCH"
        | "SYNC_CANONICAL_DATA_UNAVAILABLE"
        | "SYNC_CANONICAL_IDENTITY_INVALID"
        | "SYNC_CANONICAL_FRESHNESS_INVALID"
        | "SYNC_PROJECTION_INVALID"
        | "SYNC_PRESENTATION_BOUNDS_EXCEEDED";
    };

/** Only an asset from the already verified canonical snapshot manifest can resolve a provider image. */
export function resolveSyncDynamicAsset(
  payload: PlayerDynamicTemplatePayload,
  asset: SyncSlideAsset,
): string | undefined {
  if (asset.kind === "system") return asset.path;
  const actual = payload.assets?.[asset.mediaAssetId];
  return actual &&
    actual.checksumSha256 === asset.checksumSha256 &&
    actual.mimeType.startsWith("image/")
    ? actual.url
    : undefined;
}

/** All provider rows are projected from the existing typed read model. No provider fetch,
 * store, demo fallback or parsing of formatted prices/scores back into domain data. */
export function projectSyncDynamicSnapshot(
  value: unknown,
  seed: SyncSlidePresentation,
  now = new Date(),
  liveState?: SitesLedMatchProjection | null,
): SyncDynamicProjection {
  const parsed = playerDynamicTemplatePayloadSchema.safeParse(value),
    base = syncSlidePresentationSchema.safeParse(seed);
  if (!parsed.success || !base.success)
    return { ok: false, code: "SYNC_SNAPSHOT_INVALID" };
  const payload = parsed.data,
    slide = base.data;
  if (
    payload.orientation !== slide.orientation ||
    !syncDynamicFamilyMatches(payload.slideType,slide.family,slide.rendererVersion)
  )
    return { ok: false, code: "SYNC_FAMILY_SCOPE_MISMATCH" };
  const image = (
    url: string | null | undefined,
  ): SyncSlideAsset | undefined => {
    if (!url) return undefined;
    const entry = Object.entries(payload.assets ?? {}).find(
      ([, asset]) => asset.url === url && asset.mimeType.startsWith("image/"),
    );
    return entry
      ? {
          kind: "tenant",
          mediaAssetId: entry[0],
          checksumSha256: entry[1].checksumSha256,
        }
      : undefined;
  };
  try {
    if (payload.slideType === "ledscores_live_match") {
      const live=payload.data.liveMatch as {configuration?:{showClock?:unknown};state?:{status?:unknown;matchKey?:unknown;stateRevision?:unknown}}|undefined;
      if(!liveState&&(live?.state?.status==='unknown'&&live.state.stateRevision===0||(typeof live?.state?.matchKey==='string'&&live.state.matchKey.startsWith('waiting:')))){
        return {ok:true,presentation:syncSlidePresentationSchema.parse({...slide,state:'empty',rows:[],news:[],ownRowIndexes:[],home:undefined,away:undefined,match:undefined,poll:undefined})};
      }
      const state =
        liveState ?? readSitesLedStateFromCanonicalPayload(payload, now);
      if (!state) return { ok: false, code: "SYNC_CANONICAL_DATA_UNAVAILABLE" };
      return {
        ok: true,
        presentation: syncSlidePresentationSchema.parse({
          ...slide,
          state: "ready",
          ...(isSyncOnzeTrotsPresentation(slide)?{rich:{phase:({pre_match:'scheduled',live:'live',paused:'paused',half_time:'halftime',finished:'finished'} as Record<string,string>)[String((payload.data.liveMatch as {state?:{status?:unknown}}|undefined)?.state?.status)]??'unknown'}}:{}),
          rows: [],
          news: [],
          ownRowIndexes: [],
          poll: undefined,
          home: {
            name: state.home.name,
            team: "",
            logo: image(state.home.logoUrl),
          },
          away: {
            name: state.away.name,
            team: "",
            logo: image(state.away.logoUrl),
          },
          match: {
            homeScore: String(state.home.score),
            awayScore: String(state.away.score),
            clock: isSyncOnzeTrotsPresentation(slide)&&live?.configuration?.showClock===false?'':state.clockLabel ?? "",
            date: "",
            time: "",
          },
        }),
      };
    }
    const record = (value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value);
    const body =
      payload.slideType === "news"
        ? payload.data.news
        : payload.slideType === "menu"
          ? (payload.data.menuDocument ??
            payload.data.menu ??
            payload.data.data)
          : payload.slideType === "price_list"
            ? payload.data.priceList
            : payload.data.sport;
    if (!record(body) || payload.data.type !== payload.slideType)
      return { ok: false, code: "SYNC_CANONICAL_DATA_UNAVAILABLE" };
    // The canonical payload is bounded before the historical view's bounded readers.
    // Exceeding the new renderer's limits is an explicit rejection, never truncation.
    const pending: unknown[] = [body];
    let visited = 0;
    while (pending.length) {
      if (++visited > 10000)
        return { ok: false, code: "SYNC_PRESENTATION_BOUNDS_EXCEEDED" };
      const node = pending.pop();
      if (Array.isArray(node)) {
        if (node.length > (payload.slideType==='sport_birthdays'?250:200))
          return { ok: false, code: "SYNC_PRESENTATION_BOUNDS_EXCEEDED" };
        pending.push(...node);
      } else if (record(node))
        pending.push(...Object.values(node as Record<string, unknown>));
    }
    if (payload.slideType === "sport_birthdays") {
      const timestamp = (body as Record<string, unknown>).fetchedAt;
      const fetchedAt =
        typeof timestamp === "string" ? Date.parse(timestamp) : NaN;
      if (
        !Number.isFinite(fetchedAt) ||
        fetchedAt - now.valueOf() > 5 * 60000 ||
        now.valueOf() - fetchedAt > 21 * 86400000
      )
        return { ok: false, code: "SYNC_CANONICAL_FRESHNESS_INVALID" };
    }
    const menuDocument = payload.data.menuDocument;
    const viewPayload: PlayerDynamicTemplatePayload =
      payload.slideType === "menu" && record(menuDocument)
        ? {
            ...payload,
            slideType: "price_list",
            data: {
              ...payload.data,
              type: "price_list",
              priceList: { menuDocument },
            },
          }
        : payload;
    const view = createCompleteDynamicTemplateView(viewPayload, now);
    if (!view) return { ok: false, code: "SYNC_CANONICAL_DATA_UNAVAILABLE" };
    const rows: SyncSlidePresentation["rows"] = [],
      news: SyncSlidePresentation["news"] = [],
      ownRowIndexes: number[] = [],
      seen = new Map<string, string>();
    let match: SyncSlidePresentation["match"],
      home: SyncSlidePresentation["home"],
      away: SyncSlidePresentation["away"];
    function add(
      id: string,
      row: SyncSlidePresentation["rows"][number],
      own = false,
    ) {
      const previous = seen.get(id),
        serial = JSON.stringify(row);
      if (previous !== undefined) {
        if (previous !== serial)
          throw Error("Conflicting canonical row identity");
        return;
      }
      seen.set(id, serial);
      if (own) ownRowIndexes.push(rows.length);
      rows.push(row);
    }
    function list(item: DynamicTemplateListItem, kind: string) {
      const results = payload.slideType === "sport_results",
        rooms = payload.slideType === "sport_dressing_rooms";
      const score =
        results && item.homeScore !== null && item.awayScore !== null
          ? `${item.homeScore} – ${item.awayScore}`
          : "";
      const room = rooms
        ? [item.homeRoom, item.awayRoom].filter(Boolean).join(" · ")
        : item.dressingRoom || item.field;
      if (
        kind === "sponsor" ||
        kind === "team" ||
        kind === "volunteers" ||
        slide.family === "officials" ||
        slide.family === "referees"
      )
        add(
          item.id,
          [item.primary, item.secondary, item.time, item.meta],
          item.selected,
        );
      else if (
        kind === "trainings" ||
        ["activities", "agenda"].includes(slide.family)
      )
        add(
          item.id,
          [item.time, item.date, item.primary, item.secondary || item.venue],
          item.selected,
        );
      else
        add(
          item.id,
          [
            item.homeTeam || item.primary,
            item.awayTeam || item.secondary,
            results ? score : item.kickoffTime || item.time,
            room,
          ],
          item.selected,
        );
    }
    for (const page of view.pages) {
      switch (page.kind) {
        case "standing":
          for (const item of page.items)
            add(
              item.id,
              [
                item.position === null ? "" : String(item.position),
                item.teamName,
                item.played === null ? "" : String(item.played),
                item.points === null ? "" : String(item.points),
              ],
              item.selected,
            );
          break;
        case "birthday":
          for (const item of page.items)
            add(item.id, [
              item.dateLabel ? String(item.day) : "",
              item.dateLabel
                ? new Intl.DateTimeFormat("nl-NL", {
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2000, item.month - 1, 1)))
                : "",
              item.displayName,
              [item.age === null ? "" : `${item.age} jaar`, item.meta]
                .filter(Boolean)
                .join(" · "),
            ]);
          break;
        case "menu":
          for (const column of page.columns)
            for (const entry of column)
              if (entry.kind === "product")
                add(entry.item.id, [
                  entry.item.name,
                  entry.item.price,
                  entry.item.description,
                  entry.item.category,
                ]);
          break;
        case "price-list":
          for (const column of Object.values(page.page.columns))
            for (const entry of column)
              if (entry.kind === "product")
                add(entry.item.id, [
                  entry.item.name,
                  entry.item.formattedPrice,
                  entry.item.description,
                  "",
                ]);
          break;
        case "menu-v2":
          for (const column of Object.values(page.page.columns))
            for (const entry of column) {
              if (entry.kind === "product")
                add(entry.id, [
                  entry.product.nameOverride ??
                    entry.product.snapshotFallback.name,
                  formatMenuMoney(resolveMenuProductPrice(entry.product)),
                  entry.product.snapshotFallback.variantLabel ?? "",
                  "",
                ]);
              else if (entry.kind === "product-group")
                add(entry.id, [
                  entry.group.title,
                  resolveMenuGroupPrice(entry.group),
                  entry.group.secondaryLineItems
                    .map((line) =>
                      line.kind === "free-text"
                        ? line.label
                        : (line.labelOverride ??
                          line.snapshotFallback.variantLabel ??
                          line.snapshotFallback.name),
                    )
                    .join(" · "),
                  "",
                ]);
            }
          break;
        case "news":
          for (const item of [page.item, ...page.secondaryItems])
            if (item) {
              const id = `news:${item.id}`,
                article = {
                  title: item.title,
                  intro: item.intro,
                  source: item.source,
                  ...(item.link ? { url: item.link } : {}),
                },
                serial = JSON.stringify(article),
                previous = seen.get(id);
              if (previous !== undefined) {
                if (previous !== serial)
                  throw Error("Conflicting article identity");
                continue;
              }
              seen.set(id, serial);
              news.push(article);
            }
          break;
        case "match":
          if (page.item) {
            const item = page.item;
            home = {
              name: item.homeTeam,
              team: "",
              logo: image(item.homeLogoUrl),
            };
            away = {
              name: item.awayTeam,
              team: "",
              logo: image(item.awayLogoUrl),
            };
            match = {
              homeScore: item.homeScore === null ? "" : String(item.homeScore),
              awayScore: item.awayScore === null ? "" : String(item.awayScore),
              clock: "",
              date: item.date,
              time: item.kickoffTime || item.time,
            };
          }
          break;
        default:
          for (const item of page.items) list(item, page.kind);
      }
    }
    const empty =
      slide.family === "rss"
        ? news.length === 0
        : ["matchday", "next-match"].includes(slide.family)
          ? !home
          : rows.length === 0;
    if(rows.length>200||news.length>50)return {ok:false,code:'SYNC_PRESENTATION_BOUNDS_EXCEEDED'};
    const presentation=syncSlidePresentationSchema.parse({
        ...slide,
        state: empty ? "empty" : "ready",
        rows,
        news,
        ownRowIndexes,
        poll: undefined,
        home,
        away,
        match,
        club: {
          ...slide.club,
          name: view.clubName || slide.club.name,
          logo: image(view.clubLogoUrl) || slide.club.logo,
        },
      });
    return {ok:true,presentation:isSyncOnzeTrotsPresentation(presentation)?enrichSyncOnzeTrotsProjection(payload,presentation,view,now,image):presentation};
  } catch (error) {
    return { ok: false, code: error instanceof SyncCanonicalIdentityError?"SYNC_CANONICAL_IDENTITY_INVALID":error instanceof Error&&error.name==='ZodError'?"SYNC_SNAPSHOT_INVALID":"SYNC_PROJECTION_INVALID" };
  }
}
