// Shared model for the Reporting Hubs (Project / Account / Geo) — the
// per-period submission timeline behind the progress rings and the activity
// heatmaps. Computed server-side (GET /{scope}s/{id}/reporting-activity, see
// backend/app/services/reporting_activity.py); this module holds the shared
// TS shapes plus the small helpers the hubs use to render it.

// "n/a" — nothing was owed: the period is before the scope's start date, or
// after the reporting window closes (today, or the scope's end date). Drawn
// as a plain box, left out of the ring totals / percentage.
export type PeriodActivityStatus = "on-time" | "late" | "pending" | "n/a";

export type PeriodActivityItem = {
  period_id: string;
  label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: PeriodActivityStatus;
  has_report: boolean;
};

export type ReportingActivitySeries = {
  items: PeriodActivityItem[]; // chronological (oldest first)
  counts: {
    on_time: number;
    late: number;
    pending: number;
    not_applicable: number;
    submitted: number;
    total: number; // in-window periods only (on_time + late + pending)
  };
  pct: number;
};

export const EMPTY_ACTIVITY_SERIES: ReportingActivitySeries = {
  items: [],
  counts: { on_time: 0, late: 0, pending: 0, not_applicable: 0, submitted: 0, total: 0 },
  pct: 0,
};

export const ACTIVITY_STATUS_LABEL: Record<PeriodActivityStatus, string> = {
  "on-time": "On Time",
  late: "Late",
  pending: "Pending",
  "n/a": "Not due",
};

// The Week/Month Selection combos only offer periods that are (a) in the
// reporting window (status !== "n/a" — after the scope start, not past its
// end) and (b) fully ended, newest first, capped at COMBO_PERIOD_LIMIT back.
export const COMBO_PERIOD_LIMIT = 15;

// Local YYYY-MM-DD "today" — same string form as PeriodActivityItem.end_date,
// so a lexicographic compare is a date compare.
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// A period is selectable in a combo only once it has fully ended (end_date
// strictly before today) and a report was owed for it (status !== "n/a").
// The still-running period stays in the activity heatmap, just not the combo.
export function isSelectablePeriod(item: PeriodActivityItem, today: string = todayISO()): boolean {
  return item.status !== "n/a" && item.end_date < today;
}

export function comboPeriods(items: PeriodActivityItem[]): PeriodActivityItem[] {
  return items
    .filter((i) => isSelectablePeriod(i))
    .slice(-COMBO_PERIOD_LIMIT)
    .reverse();
}

// The period each combo defaults to: the most recent selectable one (the
// latest to have ended). undefined when nothing is selectable yet — the hubs
// then disable the combo and its action button.
export function currentActivityPeriodId(items: PeriodActivityItem[]): string | undefined {
  return comboPeriods(items)[0]?.period_id;
}

// 0-11 month index of an activity item, from its period start date.
export function monthOfItem(item: PeriodActivityItem): number {
  return Number(item.start_date.slice(5, 7)) - 1;
}
