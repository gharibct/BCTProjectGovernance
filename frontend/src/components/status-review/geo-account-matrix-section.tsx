"use client";

import { useDashboardSummary } from "@/lib/api/dashboard";
import { GovernanceMatrix } from "@/components/dashboard/governance-matrix";

// Geo has no health-declaration entry screen of its own (see
// design-reference gap noted this session — the backend endpoint exists,
// nothing writes to it), so Geo Review shows the same Account Governance
// Matrix as the CXO Dashboard instead of an always-empty RAG Status
// section, scoped to just this geo's accounts. Reflects each account's
// latest declaration (the dashboard summary has no period concept), not
// necessarily the period selected on this review page.
export function GeoAccountMatrixSection({ geoId }: { geoId: string }) {
  const { data } = useDashboardSummary({ geo_ids: [geoId] });

  return (
    <GovernanceMatrix
      heading="Account Governance Matrix"
      rows={data?.account_matrix}
      entityHref={(id) => `/account-review/${id}`}
      emptyLabel="No accounts in scope."
    />
  );
}
