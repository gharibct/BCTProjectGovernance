"use client";

import * as React from "react";
import { Lock, Send, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { RecallReportDialog } from "@/components/forms/recall-report-dialog";
import { StatusBadge } from "@/components/forms/status-badge";
import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import { LOCK_BAR_CLASS } from "@/components/new-project/baseline-lock";
import { cn } from "@/lib/utils";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateRegionalStatusReport,
  useRecallAccountStatusReport,
  useRecallGeoStatusReport,
  useUpdateRegionalStatusReport,
  type RegionalScope,
  type RegionalStatusReport,
} from "@/lib/api/regional-status";

const REVIEWER_LABEL: Record<RegionalScope, string> = {
  account: "Geo Head",
  geo: "CDO",
};

// Account has a RAG Status screen alongside its status report; Geo doesn't
// (no health-declaration model — see dashboard-view.tsx's GeoAccountMatrixSection
// swap-in for the same reason), so its entry-screen callout stays a single name.
const ENTRY_SCREEN_LABEL: Record<RegionalScope, string> = {
  account: "Delivery Status Report",
  geo: "Geo Reporting",
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Scope-generic counterpart to components/project-dashboard/submit-report-action.tsx
// — the Delivery Manager's / Geo Head's own submit action, mirroring
// status-review/review-actions.tsx's ReviewActions (their reviewer's
// Approve/Reject bar) but for submitting instead of deciding.
export function SubmitReportAction({
  scope,
  scopeId,
  periodId,
  report,
  disabled,
  disabledReason,
}: {
  scope: RegionalScope;
  scopeId: string;
  periodId: string;
  report: RegionalStatusReport | undefined;
  // Account only — blocks submission until every section is filled.
  disabled?: boolean;
  disabledReason?: string;
}) {
  const createReport = useCreateRegionalStatusReport(scope, scopeId);
  const updateReport = useUpdateRegionalStatusReport(scope, scopeId);
  const recallReport = useRecallGeoStatusReport(scope === "geo" ? scopeId : null);
  const recallAccountReport = useRecallAccountStatusReport(scope === "account" ? scopeId : null);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const [confirm, setConfirm] = React.useState<"baseline" | "recall" | "submit" | null>(null);

  // Geo reports aren't submitted for review: the Geo Head baselines them
  // (frozen) and can recall a baselined report back to "Draft - Saved".
  if (scope === "geo") {
    // Baselining also approves every still-Submitted delivery (account) and
    // project report of the period — the server does that automatically.
    const baseline = () => {
      const onSuccess = () => showSuccess("Report Baselined Successfully");
      const onError = (err: unknown) =>
        showError(err instanceof Error ? err.message : "Failed to baseline report.");
      const payload = { status: "Baselined" as const };
      if (report) {
        updateReport.mutate({ id: report.id, payload }, { onSuccess, onError });
      } else {
        createReport.mutate({ period_id: periodId, ...payload }, { onSuccess, onError });
      }
    };
    const recall = async (remarks: string) => {
      await recallReport.mutateAsync({ id: report!.id, remarks });
      showSuccess("Report Recalled — now Draft - Saved");
    };

    const isBaselined = report?.status === "Baselined";
    const isSavingBaseline = createReport.isPending || updateReport.isPending;

    return (
      <>
        <StickyActionBar
          className={isBaselined ? cn("z-40", LOCK_BAR_CLASS) : undefined}
          secondary={
            <p
              role="status"
              className={cn("flex items-center gap-2 text-sm", isBaselined ? "text-amber-800" : "text-slate-600")}
            >
              {isBaselined ? <Lock className="size-4 shrink-0" /> : null}
              {isBaselined
                ? "Baselined — the report is frozen. Recall it to make changes."
                : report?.status === "Auto Generated"
                  ? "Generated from the accounts' reports. Review it, edit if needed, then baseline."
                  : "Review the report above. If anything is missing, add or update it on Geo Reporting, then baseline here."}
            </p>
          }
        >
          <Button
            variant="outline"
            className="h-10 gap-2 border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 hover:text-red-800"
            disabled={!isBaselined || recallReport.isPending}
            onClick={() => setConfirm("recall")}
          >
            {recallReport.isPending ? <ButtonSpinner /> : <Undo2 className="size-4" />}
            Recall Report
          </Button>
          <Button
            className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={isBaselined || isSavingBaseline}
            onClick={() => setConfirm("baseline")}
          >
            {isSavingBaseline ? <ButtonSpinner /> : <Send className="size-4" />}
            Baseline Report
          </Button>
        </StickyActionBar>
        <RecallReportDialog
          open={confirm === "recall"}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          description="The report will go back to Draft - Saved so it can be edited. Do you want to proceed?"
          onRecall={recall}
        />
        <ConfirmationDialog
          open={confirm === "baseline"}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title="Baseline report?"
          message={"The report will be baselined and frozen until it is recalled. All the submitted delivery reports and project reports will be approved. Do you want to proceed?"}
          confirmLabel="Proceed"
          confirmVariant="default"
          onConfirm={() => {
            setConfirm(null);
            baseline();
          }}
        />
      </>
    );
  }

  // Submitted / Approved lock the report — the owner is done and can't edit
  // the submission. A Rejected report is NOT locked: the owner has to revise
  // and resubmit it (with the rejection reason shown above the bar).
  const isSubmitted = report?.status === "Submitted";
  const isApproved = report?.status === "Approved";
  const locked = isSubmitted || isApproved;
  const wasRejected = report?.status === "Rejected";
  const isSaving = createReport.isPending || updateReport.isPending;
  const barMessage = isApproved
    ? "This report has been approved and is now read-only."
    : isSubmitted
      ? `This report has been submitted and is now read-only. Recall it to make changes while it awaits ${REVIEWER_LABEL[scope]} review.`
      : `Review the report above. If anything is missing, add or update it on ${ENTRY_SCREEN_LABEL[scope]}, then submit here.`;

  const submit = () => {
    const onSuccess = () =>
      showSuccess(
        wasRejected ? "Status Report Resubmitted Successfully" : "Status Report Submitted Successfully"
      );
    const onError = (err: unknown) =>
      showError(err instanceof Error ? err.message : "Failed to submit status report.");

    if (report) {
      updateReport.mutate({ id: report.id, payload: { status: "Submitted" } }, { onSuccess, onError });
    } else {
      createReport.mutate({ period_id: periodId, status: "Submitted" }, { onSuccess, onError });
    }
  };

  const recallAccount = async (remarks: string) => {
    await recallAccountReport.mutateAsync({ id: report!.id, remarks });
    showSuccess("Status Report Recalled — it is back to Draft");
  };

  return (
    <div className="flex flex-col gap-3">
      {wasRejected && report ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-sm">
          <StatusBadge value={report.status} />
          <span>
            Rejected{report.reviewed_at ? ` on ${formatDateTime(report.reviewed_at)}` : ""}
            {report.review_comment ? ` — ${report.review_comment}` : ""}. Update the report on{" "}
            {ENTRY_SCREEN_LABEL[scope]}, then resubmit.
          </span>
        </div>
      ) : null}
      {report?.status === "Draft" && report.recall_remarks ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          <StatusBadge value="Draft" />
          <span>
            Recalled{report.recalled_at ? ` on ${formatDateTime(report.recalled_at)}` : ""} — {report.recall_remarks}.
            Update the report, then resubmit.
          </span>
        </div>
      ) : null}
      {!locked && disabled && disabledReason ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          {disabledReason}
        </div>
      ) : null}
      <StickyActionBar
        className={locked ? cn("z-40", LOCK_BAR_CLASS) : undefined}
        secondary={
          <p
            role="status"
            className={cn("flex items-center gap-2 text-sm", locked ? "text-amber-800" : "text-slate-600")}
          >
            {locked ? <Lock className="size-4 shrink-0" /> : null}
            {barMessage}
          </p>
        }
      >
        {locked ? (
          <Button
            variant="outline"
            className="h-10 gap-2 border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 hover:text-red-800"
            disabled={!isSubmitted || recallAccountReport.isPending}
            onClick={() => setConfirm("recall")}
          >
            {recallAccountReport.isPending ? <ButtonSpinner /> : <Undo2 className="size-4" />}
            Recall Report
          </Button>
        ) : null}
        <Button
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={isSaving || disabled || locked}
          onClick={() => setConfirm("submit")}
        >
          {isSaving ? <ButtonSpinner /> : <Send className="size-4" />}
          {wasRejected ? "Resubmit Report" : "Submit Report"}
        </Button>
      </StickyActionBar>
      <ConfirmationDialog
        open={confirm === "submit"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Submit report?"
        message={`The report will be sent to the ${REVIEWER_LABEL[scope]} for review and locked from further edits. Do you want to proceed?`}
        confirmLabel="Proceed"
        confirmVariant="default"
        onConfirm={() => {
          setConfirm(null);
          submit();
        }}
      />
      <RecallReportDialog
        open={confirm === "recall" && scope === "account"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        description={`The report will go back to Draft so you can edit and resubmit it. This is only possible until the ${REVIEWER_LABEL[scope]} reviews it. Do you want to proceed?`}
        onRecall={recallAccount}
      />
    </div>
  );
}
