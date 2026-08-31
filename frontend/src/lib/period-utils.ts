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

// The sentinel reporting_periods row (code = "BASELINE", seeded in
// db/seed_dev.sql) that project-creation-time records reference instead of
// a real Weekly/Monthly period — see 04_health_declarations.sql and
// 30_ai_field_suggestions.sql/31_ai_row_suggestions.sql. Returns null while
// reference data is still loading or the seed hasn't run.
export function useBaselinePeriodId(): string | null {
  const { data: periods = [] } = useReportingPeriods();
  return periods.find((p) => p.code === "BASELINE")?.id ?? null;
}
