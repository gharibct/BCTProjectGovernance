import { PageBanner } from "@/components/shell/page-banner";

// Own top-level route (sibling to /de-assessment, /de-projects, ...) so the
// Project Activity Restriction screen gets a full-width <main>. No right-hand
// nav rail. PageBanner is mounted here so Save / Lift feedback is visible.
export default function ProjectActivityRestrictionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      <div>
        <PageBanner />
      </div>
      {children}
    </main>
  );
}
