import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

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

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
