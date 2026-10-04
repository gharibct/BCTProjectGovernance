"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, CircleAlert, MessageSquareWarning, SendHorizontal, Undo2, GitPullRequestArrow } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  APPROVAL_MODULE_VIEW_PATH,
  useApprovalReadiness,
  useInitiateAmendment,
  useRecallApproval,
  useSendToApproval,
  type ApprovalReadiness,
  type SendToApprovalError,
} from "@/lib/api/approval-readiness";
import { effectiveProjectStatus, isBaselineEditable, useProject } from "@/lib/api/projects";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { BaselineLockMessage, LOCK_BAR_CLASS } from "@/components/new-project/baseline-lock";
import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import { ConfirmationDialog } from "@/components/forms/confirmation-dialog";

// "maintain"       — Maintain Project: Send To Approve + Recall (Draft flow).
// "amend-initiate" — Amend Project / Amendment Request screen: one Initiate button.
// "amend-approve"  — Amend Project / Send To Approve screen: Send To Approve + Recall
//                    against the Under Amendment flow.
export type SendToApprovalMode = "maintain" | "amend-initiate" | "amend-approve";


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

// The DE's per-section verdict from the last Project Details Approval review.
function DeReviewBadge({ action }: { action: string }) {
  const tone =
    action === "Gap Identified"
      ? "bg-red-50 text-red-700"
      : action === "Reviewed"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-500";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", tone)}>
      {action === "Gap Identified" ? <CircleAlert className="size-3.5" /> : null}
      {action}
    </span>
  );
}

function isSendToApprovalError(detail: unknown): detail is SendToApprovalError {
  return (
    !!detail &&
    typeof detail === "object" &&
    !Array.isArray(detail) &&
    "readiness" in detail &&
    "message" in detail
  );
}

