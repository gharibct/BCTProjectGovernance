"use client";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import {
  REPORT_PAGE_TYPE_LABEL,
  useCreateMonthlyAttestation,
  useMonthlyCompletion,
  type ReportPageType,
} from "@/lib/api/reporting-attestation";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Monthly completion control for one Project Performance Report section
// (Measurement / Commitments / Payment Milestones / one of the 5 RAIDO logs).
// A section is complete for the month once data was saved on it OR this is
// clicked — either unlocks that section's row on the Project Performance
// Dashboard's completion checklist, which gates Submit Report. See
// backend/app/services/monthly_completion.py.
export function ReviewedNoChangesButton({
  projectId,
  periodId,
  pageType,
}: {
  projectId: string;
  periodId: string | null;
  pageType: ReportPageType;
}) {
  const { data: completion } = useMonthlyCompletion(projectId, periodId);
  const attest = useCreateMonthlyAttestation(projectId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  // No period in context (e.g. this page opened outside the Monthly
  // reporting flow) — nothing to attest against.
  if (!periodId) return null;

  const status = completion?.find((c) => c.page_type === pageType);

  if (status?.reason === "data_saved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="size-3.5" />
        Data recorded this period
      </span>
    );
  }

  if (status?.reason === "reviewed_no_changes") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="size-3.5" />
        Reviewed{status.reviewed_at ? ` on ${formatDateTime(status.reviewed_at)}` : ""}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 gap-1.5 px-3 text-xs font-semibold"
      disabled={attest.isPending}
      onClick={() =>
        attest.mutate(
          { period_id: periodId, page_type: pageType },
          {
            onSuccess: () =>
              showSuccess(`${REPORT_PAGE_TYPE_LABEL[pageType]} marked Reviewed and No Changes`),
            onError: (err) => showError(err instanceof Error ? err.message : "Failed to record the review."),
          },
        )
      }
    >
      {attest.isPending ? <ButtonSpinner /> : <CheckCircle2 className="size-3.5" />}
      Reviewed and No Changes
    </Button>
  );
}
