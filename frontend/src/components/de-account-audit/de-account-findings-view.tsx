"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { MultiSelectChecklist } from "@/components/forms/multi-select-checklist";
import { StatusBadge } from "@/components/forms/status-badge";
import { canWriteDeAssessment } from "@/lib/api/de-assessment-permissions";
import { fetchProjectOptions } from "@/lib/api/projects";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole } from "@/stores/session";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  useCreateDeAccountFinding,
  useDeAccountAuditQueue,
  useDeAccountFindings,
  useDeAccountFindingsKpis,
  useUpdateDeAccountFinding,
  type AccountFindingRow,
  type AccountFindingsFilter,
  type FindingCategory,
  type FindingClassification,
  type FindingStatus,
} from "@/lib/api/de-account-audit";
import { AccountFindingHistory, AccountFindingsBoard, PAGE_SIZE, type FindingsDrawerState } from "./account-findings-board";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// DE Account Findings — the DE's register of findings raised against accounts:
// raise a new one, start / cancel it, and close it (or send it back) once the
// account's Delivery Manager records the action taken.
// `?account=<id>` pre-filters to one account (linked from the audit queue/workspace).
export function DeAccountFindingsView() {
  const initialAccountId = useSearchParams().get("account") ?? undefined;
  const [filters, setFilters] = React.useState<AccountFindingsFilter>({
    status: "Active",
    accountId: initialAccountId,
  });
  const [skip, setSkip] = React.useState(0);
  const [drawer, setDrawer] = React.useState<FindingsDrawerState | null>(null);
  const canWrite = canWriteDeAssessment(useEffectiveRole());

  const list = useDeAccountFindings({ ...filters, skip, limit: PAGE_SIZE });
  const kpis = useDeAccountFindingsKpis({ accountId: filters.accountId });

  return (
    <AccountFindingsBoard
      title="Account Findings"
      subtitle="Raise and close findings from Delivery Excellence audits of accounts"
      headerAction={
        <Button
          onClick={() => setDrawer({ mode: "create" })}
          disabled={!canWrite}
          className="h-11 gap-2 bg-[#0f172a] px-5 text-sm font-semibold text-white hover:bg-[#1e293b]"
        >
          <Plus className="size-4" />
          New Finding
        </Button>
      }
      filters={filters}
      onFiltersChange={setFilters}
      skip={skip}
      onSkipChange={setSkip}
      list={list}
      kpis={kpis.data}
      drawer={drawer}
      onDrawerChange={setDrawer}
      drawerTitle={(row) => (row ? `Finding #${row.sequence_no}` : "New Finding")}
      renderDrawer={(state, row) =>
        state.mode === "create" ? (
          <CreateFinding initialAccountId={filters.accountId} onDone={() => setDrawer(null)} />
        ) : row ? (
          <FindingDetail row={row} canWrite={canWrite} onClose={() => setDrawer(null)} />
        ) : null
      }
    />
  );
}

