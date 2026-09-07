"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  useDEFindingHistory,
  useUpdateDeFinding,
  type DeFindingRow,
  type FindingCategory,
  type FindingStatus,
} from "@/lib/api/de-findings";
import { FindingHistoryTimeline } from "./finding-history-timeline";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Transition = { label: string; next: FindingStatus; className?: string };

// Plain (no extra capture) status moves. "Closed" and reopening are handled
// separately below because closing captures a date + verification remarks.
function transitionsFor(status: FindingStatus): Transition[] {
  switch (status) {
    case "Open":
      return [
        { label: "Start", next: "In Progress" },
        { label: "Cancel Finding", next: "Cancelled" },
      ];
    case "In Progress":
      return [
        { label: "Mark Awaiting Closure", next: "Awaiting Closure" },
        { label: "Cancel Finding", next: "Cancelled" },
      ];
    default:
      return [];
  }
}

// DE Findings Closure drawer — read-only view of the finding (edits to its
// core fields live in the DE Assessment Workspace register), plus the status
// transitions. An "Awaiting Closure" finding can be Closed (captures a Closure
// Date + Verification Remarks) or Reopened back to Open. Closed is terminal.
export function DeFindingsDetailView({
  row,
  canWrite,
  onClose,
}: {
  row: DeFindingRow;
  canWrite: boolean;
  onClose: () => void;
}) {
  const updateFinding = useUpdateDeFinding();
  const { data: history = [] } = useDEFindingHistory(row.project_id, row.id);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [closureDate, setClosureDate] = React.useState(today);
  const [verificationRemarks, setVerificationRemarks] = React.useState("");

  const runTransition = (next: FindingStatus, extra?: { closure_date?: string; remarks?: string }) => {
    updateFinding.mutate(
      { id: row.id, projectId: row.project_id, payload: { status: next, ...extra } },
      {
        onSuccess: () => {
          showSuccess(`Finding marked ${next}.`);
          onClose();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update finding."),
      }
    );
  };

  const isAwaitingClosure = row.status === "Awaiting Closure";

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs text-slate-400">#{row.sequence_no}</span>
        <span className="text-sm font-semibold text-slate-800">{row.project_label}</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge value={row.status} />
          {row.overdue ? <span className="text-xs font-bold text-red-600">Overdue</span> : null}
        </div>
      </div>

      <Field label="Finding" htmlFor="detail-finding-description">
        <Textarea id="detail-finding-description" value={row.description ?? ""} rows={3} disabled />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" htmlFor="detail-finding-category">
          <NativeSelect id="detail-finding-category" value={row.category} disabled>
            {FINDING_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {row.category && !FINDING_CATEGORY_OPTIONS.includes(row.category as FindingCategory) ? (
              <option value={row.category}>{row.category}</option>
            ) : null}
          </NativeSelect>
        </Field>
        <Field label="Classification" htmlFor="detail-finding-classification">
          <NativeSelect id="detail-finding-classification" value={row.classification} disabled>
            {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {!FINDING_CLASSIFICATION_OPTIONS.includes(row.classification) ? (
              <option value={row.classification}>{row.classification}</option>
            ) : null}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Finding Date" htmlFor="detail-finding-date">
          <Input id="detail-finding-date" type="date" value={row.finding_date ?? ""} disabled />
        </Field>
        <Field label="Due Date" htmlFor="detail-finding-due-date">
          <Input id="detail-finding-due-date" type="date" value={row.due_date ?? ""} disabled />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Action Taken Date" htmlFor="detail-finding-action-taken-date">
          <Input
            id="detail-finding-action-taken-date"
            type="date"
            value={row.action_taken_date ?? ""}
            disabled
          />
        </Field>
        {row.closure_date ? (
          <Field label="Closure Date" htmlFor="detail-finding-closure-date">
            <Input id="detail-finding-closure-date" type="date" value={row.closure_date} disabled />
          </Field>
        ) : null}
      </div>

      <Field label="Action Taken" htmlFor="detail-finding-action-taken">
        <Textarea
          id="detail-finding-action-taken"
          value={row.action_taken ?? ""}
          rows={3}
          disabled
          placeholder="Recorded by the PM"
        />
      </Field>

      <Field label="Verification Remarks" htmlFor="detail-finding-verification-remarks">
        <Textarea
          id="detail-finding-verification-remarks"
          value={row.remarks ?? ""}
          rows={3}
          disabled
          placeholder="Recorded by the DE at closure"
        />
      </Field>

      {canWrite && (transitionsFor(row.status).length > 0 || isAwaitingClosure) ? (
        <div className="flex flex-col gap-4 border-t border-slate-200 pt-5">
          {isAwaitingClosure ? (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Close Finding</span>
              <Field label="Closure Date" htmlFor="close-finding-date">
                <Input
                  id="close-finding-date"
                  type="date"
                  value={closureDate}
                  onChange={(e) => setClosureDate(e.target.value)}
                />
              </Field>
              <Field label="Verification Remarks" htmlFor="close-finding-remarks">
                <Textarea
                  id="close-finding-remarks"
                  value={verificationRemarks}
                  onChange={(e) => setVerificationRemarks(e.target.value)}
                  rows={4}
                  placeholder="What was verified before closing…"
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    runTransition("Closed", {
                      closure_date: closureDate || undefined,
                      remarks: verificationRemarks.trim() || undefined,
                    })
                  }
                  disabled={updateFinding.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {updateFinding.isPending ? <ButtonSpinner /> : null}
                  Close Finding
                </Button>
                {/* Send it back to the PM — the action taken wasn't enough to close. */}
                <Button
                  onClick={() => runTransition("Open")}
                  disabled={updateFinding.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  {updateFinding.isPending ? <ButtonSpinner /> : null}
                  Reopen Finding
                </Button>
              </div>
            </div>
          ) : null}

          {transitionsFor(row.status).length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {transitionsFor(row.status).map((t) => (
                <Button
                  key={t.next}
                  onClick={() => runTransition(t.next)}
                  disabled={updateFinding.isPending}
                  variant={t.next === "Cancelled" ? "destructive" : "default"}
                  className={t.className ? `gap-2 ${t.className}` : "gap-2"}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <FindingHistoryTimeline entries={history} />
    </div>
  );
}
