import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["10.10.10.194"],
};

export default nextConfig;
