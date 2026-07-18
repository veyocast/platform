import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@castivo/config"],
  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; base-uri 'none'; connect-src 'self' https: wss:; font-src 'self' data:; frame-ancestors 'none'; img-src 'self' blob: data: https:; media-src 'self' blob: data: https:; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
      },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" }
    ];

    return [
      { headers: securityHeaders, source: "/:path*" },
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

export default nextConfig;
