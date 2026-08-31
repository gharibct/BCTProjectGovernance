import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /de-assessment, /dashboard, ...) so the
// DE-owned approval flow gets its own full-width <main>. Same shape as
// de-assessment/layout.tsx. Serves both the queue (/de-approval) and the
// Project Governance Review workspace (/de-approval/[projectId]). PageBanner is
// mounted here so Approve / Return feedback is visible.
export default function DeApprovalLayout({
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
