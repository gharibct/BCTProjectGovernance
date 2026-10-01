"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { NativeSelect } from "@/components/ui/native-select";
import { PageBanner } from "@/components/shell/page-banner";
import type { PeriodActivityItem } from "@/lib/reporting-activity";

// Shared calendar-style landing page body for the weekly Delivery Status
// reporting hubs (Project and Account): KPI cards, a compliance donut and a
// month-by-month reporting calendar. The caller supplies the activity timeline,
// the filed reports and where a date links to; `children` render below the calendar.

type DateState = "approved" | "submitted" | "rejected" | "due" | "not-due" | "not-applicable";
type Filter = "submitted" | "not-submitted" | "approved" | "rejected" | "late";

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const RANGE_OPTIONS = [
  { months: 3, label: "Last 3 Months" },
  { months: 6, label: "Last 6 Months" },
  { months: 12, label: "Last 12 Months" },
] as const;

const BOX_CLASS: Record<DateState, string> = {
  approved: "border-emerald-600 bg-emerald-500 text-white",
  submitted: "border-blue-600 bg-blue-500 text-white",
  rejected: "border-red-600 bg-red-500 text-white",
  due: "border-amber-500 bg-amber-400 text-amber-950",
  "not-due": "border-slate-300 bg-slate-200 text-slate-500",
  // Reporting not applicable (outside the project's life): greyed like a disabled control.
  "not-applicable": "border-slate-300 bg-slate-200 text-slate-500",
};
const STATE_LABEL: Record<DateState, string> = {
  approved: "Approved",
  submitted: "Submitted",
  rejected: "Rejected",
  due: "Due / Not Submitted",
  "not-due": "Not Due",
  "not-applicable": "Not Applicable",
};

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

type CalendarDate = {
  item: PeriodActivityItem;
  state: DateState;
  late: boolean;
  submittedOn: string | null;
};

export type CalendarReport = { period_id: string; status: string; updated_at: string };

