import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Stable Turbopack configuration for Next.js 16
  turbopack: {
    root: path.join(process.cwd()),
  }
};

export default nextConfig;
