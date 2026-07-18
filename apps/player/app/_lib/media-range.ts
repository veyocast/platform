export type ByteRange = {
  end: number;
  start: number;
};

export type ParsedByteRange =
  | { ok: true; range: ByteRange }
  | { ok: false; reason: "invalid" | "multiple" | "unsatisfiable" };

export function parseByteRangeHeader(
  header: string,
  totalBytes: number
): ParsedByteRange {
  if (!Number.isSafeInteger(totalBytes) || totalBytes <= 0 || !header.startsWith("bytes=")) {
    return { ok: false, reason: "invalid" };
  }

  const value = header.slice("bytes=".length).trim();
  if (!value || value.includes(",")) {
    return { ok: false, reason: value.includes(",") ? "multiple" : "invalid" };
  }

  const [startValue, endValue, ...rest] = value.split("-");
  if (rest.length > 0 || (!startValue && !endValue)) {
    return { ok: false, reason: "invalid" };
  }

  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { ok: false, reason: "invalid" };
    }

    return {
      ok: true,
      range: {
        end: totalBytes - 1,
        start: Math.max(0, totalBytes - suffixLength)
      }
    };
  }

  const start = Number(startValue);
  const requestedEnd = endValue ? Number(endValue) : totalBytes - 1;
  if (Number.isSafeInteger(start) && start >= totalBytes) {
    return { ok: false, reason: "unsatisfiable" };
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    range: { end: Math.min(requestedEnd, totalBytes - 1), start }
  };
}

export async function createRangeResponse(
  response: Response,
  rangeHeader: string | null
) {
  if (!rangeHeader) {
    return withRangeHeaders(response, response.status);
  }

  const totalBytes = await responseSize(response);
  const parsed = parseByteRangeHeader(rangeHeader, totalBytes);

  if (!parsed.ok) {
    return new Response(null, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${totalBytes}`
      },
      status: 416
    });
  }

  const { end, start } = parsed.range;
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${totalBytes}`);

  if (!response.body) {
    return new Response(null, { headers, status: 206 });
  }

  return new Response(sliceReadableStream(response.body, start, end), {
    headers,
    status: 206
  });
}

function withRangeHeaders(response: Response, status: number) {
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  return new Response(response.body, { headers, status });
}

async function responseSize(response: Response) {
  const contentLength = Number(response.headers.get("Content-Length"));
  if (Number.isSafeInteger(contentLength) && contentLength > 0) {
    return contentLength;
  }

  return (await response.clone().arrayBuffer()).byteLength;
}

function sliceReadableStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  end: number
) {
  const reader = source.getReader();
  let offset = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const result = await reader.read();
        if (result.done) {
          controller.close();
          return;
        }

        const chunk = result.value;
        const chunkStart = offset;
        const chunkEnd = offset + chunk.byteLength - 1;
        offset += chunk.byteLength;

        if (chunkEnd < start) {
          continue;
        }

        if (chunkStart > end) {
          await reader.cancel();
          controller.close();
          return;
        }

        const from = Math.max(0, start - chunkStart);
        const to = Math.min(chunk.byteLength, end - chunkStart + 1);
        controller.enqueue(chunk.slice(from, to));

        if (chunkEnd >= end) {
          await reader.cancel();
          controller.close();
        }
        return;
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    }
  });
}
