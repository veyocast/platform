import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep authenticated local acceptance builds separate from the development fixture.
  distDir: process.env.VEYOCAST_QA_OUTPUT === "1" ? ".next-qa" : ".next",
  output: "standalone",
  // Preserve local session-cookie hosts across middleware redirects in dev.
  // Next otherwise normalizes 127.0.0.1 / ::1 to localhost again in its adapter.
  skipMiddlewareUrlNormalize: process.env.NODE_ENV === "development",
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@veyocast/config", "@veyocast/content-templates"]
};

export default nextConfig;
