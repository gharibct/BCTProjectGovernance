import type { QueryClient } from "@tanstack/react-query";

// Data derived from the reports below it: Project -> Account -> Geo rollups
// (Key Metrics + pullable items), the by-period submission lists, and every
// dashboard (their query keys start with "dashboard-"). Mark them stale after a
// project / account report, register item or health rating is written, so the
// next screen that reads them refetches — rather than showing what was cached
// before the change. Queries not currently on screen are only marked stale and
// refetch when next opened, so this costs nothing extra for unrelated screens.
const DERIVED_KEYS = [
  "account-rollup",
  "account-health-rollup",
  "geo-rollup",
  "status-reports-by-period",
  "performance-status-by-period",
  "reporting-activity",
  "regional-reporting-activity",
];

export function invalidateReportingDerived(queryClient: QueryClient) {
  for (const key of DERIVED_KEYS) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
  queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("dashboard-"),
  });
}
