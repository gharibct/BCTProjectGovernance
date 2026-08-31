"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardCheck, CircleAlert, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  MODULE_REVIEW_ACTIONS,
  MODULE_VIEW_PATH,
  useDeReviewDecision,
  useDeReviewDetail,
  useUpdateModuleReview,
  type DeModuleReviewAction,
  type DeReviewDecision,
} from "@/lib/api/de-approval";
import { canWriteDeApproval } from "@/lib/api/de-approval-permissions";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, MandatoryBadge, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "red";
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-4">
      <span className={cn("text-2xl font-bold", tone === "red" ? "text-red-600" : "text-slate-900")}>{value}</span>
      <span className="mt-0.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
    </div>
  );
}

export function GovernanceReviewWorkspace() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const router = useRouter();

  const user = useSession((s) => s.user);
  const canWrite = canWriteDeApproval(user?.role.code);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const { data: detail, isLoading, isError, error } = useDeReviewDetail(projectId);
  const updateModule = useUpdateModuleReview(projectId);
  const decision = useDeReviewDecision(projectId);

  const [syncedId, setSyncedId] = React.useState<string | null>("__init__");
  const [remarks, setRemarks] = React.useState("");
  const [errors, setErrors] = React.useState<{ remarks?: string }>({});

  if (detail && detail.project_id !== syncedId) {
    setSyncedId(detail.project_id);
    setRemarks(detail.de_review_remarks ?? "");
    setErrors({});
  }

  if (!projectId) return <EmptyState>No project selected.</EmptyState>;

  if (isError) {
    return (
      <div className="mx-auto max-w-[1400px] rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        <p className="font-semibold">Couldn&apos;t load this review.</p>
        <p className="mt-1 text-red-600">
          {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
        </p>
        <Link href="/de-approval" className="mt-3 inline-block font-semibold text-red-700 underline">
          Back to DE Project Approval
        </Link>
      </div>
    );
  }

  if (isLoading || !detail) return <p className="text-slate-400">Loading…</p>;

  const { completeness } = detail;
  const readOnly = !canWrite || detail.project_status !== "Pending Approval";
  const busy = decision.isPending;

  const decide = (kind: DeReviewDecision) => {
    if (!remarks.trim()) {
      setErrors({ remarks: "DE Review Remarks are required." });
      showError("Enter DE Review Remarks before submitting a decision.");
      return;
    }
    setErrors({});
    decision.mutate(
      { decision: kind, remarks, reviewed_by: user!.id },
      {
        onSuccess: () => {
          showSuccess(kind === "Approve" ? "Project Approved" : "Returned to PM");
          router.push("/de-approval");
        },
        onError: (err) =>
          showError(err instanceof Error ? err.message : "Failed to submit the decision."),
      },
    );
  };

  const setModule = (moduleKey: (typeof completeness.modules)[number]["key"], reviewAction: DeModuleReviewAction) => {
    updateModule.mutate(
      { moduleKey, reviewAction },
      { onError: (err) => showError(err instanceof Error ? err.message : "Failed to save the module review.") },
    );
  };

  const mandatoryTotal = completeness.modules.filter((m) => m.mandatory).length;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div>
        <Link
          href="/de-approval"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
        >
          <ArrowLeft className="size-4" />
          Back to DE Project Approval
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Project Governance Review — {detail.project_name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {detail.project_code}
          {" · "}
          {detail.account_name ?? "—"}
          {" · "}
          {detail.de_review_status ??
            (detail.project_status === "Pending Approval" ? "Awaiting Review" : detail.project_status)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Overall Completion" value={`${completeness.completion_pct}%`} />
        <Tile label="Modules Complete" value={completeness.modules_complete} />
        <Tile
          label="Modules Incomplete"
          value={completeness.modules_incomplete}
          tone={completeness.modules_incomplete > 0 ? "red" : undefined}
        />
        <Tile
          label="Critical Gaps"
          value={completeness.critical_gaps}
          tone={completeness.critical_gaps > 0 ? "red" : undefined}
        />
      </div>

      <SectionCard icon={ClipboardCheck} title="Completeness Checklist">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <th className="px-3 py-3">Module</th>
                <th className="px-3 py-3">Completion</th>
                <th className="px-3 py-3">Review Status</th>
                <th className="px-3 py-3">Gaps</th>
                <th className="px-3 py-3">Last Updated</th>
                <th className="px-3 py-3 min-w-[170px]">DE Assessor Action</th>
                <th className="px-3 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {completeness.modules.map((m) => (
                <tr key={m.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {m.label}
                    {!m.mandatory ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        Optional
                      </span>
                    ) : null}
                  </td>
                  <td className={cn("px-3 py-2.5 font-mono", m.complete ? "text-slate-600" : "text-[#1a6fc4]")}>
                    {m.complete ? "100%" : "0%"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        m.complete
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-[#1a6fc4]",
                      )}
                    >
                      {m.complete ? "Complete" : "Incomplete"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {m.gaps ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <CircleAlert className="size-3.5" />
                        {m.gaps}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {m.last_updated ? m.last_updated.slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {readOnly ? (
                      <span className="text-slate-600">{m.review_action}</span>
                    ) : (
                      <NativeSelect
                        aria-label={`Review action for ${m.label}`}
                        className="h-9 text-sm"
                        value={m.review_action}
                        disabled={updateModule.isPending}
                        onChange={(e) => setModule(m.key, e.target.value as DeModuleReviewAction)}
                      >
                        {MODULE_REVIEW_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/de-approval/${projectId}/${MODULE_VIEW_PATH[m.key]}`}
                      className="font-medium text-[#1a6fc4] hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={CheckCircle2} title="DE Review Decision">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Field
              label="DE Review Remarks"
              htmlFor="de-review-remarks"
              badge={<MandatoryBadge />}
              hint="Visible to the Project Manager on approval or return."
              error={errors.remarks}
            >
              <Textarea
                id="de-review-remarks"
                rows={4}
                value={remarks}
                disabled={readOnly}
                placeholder="Enter detailed findings, concerns, or justification for approval / return…"
                onChange={(e) => {
                  setRemarks(e.target.value);
                  if (errors.remarks) setErrors({});
                }}
              />
            </Field>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Readiness Summary</h3>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
                <li className="flex items-center justify-between">
                  <span>Mandatory Modules</span>
                  <span className="font-mono font-medium">
                    {completeness.modules_complete}/{mandatoryTotal}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Critical Gaps</span>
                  <span className={cn("font-mono font-medium", completeness.critical_gaps > 0 && "text-red-600")}>
                    {completeness.critical_gaps}
                  </span>
                </li>
              </ul>
            </div>

            {readOnly ? (
              <p className="text-sm text-slate-400">
                {detail.project_status !== "Pending Approval"
                  ? `This project is ${detail.project_status}. No decision pending.`
                  : "You have read-only access."}
              </p>
            ) : (
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
                {completeness.gaps_count > 0 ? (
                  <p className="text-xs text-amber-600">
                    {completeness.gaps_count} mandatory module(s) still incomplete.
                  </p>
                ) : null}
                <Button
                  onClick={() => decide("Approve")}
                  disabled={busy}
                  className="w-full gap-2 bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]"
                >
                  {busy ? <ButtonSpinner /> : <ThumbsUp className="size-4" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decide("Return")}
                  disabled={busy}
                  className="w-full gap-2 border-red-200 bg-red-50 font-semibold text-red-700 hover:bg-red-100 hover:text-red-800"
                >
                  {busy ? <ButtonSpinner /> : <ArrowLeft className="size-4" />}
                  Return to PM
                </Button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <Button variant="ghost" onClick={() => router.push("/de-approval")}>
          Back to Queue
        </Button>
      </div>
    </div>
  );
}
