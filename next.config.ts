import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors must fail the build (they were silently ignored before).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Allow the Arena preview host plus localhost in dev.
  allowedDevOrigins: ["*.e2b.app", "127.0.0.1", "localhost"],
};

export default nextConfig;
