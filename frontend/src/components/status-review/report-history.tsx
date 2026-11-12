"use client";

import { StatusBadge } from "@/components/forms/status-badge";
import {
  useStatusReportHistory,
  type ReviewScope,
  type ReviewStatusReport,
} from "@/lib/api/status-review";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Audit trail of a report: every submission, recall, approval / rejection and
// baseline, newest first — survives resubmission, unlike the review/recall
// fields on the report itself.
export function ReportHistory({
  scope,
  scopeId,
  report,
}: {
  scope: ReviewScope;
  scopeId: string;
  report: ReviewStatusReport | undefined;
}) {
  const { data: events = [], isLoading } = useStatusReportHistory(
    scope,
    scopeId,
    report?.id ?? null,
    `${report?.status}|${report?.updated_at}`
  );
  if (!report || isLoading) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-bold text-slate-900">Submission &amp; Approval History</h2>
      </div>
      {events.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">No history recorded for this report.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-[#E4E9EE]">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-x-4 px-5 py-3 text-sm">
              <span className="w-40 shrink-0 text-slate-500">{formatDateTime(e.created_at)}</span>
              <StatusBadge value={e.to_status} />
              <span className="shrink-0 font-semibold text-slate-800">{e.event_type}</span>
              <span className="shrink-0 text-slate-600">by {e.actor_name ?? "—"}</span>
              {e.comment ? (
                <span className="min-w-0 flex-1 truncate text-slate-600" title={e.comment}>
                  — {e.comment}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
