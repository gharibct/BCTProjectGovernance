"use client";

import { useOpenAlertsForReport } from "@/lib/api/dashboard";
import { OpenNcList } from "@/components/dashboard/open-nc-list";
import type { OpenNcRow } from "@/lib/api/dashboard";
import type { ReviewScope } from "@/lib/api/status-review";

// The "Open Alerts" list section (open Alert-classified findings) for a single
// Project / Account / Geo — rendered as the last section on the per-entity
// dashboards and Review screens. The matching KPI count sits in the Overview
// snapshot row (overview-section.tsx). On account/geo scope the list rolls up
// every project under that entity, so it carries an extra Account column.
//
// While `report` is missing or still Draft/Rejected, this is a live,
// unfiltered read of every currently open Alert — new Alerts (or findings
// closed) show up immediately. Once the report is Submitted/Approved it's
// frozen to exactly what was open at submission time, so later changes to
// the underlying findings (e.g. closing one) don't alter an already-filed
// report. See lib/api/dashboard.ts's useOpenAlertsForReport.
export function OpenNcSection({
  scope,
  scopeId,
  report,
}: {
  scope: ReviewScope;
  scopeId: string;
  report?: { status: string; open_alerts_count: number; open_alerts_snapshot: OpenNcRow[] | null };
}) {
  const data = useOpenAlertsForReport(scope, scopeId, report);
  return <OpenNcList rows={data?.open_ncs ?? []} showAccount={scope !== "project"} />;
}
