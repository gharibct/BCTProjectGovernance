import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { STATUS_CATEGORIES } from "@/lib/status-categories";
import { useAccountHealthItems } from "@/lib/api/account-health-declarations";
import { useRegionalStatusItems, useRegionalStatusReports } from "@/lib/api/regional-status";
import {
  ragSectionId,
  SECTION_IDS,
  statusSectionId,
  type ReportProgress,
} from "@/components/reporting/report-progress";

// "N of 11 sections completed" for the Account Delivery Status Report: Overview, the
// four status registers and the six RAG categories (Customer Communications is
// its own page for Account). A section counts once it has content saved.
export function useAccountReportProgress(accountId: string | null, periodId: string | null): ReportProgress {
  const { data: reports } = useRegionalStatusReports("account", accountId);
  const report = reports?.find((r) => r.period_id === periodId);
  const metricsDone =
    !!report &&
    [report.revenue, report.onsite_fte, report.offshore_fte, report.projects_count].every(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );

  // Fixed-length lists, so the hooks are called in a stable order.
  const s0 = useRegionalStatusItems("account", accountId, periodId, STATUS_CATEGORIES[0].category).data;
  const s1 = useRegionalStatusItems("account", accountId, periodId, STATUS_CATEGORIES[1].category).data;
  const s2 = useRegionalStatusItems("account", accountId, periodId, STATUS_CATEGORIES[2].category).data;
  const s3 = useRegionalStatusItems("account", accountId, periodId, STATUS_CATEGORIES[3].category).data;
  const statusData = [s0, s1, s2, s3];

  const h0 = useAccountHealthItems(accountId, periodId, HEALTH_CATEGORIES[0].category).data;
  const h1 = useAccountHealthItems(accountId, periodId, HEALTH_CATEGORIES[1].category).data;
  const h2 = useAccountHealthItems(accountId, periodId, HEALTH_CATEGORIES[2].category).data;
  const h3 = useAccountHealthItems(accountId, periodId, HEALTH_CATEGORIES[3].category).data;
  const h4 = useAccountHealthItems(accountId, periodId, HEALTH_CATEGORIES[4].category).data;
  const h5 = useAccountHealthItems(accountId, periodId, HEALTH_CATEGORIES[5].category).data;
  const healthData = [h0, h1, h2, h3, h4, h5];

  const status = STATUS_CATEGORIES.map((c, i) => ({
    id: statusSectionId(c.label),
    label: c.label,
    done: (statusData[i]?.length ?? 0) > 0,
  }));
  const rag = HEALTH_CATEGORIES.map((c, i) => ({
    id: ragSectionId(c.label),
    label: c.label,
    done: (healthData[i]?.length ?? 0) > 0,
  }));
  const metrics = { id: SECTION_IDS.metrics, label: "Overview", done: metricsDone };

  const all = [metrics, ...status, ...rag];
  return {
    metrics,
    status,
    rag,
    completed: all.filter((i) => i.done).length,
    total: all.length,
  };
}
