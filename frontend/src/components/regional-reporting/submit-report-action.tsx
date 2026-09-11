"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import {
  useCreateRegionalStatusReport,
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
  account: "Account Reporting / RAG Status",
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
// — the Account Manager's / Geo Head's own submit action, mirroring
// status-review/review-actions.tsx's ReviewActions (their reviewer's
// Approve/Reject bar) but for submitting instead of deciding.
export function SubmitReportAction({
  scope,
  scopeId,
  periodId,
  report,
}: {
  scope: RegionalScope;
  scopeId: string;
  periodId: string;
  report: RegionalStatusReport | undefined;
}) {
  const createReport = useCreateRegionalStatusReport(scope, scopeId);
  const updateReport = useUpdateRegionalStatusReport(scope, scopeId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Review the report above. If anything is missing, add or update it on{" "}
          {ENTRY_SCREEN_LABEL[scope]}, then submit here.
        </p>
        <Button
          className="h-10 shrink-0 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={isSaving}
          onClick={submit}
        >
          {isSaving ? <ButtonSpinner /> : <Send className="size-4" />}
          {wasRejected ? "Resubmit Report" : "Submit Report"}
        </Button>
      </div>
    </div>
  );
}
