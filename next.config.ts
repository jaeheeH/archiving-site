import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_IMAGE_HOSTS } from './lib/public-image';

function getSupabaseImageHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const supabaseImageHost = getSupabaseImageHost();

const nextConfig: NextConfig = {
  // Keep performance QA builds separate from the build currently serving the site.
  distDir: process.env.ARCHB_BUILD_DIR || '.next',
  poweredByHeader: false,
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      ...PUBLIC_IMAGE_HOSTS.map(hostname => ({ protocol: 'https' as const, hostname })),
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'k.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 'img1.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 't1.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 'images.metmuseum.org',
        pathname: '/CRDImages/**',
      },
      {
        protocol: 'https',
        hostname: 'openaccess-cdn.clevelandart.org',
        pathname: '/**',
      },
      ...(supabaseImageHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseImageHost,
            },
          ]
        : []),
    ],
    deviceSizes: [640, 828, 1200],
    imageSizes: [16, 32, 64, 128, 256, 384],
    qualities: [75],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      { source: '/fonts/pretendard-v1.3.9/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      ...((process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }] : []),
      ...['dashboard', 'mypage', 'login', 'auth', 'no-access', 'extension'].map(path => ({ source: `/${path}/:path*`, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] })),
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default function configure(phase: string): NextConfig {
  // Use the same version for compiled assets and every server serving this build.
  const deploymentId = process.env.NEXT_DEPLOYMENT_ID || (phase === PHASE_PRODUCTION_BUILD
    ? randomUUID()
    : phase === PHASE_PRODUCTION_SERVER
      ? JSON.parse(readFileSync(join(process.cwd(), nextConfig.distDir || '.next', 'required-server-files.json'), 'utf8')).config.deploymentId
      : undefined);
  return deploymentId ? { ...nextConfig, deploymentId } : nextConfig;
}
