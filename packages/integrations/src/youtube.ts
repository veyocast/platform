import {
  youtubeMetadataSchema,
  youtubeVideoIdSchema,
  youtubePlaylistIdSchema,
  type YouTubeMetadata
} from "@veyocast/contracts";

const youtubeHosts = new Set([
  "m.youtube.com",
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "youtu.be"
]);

export function parseYouTubeVideoId(input: string) {
  const trimmed = input.trim();
  if (youtubeVideoIdSchema.safeParse(trimmed).success) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !youtubeHosts.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const candidate = url.hostname.toLowerCase() === "youtu.be"
    ? parts[0]
    : url.searchParams.get("v") ??
      (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" ? parts[1] : null);
  return candidate && youtubeVideoIdSchema.safeParse(candidate).success ? candidate : null;
}

export function parseYouTubePlaylistId(input: string) {
  const trimmed = input.trim();
  if (youtubePlaylistIdSchema.safeParse(trimmed).success && !youtubeVideoIdSchema.safeParse(trimmed).success) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || !youtubeHosts.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
    const candidate = url.searchParams.get("list");
    return candidate && youtubePlaylistIdSchema.safeParse(candidate).success ? candidate : null;
  } catch { return null; }
}

export type ResolvedYouTubePlaylist = {
  playlistId: string; title: string; channelTitle: string; videoIds: string[];
  unavailableItems: number; providerItemCount: number;
};

