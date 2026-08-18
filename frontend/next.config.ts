import type { NextConfig } from "next";

// Server-only (not NEXT_PUBLIC_) — evaluated by the Next.js server when
// proxying, never shipped to the browser. Keeps the browser talking to the
// backend as same-origin (via /api/v1/*) in every environment, which is what
// lets the OneLogin session cookie work without needing HTTPS locally and
// without CORS. See docs/plans on OneLogin SSO integration.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
