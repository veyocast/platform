/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@veyocast/config", "@veyocast/content-templates"]
};

export default nextConfig;
