import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the container image (see Dockerfile).
  // Vercel builds work unchanged with it.
  output: "standalone",
};

export default nextConfig;
