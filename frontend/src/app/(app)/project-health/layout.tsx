// Own top-level route (sibling to /dashboard, /project-reporting, ...) rather
// than nested under /dashboard, so this gets its own main+aside layout
// instead of inheriting dashboard/layout.tsx's single-<main> wrapper — same
// pattern as project-reporting/[projectId]/layout.tsx's ProjectNav.
//
// The right-hand ProjectHealthNav ("Reports") is hidden for now — it was
// taking up too much width and is slated for removal per the design; the
// component itself is untouched, so restoring it is just re-adding the
// import and <ProjectHealthNav /> below.
export default function ProjectHealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      {children}
    </main>
  );
}
