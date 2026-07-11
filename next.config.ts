import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: false,
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