export function DeliveryCalendarView({
  title,
  subtitle,
  weeklyItems,
  reports,
  hrefForPeriod,
  scopeStart = null,
  scopeEnd = null,
  children,
}: {
  title: string;
  subtitle?: string;
  // Weekly activity items covering the current and previous year.
  weeklyItems: PeriodActivityItem[];
  reports: CalendarReport[];
  hrefForPeriod: (periodId: string) => string;
  // Reporting scope's life (project dates) — periods outside it read as Not Applicable.
  scopeStart?: string | null;
  scopeEnd?: string | null;
  // Rendered below the calendar; receives the selected window so extra
  // sections can follow the same Last 3 / 6 / 12 Months range.
  children?: (ctx: { months: number }) => ReactNode;
}) {
  const [months, setMonths] = useState<number>(6);
  const [filter, setFilter] = useState<Filter | null>(null);

  const dates = useMemo<CalendarDate[]>(() => {
    const today = todayISO();
    const reportByPeriod = new Map(reports.map((r) => [r.period_id, r]));
    return weeklyItems.map((item) => {
      const report = reportByPeriod.get(item.period_id);
      const owed = item.status !== "n/a" && item.end_date <= today;
      let state: DateState = "not-due";
      if (report?.status === "Approved") state = "approved";
      else if (report?.status === "Submitted") state = "submitted";
      else if (report?.status === "Rejected") state = "rejected";
      else if (owed) state = "due";
      else if (
        item.status === "n/a" &&
        ((scopeStart !== null && item.end_date < scopeStart) ||
          (scopeEnd !== null && item.start_date > scopeEnd))
      )
        state = "not-applicable";
      const filed = state === "approved" || state === "submitted";
      return {
        item,
        state,
        late: item.status === "late",
        submittedOn: filed && report ? report.updated_at : null,
      };
    });
  }, [reports, weeklyItems, scopeStart, scopeEnd]);

  // Rolling window, newest first: the current month, then the (months - 1) before it, grouped
  // by the month of each period's reporting (end) date.
  const monthGroups = useMemo(() => {
    const now = new Date();
    const groups: { key: string; year: number; month: number; dates: CalendarDate[] }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      groups.push({ key: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth(), dates: [] });
    }
    const byKey = new Map(groups.map((g) => [g.key, g]));
    for (const date of dates) {
      const y = Number(date.item.end_date.slice(0, 4));
      const m = Number(date.item.end_date.slice(5, 7)) - 1;
      byKey.get(`${y}-${m}`)?.dates.push(date);
    }
    for (const g of groups) g.dates.sort((a, b) => b.item.end_date.localeCompare(a.item.end_date));
    return groups;
  }, [dates, months]);

  const stats = useMemo(() => {
    const inWindow = monthGroups.flatMap((g) => g.dates);
    const approved = inWindow.filter((d) => d.state === "approved").length;
    const submittedPending = inWindow.filter((d) => d.state === "submitted").length;
    const rejected = inWindow.filter((d) => d.state === "rejected").length;
    const notSubmitted = inWindow.filter((d) => d.state === "due").length;
    const late = inWindow.filter((d) => d.late).length;
    const submitted = approved + submittedPending;
    const expected = submitted + rejected + notSubmitted;
    return {
      approved,
      rejected,
      notSubmitted,
      late,
      submitted,
      expected,
      pct: expected ? Math.round((submitted / expected) * 100) : 0,
    };
  }, [monthGroups]);

  const matchesFilter = (d: CalendarDate): boolean => {
    switch (filter) {
      case null:
        return true;
      case "submitted":
        return d.state === "approved" || d.state === "submitted";
      case "not-submitted":
        return d.state === "due";
      case "approved":
        return d.state === "approved";
      case "rejected":
        return d.state === "rejected";
      case "late":
        return d.late;
    }
  };

  const kpis: { key: Filter | null; label: string; value: number; tone: string }[] = [
    { key: null, label: "Expected Reports", value: stats.expected, tone: "text-slate-900" },
    { key: "submitted", label: "Submitted", value: stats.submitted, tone: "text-blue-600" },
    { key: "not-submitted", label: "Not Submitted", value: stats.notSubmitted, tone: "text-amber-600" },
    { key: "approved", label: "Approved", value: stats.approved, tone: "text-emerald-600" },
    { key: "rejected", label: "Rejected", value: stats.rejected, tone: "text-red-600" },
    { key: "late", label: "Late Submissions", value: stats.late, tone: "text-orange-600" },
  ];

  const R = 42;
  const C = 2 * Math.PI * R;
  const submittedLen = stats.expected ? (stats.submitted / stats.expected) * C : 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="w-44">
          <NativeSelect
            aria-label="Period"
            className="h-9 bg-white text-sm"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.months} value={o.months}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <PageBanner />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const active = kpi.key !== null && filter === kpi.key;
          return (
            <button
              key={kpi.label}
              type="button"
              disabled={kpi.key === null}
              onClick={() => setFilter(active ? null : kpi.key)}
              aria-pressed={active}
              className={cn(
                "rounded-xl border bg-white p-4 text-center shadow-sm transition",
                kpi.key !== null && "cursor-pointer hover:border-slate-300 hover:shadow",
                active ? "border-[#1a6fc4] ring-2 ring-[#1a6fc4]/30" : "border-slate-200",
              )}
            >
              <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">{kpi.label}</div>
              <div className={cn("mt-2 text-3xl font-bold", kpi.tone)}>{kpi.value}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <section className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="self-start font-bold text-slate-900">Submission Compliance</h2>
          <div className="relative mt-4 size-36">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="#fcd34d" strokeWidth="14" />
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke="#10b981"
                strokeWidth="14"
                strokeDasharray={`${submittedLen} ${C}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">{stats.pct}%</span>
              <span className="text-[11px] text-slate-500">Submitted</span>
            </div>
          </div>
          <div className="mt-4 flex w-full flex-wrap justify-around gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              Submitted <b className="text-slate-900">{stats.submitted}</b>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="size-2.5 rounded-full bg-amber-300" />
              Not Submitted <b className="text-slate-900">{stats.expected - stats.submitted}</b>
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">Reporting Calendar</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              {(["approved", "submitted", "rejected", "due", "not-due"] as DateState[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn("size-3.5 rounded-[3px] border", BOX_CLASS[s])} />
                  {STATE_LABEL[s]}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-orange-500" />
                Late submission
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monthGroups.map((g) => (
              <div key={g.key} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-xs font-bold tracking-wide text-slate-500">
                  {MONTH_NAMES[g.month]} {g.year}
                </div>
                {g.dates.length === 0 ? (
                  <p className="py-2 text-xs text-slate-400">No reporting dates</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {g.dates.map((d) => {
                      const dimmed = !matchesFilter(d);
                      const clickable = d.state !== "not-due" && d.state !== "not-applicable";
                      const tooltip = [
                        `Reporting date: ${formatDate(d.item.end_date)}`,
                        `Status: ${d.state === "due" ? "Not Submitted" : STATE_LABEL[d.state]}`,
                        d.submittedOn ? `Submitted: ${formatDate(d.submittedOn)}` : null,
                        d.submittedOn ? (d.late ? "Late" : "On time") : null,
                      ]
                        .filter(Boolean)
                        .join("\n");
                      const box = (
                        <span
                          className={cn(
                            "relative flex h-9 w-10 items-center justify-center rounded-md border text-sm font-semibold transition",
                            BOX_CLASS[d.state],
                            clickable && "underline underline-offset-2 hover:brightness-95",
                            dimmed && "opacity-25",
                            filter && !dimmed && "ring-2 ring-[#1a6fc4]/50",
                          )}
                        >
                          {d.item.end_date.slice(8, 10)}
                          {d.late ? (
                            <span className="absolute -top-1 -right-1 size-2.5 rounded-full border border-white bg-orange-500" />
                          ) : null}
                        </span>
                      );
                      return clickable ? (
                        <Link
                          key={d.item.period_id}
                          title={tooltip}
                          href={hrefForPeriod(d.item.period_id)}
                        >
                          {box}
                        </Link>
                      ) : (
                        <span key={d.item.period_id} title={tooltip} className="cursor-default">
                          {box}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
      {children?.({ months })}
    </div>
  );
}
