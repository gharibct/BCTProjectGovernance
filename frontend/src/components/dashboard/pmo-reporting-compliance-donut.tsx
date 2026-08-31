import type { PmoReportingComplianceSummary } from "@/lib/api/pmo-dashboard";

// "Reporting Compliance" ring (design-reference/pmo-mysummary.jpg) — the
// nearest active reporting period's On Time/Late/Missing/Rework split across
// every org-wide project (see services/dashboard.py's
// _project_reporting_bucket); every project lands in exactly one bucket, so
// the four counts always sum to the total.

const SEGMENTS: {
  key: keyof Omit<PmoReportingComplianceSummary, never>;
  label: string;
  dotClass: string;
  stroke: string;
}[] = [
  { key: "on_time_count", label: "On Time", dotClass: "bg-emerald-500", stroke: "#10b981" },
  { key: "late_count", label: "Late", dotClass: "bg-amber-400", stroke: "#fbbf24" },
  { key: "missing_count", label: "Missing", dotClass: "bg-red-600", stroke: "#dc2626" },
  { key: "rework_count", label: "Rework", dotClass: "bg-slate-400", stroke: "#94a3b8" },
];

const RADIUS = 70;
const STROKE_WIDTH = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ReportingComplianceDonut({ summary }: { summary: PmoReportingComplianceSummary }) {
  const total =
    summary.on_time_count + summary.late_count + summary.missing_count + summary.rework_count;
  const onTimePct = total > 0 ? Math.round((summary.on_time_count / total) * 100) : 0;

  let offset = 0;
  const arcs = SEGMENTS.map((segment) => {
    const count = summary[segment.key];
    const fraction = total > 0 ? count / total : 0;
    const length = fraction * CIRCUMFERENCE;
    const arc = { ...segment, count, length, offset };
    offset += length;
    return arc;
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="border-b border-slate-200 pb-3 font-bold text-slate-900">Reporting Compliance</h2>

      <div className="relative flex justify-center py-6">
        <svg viewBox="0 0 180 180" className="size-44 -rotate-90">
          <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={STROKE_WIDTH} />
          {total > 0
            ? arcs
                .filter((arc) => arc.length > 0)
                .map((arc) => (
                  <circle
                    key={arc.label}
                    cx="90"
                    cy="90"
                    r={RADIUS}
                    fill="none"
                    stroke={arc.stroke}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                    strokeDashoffset={-arc.offset}
                  />
                ))
            : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-slate-900">{onTimePct}%</span>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-slate-100 text-sm">
        {SEGMENTS.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between py-2">
            <span className="flex items-center gap-2 text-slate-600">
              <span className={`inline-block size-2.5 rounded-full ${segment.dotClass}`} />
              {segment.label}
            </span>
            <span className="font-semibold text-slate-900">{summary[segment.key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
