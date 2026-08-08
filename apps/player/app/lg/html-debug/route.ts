import { renderLgHtmlDebugHtml } from "../../_lib/lg-html-debug-page";

export function GET() {
  return new Response(renderLgHtmlDebugHtml(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy":
        "default-src 'self'; base-uri 'none'; connect-src 'self'; frame-ancestors file:; img-src 'self' data:; media-src 'none'; object-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
