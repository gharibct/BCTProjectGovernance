import path from "node:path";
import type { NextConfig } from "next";

// Server-only (not NEXT_PUBLIC_) — evaluated by the Next.js server when
// proxying, never shipped to the browser. Keeps the browser talking to the
// backend as same-origin (via /api/v1/*) in every environment, which is what
// lets the OneLogin session cookie work without needing HTTPS locally and
// without CORS. See docs/plans on OneLogin SSO integration.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Without this, Turbopack/webpack auto-detect the project root by walking
  // up for a lockfile. On at least one Windows build host that walk resolved
  // this same folder through two different casings (`E:\Hari\...` vs
  // `E:\hari\...`), which webpack reported as "multiple modules with names
  // that only differ in casing" and duplicated singleton modules — including
  // the one holding App Router's workStore — causing prerendering to read an
  // uninitialized store (`InvariantError: Expected workStore to be
  // initialized`) on whichever page was built last. Pinning both roots to
  // this file's own directory removes the casing-sensitive auto-detection
  // step entirely.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: path.join(__dirname),
  },
  // Retry a flaky static-generation worker before failing the whole build —
  // doesn't fix a deterministic failure (see app/global-error.tsx for the
  // one we actually had), just cheap insurance against a transient one.
  experimental: {
    staticGenerationRetryCount: 2,
  },
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
