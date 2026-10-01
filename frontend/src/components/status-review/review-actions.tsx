"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole, useSession } from "@/stores/session";
import {
  REVIEWER_ROLE_BY_SCOPE,
  useReviewStatusReportMutation,
  type ReviewScope,
  type ReviewStatusReport,
} from "@/lib/api/status-review";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Approve/Reject action bar for a Status Review page — visible only to the
// reviewer role for this scope (Account Head/Geo Head/CDO, or Admin) once
// the report is Submitted. Once reviewed, shows a read-only line instead. With
// `readOnly` (the view-only Project Delivery Status page) the Approve/Reject bar
// is never shown — only the "Reviewed on …" line of an already-decided report.
export function ReviewActions({
  scope,
  scopeId,
  report,
  readOnly = false,
}: {
  scope: ReviewScope;
  scopeId: string;
  report: ReviewStatusReport | undefined;
  readOnly?: boolean;
}) {
  const user = useSession((s) => s.user);
  const effectiveRole = useEffectiveRole();
  const [comment, setComment] = React.useState("");
  const reviewMutation = useReviewStatusReportMutation(scope, scopeId);
  const [pending, setPending] = React.useState<"Approved" | "Rejected" | null>(null);
  const [remarksError, setRemarksError] = React.useState(false);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  // The reviewer role is matched against the effective (Work Context) role, so
  // a Geo Head acting as Account Head can approve project status reports.
  const canReview =
    !!user && (effectiveRole === REVIEWER_ROLE_BY_SCOPE[scope] || user.role.code === "ADMIN");

  if (!report || !canReview) return null;

  if (report.status === "Approved" || report.status === "Rejected") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <StatusBadge value={report.status} />
        <span>
          Reviewed{report.reviewed_at ? ` on ${formatDateTime(report.reviewed_at)}` : ""}
          {report.review_comment ? ` — ${report.review_comment}` : ""}
        </span>
      </div>
    );
  }

  if (report.status !== "Submitted" || readOnly) {
    return null;
  }

  const decide = (decision: "Approved" | "Rejected") => {
    reviewMutation.mutate(
      { id: report.id, payload: { decision, comment: comment.trim() || undefined, reviewed_by: user!.id } },
      {
        onSuccess: () => {
          setComment("");
          showSuccess(`Report ${decision.toLowerCase()}.`);
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to submit review."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-800">Review this report</p>
      <textarea
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          if (e.target.value.trim()) setRemarksError(false);
        }}
        placeholder="Comment (optional for approval, required for rejection)"
        rows={2}
        aria-invalid={remarksError}
        className={`w-full min-w-0 rounded-lg border bg-[#F7FAFF] px-2.5 py-1.5 text-sm text-[#000000] outline-none placeholder:text-[#718096] hover:border-[#4F91D1] hover:bg-[#F3F8FE] focus-visible:border-[#2F80ED] focus-visible:ring-3 focus-visible:ring-ring/50 ${
          remarksError ? "border-[#D92D20]" : "border-[#5B9BE6]"
        }`}
      />
      {remarksError ? (
        <p role="alert" className="-mt-2 text-xs font-medium text-red-600">
          Rejection remarks are required.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          className="h-9 gap-2 bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
          disabled={reviewMutation.isPending}
          onClick={() => setPending("Approved")}
        >
          {reviewMutation.isPending ? <ButtonSpinner /> : <Check className="size-4" />}
          Approve
        </Button>
        <Button
          variant="destructive"
          className="h-9 gap-2 text-sm font-semibold"
          disabled={reviewMutation.isPending}
          onClick={() => {
            if (!comment.trim()) {
              setRemarksError(true);
              return;
            }
            setPending("Rejected");
          }}
        >
          {reviewMutation.isPending ? <ButtonSpinner /> : <X className="size-4" />}
          Reject
        </Button>
      </div>
      <ConfirmationDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending === "Approved" ? "Approve report?" : "Reject report?"}
        message={`This will ${pending === "Approved" ? "approve" : "reject"} the report. Do you want to proceed?`}
        confirmLabel="Proceed"
        confirmVariant={pending === "Rejected" ? "destructive" : "default"}
        onConfirm={() => {
          const decision = pending;
          setPending(null);
          if (decision) decide(decision);
        }}
      />
    </div>
  );
}
