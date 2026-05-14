import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    serverActions: {
      // YL Pointing persists 4 base64 images at once (~800KB). Bump limit
      // safely so multi-image sessions don't 413.
      bodySizeLimit: '10mb',
    },
  },
  // Stable Turbopack configuration for Next.js 16
  turbopack: {
    root: path.join(process.cwd()),
  }
};

export default nextConfig;
