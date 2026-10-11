import { renderLgLegacyHtml } from "../../_lib/lg-legacy-page";

export function GET() {
  return new Response(renderLgLegacyHtml(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy":
        "default-src 'self'; base-uri 'none'; connect-src 'self' https:; frame-ancestors file:; frame-src 'self' https://www.youtube-nocookie.com; font-src 'self' blob: data:; img-src 'self' blob: data: https:; media-src 'self' blob: data: https:; object-src 'none'; script-src 'self' 'unsafe-inline' https://www.youtube.com; style-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
