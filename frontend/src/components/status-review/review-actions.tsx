"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
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
// reviewer role for this scope (Account Head/Geo Head/CXO, or Admin) once
// the report is Submitted. Once reviewed, shows a read-only line instead.
export function ReviewActions({
  scope,
  scopeId,
  report,
}: {
  scope: ReviewScope;
  scopeId: string;
  report: ReviewStatusReport | undefined;
}) {
  const user = useSession((s) => s.user);
  const [comment, setComment] = React.useState("");
  const reviewMutation = useReviewStatusReportMutation(scope, scopeId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const canReview =
    !!user && (user.role.code === REVIEWER_ROLE_BY_SCOPE[scope] || user.role.code === "ADMIN");

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

  if (report.status !== "Submitted") {
    return null;
  }

  const decide = (decision: "Approved" | "Rejected") => {
    reviewMutation.mutate(
      { id: report.id, payload: { decision, comment: comment || undefined, reviewed_by: user!.id } },
      {
        onSuccess: () => showSuccess(`Report ${decision.toLowerCase()}.`),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to submit review."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-800">Review this report</p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        rows={2}
        className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex gap-2">
        <Button
          className="h-9 gap-2 bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
          disabled={reviewMutation.isPending}
          onClick={() => decide("Approved")}
        >
          {reviewMutation.isPending ? <ButtonSpinner /> : <Check className="size-4" />}
          Approve
        </Button>
        <Button
          variant="destructive"
          className="h-9 gap-2 text-sm font-semibold"
          disabled={reviewMutation.isPending}
          onClick={() => decide("Rejected")}
        >
          {reviewMutation.isPending ? <ButtonSpinner /> : <X className="size-4" />}
          Reject
        </Button>
      </div>
    </div>
  );
}
