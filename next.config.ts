import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Necesario para cPanel Node.js (genera server.js auto-contenido)
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
