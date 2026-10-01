import { HEALTH_CATEGORIES } from "@/lib/health-categories";
import { STATUS_CATEGORIES } from "@/lib/status-categories";
import { useHealthItems } from "@/lib/api/health-declarations";
import { useStatusItems, useStatusReports } from "@/lib/api/project-status";
import {
  ragSectionId,
  SECTION_IDS,
  statusSectionId,
  type ReportProgress,
} from "@/components/reporting/report-progress";
import {
  customerCommunicationFromReport,
  validateCustomerCommunication,
} from "./customer-communication-section";

// "N of 12 sections completed": Metrics, Customer Communication, the four status
// registers and the six RAG categories. Content-based — a section counts once
// it has something saved for the period.
export function useReportProgress(projectId: string | null, periodId: string | null): ReportProgress {
  const { data: reports } = useStatusReports(projectId);
  const report = reports?.find((r) => r.period_id === periodId);

  const metricsDone =
    !!report &&
    [report.revenue, report.onsite_fte, report.offshore_fte, report.projects_count].every(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    );
  const customerDone =
    !!report &&
    Object.keys(
      validateCustomerCommunication(customerCommunicationFromReport(report), !!report.customer_report_file_name)
    ).length === 0;

  // Fixed-length lists, so the hooks are called in a stable order.
  const s0 = useStatusItems(projectId, periodId, STATUS_CATEGORIES[0].category).data;
  const s1 = useStatusItems(projectId, periodId, STATUS_CATEGORIES[1].category).data;
  const s2 = useStatusItems(projectId, periodId, STATUS_CATEGORIES[2].category).data;
  const s3 = useStatusItems(projectId, periodId, STATUS_CATEGORIES[3].category).data;
  const statusData = [s0, s1, s2, s3];

  const h0 = useHealthItems(projectId, periodId, HEALTH_CATEGORIES[0].category).data;
  const h1 = useHealthItems(projectId, periodId, HEALTH_CATEGORIES[1].category).data;
  const h2 = useHealthItems(projectId, periodId, HEALTH_CATEGORIES[2].category).data;
  const h3 = useHealthItems(projectId, periodId, HEALTH_CATEGORIES[3].category).data;
  const h4 = useHealthItems(projectId, periodId, HEALTH_CATEGORIES[4].category).data;
  const h5 = useHealthItems(projectId, periodId, HEALTH_CATEGORIES[5].category).data;
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
  const customer = { id: SECTION_IDS.customer, label: "Customer Communication", done: customerDone };

  const all = [metrics, customer, ...status, ...rag];
  return {
    metrics,
    customer,
    status,
    rag,
    completed: all.filter((i) => i.done).length,
    total: all.length,
  };
}
