/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  output: "standalone",
  transpilePackages: ["@veyocast/config"]
};

export default nextConfig;
