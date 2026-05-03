import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  logging: {
    incomingRequests: false,
  },
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
