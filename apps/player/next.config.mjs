/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@castivo/config"]
};

export default nextConfig;
