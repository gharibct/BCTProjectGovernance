"use client";

import { useParams, useSearchParams } from "next/navigation";

import { ReportProgressRail } from "@/components/reporting/report-progress-rail";
import { useAccountReportProgress } from "./account-report-progress";

// Account's Report Progress rail: shared by the Account status page and Submit
// Report (the dashboard route), so the right-hand side does not change.
export function AccountReportRail({ mode }: { mode: "status" | "submit" }) {
  const { accountId } = useParams<{ accountId: string }>();
  const periodId = useSearchParams().get("period");
  const progress = useAccountReportProgress(accountId ?? null, periodId);
  const base = `/account-reporting/${accountId}`;
  return (
    <ReportProgressRail
      progress={progress}
      mode={mode}
      statusPath={`${base}/status`}
      submitPath={`${base}/dashboard`}
    />
  );
}
