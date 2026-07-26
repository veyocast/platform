import process from "node:process";
import { URL } from "node:url";

const developmentSupabaseOrigin = getDevelopmentSupabaseOrigin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/player/demo/media": ["./demo-assets/demoveyo.mp4"]
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@veyocast/config"],
  async headers() {
    const sharedSecurityHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" }
    ];
    const defaultSecurityHeaders = [
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; base-uri 'none'; connect-src 'self' https: wss:${developmentSupabaseOrigin ? ` ${developmentSupabaseOrigin}` : ""}; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' blob: data: https:; media-src 'self' blob: data: https:; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
      },
      ...sharedSecurityHeaders,
      { key: "X-Frame-Options", value: "DENY" }
    ];
    const lgSignageSecurityHeaders = [
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; base-uri 'none'; connect-src 'self' https: wss:; font-src 'self' data:; frame-ancestors file:; img-src 'self' blob: data: https:; media-src 'self' blob: data: https:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
      },
      ...sharedSecurityHeaders,
      { key: "Cache-Control", value: "no-store" }
    ];

    return [
      { headers: lgSignageSecurityHeaders, source: "/lg/:path*" },
      {
        headers: defaultSecurityHeaders,
        source: "/:path((?!lg(?:/.*)?$).*)"
      },
      {
        headers: [{ key: "Cache-Control", value: "no-store" }],
        source: "/device-lab/:path*"
      },
      {
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" }
        ],
        source: "/sw.js"
      }
    ];
  }
};

function getDevelopmentSupabaseOrigin() {
  if (process.env.NODE_ENV === "production") return "";
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
    );
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export default nextConfig;
