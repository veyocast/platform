/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@veyocast/config"]
};

export default nextConfig;
