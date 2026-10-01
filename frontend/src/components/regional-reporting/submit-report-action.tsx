"use client";

import * as React from "react";
import { RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import { ApiError } from "@/lib/api/client";
import {
  useCreateRegionalStatusReport,
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
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const [confirm, setConfirm] = React.useState<"baseline" | "approve-accounts" | "recall" | "submit" | null>(null);
  const [pendingAccounts, setPendingAccounts] = React.useState(0);

  // Geo reports aren't submitted for review: the Geo Head baselines them
  // (frozen) and can recall a baselined report back to "Draft - Saved".
  if (scope === "geo") {
    // The server refuses to baseline while account reports of the period are
    // still Submitted; that comes back as ACCOUNT_REPORTS_PENDING_APPROVAL and
    // the Geo Head is asked to approve them, then the baseline is retried.
    const baseline = (approveSubmittedAccounts = false) => {
      const onSuccess = () =>
        showSuccess(
          approveSubmittedAccounts
            ? "Submitted account reports approved and report baselined successfully"
            : "Report Baselined Successfully"
        );
      const onError = (err: unknown) => {
        if (err instanceof ApiError && err.code === "ACCOUNT_REPORTS_PENDING_APPROVAL") {
          const count = (err.detail as { count?: number }).count ?? 0;
          setPendingAccounts(count);
          setConfirm("approve-accounts");
          return;
        }
        showError(err instanceof Error ? err.message : "Failed to baseline report.");
      };
      const payload = approveSubmittedAccounts ? { status: "Baselined" as const, approve_submitted_accounts: true } : { status: "Baselined" as const };
      if (report) {
        updateReport.mutate({ id: report.id, payload }, { onSuccess, onError });
      } else {
        createReport.mutate({ period_id: periodId, ...payload }, { onSuccess, onError });
      }
    };
    const recall = () =>
      recallReport.mutate(report!.id, {
        onSuccess: () => showSuccess("Report Recalled — now Draft - Saved"),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to recall report."),
      });

    if (report?.status === "Baselined") {
      return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <StatusBadge value={report.status} />
            <span>Baselined — the report is frozen. Recall it to make changes.</span>
          </div>
          <Button
            variant="outline"
            className="h-10 shrink-0 gap-2 px-5 text-sm font-semibold"
            disabled={recallReport.isPending}
            onClick={() => setConfirm("recall")}
          >
            {recallReport.isPending ? <ButtonSpinner /> : <RotateCcw className="size-4" />}
            Recall
          </Button>
          <ConfirmationDialog
          open={confirm === "recall"}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title="Recall report?"
          message={"The report will go back to Draft - Saved so it can be edited. Do you want to proceed?"}
          confirmLabel="Proceed"
          confirmVariant="default"
          onConfirm={() => {
            setConfirm(null);
            recall();
          }}
        />
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {report ? <StatusBadge value={report.status} /> : null}
          <span>
            {report?.status === "Auto Generated"
              ? "Generated from the accounts' reports. Review it, edit if needed, then baseline."
              : "Review the report above. If anything is missing, add or update it on Geo Reporting, then baseline here."}
          </span>
        </div>
        <Button
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={createReport.isPending || updateReport.isPending}
          onClick={() => setConfirm("baseline")}
        >
          {createReport.isPending || updateReport.isPending ? <ButtonSpinner /> : <Send className="size-4" />}
          Baseline Report
        </Button>
        <ConfirmationDialog
          open={confirm === "baseline"}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title="Baseline report?"
          message={"The report will be baselined and frozen until it is recalled. Do you want to proceed?"}
          confirmLabel="Proceed"
          confirmVariant="default"
          onConfirm={() => {
            setConfirm(null);
            baseline();
          }}
        />
        <ConfirmationDialog
          open={confirm === "approve-accounts"}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
          title="Approve submitted account reports?"
          message={`${pendingAccounts} account report(s) for this period are still Submitted. They will be approved and the geo report baselined; account reports can no longer be submitted for this period afterwards. Do you want to proceed?`}
          confirmLabel="Approve & Baseline"
          confirmVariant="default"
          onConfirm={() => {
            setConfirm(null);
            baseline(true);
          }}
        />
      </div>
    );
  }

  // Submitted / Approved lock the report — the owner is done and can't edit
  // the submission. A Rejected report is NOT locked: the owner has to revise
  // and resubmit it, so it falls through to the submit bar below (with the
  // rejection reason shown above it).
  if (report && (report.status === "Submitted" || report.status === "Approved")) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <StatusBadge value={report.status} />
        <span>
          {report.status === "Submitted"
            ? `Submitted — awaiting ${REVIEWER_LABEL[scope]} review.`
            : `Reviewed${report.reviewed_at ? ` on ${formatDateTime(report.reviewed_at)}` : ""}${
                report.review_comment ? ` — ${report.review_comment}` : ""
              }`}
        </span>
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
            {report.review_comment ? ` — ${report.review_comment}` : ""}. Update the report on{" "}
            {ENTRY_SCREEN_LABEL[scope]}, then resubmit.
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
          Review the report above. If anything is missing, add or update it on{" "}
          {ENTRY_SCREEN_LABEL[scope]}, then submit here.
        </p>
        <Button
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={isSaving || disabled}
          onClick={() => setConfirm("submit")}
        >
          {isSaving ? <ButtonSpinner /> : <Send className="size-4" />}
          {wasRejected ? "Resubmit Report" : "Submit Report"}
        </Button>
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
      </div>
    </div>
  );
}
