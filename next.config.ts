import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Allow large audio/video uploads (recordings can easily exceed the 10MB default).
  // In Next.js 15+, this limit also applies to API route handlers, not just Server Actions.
  experimental: {
    serverActions: {
      bodySizeLimit: Infinity,
    },
  },
};

export default nextConfig;