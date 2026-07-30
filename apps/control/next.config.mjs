/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverActions: {
      // Afbeeldingen worden één voor één verzonden en daarna inhoudelijk op
      // maximaal 20 MB gevalideerd. De kleine marge is alleen multipart-overhead.
      bodySizeLimit: "21mb"
    }
  },
  transpilePackages: ["@veyocast/config"]
};

export default nextConfig;
