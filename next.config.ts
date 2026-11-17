import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev only: lets 127.0.0.1 act as a second "device" (separate storage) when testing sync.
  allowedDevOrigins: ["127.0.0.1"]
};

export default nextConfig;
