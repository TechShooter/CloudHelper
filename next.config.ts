import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: false, //HTTP POST, GET etc. logging on prompt
  },
};

export default nextConfig;
