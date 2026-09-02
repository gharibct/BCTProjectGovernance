import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /de-assessment, /project-health, ...) so the
// DE Findings screen gets its own full-width <main>. Same shell as
// de-assessment/layout.tsx — no right-hand nav rail. PageBanner is mounted
// here so New Finding / status-transition feedback is visible.
export default function DeFindingsLayout({
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
