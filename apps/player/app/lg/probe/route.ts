import { renderLgProbeHtml } from "../../_lib/lg-probe-page";

export function GET() {
  return new Response(renderLgProbeHtml(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy":
        "default-src 'self'; base-uri 'none'; connect-src 'self' https:; frame-ancestors file:; img-src 'self' blob: data: https:; media-src 'self' blob: data: https:; object-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
