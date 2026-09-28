import { useReportingPeriods } from "@/lib/api/reference-data";
import type { PeriodType, ReportingPeriod } from "@/lib/api/reference-data";

// The period whose [start_date, end_date] brackets today, falling back to
// the most recent active one of that type if none does (e.g. the seeded
// range doesn't cover "today" yet). Shared by the Reporting Hub's starter
// cards (default period to offer) and Document Processing (default upload
// folder when no ?period= is in the URL yet).
export function currentPeriod(periods: ReportingPeriod[], type: PeriodType): ReportingPeriod | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const typed = periods.filter((p) => p.period_type === type);
  return (
    typed.find((p) => p.start_date <= today && today <= p.end_date) ??
    typed.filter((p) => p.is_active).sort((a, b) => a.start_date.localeCompare(b.start_date)).at(-1)
  );
}

// Periods of one type that fall inside the reporting look-back window:
// nothing in the future (start_date after today), and nothing older than
// `monthsBack` months before today. Project Reporting offers 3 months of
// Weekly periods and 6 months of Monthly ones. Returned most-recent first
// so the current period sits at the top of the picker.
export function recentPeriods(
  periods: ReportingPeriod[],
  type: PeriodType,
  monthsBack: number,
): ReportingPeriod[] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return periods
    .filter((p) => p.period_type === type)
    .filter((p) => p.start_date <= todayStr && p.start_date >= cutoffStr)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
}

// Completed Weekly periods, most recent first: reporting happens on a period's
// end date, so a week is complete once end_date <= today (local date). The same
// weeks the Delivery Status reporting combos offer; the label is the end date.
export function completedWeeklyPeriods(periods: ReportingPeriod[], limit = 15): ReportingPeriod[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return periods
    .filter((p) => p.period_type === "Weekly" && p.is_active && p.end_date <= todayStr)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))
    .slice(0, limit);
}

// The latest Weekly periods that have started, most recent first — the current
// (in-progress) week plus the ones before it, `limit` in total. The DE
// Assessment period combo uses this: unlike completedWeeklyPeriods, an
// assessment can be recorded against the week still in progress.
export function latestWeeklyPeriods(periods: ReportingPeriod[], limit = 10): ReportingPeriod[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return periods
    .filter((p) => p.period_type === "Weekly" && p.is_active && p.start_date <= todayStr)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))
    .slice(0, limit);
}

// The sentinel reporting_periods row (code = "BASELINE", seeded in
// db/seed_dev.sql) that project-creation-time records reference instead of
// a real Weekly/Monthly period — see 04_health_declarations.sql and
// 30_ai_field_suggestions.sql/31_ai_row_suggestions.sql. Returns null while
// reference data is still loading or the seed hasn't run.
export function useBaselinePeriodId(): string | null {
  const { data: periods = [] } = useReportingPeriods();
  return periods.find((p) => p.code === "BASELINE")?.id ?? null;
}
