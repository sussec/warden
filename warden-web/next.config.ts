import type { NextConfig } from "next";

// Internal URL of the Warden API (container-to-container in compose,
// localhost in dev). The browser only ever talks same-origin — these
// rewrites proxy API traffic so no CORS is involved.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      { source: "/openapi/:path*", destination: `${API_INTERNAL_URL}/openapi/:path*` },
      { source: "/mcp", destination: `${API_INTERNAL_URL}/mcp` },
      { source: "/healthz", destination: `${API_INTERNAL_URL}/healthz` },
    ];
  },
};

export default nextConfig;
