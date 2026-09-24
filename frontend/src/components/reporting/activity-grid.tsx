"use client";

import { cn } from "@/lib/utils";
import {
  ACTIVITY_DISPLAY_LABEL,
  activityDisplayStatus,
  monthOfItem,
  type ActivityDisplayStatus,
  type PeriodActivityItem,
} from "@/lib/reporting-activity";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CELL_CLASS: Record<ActivityDisplayStatus, string> = {
  submitted: "bg-emerald-500",
  "not-submitted": "bg-red-400",
  // Before project start or still in the future — a plain outline box, no fill.
  "n/a": "border border-slate-200",
};

// "reporting" is the report-submission legend; "communications" (Customer
// Communications heatmap) has a single state — a green box per month in which
// a communication was shared.
function Legend({ kind }: { kind: "reporting" | "communications" }) {
  const entries: { label: string; status: ActivityDisplayStatus }[] =
    kind === "communications"
      ? [{ label: "Communication Shared", status: "submitted" }]
      : (["n/a", "not-submitted", "submitted"] as ActivityDisplayStatus[]).map((status) => ({
          label: ACTIVITY_DISPLAY_LABEL[status],
          status,
        }));
  return (
    <div className="mt-auto flex items-center justify-end gap-3 pt-4 text-xs text-slate-500">
      {entries.map(({ label, status }) => (
        <span key={status} className="flex items-center gap-1.5">
          {label}
          <span className={cn("size-3 rounded-sm", CELL_CLASS[status])} />
        </span>
      ))}
    </div>
  );
}

export function ReportingActivityGrid({
  title,
  items,
  variant,
  legend = "reporting",
}: {
  title?: string;
  items: PeriodActivityItem[];
  variant: "weekly" | "monthly";
  legend?: "reporting" | "communications";
}) {
  // Weekly: one small square per week, grouped under its month (a week is
  // filed by the month its Monday falls in). A calendar month has at most 5
  // week-starts, so a 2-wide grid never exceeds 3 rows and the whole strip
  // fits 12 months across without horizontal scroll.
  const weeksByMonth: PeriodActivityItem[][] = Array.from({ length: 12 }, () => []);
  for (const item of items) weeksByMonth[monthOfItem(item)].push(item);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {title ? <h3 className="mb-4 font-bold text-slate-900">{title}</h3> : null}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No reporting periods for this year.</p>
      ) : variant === "weekly" ? (
        <div className="grid grid-cols-6 gap-x-2 gap-y-3 min-[420px]:grid-cols-12">
          {weeksByMonth.map((weeks, month) => (
            <div key={month} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-slate-400">{MONTHS[month]}</span>
              <div className="grid min-h-[42px] grid-cols-2 gap-1">
                {weeks.map((item) => (
                  <div
                    key={item.period_id}
                    className={cn("size-3.5 rounded-[3px]", CELL_CLASS[activityDisplayStatus(item.status)])}
                    title={`${item.label} — ${ACTIVITY_DISPLAY_LABEL[activityDisplayStatus(item.status)]}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-1.5">
          {items.map((item) => (
            <div key={item.period_id} className="flex flex-col items-center gap-1">
              <span className="text-xs text-slate-400">{MONTHS[monthOfItem(item)]}</span>
              <div
                className={cn("aspect-square w-full rounded-[4px]", CELL_CLASS[activityDisplayStatus(item.status)])}
                title={`${item.label} — ${ACTIVITY_DISPLAY_LABEL[activityDisplayStatus(item.status)]}`}
              />
            </div>
          ))}
        </div>
      )}

      <Legend kind={legend} />
    </div>
  );
}
