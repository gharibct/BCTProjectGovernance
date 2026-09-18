"use client";

// Replaces Next's built-in default global-error page. That built-in page
// tries to resolve metadata inherited from app/layout.tsx while rendering
// the error-page tree — a path where `/_global-error`'s prerender doesn't
// get its workStore context set up in this Next 16.2.10 + Turbopack build,
// throwing "InvariantError: Expected workStore to be initialized" (Next's
// own error code E1068) and failing `next build` outright. Global error
// boundaries don't support metadata/generateMetadata exports anyway (see
// https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error),
// so supplying our own here avoids that code path entirely. Inline styles
// only — this replaces the root layout, so nothing from it (fonts,
// globals.css) is guaranteed to be loaded.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 20px" }}>
            {error.digest
              ? `A server error occurred. Reference: ${error.digest}`
              : "Reload the page to try again."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 8,
              border: "none",
              background: "#1a4a7a",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
