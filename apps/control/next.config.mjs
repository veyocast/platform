/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  async redirects() {
    return [
      {
        destination: "/dashboard/slides/menu-studio/new",
        permanent: false,
        source: "/dashboard/slides/new"
      }
    ];
  },
  transpilePackages: ["@veyocast/config", "@veyocast/content-templates"]
};

export default nextConfig;
