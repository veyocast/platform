import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

import { type NextRequest } from "next/server";

import {
  acceptsPlayerDemoSession,
  playerDemoCookieName
} from "../../../../_lib/player-demo-auth";
import { parseByteRangeHeader } from "../../../../_lib/media-range";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasDemoSession(request)) {
    return unavailableResponse();
  }

  return streamDemoMedia(request.headers.get("range"));
}

export async function HEAD(request: NextRequest) {
  if (!hasDemoSession(request)) {
    return unavailableResponse(true);
  }

  return streamDemoMedia(null, true);
}

function hasDemoSession(request: NextRequest) {
  return acceptsPlayerDemoSession(
    request.cookies.get(playerDemoCookieName)?.value
  );
}

function resolveDemoMediaPath() {
  return process.cwd().endsWith("/apps/player")
    ? join(process.cwd(), "demo-assets", "demoveyo.mp4")
    : join(process.cwd(), "apps", "player", "demo-assets", "demoveyo.mp4");
}

async function streamDemoMedia(
  rangeHeader: string | null,
  headOnly = false
) {
  try {
    const mediaPath = resolveDemoMediaPath();
    const media = await stat(mediaPath);
    const baseHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=86400",
      "Content-Type": "video/mp4"
    };

    if (!rangeHeader) {
      return new Response(
        headOnly ? null : nodeStreamBody(createReadStream(mediaPath)),
        {
          headers: {
            ...baseHeaders,
            "Content-Length": String(media.size)
          }
        }
      );
    }

    const parsed = parseByteRangeHeader(rangeHeader, media.size);
    if (!parsed.ok) {
      return new Response(null, {
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${media.size}`
        },
        status: 416
      });
    }

    const { end, start } = parsed.range;
    return new Response(
      headOnly
        ? null
        : nodeStreamBody(createReadStream(mediaPath, { end, start })),
      {
        headers: {
          ...baseHeaders,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${media.size}`
        },
        status: 206
      }
    );
  } catch {
    return unavailableResponse(headOnly);
  }
}

function nodeStreamBody(stream: ReturnType<typeof createReadStream>) {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

function unavailableResponse(headOnly = false) {
  return new Response(headOnly ? null : "Niet beschikbaar.", {
    headers: { "Cache-Control": "no-store" },
    status: 404
  });
}
