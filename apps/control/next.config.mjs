import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep authenticated local acceptance builds separate from the development fixture.
  distDir: process.env.VEYOCAST_QA_OUTPUT === "1" ? ".next-qa" : ".next",
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@veyocast/config", "@veyocast/content-templates"]
};

export default nextConfig;
