"use client";

import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

import { HealthPill, RATING_FROM_API } from "@/components/project-charter/health-declaration";
import { STATUS_CATEGORIES } from "@/lib/status-categories";
import {
  useReviewHealthDeclaration,
  useReviewStatusItems,
  useReviewStatusReports,
  type ReviewScope,
} from "@/lib/api/status-review";

// Section 1 of a Status Review page — a snapshot header (Revenue / Projects /
// ON:OFF FTE / overall RAG) plus a 2x2 grid of the 4 ProjectStatusCategory
// quadrants, each rendered as a plain read-only bullet list. Inspired by
// design-reference/Review-Overview.html's content/layout only — no AI
// confidence badges or "Source:" lines (this app has no live AI-extraction
// pipeline feeding this screen yet), and no fabricated per-quadrant severity
// color — every card uses the same neutral accent.

function SnapshotStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function QuadrantCard({
  scope,
  scopeId,
  periodId,
  label,
  category,
  icon: Icon,
}: {
  scope: ReviewScope;
  scopeId: string;
  periodId: string;
  label: string;
  category: (typeof STATUS_CATEGORIES)[number]["category"];
  icon: (typeof STATUS_CATEGORIES)[number]["icon"];
}) {
  const { data: items = [] } = useReviewStatusItems(scope, scopeId, periodId, category);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 border-l-4 border-l-[#1a6fc4] bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800 uppercase">
        <Icon className="size-4 text-[#1a6fc4]" />
        {label}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No entries recorded for this period.</p>
      ) : (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item.id}>{item.description}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OverviewSection({
  scope,
  scopeId,
  periodId,
}: {
  scope: ReviewScope;
  scopeId: string;
  periodId: string;
}) {
  const { data: reports = [] } = useReviewStatusReports(scope, scopeId);
  const report = reports.find((r) => r.period_id === periodId);
  const { data: declaration } = useReviewHealthDeclaration(scope, scopeId, periodId);

  // Decimal fields come back from the API as strings like "5.00" — trim the
  // trailing zeros so a whole-number FTE count doesn't show ".00".
  const fteRatio =
    report?.onsite_fte != null && report?.offshore_fte != null
      ? `${Number(report.onsite_fte)}:${Number(report.offshore_fte)}`
      : "—";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <BarChart3 className="size-5 text-[#1a6fc4]" />
        Overview
      </h2>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SnapshotStat label="Revenue" value={report?.revenue ?? "—"} />
        <SnapshotStat label="Projects" value={report?.projects_count ?? "—"} />
        <SnapshotStat label="ON:OFF FTE" value={fteRatio} />
        <SnapshotStat
          label="RAG Status"
          value={
            declaration ? (
              <HealthPill rating={RATING_FROM_API[declaration.overall_rating]} />
            ) : (
              <span className="text-sm font-semibold text-slate-400">Not assessed</span>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {STATUS_CATEGORIES.map((c) => (
          <QuadrantCard
            key={c.category}
            scope={scope}
            scopeId={scopeId}
            periodId={periodId}
            label={c.label}
            category={c.category}
            icon={c.icon}
          />
        ))}
      </div>
    </section>
  );
}
