"use client";

import * as React from "react";

import { ApiError } from "@/lib/api/client";
import {
  useApproveProjectCreationRequest,
  useProjectCreationRequests,
  useRejectProjectCreationRequest,
  type ProjectCreationRequestRow,
} from "@/lib/api/project-creation-requests";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/forms/form-primitives";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// DE Project Creation Approval queue. Lists pending creation requests submitted
// by Account / Geo Heads; Approve creates the real Draft project, Reject deletes
// the request. Separate from /de-approval (governance-completeness review of an
// already-created project).
export function DeProjectRequestsQueue() {
  const { data: rows = [], isLoading, isError, error, refetch } = useProjectCreationRequests();
  const userId = useSession((s) => s.user?.id ?? null);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const approve = useApproveProjectCreationRequest();
  const reject = useRejectProjectCreationRequest();

  const [rejectTarget, setRejectTarget] = React.useState<ProjectCreationRequestRow | null>(null);
  const [rejectRemarks, setRejectRemarks] = React.useState("");
  const [approveTarget, setApproveTarget] = React.useState<ProjectCreationRequestRow | null>(null);
  const [approveRemarks, setApproveRemarks] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const openReject = (row: ProjectCreationRequestRow) => {
    if (!userId) {
      showError("Your session has expired. Sign in again to reject requests.");
      return;
    }
    setRejectRemarks("");
    setRejectTarget(row);
  };

  const openApprove = (row: ProjectCreationRequestRow) => {
    if (!userId) {
      showError("Your session has expired. Sign in again to approve requests.");
      return;
    }
    setApproveRemarks("");
    setApproveTarget(row);
  };

  const onConfirmApprove = () => {
    if (!approveTarget || !userId) return;
    const row = approveTarget;
    const remarks = approveRemarks.trim();
    setBusyId(row.id);
    approve.mutate(
      { id: row.id, reviewedBy: userId, remarks: remarks || undefined },
      {
        onSuccess: () => showSuccess(`"${row.project_name}" created in Draft.`),
        onError: (err) =>
          showError(err instanceof Error ? err.message : "Failed to approve the request."),
        onSettled: () => {
          setBusyId(null);
          setApproveTarget(null);
        },
      },
    );
  };

  const onConfirmReject = () => {
    if (!rejectTarget || !userId) return;
    const row = rejectTarget;
    const remarks = rejectRemarks.trim();
    if (!remarks) return;
    setBusyId(row.id);
    reject.mutate(
      { id: row.id, reviewedBy: userId, remarks },
      {
        onSuccess: () => showSuccess(`Request for "${row.project_name}" rejected.`),
        onError: (err) =>
          showError(err instanceof Error ? err.message : "Failed to reject the request."),
        onSettled: () => {
          setBusyId(null);
          setRejectTarget(null);
        },
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Project Creation Approval</h1>
        <p className="mt-1 text-sm text-slate-500">
          Approve to create the project in Draft for the assigned Project Manager, or reject to
          discard the request.
        </p>
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load creation requests.</p>
          <p className="mt-1 text-red-600">
            {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              {isLoading ? "Loading…" : "No project creation requests pending."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-3">Project</th>
                    <th className="px-3 py-3">Project Manager</th>
                    <th className="px-3 py-3">Organization</th>
                    <th className="px-3 py-3">Geo</th>
                    <th className="px-3 py-3">Region</th>
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Oracle Projects</th>
                    <th className="px-3 py-3">Requested By</th>
                    <th className="px-3 py-3">Requested</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const busy = busyId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-2.5 font-semibold text-slate-900">{row.project_name}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {row.project_manager_name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{row.organization_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.geo_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.region_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.account_name ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                          {row.oracle_project_ids.join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{row.requested_by_name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              disabled={busy}
                              onClick={() => openApprove(row)}
                              className="h-8 gap-1.5 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              {busy && approve.isPending ? <ButtonSpinner /> : null}
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openReject(row)}
                              className="h-8 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={approveTarget !== null}
        onOpenChange={(open) => (!open ? setApproveTarget(null) : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve creation request?</DialogTitle>
            <DialogDescription>
              {approveTarget
                ? `"${approveTarget.project_name}" will be created in Draft for ${approveTarget.project_manager_name ?? "the assigned Project Manager"}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="approve-remarks">Remarks (optional)</Label>
            <Textarea
              id="approve-remarks"
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              placeholder="Add any notes for this approval…"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={approve.isPending}
              onClick={onConfirmApprove}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {approve.isPending ? <ButtonSpinner /> : null}
              Approve Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => (!open ? setRejectTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject creation request?</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `"${rejectTarget.project_name}" will not be created. The request is kept as Rejected and the requester can see your remarks.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reject-remarks">Remarks (required)</Label>
            <Textarea
              id="reject-remarks"
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Explain why this request is being rejected…"
              maxLength={2000}
              aria-invalid={rejectRemarks.trim().length === 0}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={reject.isPending || rejectRemarks.trim().length === 0}
              onClick={onConfirmReject}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700"
            >
              {reject.isPending ? <ButtonSpinner /> : null}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
