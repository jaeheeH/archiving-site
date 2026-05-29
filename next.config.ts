import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    deviceSizes: [640, 828, 1200],
    imageSizes: [16, 32, 64, 128, 256, 384],
    qualities: [75],
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
