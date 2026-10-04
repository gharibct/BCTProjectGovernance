"use client";

import * as React from "react";
import { Lock, Send, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { StatusBadge } from "@/components/forms/status-badge";
import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import { LOCK_BAR_CLASS } from "@/components/new-project/baseline-lock";
import { cn } from "@/lib/utils";
import { RecallReportDialog } from "@/components/forms/recall-report-dialog";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateStatusReport,
  useRecallStatusReport,
  useUpdateStatusReport,
  type ProjectStatusReport,
} from "@/lib/api/project-status";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Project Manager's counterpart to status-review/review-actions.tsx's
// ReviewActions (the Delivery Manager's Approve/Reject bar) — submits a report
// for review instead of deciding one. Key Metrics stay editable only on
// Project Status; this just flips Draft/none -> Submitted for whatever's
// already been entered there and on RAG Status.
export function SubmitReportAction({
  projectId,
  periodId,
  report,
  disabled,
  disabledReason,
}: {
  projectId: string;
  periodId: string;
  report: ProjectStatusReport | undefined;
  // Project Performance Report (Monthly) only — blocks submission until every
  // section's monthly completion checklist is done. Ignored once the report
  // is already Submitted/Approved/Rejected (those states render above,
  // before this ever applies).
  disabled?: boolean;
  disabledReason?: string;
}) {
  const createReport = useCreateStatusReport(projectId);
  const updateReport = useUpdateStatusReport(projectId);
  const recallReport = useRecallStatusReport(projectId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [recallOpen, setRecallOpen] = React.useState(false);

  const isSubmitted = report?.status === "Submitted";
  const isApproved = report?.status === "Approved";
  const locked = isSubmitted || isApproved;
  // Monthly (Project Performance) reports have no approval step: they can be
  // recalled until the period's due date.
  const { data: periods = [] } = useReportingPeriods();
  const period = periods.find((p) => p.id === periodId);
  const monthlyDueDate =
    period?.period_type === "Monthly" && period.due_date ? formatDate(period.due_date) : null;
  // Past the due date the monthly report is final — it can no longer be recalled.
  const recallClosed =
    period?.period_type === "Monthly" && !!period.due_date && period.due_date < todayISO();
  const barMessage = isApproved
    ? "This report has been approved and is now read-only."
    : isSubmitted
      ? monthlyDueDate
        ? recallClosed
          ? `This report has been submitted and is now read-only. The due date (${monthlyDueDate}) has passed, so it can no longer be recalled.`
          : `This report has been submitted and is now read-only. Recall it to make changes till ${monthlyDueDate}`
        : `This report has been submitted and is now read-only. Recall it to make changes while it awaits ${ACCOUNT_MANAGER_LABEL} review.`
      : "Review the report above. If anything is missing, add or update it on the Delivery Status Report, then submit here.";

  const wasRejected = report?.status === "Rejected";
  const isSaving = createReport.isPending || updateReport.isPending;

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

  return (
    <div className="flex flex-col gap-3">
      {wasRejected && report ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 shadow-sm">
          <StatusBadge value={report.status} />
          <span>
            Rejected{report.reviewed_at ? ` on ${formatDateTime(report.reviewed_at)}` : ""}
            {report.review_comment ? ` — ${report.review_comment}` : ""}. Update the report on the
            Delivery Status Report, then resubmit.
          </span>
        </div>
      ) : null}
      {report?.status === "Draft" && report.recall_remarks ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          <StatusBadge value="Draft" />
          <span>
            Recalled{report.recalled_at ? ` on ${formatDateTime(report.recalled_at)}` : ""} —{" "}
            {report.recall_remarks}. Update the report, then resubmit.
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
            disabled={!isSubmitted || recallClosed}
            onClick={() => setRecallOpen(true)}
          >
            <Undo2 className="size-4" />
            Recall Report
          </Button>
        ) : null}
        <Button
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={isSaving || disabled || locked}
          onClick={() => setConfirmOpen(true)}
        >
          {isSaving ? <ButtonSpinner /> : <Send className="size-4" />}
          {wasRejected ? "Resubmit Report" : "Submit Report"}
        </Button>
      </StickyActionBar>
      <RecallReportDialog
        open={recallOpen}
        onOpenChange={setRecallOpen}
        description={`The report will go back to Draft so you can edit and resubmit it. This is only possible until the ${ACCOUNT_MANAGER_LABEL} approves it. Do you want to proceed?`}
        onRecall={async (remarks) => {
          if (!report) return;
          await recallReport.mutateAsync({ id: report.id, remarks });
          showSuccess("Status Report Recalled — it is back to Draft");
        }}
      />
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={wasRejected ? "Resubmit report?" : "Submit report?"}
        message={`The report will be sent to the ${ACCOUNT_MANAGER_LABEL} for review and locked from further edits. Do you want to proceed?`}
        confirmLabel="Proceed"
        confirmVariant="default"
        onConfirm={() => {
          setConfirmOpen(false);
          submit();
        }}
      />
    </div>
  );
}
