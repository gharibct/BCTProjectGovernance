"use client";

import { useOpenNcs } from "@/lib/api/dashboard";
import { OpenNcList } from "@/components/dashboard/open-nc-list";
import type { ReviewScope } from "@/lib/api/status-review";

// The "Open Alerts" list section (open Alert-classified findings) for a single
// Project / Account / Geo — rendered as the last section on the per-entity
// dashboards and Review screens. The matching KPI count sits in the Overview
// snapshot row (overview-section.tsx). On account/geo scope the list rolls up
// every project under that entity, so it carries an extra Account column.

export function OpenNcSection({ scope, scopeId }: { scope: ReviewScope; scopeId: string }) {
  const { data } = useOpenNcs(scope, scopeId);
  return <OpenNcList rows={data?.open_ncs ?? []} showAccount={scope !== "project"} />;
}
