import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import sharp from "sharp";

export const ledScoresImageWidth = 480;
export const ledScoresImageHeight = 270;
export const ledScoresImageContentType = "image/png";

export const ledScoresNoCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache"
} as const;

type Rgba = readonly [number, number, number, number];

type RateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}>;

type LedScoresRateLimiter = Readonly<{
  consume: (clientKey: string, nowMs: number) => RateLimitDecision;
}>;

type LiveImageLogFields = Readonly<{
  outcome: "rate_limited" | "render_failed" | "served";
  requestCode?: string;
  servedAt?: string;
  status: number;
}>;

type LiveImageHandlerOptions = Readonly<{
  clock?: () => Date;
  expectedTokenDigest: string;
  limiter?: LedScoresRateLimiter;
  log: (fields: LiveImageLogFields) => void;
  requestCode?: () => string;
}>;

type RateLimitWindow = {
  count: number;
  startedAt: number;
};

const dutchDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "long",
  timeZone: "Europe/Amsterdam",
  weekday: "long",
  year: "numeric"
});

const dutchTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Amsterdam"
});

const glyphs: Readonly<Record<string, readonly string[]>> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"]
};

export function tokenMatchesDigest(token: string, expectedDigest: string) {
  if (
    !/^[A-Za-z0-9_-]{64,128}$/.test(token) ||
    !/^[a-f0-9]{64}$/.test(expectedDigest)
  ) {
    return false;
  }
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createLedScoresRateLimiter(options: {
  clientLimit?: number;
  globalLimit?: number;
  windowMs?: number;
} = {}): LedScoresRateLimiter {
  const clientLimit = options.clientLimit ?? 90;
  const globalLimit = options.globalLimit ?? 300;
  const windowMs = options.windowMs ?? 60_000;
  const clients = new Map<string, RateLimitWindow>();
  let globalWindow: RateLimitWindow = { count: 0, startedAt: 0 };

  return {
    consume(clientKey, nowMs) {
      globalWindow = currentWindow(globalWindow, nowMs, windowMs);
      const clientWindow = currentWindow(
        clients.get(clientKey) ?? { count: 0, startedAt: nowMs },
        nowMs,
        windowMs
      );
      globalWindow.count += 1;
      clientWindow.count += 1;
      clients.set(clientKey, clientWindow);
      pruneRateLimitWindows(clients, nowMs, windowMs);

      const allowed =
        clientWindow.count <= clientLimit && globalWindow.count <= globalLimit;
      const retryAt = Math.max(
        clientWindow.count > clientLimit ? clientWindow.startedAt + windowMs : nowMs,
        globalWindow.count > globalLimit ? globalWindow.startedAt + windowMs : nowMs
      );
      return {
        allowed,
        limit: clientLimit,
        remaining: Math.max(0, clientLimit - clientWindow.count),
        retryAfterSeconds: Math.max(1, Math.ceil((retryAt - nowMs) / 1_000))
      };
    }
  };
}

export async function createLedScoresLiveImage(input: {
  now: Date;
  requestCode: string;
}) {
  const displayDate = dutchDateFormatter.format(input.now).toUpperCase();
  const displayTime = dutchTimeFormatter.format(input.now);
  const requestCode = normalizeRequestCode(input.requestCode);
  const pixels = createBackground();

  fillRect(pixels, 22, 18, 8, 224, [34, 212, 167, 255]);
  drawCenteredText(pixels, "VEYOCAST LIVE URL TEST", 3, 24, [246, 249, 255, 255]);
  fillRect(pixels, 47, 62, 386, 2, [77, 111, 171, 255]);
  drawCenteredText(pixels, displayDate, 2, 80, [156, 185, 229, 255]);
  drawCenteredText(pixels, displayTime, 6, 111, [247, 251, 255, 255]);
  fillRect(pixels, 47, 188, 386, 1, [77, 111, 171, 255]);
  fillRect(pixels, 47, 203, 386, 40, [12, 27, 52, 255]);
  drawText(pixels, "REQUESTCODE", 2, 68, 216, [139, 169, 215, 255]);
  drawText(pixels, requestCode, 4, 277, 209, [34, 212, 167, 255]);

  const bytes = await sharp(pixels, {
    raw: {
      channels: 4,
      height: ledScoresImageHeight,
      width: ledScoresImageWidth
    }
  }).png({ compressionLevel: 9, palette: false }).toBuffer();

  return { bytes, displayDate, displayTime, requestCode };
}

export function createLedScoresLiveImageHandler(options: LiveImageHandlerOptions) {
  const clock = options.clock ?? (() => new Date());
  const limiter = options.limiter ?? createLedScoresRateLimiter();
  const requestCode = options.requestCode ?? createRequestCode;

  return async function handle(request: Request, token: string) {
    if (!tokenMatchesDigest(token, options.expectedTokenDigest)) {
      return noCacheResponse(null, 404);
    }

    const now = clock();
    const rateLimit = limiter.consume(clientRateLimitKey(request), now.getTime());
    if (!rateLimit.allowed) {
      options.log({ outcome: "rate_limited", status: 429 });
      return noCacheResponse("Te veel aanvragen.", 429, {
        "Retry-After": String(rateLimit.retryAfterSeconds)
      });
    }

    const code = requestCode();
    try {
      const image = await createLedScoresLiveImage({ now, requestCode: code });
      options.log({
        outcome: "served",
        requestCode: image.requestCode,
        servedAt: now.toISOString(),
        status: 200
      });
      return new Response(new Uint8Array(image.bytes), {
        headers: {
          ...ledScoresNoCacheHeaders,
          "Content-Disposition": "inline; filename=veyocast-live-url-test.png",
          "Content-Length": String(image.bytes.byteLength),
          "Content-Type": ledScoresImageContentType,
          "Surrogate-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining)
        },
        status: 200
      });
    } catch {
      options.log({ outcome: "render_failed", status: 503 });
      return noCacheResponse("Afbeelding tijdelijk niet beschikbaar.", 503);
    }
  };
}

function createBackground() {
  const pixels = Buffer.alloc(ledScoresImageWidth * ledScoresImageHeight * 4);
  for (let y = 0; y < ledScoresImageHeight; y += 1) {
    const vertical = y / (ledScoresImageHeight - 1);
    for (let x = 0; x < ledScoresImageWidth; x += 1) {
      const horizontal = x / (ledScoresImageWidth - 1);
      const index = (y * ledScoresImageWidth + x) * 4;
      pixels[index] = Math.round(7 + 7 * vertical);
      pixels[index + 1] = Math.round(16 + 20 * horizontal + 7 * vertical);
      pixels[index + 2] = Math.round(34 + 32 * horizontal + 8 * vertical);
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

function drawCenteredText(
  pixels: Buffer,
  text: string,
  scale: number,
  y: number,
  color: Rgba
) {
  const width = measureText(text, scale);
  drawText(pixels, text, scale, Math.max(0, Math.floor((ledScoresImageWidth - width) / 2)), y, color);
}

function drawText(
  pixels: Buffer,
  text: string,
  scale: number,
  x: number,
  y: number,
  color: Rgba
) {
  const normalized = text.toUpperCase();
  let cursor = x;
  for (const character of normalized) {
    const glyph = glyphs[character] ?? glyphs["?"]!;
    glyph.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] === "1") {
          fillRect(
            pixels,
            cursor + column * scale,
            y + rowIndex * scale,
            scale,
            scale,
            color
          );
        }
      }
    });
    cursor += 6 * scale;
  }
}