export function SendToApprovalView({ mode = "maintain" }: { mode?: SendToApprovalMode }) {
  const projectId = useNewProjectId();
  const pathname = usePathname();
  const routePrefix = pathname.split("/")[1] || "new-project";
  const base = `/${routePrefix}/${projectId}`;
  const isAmend = mode !== "maintain";

  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const { data, isLoading, isError, error } = useApprovalReadiness(projectId);
  const { data: project } = useProject(projectId);
  const send = useSendToApproval(projectId);
  const recall = useRecallApproval(projectId);
  const initiate = useInitiateAmendment(projectId);

  // Once the server rejects a submission it hands back a freshly recomputed
  // readiness — show that immediately, then let the invalidated query converge.
  const [serverReadiness, setServerReadiness] = React.useState<ApprovalReadiness | null>(null);
  const view = serverReadiness ?? data;
  // Send To Approve / Recall both change the project's workflow state, so each asks first.
  const [confirm, setConfirm] = React.useState<"send" | "recall" | null>(null);

  if (!projectId) return <EmptyState>Create the project first.</EmptyState>;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        <p className="font-semibold">Couldn&apos;t load approval readiness.</p>
        <p className="mt-1 text-red-600">
          {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
        </p>
      </div>
    );
  }

  if (isLoading || !view) return <p className="text-slate-400">Loading…</p>;

  const wasReturnedByDe = view.de_review_status === "Returned" && !!view.de_review_remarks;
  const isPendingApproval = view.project_status === "Pending Approval";
  const isUnderAmendment = view.project_status === "Under Amendment";
  // An approved project can be amended unless its lifecycle state is Closed.
  const canInitiate = view.project_status === "Approved" && view.lifecycle_status !== "Closed";
  const busy = send.isPending || recall.isPending || initiate.isPending;
  // What Recall lands on is decided by the server from the project's amendment
  // cycle, not by which route tree the PM happens to be in: an amendment goes back
  // to Under Amendment, a first-time submission back to Draft.
  const recallsToAmendment = project?.has_active_amendment ?? isAmend;
  const recallTarget = recallsToAmendment ? "Under Amendment" : "Draft";

  const onSubmit = () => {
    send.mutate(undefined, {
      onSuccess: () => {
        setServerReadiness(null);
        showSuccess(isUnderAmendment ? "Amendment sent for approval" : "Project Sent to Approval Successfully");
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.detail : null;
        if (isSendToApprovalError(detail)) {
          setServerReadiness(detail.readiness);
          showError(detail.message);
        } else {
          showError(err instanceof Error ? err.message : "Failed to send for approval.");
        }
      },
    });
  };

  const onRecall = () => {
    recall.mutate(undefined, {
      onSuccess: () => {
        setServerReadiness(null);
        showSuccess(
          recallsToAmendment
            ? "Amendment recalled — project is back Under Amendment"
            : "Project Recalled — status set back to Draft",
        );
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.detail : null;
        showError(
          typeof detail === "string"
            ? detail
            : err instanceof Error
              ? err.message
              : "Failed to recall the project.",
        );
      },
    });
  };

  const onInitiate = () => {
    initiate.mutate(undefined, {
      onSuccess: () => {
        setServerReadiness(null);
        showSuccess("Amendment initiated — project is now Under Amendment");
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.detail : null;
        showError(
          typeof detail === "string"
            ? detail
            : err instanceof Error
              ? err.message
              : "Failed to initiate the amendment.",
        );
      },
    });
  };

  const initiateIntro =
    mode === "amend-initiate" ? (
      <SectionCard icon={GitPullRequestArrow} title="Initiate Amendment">
        <p className="text-sm text-slate-600">
          Initiating an amendment snapshots the current project data for audit and unlocks the
          charter and baseline for edits — every field except <strong>Project Type</strong>. When
          done, submit the changes from <strong>Send To Approve</strong>.
        </p>
      </SectionCard>
    ) : null;

  const initiateStatus = isUnderAmendment ? (
    <p className="text-sm text-violet-700">
      An amendment is already in progress. Make your edits, then go to Send To Approve.
    </p>
  ) : !canInitiate ? (
    <p className="text-sm text-slate-400">
      This project is {effectiveProjectStatus(view)} — only an Approved project that isn&apos;t
      Closed can be amended.
    </p>
  ) : null;

  const initiateBar =
    mode === "amend-initiate" ? (
      <StickyActionBar secondary={initiateStatus}>
        <Button
          onClick={onInitiate}
          disabled={busy || !canInitiate}
          className="h-11 gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
        >
          {initiate.isPending ? <ButtonSpinner /> : <GitPullRequestArrow className="size-4" />}
          Initiate Amendment
        </Button>
      </StickyActionBar>
    ) : null;

  const submitIntro =
    mode === "amend-initiate" ? null : (
      <SectionCard icon={SendHorizontal} title="Submit for Approval">
        <p className="text-sm text-slate-600">
          Project Profile, Scope &amp; Schedule, Measurement, Commitments and Milestones must all
          be complete before this project can go to Delivery Excellence. The RAIDO register is
          informational and does not block submission.
        </p>
      </SectionCard>
    );

  const submitStatus =
    project && !isBaselineEditable(project.project_status) ? (
      <BaselineLockMessage project={project} />
    ) : isAmend && !isUnderAmendment ? (
      <p className="text-sm text-slate-400">
        This project is {view.project_status}. Initiate an amendment first.
      </p>
  ) : view.modules_incomplete > 0 ? (
    <p className="text-xs text-amber-600">
      {view.modules_incomplete} mandatory module(s) still incomplete.
    </p>
  ) : null;

  const submitBar =
    mode === "amend-initiate" ? null : (
      <StickyActionBar
        secondary={submitStatus}
        className={project && !isBaselineEditable(project.project_status) ? LOCK_BAR_CLASS : undefined}
      >
        <Button
          variant="outline"
          onClick={() => setConfirm("recall")}
          disabled={busy || !isPendingApproval}
          className="h-11 gap-2 px-6 text-sm font-semibold"
        >
          {recall.isPending ? <ButtonSpinner /> : <Undo2 className="size-4" />}
          {`Recall to ${recallTarget}`}
        </Button>
        <Button
          onClick={() => setConfirm("send")}
          disabled={busy || !view.can_submit}
          className="h-11 gap-2 bg-[#1a4a7a] px-6 font-semibold text-white hover:bg-[#15406b]"
        >
          {send.isPending ? <ButtonSpinner /> : <SendHorizontal className="size-4" />}
          Send To Approve
        </Button>
      </StickyActionBar>
    );

  return (
    <div className="flex flex-col gap-6">
      <ConfirmationDialog
        open={confirm === "send"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Send to approval?"
        message={
          isUnderAmendment
            ? "The amendment will be sent to Delivery Excellence for approval and locked from further edits until it is approved, returned or recalled. Do you want to proceed?"
            : "The project will be sent to Delivery Excellence for approval and locked from further edits until it is approved, returned or recalled. Do you want to proceed?"
        }
        confirmLabel="Send To Approve"
        confirmVariant="default"
        onConfirm={() => {
          setConfirm(null);
          onSubmit();
        }}
      />
      <ConfirmationDialog
        open={confirm === "recall"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={`Recall to ${recallTarget}?`}
        message={`The project will be taken back from Delivery Excellence and set to ${recallTarget} so it can be edited again. Do you want to proceed?`}
        confirmLabel={`Recall to ${recallTarget}`}
        confirmVariant="default"
        onConfirm={() => {
          setConfirm(null);
          onRecall();
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Overall Completion" value={`${view.completion_pct}%`} />
        <Tile label="Modules Complete" value={view.modules_complete} />
        <Tile
          label="Modules Incomplete"
          value={view.modules_incomplete}
          tone={view.modules_incomplete > 0 ? "red" : undefined}
        />
        <Tile
          label="Critical Gaps"
          value={view.critical_gaps}
          tone={view.critical_gaps > 0 ? "red" : undefined}
        />
      </div>

      {initiateIntro}
      {submitIntro}

      {wasReturnedByDe ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <MessageSquareWarning className="size-4" />
            Returned by Delivery Excellence
            {view.de_reviewed_at ? (
              <span className="font-normal text-red-600">· {view.de_reviewed_at.slice(0, 10)}</span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] font-bold tracking-wider text-red-400 uppercase">
            Rejection Remarks
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-red-700">{view.de_review_remarks}</p>
        </div>
      ) : null}

      <SectionCard icon={ClipboardCheck} title="Approval Readiness Checklist">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                <th className="px-3 py-3">Module</th>
                <th className="px-3 py-3">Completion</th>
                <th className="px-3 py-3">Gaps</th>
                <th className="px-3 py-3">DE Review</th>
                <th className="px-3 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody>
              {view.modules.map((m) => (
                <tr key={m.key} className="border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {m.label}
                    {!m.mandatory ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        {m.restricted ? "Restricted - not required" : "Optional"}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 font-mono",
                      m.complete || !m.mandatory ? "text-slate-600" : "text-[#1a6fc4]"
                    )}
                  >
                    {m.progress_pct}%
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {m.gaps ? (
                      m.mandatory ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <CircleAlert className="size-3.5" />
                          {m.gaps}
                        </span>
                      ) : (
                        <span>{m.gaps}</span>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <DeReviewBadge action={m.de_review_action} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`${base}/${APPROVAL_MODULE_VIEW_PATH[m.key]}`}
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

      {initiateBar}
      {submitBar}
    </div>
  );
}
