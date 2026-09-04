import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /de-assessment, /de-findings, ...) — a
// read-only project browser for the Delivery Excellence role. Same shell as
// de-approval/layout.tsx; serves both the list (/de-projects) and the detail
// (/de-projects/[projectId]).
export default function DeProjectsLayout({
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