function measureText(text: string, scale: number) {
  return text.length === 0 ? 0 : text.length * 6 * scale - scale;
}

function fillRect(
  pixels: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgba
) {
  for (let row = Math.max(0, y); row < Math.min(ledScoresImageHeight, y + height); row += 1) {
    for (let column = Math.max(0, x); column < Math.min(ledScoresImageWidth, x + width); column += 1) {
      const index = (row * ledScoresImageWidth + column) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = color[3];
    }
  }
}

function normalizeRequestCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : "ERROR0";
}

function createRequestCode() {
  return randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

function clientRateLimitKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const source = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256")
    .update(`led-scores-client:${source}`)
    .digest("hex");
}

function currentWindow(window: RateLimitWindow, nowMs: number, windowMs: number) {
  return nowMs - window.startedAt >= windowMs
    ? { count: 0, startedAt: nowMs }
    : window;
}

function pruneRateLimitWindows(
  windows: Map<string, RateLimitWindow>,
  nowMs: number,
  windowMs: number
) {
  if (windows.size < 512) return;
  for (const [key, window] of windows) {
    if (nowMs - window.startedAt >= windowMs) windows.delete(key);
  }
  while (windows.size > 512) {
    const oldest = windows.keys().next().value as string | undefined;
    if (!oldest) break;
    windows.delete(oldest);
  }
}

function noCacheResponse(
  body: BodyInit | null,
  status: number,
  headers: Readonly<Record<string, string>> = {}
) {
  return new Response(body, {
    headers: {
      ...ledScoresNoCacheHeaders,
      ...headers,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    status
  });
}
