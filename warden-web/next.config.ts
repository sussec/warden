import type { NextConfig } from "next";

// Internal URL of the Warden API (container-to-container in compose,
// localhost in dev). The browser only ever talks same-origin — these
// rewrites proxy API traffic so no CORS is involved.
// Host-side default matches warden-api launchSettings / compose publish port.
// In Docker compose, build-arg API_INTERNAL_URL=http://warden:8080 overrides this.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:5272";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      // OIDC provider callback hits the public host (same origin as the UI).
      // ASP.NET OpenIdConnect middleware owns /auth/oidc/* — must not stay on Next.
      { source: "/auth/oidc/:path*", destination: `${API_INTERNAL_URL}/auth/oidc/:path*` },
      { source: "/openapi/:path*", destination: `${API_INTERNAL_URL}/openapi/:path*` },
      { source: "/mcp", destination: `${API_INTERNAL_URL}/mcp` },
      { source: "/healthz", destination: `${API_INTERNAL_URL}/healthz` },
      // Live scan-job stream (WebSocket upgrade when proxy supports it)
      { source: "/ws/:path*", destination: `${API_INTERNAL_URL}/ws/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Always revalidate HTML documents so a redeploy is picked up on the
        // next navigation. Pages are statically prerendered, so the browser
        // would otherwise serve a cached shell referencing stale JS chunks
        // (symptom: "login is new but dashboard is old" after a rebuild).
        // Hashed assets under /_next/static keep their long immutable cache.
        source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
