"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import { FINDING_CLASSIFICATION_OPTIONS, FINDING_SEVERITY_OPTIONS } from "@/lib/api/de-findings";
import { usePmFindingActionTaken, type DeFindingRow } from "@/lib/api/pm-findings";

const ACTIONABLE = ["Open", "In Progress"];

// The PM's view of a finding: everything the DE captured is read-only; the PM
// records what they did in Remarks and clicks "Action Taken", which moves the
// finding to "Awaiting Closure" for the DE to close.
export function PmFindingsDetailView({
  row,
  canAct,
  onClose,
}: {
  row: DeFindingRow;
  canAct: boolean;
  onClose: () => void;
}) {
  const actionTaken = usePmFindingActionTaken();
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [remarks, setRemarks] = React.useState(() => row.remarks ?? "");

  const isActionable = ACTIONABLE.includes(row.status);

  const submit = () => {
    actionTaken.mutate(
      { id: row.id, remarks: remarks.trim() },
      {
        onSuccess: () => {
          showSuccess("Finding moved to Awaiting Closure.");
          onClose();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to record the action."),
      }
    );
  };

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

      <Field label="Finding">
        <Textarea value={row.description ?? ""} rows={3} disabled />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Classification">
          <NativeSelect value={row.classification} disabled>
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
        <Field label="Severity">
          <NativeSelect value={row.severity ?? ""} disabled>
            <option value="">—</option>
            {FINDING_SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Assigned To">
          <Input value={row.assignee_name ?? "Unassigned"} disabled />
        </Field>
        <Field label="Due Date">
          <Input type="date" value={row.due_date ?? ""} disabled />
        </Field>
      </div>

      <Field label="Remarks" htmlFor="pm-finding-remarks" hint="What was done to address this finding.">
        <Textarea
          id="pm-finding-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          disabled={!canAct || !isActionable}
          placeholder="Describe the action taken…"
        />
      </Field>

      {!canAct ? null : isActionable ? (
        <Button
          onClick={submit}
          disabled={actionTaken.isPending || !remarks.trim()}
          className="gap-2 self-start"
        >
          {actionTaken.isPending ? <ButtonSpinner /> : null}
          Action Taken
        </Button>
      ) : (
        <p className="text-sm text-slate-400">This finding is already {row.status}.</p>
      )}
    </div>
  );
}
