import { z } from "zod";
import { createLedScoresUrl, LED_SCORES_PLAYER_MEDIA_HOST, normalizeLedScoresTeamKey } from "./ledscores";

const id = z.union([z.number().int().nonnegative(), z.string().min(1).max(120)]).transform(String);
const catalogSchema = z.object({
  id,
  slug: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  teams: z.array(z.object({
    id,
    name: z.string().trim().min(1).max(160),
    type: z.enum(["home", "away"]),
    active: z.boolean().optional(),
    logo: z.string().max(2048).nullable().optional(),
    logo_fk_url: z.string().max(2048).nullable().optional(),
    sportlink_team_name: z.string().max(160).nullable().optional(),
    sportlink_teamcode: z.string().max(120).nullable().optional(),
    category: z.string().max(80).nullable().optional()
  })).max(1000)
});
export type LedScoresCatalogTeam = {
  teamKey: string;
  teamName: string;
  sourceName: string;
  side: "own" | "opponent";
  active: boolean;
  category: string | null;
  sportlinkTeamCode: string | null;
  logoSourceUrl: string | null;
  logoProviderAssetVersionId?: string | null;
};
export type LedScoresClubCatalog = { clubId: string; clubSlug: string; clubName: string; teams: LedScoresCatalogTeam[] };

export function parseLedScoresClubCatalog(raw: string, expectedSlug: string): LedScoresClubCatalog {
  if (Buffer.byteLength(raw, "utf8") > 2 * 1024 * 1024) throw new Error("ledscores_catalog_too_large");
  const parsed = catalogSchema.parse(JSON.parse(raw));
  if (parsed.slug !== expectedSlug) throw new Error("ledscores_catalog_club_mismatch");
  const keys = new Set<string>();
  const teams = parsed.teams.map((team): LedScoresCatalogTeam => {
    const teamKey = normalizeLedScoresTeamKey(team.id);
    if (keys.has(teamKey)) throw new Error("ledscores_catalog_duplicate_team");
    keys.add(teamKey);
    let logoSourceUrl: string | null = null;
    try {
      for (const source of [team.logo_fk_url, team.logo]) {
        if (!source) continue;
        const url = new URL(source, `https://${LED_SCORES_PLAYER_MEDIA_HOST}`);
        if (url.protocol === "https:" && url.hostname === LED_SCORES_PLAYER_MEDIA_HOST && !url.port && !url.username && !url.password) { logoSourceUrl = url.toString(); break; }
      }
    } catch { /* Optional logo, never a catalog failure. */ }
    return {
      active: team.active !== false,
      category: team.category?.trim() || null,
      logoSourceUrl,
      side: team.type === "home" ? "own" : "opponent",
      sourceName: team.name,
      sportlinkTeamCode: team.sportlink_teamcode?.trim() || null,
      teamKey,
      teamName: team.sportlink_team_name?.trim() || team.name
    };
  });
  return { clubId: parsed.id, clubSlug: parsed.slug, clubName: parsed.name, teams };
}

/** One read-only snapshot. No provider authentication, writes or raw persistence. */
export function fetchLedScoresClubCatalog(clubSlug: string, options: {
  signal?: AbortSignal;
  webSocketFactory?: (url: string) => WebSocket;
  timeoutMs?: number;
} = {}): Promise<LedScoresClubCatalog> {
  const endpoint = createLedScoresUrl(clubSlug).replace(/scores\/$/, "");
  return new Promise((resolve, reject) => {
    const socket = options.webSocketFactory?.(endpoint) ?? new WebSocket(endpoint);
    let settled = false;
    const finish = (error: Error | null, catalog?: LedScoresClubCatalog) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      try { socket.close(); } catch { /* Already closed or cancelled while connecting. */ }
      if (error) reject(error); else resolve(catalog!);
    };
    const abort = () => finish(new Error("ledscores_catalog_cancelled"));
    const timer = setTimeout(() => finish(new Error("ledscores_catalog_timeout")), Math.min(10000, options.timeoutMs ?? 8000));
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    socket.addEventListener("message", (event) => {
      try {
        if (typeof event.data !== "string") throw new Error("ledscores_catalog_invalid");
        finish(null, parseLedScoresClubCatalog(event.data, clubSlug));
      } catch { finish(new Error("ledscores_catalog_invalid")); }
    }, { once: true });
    socket.addEventListener("error", () => finish(new Error("ledscores_catalog_unavailable")), { once: true });
    socket.addEventListener("close", () => finish(new Error("ledscores_catalog_closed")), { once: true });
  });
}