function CreateFinding({ initialAccountId, onDone }: { initialAccountId?: string; onDone: () => void }) {
  const create = useCreateDeAccountFinding();
  const { data: queue } = useDeAccountAuditQueue();
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [accountId, setAccountId] = React.useState(initialAccountId ?? "");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<FindingCategory | "">("");
  const [classification, setClassification] = React.useState<FindingClassification | "">("");
  const [findingDate, setFindingDate] = React.useState(today);
  const [dueDate, setDueDate] = React.useState("");
  const [projectIds, setProjectIds] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Optional: the selected account's (non-Draft) projects, to tag the finding with.
  const { data: projectPage } = useQuery({
    queryKey: ["account-finding-projects", accountId],
    queryFn: () => fetchProjectOptions({ search: "", filters: { account_id: accountId }, limit: 200, excludeStatus: "Draft" }),
    enabled: !!accountId,
  });
  const projectOptions = (projectPage?.items ?? []).map((p) => ({
    value: p.id,
    label: `${p.project_code} — ${p.project_name}`,
  }));

  const submit = () => {
    const next: Record<string, string> = {};
    if (!accountId) next.account = "Select an account.";
    if (!description.trim()) next.description = "Describe the finding.";
    if (!category) next.category = "Select a category.";
    if (!classification) next.classification = "Select a classification.";
    if (!findingDate) next.findingDate = "Finding date is required.";
    if (!dueDate) next.dueDate = "Due date is required.";
    else if (findingDate && dueDate < findingDate) next.dueDate = "Due date cannot be before the finding date.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    create.mutate(
      {
        account_id: accountId,
        description: description.trim(),
        category: category as FindingCategory,
        classification: classification as FindingClassification,
        finding_date: findingDate,
        due_date: dueDate,
        project_ids: projectIds,
      },
      {
        onSuccess: () => {
          showSuccess("Finding raised.");
          onDone();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to raise finding."),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <Field label="Account" htmlFor="acct-finding-account" badge={<MandatoryBadge />} error={errors.account}>
        <NativeSelect id="acct-finding-account" value={accountId} onChange={(e) => {
            setAccountId(e.target.value);
            setProjectIds([]);
          }}
        >
          <option value="">Select account</option>
          {(queue?.rows ?? []).map((r) => (
            <option key={r.account_id} value={r.account_id}>
              {r.account_name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Project Codes (optional)">
        <MultiSelectChecklist
          options={projectOptions}
          value={projectIds}
          onChange={setProjectIds}
          disabled={!accountId}
          emptyLabel={accountId ? "No projects for this account" : "Select an account first"}
        />
      </Field>
      <Field label="Finding" htmlFor="acct-finding-description" badge={<MandatoryBadge />} error={errors.description}>
        <Textarea
          id="acct-finding-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the finding…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" htmlFor="acct-finding-category" badge={<MandatoryBadge />} error={errors.category}>
          <NativeSelect id="acct-finding-category" value={category} onChange={(e) => setCategory(e.target.value as FindingCategory)}>
            <option value="">Select</option>
            {FINDING_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Classification" htmlFor="acct-finding-class" badge={<MandatoryBadge />} error={errors.classification}>
          <NativeSelect
            id="acct-finding-class"
            value={classification}
            onChange={(e) => setClassification(e.target.value as FindingClassification)}
          >
            <option value="">Select</option>
            {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Finding Date" htmlFor="acct-finding-date" badge={<MandatoryBadge />} error={errors.findingDate}>
          <Input id="acct-finding-date" type="date" value={findingDate} onChange={(e) => setFindingDate(e.target.value)} />
        </Field>
        <Field label="Due Date" htmlFor="acct-finding-due" badge={<MandatoryBadge />} error={errors.dueDate}>
          <Input id="acct-finding-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-3">
        <Button onClick={submit} disabled={create.isPending} className="gap-2">
          {create.isPending ? <ButtonSpinner /> : null}
          Raise Finding
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

type Transition = { label: string; next: FindingStatus };

// Plain status moves; closing (captures date + remarks) and reopening are below.
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

function FindingDetail({ row, canWrite, onClose }: { row: AccountFindingRow; canWrite: boolean; onClose: () => void }) {
  const update = useUpdateDeAccountFinding();
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);
  const [closureDate, setClosureDate] = React.useState(today);
  const [remarks, setRemarks] = React.useState("");

  const run = (next: FindingStatus, extra?: { closure_date?: string; remarks?: string }) =>
    update.mutate(
      { id: row.id, payload: { status: next, ...extra } },
      {
        onSuccess: () => {
          showSuccess(`Finding marked ${next}.`);
          onClose();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update finding."),
      },
    );

  const awaiting = row.status === "Awaiting Closure";
  const transitions = transitionsFor(row.status);

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

      {row.project_codes.length > 0 ? (
        <Field label="Project Codes">
          <Input value={row.project_codes.join(", ")} disabled />
        </Field>
      ) : null}
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
        <Field label="Finding Date">
          <Input type="date" value={row.finding_date ?? ""} disabled />
        </Field>
        <Field label="Due Date">
          <Input type="date" value={row.due_date ?? ""} disabled />
        </Field>
        <Field label="Action Taken Date">
          <Input type="date" value={row.action_taken_date ?? ""} disabled />
        </Field>
        {row.closure_date ? (
          <Field label="Closure Date">
            <Input type="date" value={row.closure_date} disabled />
          </Field>
        ) : null}
      </div>
      <Field label="Action Taken">
        <Textarea value={row.action_taken ?? ""} rows={3} disabled placeholder="Recorded by the Delivery Manager" />
      </Field>
      <Field label="Verification Remarks">
        <Textarea value={row.remarks ?? ""} rows={3} disabled placeholder="Recorded by the DE at closure" />
      </Field>

      {canWrite && (transitions.length > 0 || awaiting) ? (
        <div className="flex flex-col gap-4 border-t border-slate-200 pt-5">
          {awaiting ? (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Close Finding</span>
              <Field label="Closure Date" htmlFor="acct-close-date">
                <Input id="acct-close-date" type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
              </Field>
              <Field label="Verification Remarks" htmlFor="acct-close-remarks">
                <Textarea
                  id="acct-close-remarks"
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="What was verified before closing…"
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => run("Closed", { closure_date: closureDate || undefined, remarks: remarks.trim() || undefined })}
                  disabled={update.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {update.isPending ? <ButtonSpinner /> : null}
                  Close Finding
                </Button>
                {/* Send it back to the Delivery Manager — the action taken wasn't enough. */}
                <Button onClick={() => run("Open")} disabled={update.isPending} variant="outline">
                  Reopen Finding
                </Button>
              </div>
            </div>
          ) : null}
          {transitions.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  onClick={() => run(t.next)}
                  disabled={update.isPending}
                  variant={t.next === "Cancelled" ? "destructive" : "default"}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <AccountFindingHistory findingId={row.id} scope="de" />
    </div>
  );
}
