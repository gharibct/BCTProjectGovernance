"use client";

import * as React from "react";
import { Send, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { StatusBadge } from "@/components/forms/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateStatusReport,
  useRecallStatusReport,
  useUpdateStatusReport,
  type ProjectStatusReport,
} from "@/lib/api/project-status";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

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
  const [recallRemarks, setRecallRemarks] = React.useState("");
  const [recallError, setRecallError] = React.useState<string | null>(null);

  // Recall (Submitted -> Draft) needs remarks and a confirmation; the dialog is
  // the confirmation step. It only works until the Delivery Manager has decided.
  const recall = () => {
    const remarks = recallRemarks.trim();
    if (!remarks) {
      setRecallError("Recall remarks are required.");
      return;
    }
    if (!report) return;
    recallReport.mutate(
      { id: report.id, remarks },
      {
        onSuccess: () => {
          setRecallOpen(false);
          setRecallRemarks("");
          setRecallError(null);
          showSuccess("Status Report Recalled — it is back to Draft");
        },
        onError: (err) => setRecallError(err instanceof Error ? err.message : "Failed to recall the report."),
      }
    );
  };

  // Submitted / Approved lock the report — the PM is done and can't edit the
  // submission. A Rejected report is NOT locked: the PM has to revise and
  // resubmit it, so it falls through to the submit bar below (with the
  // rejection reason shown above it).
  if (report && (report.status === "Submitted" || report.status === "Approved")) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <StatusBadge value={report.status} />
        <span>
          {report.status === "Submitted"
            ? `Submitted — awaiting ${ACCOUNT_MANAGER_LABEL} review.`
            : `Reviewed${report.reviewed_at ? ` on ${formatDateTime(report.reviewed_at)}` : ""}${
                report.review_comment ? ` — ${report.review_comment}` : ""
              }`}
        </span>
        {report.status === "Submitted" ? (
          <>
            <Button
              variant="outline"
              className="ml-auto h-9 gap-2 border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 hover:text-red-800"
              onClick={() => {
                setRecallRemarks("");
                setRecallError(null);
                setRecallOpen(true);
              }}
            >
              <Undo2 className="size-4" />
              Recall Report
            </Button>
            <Dialog open={recallOpen} onOpenChange={(open) => !recallReport.isPending && setRecallOpen(open)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Recall report?</DialogTitle>
                  <DialogDescription>
                    The report will go back to Draft so you can edit and resubmit it. This is only
                    possible until the {ACCOUNT_MANAGER_LABEL} approves it. Do you want to proceed?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="recall-remarks" className="text-sm font-semibold text-slate-700">
                    Recall remarks <span className="text-red-600">*</span>
                  </label>
                  <Textarea
                    id="recall-remarks"
                    rows={4}
                    placeholder="Why is this report being recalled?"
                    value={recallRemarks}
                    onChange={(e) => {
                      setRecallRemarks(e.target.value);
                      if (recallError) setRecallError(null);
                    }}
                    aria-invalid={recallError ? true : undefined}
                  />
                  {recallError ? <p className="text-xs text-red-600">{recallError}</p> : null}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={recallReport.isPending}
                    onClick={() => setRecallOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" variant="destructive" disabled={recallReport.isPending} onClick={recall}>
                    {recallReport.isPending ? <ButtonSpinner /> : null}
                    Recall Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>
    );
  }

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
      {disabled && disabledReason ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          {disabledReason}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Review the report above. If anything is missing, add or update it on the Delivery Status
          Report, then submit here.
        </p>
        <Button
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={isSaving || disabled}
          onClick={() => setConfirmOpen(true)}
        >
          {isSaving ? <ButtonSpinner /> : <Send className="size-4" />}
          {wasRejected ? "Resubmit Report" : "Submit Report"}
        </Button>
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
    </div>
  );
}