/** Resolve the complete bounded provider order. Only metadata is retrieved. */
export async function fetchYouTubePlaylistMetadata({ apiKey, playlistId, fetchImpl = fetch }: {
  apiKey: string; playlistId: string; fetchImpl?: typeof fetch;
}): Promise<ResolvedYouTubePlaylist> {
  const id = youtubePlaylistIdSchema.parse(playlistId);
  if (!apiKey.trim()) throw new Error("YouTube Data API-key ontbreekt.");
  const signal = AbortSignal.timeout(30_000);
  async function request(resource: string, parameters: Record<string, string>): Promise<Record<string, unknown>> {
    const endpoint = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    for (const [key, value] of Object.entries({ ...parameters, key: apiKey })) endpoint.searchParams.set(key, value);
    const response = await fetchImpl(endpoint, { headers: { accept: "application/json" }, signal });
    if (!response.ok) throw new Error(`YouTube-playlist ophalen mislukt (${response.status}).`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("YouTube gaf geen geldige metadata.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const result = await reader.read(); if (result.done) break; size += result.value.byteLength;
        if (size > 1_048_576) { await reader.cancel(); throw new Error("YouTube-metadata overschrijdt de limiet."); }
        chunks.push(result.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("YouTube gaf ongeldige metadata.");
    return value as Record<string, unknown>;
  }
  type Item = { id?: string; snippet?: { title?: string; channelTitle?: string; position?: number; resourceId?: { videoId?: string } }; status?: { embeddable?: boolean; privacyStatus?: string } };
  const details = await request("playlists", { id, part: "snippet,status" });
  const playlist = (details.items as Item[] | undefined)?.[0];
  if (!playlist || !playlist.snippet?.title || !playlist.snippet.channelTitle || playlist.status?.privacyStatus === "private") throw new Error("De playlist is niet openbaar toegankelijk.");
  const entries: Array<{ videoId: string; position: number }> = [];
  let nextPage = ""; const seenPages = new Set<string>();
  for (let page = 0; page < 4; page++) {
    if (seenPages.has(nextPage)) throw new Error("YouTube gaf een herhaalde metadatapagina.");
    seenPages.add(nextPage);
    const payload = await request("playlistItems", { playlistId: id, part: "snippet", maxResults: "50", ...(nextPage ? { pageToken: nextPage } : {}) });
    const count = (payload.pageInfo as { totalResults?: number } | undefined)?.totalResults;
    if (count !== undefined && (!Number.isInteger(count) || count > 200)) throw new Error("Kies een playlist met maximaal 200 items.");
    if (!Array.isArray(payload.items) || payload.items.length > 50) throw new Error("YouTube gaf een ongeldige metadatapagina.");
    for (const item of payload.items as Item[]) {
      const videoId = item.snippet?.resourceId?.videoId; const position = item.snippet?.position;
      if (!videoId || !youtubeVideoIdSchema.safeParse(videoId).success || !Number.isInteger(position) || position! < 0) throw new Error("Een playlistitem mist zijn provideridentiteit of volgorde.");
      entries.push({ videoId, position: position! });
    }
    if (entries.length > 200) throw new Error("Kies een playlist met maximaal 200 items.");
    nextPage = typeof payload.nextPageToken === "string" ? payload.nextPageToken : "";
    if (!nextPage) break;
  }
  if (nextPage) throw new Error("De playlist is groter dan de ondersteunde limiet.");
  if (!entries.length || new Set(entries.map(({ position }) => position)).size !== entries.length) throw new Error("De playlist is leeg of veranderde tijdens het ophalen. Probeer opnieuw.");
  entries.sort((left, right) => left.position - right.position);
  const uniqueIds = [...new Set(entries.map(({ videoId }) => videoId))]; const playable = new Set<string>();
  for (let start = 0; start < uniqueIds.length; start += 50) {
    const payload = await request("videos", { id: uniqueIds.slice(start, start + 50).join(","), part: "status" });
    if (!Array.isArray(payload.items) || payload.items.length > 50) throw new Error("YouTube gaf ongeldige videovalidatie.");
    for (const item of payload.items as Item[]) if (item.id && uniqueIds.includes(item.id) && item.status?.embeddable === true && item.status.privacyStatus !== "private") playable.add(item.id);
  }
  const videoIds = entries.filter(({ videoId }) => playable.has(videoId)).map(({ videoId }) => videoId);
  if (!videoIds.length) throw new Error("Deze playlist bevat geen toegankelijke, insluitbare video's.");
  return { playlistId: id, title: playlist.snippet.title.slice(0, 160), channelTitle: playlist.snippet.channelTitle.slice(0, 240), videoIds, unavailableItems: entries.length - videoIds.length, providerItemCount: entries.length };
}

export function buildYouTubeEmbedUrl(videoId: string, origin: string) {
  const parsedVideoId = youtubeVideoIdSchema.parse(videoId);
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" && parsedOrigin.hostname !== "localhost") {
    throw new Error("Een HTTPS-origin is vereist voor YouTube playback.");
  }
  const url = new URL(`https://www.youtube-nocookie.com/embed/${parsedVideoId}`);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("controls", "0");
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("rel", "0");
  url.searchParams.set("origin", parsedOrigin.origin);
  return url.toString();
}

export async function fetchYouTubeMetadata({
  apiKey,
  fetchImpl = fetch,
  videoId
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  videoId: string;
}): Promise<YouTubeMetadata> {
  const id = youtubeVideoIdSchema.parse(videoId);
  if (!apiKey.trim()) throw new Error("YouTube Data API-key ontbreekt.");
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("id", id);
  endpoint.searchParams.set("part", "snippet,status");
  endpoint.searchParams.set("key", apiKey);
  const response = await fetchImpl(endpoint, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`YouTube metadata ophalen mislukt (${response.status}).`);
  const payload = await response.json() as {
    items?: Array<{
      id?: string;
      snippet?: { channelTitle?: string; title?: string };
      status?: { embeddable?: boolean; privacyStatus?: string };
    }>;
  };
  const item = payload.items?.[0];
  if (!item) throw new Error("YouTube-video is niet gevonden of niet toegankelijk.");
  return youtubeMetadataSchema.parse({
    channelTitle: item.snippet?.channelTitle,
    embeddable: item.status?.embeddable,
    privacyStatus: item.status?.privacyStatus,
    title: item.snippet?.title,
    videoId: item.id
  });
}
