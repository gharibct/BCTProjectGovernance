"use client";

import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Lock, TrendingUp } from "lucide-react";

import { LOCK_BAR_CLASS } from "@/components/new-project/baseline-lock";
import { cn } from "@/lib/utils";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { CopyFromLatestButton } from "@/components/forms/copy-from-latest-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBanner } from "@/stores/page-banner";
import { useProject } from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  downloadCustomerReportFile,
  isReportFrozen,
  previousPeriodReport,
  statusMetricsFromReport,
  useCopyStatusItemsFromLatest,
  useCreateStatusReport,
  useStatusReports,
  useUpdateStatusReport,
  useUploadCustomerReportFile,
} from "@/lib/api/project-status";
import { useUploadReportAttachment } from "@/lib/api/report-attachments";
import { ReportAttachmentsSection } from "@/components/reporting/report-attachments-section";
import { STATUS_CATEGORIES as TABS } from "@/lib/status-categories";
import { HealthSections, useHealthDeclarationForm } from "@/components/project-charter/health-declaration";
import {
  BLANK_CUSTOMER_COMMUNICATION,
  CustomerCommunicationSection,
  customerCommunicationFromReport,
  type CustomerCommunicationErrors,
} from "./customer-communication-section";
import { SECTION_IDS, statusSectionId } from "@/components/reporting/report-progress";
import { StatusItemsTab } from "./status-items-tab";

// The weekly Delivery Status Report as one long page: Key Metrics, Customer
// Communication, the four status registers and the six RAG categories stacked
// top to bottom, with a single Save Report at the bottom. The right-hand
// Report Progress rail (report-progress-rail.tsx) jumps between the sections.

const BLANK_METRICS = { revenue: "", onsite_fte: "", offshore_fte: "", projects_count: "" };

