import { EmptyState } from "@/components/forms/empty-state";

// Placeholder body for the 12 Project Health drill-down screens
// (design-reference/project-health-screens.md) — the nav and routes exist
// now, the real KPI-row + data-grid content for each ships incrementally.
// Previewing the planned KPIs/columns here (rather than a bare "empty" state)
// keeps the placeholder honest about what's coming instead of looking broken.
export function ProjectHealthComingSoon({
  title,
  kpis,
  columns,
}: {
  title: string;
  kpis: string[];
  columns: string[];
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1.5 text-slate-500">Portfolio-wide {title.toLowerCase()} report</p>
      </header>

      <EmptyState>This screen isn&apos;t built yet — it&apos;s next up after the Project Health overview.</EmptyState>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Planned KPIs</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-700">
            {kpis.map((kpi) => (
              <li key={kpi}>{kpi}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Planned Grid Columns</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-700">
            {columns.map((column) => (
              <li key={column}>{column}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
