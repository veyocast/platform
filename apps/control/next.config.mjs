/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@castivo/config"]
};

export default nextConfig;
