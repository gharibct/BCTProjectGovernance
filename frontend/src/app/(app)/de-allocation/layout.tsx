import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /de-assessment, /dashboard, ...) so the
// DE-owned allocation screen gets its own full-width <main>. Same shape as
// de-assessment/layout.tsx. PageBanner is mounted here so Save Allocations
// feedback is visible.
export default function DeAllocationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      <div className="mx-auto max-w-[1400px]">
        <PageBanner />
      </div>
      {children}
    </main>
  );
}
