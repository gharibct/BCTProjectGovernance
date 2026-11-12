"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { usePageBanner } from "@/stores/page-banner";
import {
  useAccountFindingActionTaken,
  useAccountFindings,
  useAccountFindingsKpis,
  type AccountFindingRow,
  type AccountFindingsFilter,
} from "@/lib/api/de-account-audit";
import { AccountFindingHistory, AccountFindingsBoard, PAGE_SIZE, type FindingsDrawerState } from "./account-findings-board";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Account Findings — the Delivery Manager's view of DE findings raised on their
// accounts. The one action is "Action Taken": record what was done, which moves
// the finding to Awaiting Closure for the DE to verify.
export function AccountFindingsView() {
  const [filters, setFilters] = React.useState<AccountFindingsFilter>({ status: "Active" });
  const [skip, setSkip] = React.useState(0);
  const [drawer, setDrawer] = React.useState<FindingsDrawerState | null>(null);

  const list = useAccountFindings({ ...filters, skip, limit: PAGE_SIZE });
  const kpis = useAccountFindingsKpis();

  return (
    <AccountFindingsBoard
      title="Account Findings"
      subtitle="Findings raised by Delivery Excellence on your accounts — record the action taken"
      filters={filters}
      onFiltersChange={setFilters}
      skip={skip}
      onSkipChange={setSkip}
      list={list}
      kpis={kpis.data}
      drawer={drawer}
      onDrawerChange={setDrawer}
      drawerTitle={(row) => (row ? `Finding #${row.sequence_no}` : "Finding")}
      renderDrawer={(_state, row) => (row ? <ActionTakenDetail row={row} onClose={() => setDrawer(null)} /> : null)}
    />
  );
}

function ActionTakenDetail({ row, onClose }: { row: AccountFindingRow; onClose: () => void }) {
  const actionTaken = useAccountFindingActionTaken();
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const actionable = row.status === "Open" || row.status === "In Progress";
  const [text, setText] = React.useState(row.action_taken ?? "");
  const [date, setDate] = React.useState(row.action_taken_date ?? today());

  const submit = () =>
    actionTaken.mutate(
      { id: row.id, action_taken: text.trim(), action_taken_date: date || undefined },
      {
        onSuccess: () => {
          showSuccess("Action recorded — finding is awaiting closure.");
          onClose();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to record action."),
      },
    );

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs text-slate-400">#{row.sequence_no}</span>
        <span className="text-sm font-semibold text-slate-800">{row.account_name}</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge value={row.status} />
          {row.overdue ? <span className="text-xs font-bold text-red-600">Overdue</span> : null}
        </div>
      </div>

      <Field label="Finding">
        <Textarea value={row.description ?? ""} rows={3} disabled />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <Input value={row.category} disabled />
        </Field>
        <Field label="Classification">
          <Input value={row.classification} disabled />
        </Field>
      </div>
      <Field label="Due Date">
        <Input type="date" value={row.due_date ?? ""} disabled />
      </Field>
      {row.remarks ? (
        <Field label="Verification Remarks">
          <Textarea value={row.remarks} rows={3} disabled />
        </Field>
      ) : null}

      <Field label="Action Taken" htmlFor="acct-action-taken" hint="What was done to address this finding.">
        <Textarea
          id="acct-action-taken"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!actionable}
          placeholder="Describe the action taken…"
        />
      </Field>
      <Field label="Action Taken Date" htmlFor="acct-action-taken-date">
        <Input id="acct-action-taken-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!actionable} />
      </Field>

      {actionable ? (
        <Button onClick={submit} disabled={actionTaken.isPending || !text.trim()} className="gap-2 self-start">
          {actionTaken.isPending ? <ButtonSpinner /> : null}
          Action Taken
        </Button>
      ) : (
        <p className="text-sm text-slate-400">This finding is already {row.status}.</p>
      )}

      <AccountFindingHistory findingId={row.id} scope="owner" />
    </div>
  );
}
