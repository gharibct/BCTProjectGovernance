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
  // `app/layout.tsx`'s `export const dynamic = "force-dynamic"` stops the
  // same workStore race from hitting our own pages, but `/_global-error` and
  // `/_not-found` are special — they REPLACE the root layout instead of
  // nesting under it, so that export never applies to them, and they still
  // get prerendered by whichever of the parallel static-generation workers
  // picks them up. With >1 worker that's exactly the cross-worker race the
  // note above describes, just for a page we can't mark dynamic. Forcing a
  // single worker (well above our ~100 routes) removes the race instead of
  // chasing which page it lands on next.
  experimental: {
    staticGenerationMinPagesPerWorker: 1000,
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
