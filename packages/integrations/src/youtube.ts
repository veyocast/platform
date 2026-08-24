import {
  youtubeMetadataSchema,
  youtubeVideoIdSchema,
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