export function DeliveryStatusReport() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");

  const { data: project } = useProject(projectId ?? null);
  const { data: reports } = useStatusReports(projectId ?? null);
  const { data: periods = [] } = useReportingPeriods();
  const createReport = useCreateStatusReport(projectId ?? null);
  const updateReport = useUpdateStatusReport(projectId ?? null);
  const uploadCustomerFile = useUploadCustomerReportFile(projectId ?? null);
  const uploadAttachment = useUploadReportAttachment("project", projectId ?? null);
  const [pendingAttachments, setPendingAttachments] = React.useState<File[]>([]);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const existing = reports?.find((r) => r.period_id === periodId);
  // Submitted/Approved — the report is frozen (see submit-report-action.tsx);
  // Key Metrics and the status-item registers all stop accepting edits.
  const frozen = existing ? isReportFrozen(existing.status) : false;

  // No report yet for this period → carry Key Metrics forward from the last
  // period's report so unchanged figures don't have to be re-keyed.
  const carriedFrom = existing ? undefined : previousPeriodReport(reports, periods, periodId);
  const carriedFromLabel = carriedFrom
    ? periods.find((p) => p.id === carriedFrom.period_id)?.label
    : null;

  // Key Metrics — captured once per report and persisted on "Save Details"
  // rather than immediately like the grid rows. The report is submitted for
  // review separately, from the Dashboard.
  const [metrics, setMetrics] = React.useState(BLANK_METRICS);
  const [customer, setCustomer] = React.useState(BLANK_CUSTOMER_COMMUNICATION);
  const [customerErrors, setCustomerErrors] = React.useState<CustomerCommunicationErrors>({});
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);
  // First report for the project → Revenue defaults from the project's
  // Revenue in USD (still editable); later periods carry the previous report.
  const projectRevenueUsd = project?.project_revenue_usd ?? "";
  const key = existing ? existing.id : `blank:${carriedFrom?.id ?? "none"}:${periodId}:${projectRevenueUsd}`;
  if (key !== syncedFor) {
    setSyncedFor(key);
    // Customer Communication is per report — never carried forward.
    setCustomer(existing ? customerCommunicationFromReport(existing) : BLANK_CUSTOMER_COMMUNICATION);
    setCustomerErrors({});
    setMetrics(
      existing
        ? statusMetricsFromReport(existing)
        : carriedFrom
          ? statusMetricsFromReport(carriedFrom)
          : { ...BLANK_METRICS, revenue: projectRevenueUsd }
    );
  }

  const setMetric = (key: keyof typeof metrics) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMetrics((prev) => ({ ...prev, [key]: e.target.value }));

  const isSaving = createReport.isPending || updateReport.isPending || uploadCustomerFile.isPending || uploadAttachment.isPending;

  // Persists Key Metrics for this period without submitting — the report is
  // only moved Draft -> Submitted from the Dashboard
  // (project-dashboard/submit-report-action.tsx). Key Accomplishments and the
  // other status-item registers already persist per-row as they're edited
  // (status-items-tab.tsx), so after this the whole page is saved.
  const saveDetails = async (): Promise<boolean> => {
    if (!periodId) return false;
    // Customer Communication is optional on save (a half-filled section is kept
    // as typed); it is only mandatory when the report is submitted, which the
    // Submit action and the server both enforce.
    setCustomerErrors({});
    const sharedWithCustomer = customer.shared === "Sent" || customer.shared === "Sent - Cannot be Disclosed";
    const confidential = customer.shared === "Sent - Cannot be Disclosed";
    const fields = {
      revenue: metrics.revenue || undefined,
      onsite_fte: metrics.onsite_fte || undefined,
      offshore_fte: metrics.offshore_fte || undefined,
      projects_count: metrics.projects_count ? Number(metrics.projects_count) : undefined,
      // Left unset until an answer is picked, so an unanswered section isn't saved as "Not Sent".
      customer_report_shared: customer.shared ? sharedWithCustomer : undefined,
      customer_report_confidential: customer.shared ? confidential : undefined,
      // The server drops the date and file when the answer is Not Sent, and the file when it is Cannot be Disclosed.
      customer_report_date: sharedWithCustomer && customer.date ? customer.date : undefined,
      customer_remarks: customer.remarks.trim(),
    };
    try {
      const saved = await (existing
        ? // No status in the payload — a Draft stays Draft, and an already
          // Submitted/Approved report keeps its status.
          updateReport.mutateAsync({ id: existing.id, payload: { ...fields } })
        : createReport.mutateAsync({ period_id: periodId, status: "Draft", ...fields }));
      // The file needs the report's id, so it's uploaded after the save.
      if (customer.shared === "Sent" && customer.file) {
        await uploadCustomerFile.mutateAsync({ reportId: saved.id, file: customer.file });
        setCustomer((prev) => ({ ...prev, file: null }));
      }
      // Attachments picked on this page are uploaded once the report exists;
      // any that fail stay queued so Save Report can retry them.
      if (pendingAttachments.length > 0) {
        const failed: File[] = [];
        for (const file of pendingAttachments) {
          try {
            await uploadAttachment.mutateAsync({ reportId: saved.id, file });
          } catch {
            failed.push(file);
          }
        }
        setPendingAttachments(failed);
        if (failed.length > 0) {
          showError(`Could not upload: ${failed.map((f) => f.name).join(", ")}.`);
          return false;
        }
      }
      return true;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save details.");
      return false;
    }
  };

  const health = useHealthDeclarationForm();

  // "Copy from latest report": status + RAG registers are copied on the server
  // (and saved straight away); the six ratings are only pre-filled here, like
  // Key Metrics, and persist with Save Report.
  const copyItems = useCopyStatusItemsFromLatest(projectId ?? null);
  const copyFromLatest = async () => {
    if (!periodId) return;
    try {
      const result = await copyItems.mutateAsync(periodId);
      const ratingsCopied = health.copyRatingsFromLatest();
      if (result.copied === 0 && !ratingsCopied) {
        showError("Nothing to copy — there is no earlier report, or these sections already have content.");
        return;
      }
      showSuccess(
        ratingsCopied
          ? "Copied from the latest report. RAG ratings are pre-filled — review them and Save Report."
          : "Copied from the latest report."
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to copy from the latest report.");
    }
  };

  // One Save Report for the whole page: report fields first (Key Metrics +
  // Customer Communication), then the six RAG ratings. Line items in the
  // registers already saved per row as they were edited.
  const saveReport = async () => {
    if (!(await saveDetails())) return;
    try {
      await health.saveRatings();
      showSuccess("Report Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save RAG status.");
    }
  };
  const isBusy = isSaving || health.isSubmitting;

  return (
    <div className="flex flex-col gap-8">
      {periodId && !frozen ? (
        <div className="flex justify-end">
          <CopyFromLatestButton onClick={copyFromLatest} busy={copyItems.isPending} />
        </div>
      ) : null}
      {periodId ? (
        <>
          <section id={SECTION_IDS.metrics} className="scroll-mt-6">
            <SectionCard icon={TrendingUp} title="Overview">
              {!frozen && carriedFromLabel ? (
                <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Pre-filled from {carriedFromLabel}. Review and adjust before saving.
                </p>
              ) : null}
              <Field label="Project Scope" className="mb-6">
                <p className="text-sm whitespace-pre-wrap text-slate-700">
                  {project?.project_scope_description || "—"}
                </p>
              </Field>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
                <Field label="Revenue (USD)" htmlFor="revenue">
                  <Input
                    id="revenue"
                    type="number"
                    className="h-11"
                    value={metrics.revenue}
                    onChange={setMetric("revenue")}
                    disabled={frozen}
                  />
                </Field>
                <Field label="Onsite FTE" htmlFor="onsite_fte">
                  <Input
                    id="onsite_fte"
                    type="number"
                    className="h-11"
                    value={metrics.onsite_fte}
                    onChange={setMetric("onsite_fte")}
                    disabled={frozen}
                  />
                </Field>
                <Field label="Offshore FTE" htmlFor="offshore_fte">
                  <Input
                    id="offshore_fte"
                    type="number"
                    className="h-11"
                    value={metrics.offshore_fte}
                    onChange={setMetric("offshore_fte")}
                    disabled={frozen}
                  />
                </Field>
                <Field label="Projects Count" htmlFor="projects_count">
                  <Input
                    id="projects_count"
                    type="number"
                    className="h-11"
                    value={metrics.projects_count}
                    onChange={setMetric("projects_count")}
                    disabled={frozen}
                  />
                </Field>
              </div>
            </SectionCard>
          </section>

          <section id={SECTION_IDS.customer} className="scroll-mt-6">
            <CustomerCommunicationSection
              value={customer}
              onChange={(next) => {
                setCustomer(next);
                setCustomerErrors({});
              }}
              errors={customerErrors}
              uploadedFileName={existing?.customer_report_file_name ?? null}
              onDownload={() => {
                if (existing && projectId) {
                  downloadCustomerReportFile(projectId, existing).catch((err) =>
                    showError(err instanceof Error ? err.message : "Failed to download the file.")
                  );
                }
              }}
              disabled={frozen}
            />
          </section>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No reporting period selected.
        </p>
      )}

      {TABS.map((t) => (
        <section key={t.label} id={statusSectionId(t.label)} className="scroll-mt-6">
          <StatusItemsTab category={t.category} title={t.label} icon={t.icon} />
        </section>
      ))}

      <HealthSections form={health} disabled={frozen} />

      {periodId && projectId ? (
        <section id={SECTION_IDS.attachments} className="scroll-mt-6">
          <ReportAttachmentsSection
            scope="project"
            ownerId={projectId}
            reportId={existing?.id}
            frozen={frozen}
            pending={pendingAttachments}
            onPendingChange={setPendingAttachments}
          />
        </section>
      ) : null}

      {periodId ? (
        <StickyActionBar
          className={frozen ? cn("z-40", LOCK_BAR_CLASS) : undefined}
          secondary={
            frozen ? (
              <p role="status" className="flex items-center gap-2 text-sm text-amber-800">
                <Lock className="size-4 shrink-0" />
                This report has been submitted and is now read-only.
              </p>
            ) : undefined
          }
        >
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isBusy || frozen}
            onClick={saveReport}
          >
            {isBusy ? <ButtonSpinner /> : null}
            Save Report
          </Button>
        </StickyActionBar>
      ) : null}
    </div>
  );
}
