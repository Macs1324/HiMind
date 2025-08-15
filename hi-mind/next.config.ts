import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentation.ts is now enabled by default in Next.js 15
  webpack: (config, { isServer }) => {
    // Fix for Node.js built-in modules in instrumentation
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@slack/web-api': '@slack/web-api',
        '@slack/socket-mode': '@slack/socket-mode',
      });
    }
    return config;
  },
};

export default nextConfig;
