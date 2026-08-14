"use client";

import { LayoutGrid } from "lucide-react";

import { useDashboardSummary } from "@/lib/api/dashboard";
import { GovernanceMatrix } from "@/components/dashboard/governance-matrix";
import { sectionAccentColor } from "@/lib/section-accent-colors";

// Geo has no health-declaration entry screen of its own (see
// design-reference gap noted this session — the backend endpoint exists,
// nothing writes to it), so Geo Review shows the same Account Governance
// Matrix as the CXO Dashboard instead of an always-empty RAG Status
// section, scoped to just this geo's accounts. Reflects each account's
// latest declaration (the dashboard summary has no period concept), not
// necessarily the period selected on this review page.
//
// Shared between /geo-review (CXO's plain reviewer screen) and the Geo
// Dashboard (regional-reporting/dashboard-view.tsx) — `accented` opts into
// the Dashboard's "Summary" heading + colored PPT-divider header (accent
// slot 6, violet — distinct from Delivery's blue directly underneath it on
// that page) without changing /geo-review's look.
export function GeoAccountMatrixSection({ geoId, accented }: { geoId: string; accented?: boolean }) {
  const { data } = useDashboardSummary({ geo_ids: [geoId] });

  return (
    <GovernanceMatrix
      heading={accented ? "Summary" : "Account Governance Matrix"}
      icon={accented ? LayoutGrid : undefined}
      accentColor={accented ? sectionAccentColor(6) : undefined}
      entityColumnLabel="Accounts"
      rows={data?.account_matrix}
      entityHref={(id) => `/account-review/${id}`}
      emptyLabel="No accounts in scope."
    />
  );
}
