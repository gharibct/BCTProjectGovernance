import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /dashboard, /project-reporting, ...) so the
// DE-owned assessment flow gets its own full-width <main> instead of inheriting
// dashboard/layout.tsx. No right-hand nav rail — same shape as
// project-health/layout.tsx. Serves both the queue (/de-assessment) and the
// workspace (/de-assessment/[projectId]). PageBanner is mounted here (no
// area header renders it) so Save Draft / Submit feedback is visible.
export default function DeAssessmentLayout({
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
