import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pdf-parse', 'xlsx', 'puppeteer-core', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
};

export default nextConfig;
