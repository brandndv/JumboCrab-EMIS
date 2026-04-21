import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "192.168.0.18:3000",
        "10.147.13.191:3000",
        "localhost:3000",
        "*.app.github.dev",
      ],
    },
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },
  allowedDevOrigins: ["192.168.0.18", "10.147.13.191"],
};

export default nextConfig;
