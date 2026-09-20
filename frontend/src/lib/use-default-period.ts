import { useReportingActivity } from "@/lib/api/project-status";
import { useRegionalReportingActivity, type RegionalScope } from "@/lib/api/regional-status";
import { currentActivityPeriodId } from "@/lib/reporting-activity";

// Default period for a report screen reached without ?period=: the oldest
// period whose report is still not submitted (see currentActivityPeriodId).
// undefined while the activity loads or when nothing is selectable yet.
export function useProjectDefaultPeriodId(
  projectId: string | null,
  type: "weekly" | "monthly",
): string | undefined {
  const { data } = useReportingActivity(projectId);
  return data ? currentActivityPeriodId(data[type].items) : undefined;
}

// Account / Geo reporting has a single (weekly) cadence.
export function useRegionalDefaultPeriodId(scope: RegionalScope, scopeId: string | null): string | undefined {
  const { data } = useRegionalReportingActivity(scope, scopeId);
  return data ? currentActivityPeriodId(data.weekly.items) : undefined;
}
