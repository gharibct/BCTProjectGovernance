import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /de-findings, /project-review, ...) so the
// PM Findings screen gets its own full-width <main>. Same shell as
// de-findings/layout.tsx. PageBanner is mounted here so "Action Taken"
// feedback is visible.
export default function PmFindingsLayout({
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
