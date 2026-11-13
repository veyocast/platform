import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The existing SocialHero verifier reads the initial head without executing JS.
  // Extend the installed Next default so its other preview bots remain covered.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|SocialHeroBlogPublisher`, "i"),
  eslint: {
    ignoreDuringBuilds: true
  },
  output: "standalone",
  transpilePackages: ["@veyocast/config", "@veyocast/blog"]
};

export default nextConfig;
