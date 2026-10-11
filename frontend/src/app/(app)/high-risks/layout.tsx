// Same page chrome as /project-health (bluish gradient + padding) — High Risks
// is a Project Health-style portfolio view, not a plain dashboard page.
export default function HighRisksLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-w-0 flex-1 bg-gradient-to-br from-sky-100/70 via-blue-50/40 to-white px-10 py-8">
      {children}
    </main>
  );
}
