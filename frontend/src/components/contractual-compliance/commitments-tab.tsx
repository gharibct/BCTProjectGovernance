"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ChevronRight, ClipboardCheck, GaugeCircle, History, Plus } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate, formatDateTime } from "@/components/dashboard/project-health-kpi";
import { useReportingPeriods, useUsersByIds } from "@/lib/api/reference-data";
import {
  useCommitmentActuals,
  useCommitments,
  useCreateCommitmentActual,
  useDeleteCommitmentActual,
  useLatestCommitmentActuals,
  useUpdateCommitmentActual,
  type ContractualCommitment,
  type ContractualCommitmentActual,
  type MetStatus,
} from "@/lib/api/contractual";

const MET_STATUSES: MetStatus[] = ["Met", "Not Met", "Breached"];

// Project Reporting is actuals-only: the commitment definitions are fixed at
// charter time (New Project → Contractual Compliance). This tab shows the
// register read-only and lets the PM record what was actually achieved for
// the selected reporting period, then review the full history per commitment.
export function CommitmentsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: items = [] } = useCommitments(projectId);
  const commitmentIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const actualsByCommitment = useLatestCommitmentActuals(projectId, commitmentIds);
  const [openFor, setOpenFor] = React.useState<ContractualCommitment | null>(null);

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={ClipboardCheck}
        title="Commitments Register"
        aside={<AutoBadge label={`${items.length} logged`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No commitments defined yet."
          onRowClick={(c) => setOpenFor(c)}
          columns={[
            { key: "commitment_name", label: "Commitment" },
            { key: "frequency", label: "Frequency" },
            { key: "target", label: "Target", align: "right" },
            {
              key: "penalty_applicable",
              label: "Penalty",
              render: (item) => (item.penalty_applicable ? "Yes" : "No"),
            },
            { key: "penalty_value", label: "Penalty Value", align: "right" },
            {
              key: "actual",
              label: "Latest Actual",
              align: "right",
              render: (item) => actualsByCommitment[item.id]?.latest?.actual_value ?? "—",
            },
            {
              key: "met_status",
              label: "Status",
              render: (item) => actualsByCommitment[item.id]?.latest?.met_status ?? "—",
            },
            {
              key: "history",
              label: "History",
              align: "right",
              render: (item) => {
                const count = actualsByCommitment[item.id]?.count ?? 0;
                return (
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span
                      className={
                        count > 0
                          ? "inline-flex min-w-[1.5rem] justify-center rounded-full bg-[#d9eafc] px-2 py-0.5 text-xs font-semibold text-[#15406b]"
                          : "text-xs text-slate-400"
                      }
                    >
                      {count > 0 ? count : "—"}
                    </span>
                    <ChevronRight className="size-4 text-slate-400" />
                  </span>
                );
              },
            },
          ]}
        />
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <History className="size-3.5" />
          Select a commitment row to view and edit its recorded actuals.
        </p>
      </SectionCard>

      <MonthlyActualCapture projectId={projectId} commitments={items} />

      <Sheet open={!!openFor} onOpenChange={(open) => !open && setOpenFor(null)}>
        {openFor ? <CommitmentActualsDrawer projectId={projectId} commitment={openFor} /> : null}
      </Sheet>
    </div>
  );
}

// Monthly Project Reporting capture: the commitment definitions above are
// fixed at charter time; here the PM records what was actually achieved. The
// date defaults to the selected reporting period's start date but is editable
// so a reading can be logged for the actual period it covers.
function MonthlyActualCapture({
  projectId,
  commitments,
}: {
  projectId: string;
  commitments: ContractualCommitment[];
}) {
  const periodId = useSearchParams().get("period");
  const { data: periods = [] } = useReportingPeriods();
  const period = periods.find((p) => p.id === periodId) ?? null;
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const [commitmentId, setCommitmentId] = React.useState("");
  const [actualValue, setActualValue] = React.useState("");
  const [metStatus, setMetStatus] = React.useState<"" | MetStatus>("");

  // The date defaults to the selected reporting period's start date (or today
  // when no period is in context) and is editable. A manual edit is remembered
  // against the period it was made for, so switching periods falls back to the
  // new period's start date.
  const todayISO = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultDate = period?.start_date ?? todayISO;
  const dateKey = period?.id ?? "none";
  const [dateEdit, setDateEdit] = React.useState<{ key: string; value: string } | null>(null);
  const periodDate = dateEdit && dateEdit.key === dateKey ? dateEdit.value : defaultDate;
  const onPeriodDateChange = (value: string) => setDateEdit({ key: dateKey, value });

  const createActual = useCreateCommitmentActual(projectId, commitmentId);

  const save = () => {
    if (!commitmentId || !periodDate) return;
    createActual.mutate(
      {
        period_date: periodDate,
        actual_value: actualValue || undefined,
        met_status: metStatus || undefined,
      },
      {
        onSuccess: () => {
          setActualValue("");
          setMetStatus("");
          showSuccess("Commitment Actual Recorded");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to record the actual."),
      },
    );
  };

  return (
    <SectionCard icon={GaugeCircle} title="Record Actual">
      {commitments.length === 0 ? (
        <EmptyState>No commitments have been defined for this project.</EmptyState>
      ) : (
        <>
          <p className="mb-6 text-sm text-slate-500">
            {period ? (
              <>
                Reporting period:{" "}
                <span className="font-semibold text-slate-700">{period.label}</span>
              </>
            ) : (
              <>No reporting period in context — the date defaults to today and is editable.</>
            )}
          </p>
          <div className="grid gap-6 sm:grid-cols-4">
            <Field label="Commitment">
              <NativeSelect value={commitmentId} onChange={(e) => setCommitmentId(e.target.value)}>
                <option value="" disabled>
                  Select…
                </option>
                {commitments.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.commitment_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={periodDate}
                onChange={(e) => onPeriodDateChange(e.target.value)}
              />
            </Field>
            <Field label="Actual">
              <Input
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                placeholder="e.g. 93%"
              />
            </Field>
            <Field label="Status">
              <NativeSelect
                value={metStatus}
                onChange={(e) => setMetStatus(e.target.value as "" | MetStatus)}
              >
                <option value="">—</option>
                {MET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={save}
              disabled={!commitmentId || !periodDate || createActual.isPending}
              className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              {createActual.isPending ? <ButtonSpinner /> : null}
              Record Actual
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// Per-commitment actuals history — every reading recorded against this
// commitment (newest first), with in-place edit of value/status and delete.
// The recording date is immutable (it is the unique key); re-record from the
// capture form for a new date, or delete and re-add to move one.
function CommitmentActualsDrawer({
  projectId,
  commitment,
}: {
  projectId: string;
  commitment: ContractualCommitment;
}) {
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const { data: actuals = [], isLoading } = useCommitmentActuals(projectId, commitment.id, true);
  const users = useUsersByIds(actuals.map((a) => a.recorded_by));
  const userName = (id: string | null) =>
    id ? (users.data?.find((u) => u.id === id)?.full_name ?? "—") : "—";

  const createActual = useCreateCommitmentActual(projectId, commitment.id);
  const updateActual = useUpdateCommitmentActual(projectId, commitment.id);
  const deleteActual = useDeleteCommitmentActual(projectId, commitment.id);

  const todayISO = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [adding, setAdding] = React.useState(false);
  const [addDate, setAddDate] = React.useState(todayISO);
  const [addValue, setAddValue] = React.useState("");
  const [addStatus, setAddStatus] = React.useState<"" | MetStatus>("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<"" | MetStatus>("");

  const saveAdd = () => {
    if (!addDate) return;
    createActual.mutate(
      {
        period_date: addDate,
        actual_value: addValue || undefined,
        met_status: addStatus || undefined,
      },
      {
        onSuccess: () => {
          setAddValue("");
          setAddStatus("");
          showSuccess("Commitment Actual Recorded");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to record the actual."),
      },
    );
  };

  const startEdit = (row: ContractualCommitmentActual) => {
    setEditingId(row.id);
    setEditValue(row.actual_value ?? "");
    setEditStatus(row.met_status ?? "");
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editingId) return;
    updateActual.mutate(
      {
        id: editingId,
        payload: { actual_value: editValue || undefined, met_status: editStatus || undefined },
      },
      {
        onSuccess: () => {
          setEditingId(null);
          showSuccess("Commitment Actual Updated");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update the actual."),
      },
    );
  };

  const remove = (row: ContractualCommitmentActual) => {
    deleteActual.mutate(row.id, {
      onSuccess: () => {
        if (editingId === row.id) setEditingId(null);
        showSuccess("Commitment Actual Deleted");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete the actual."),
    });
  };

  return (
    <SheetContent className="gap-0 p-0 sm:w-[560px] lg:w-[46%]">
      <SheetHeader>
        <SheetTitle>Actuals — {commitment.commitment_name}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {commitment.frequency} cadence · {actuals.length} recorded
          </p>
          <Button
            variant="outline"
            className="h-9 gap-1.5 px-3 text-xs font-semibold"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="size-3.5" />
            {adding ? "Close" : "Add Actual"}
          </Button>
        </div>

        {adding ? (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-4 text-sm font-semibold text-slate-700">New actual</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date">
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </Field>
              <Field label="Actual">
                <Input
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  placeholder="e.g. 93%"
                />
              </Field>
              <Field label="Status">
                <NativeSelect
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value as "" | MetStatus)}
                >
                  <option value="">—</option>
                  {MET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={saveAdd}
                disabled={!addDate || createActual.isPending}
                className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                {createActual.isPending ? <ButtonSpinner /> : null}
                Record Actual
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Recording an existing date overwrites that entry.
            </p>
          </div>
        ) : null}

        <RegisterTable
          items={actuals}
          emptyLabel={isLoading ? "Loading…" : "No actuals recorded yet."}
          onEdit={startEdit}
          onDelete={remove}
          columns={[
            { key: "period_date", label: "Date", render: (r) => formatDate(r.period_date) },
            { key: "actual_value", label: "Actual", align: "right", render: (r) => r.actual_value ?? "—" },
            { key: "met_status", label: "Status", badge: true },
            { key: "recorded_by", label: "Recorded By", render: (r) => userName(r.recorded_by) },
            { key: "created_at", label: "Recorded At", render: (r) => formatDateTime(r.created_at) },
          ]}
        />

        {editingId ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-4 text-sm font-semibold text-slate-700">
              Edit actual ·{" "}
              {formatDate(actuals.find((a) => a.id === editingId)?.period_date)}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Actual">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="e.g. 93%"
                />
              </Field>
              <Field label="Status">
                <NativeSelect
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "" | MetStatus)}
                >
                  <option value="">—</option>
                  {MET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-10 px-5 text-sm font-semibold"
                onClick={cancelEdit}
              >
                Cancel
              </Button>
              <Button
                onClick={saveEdit}
                disabled={updateActual.isPending}
                className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                {updateActual.isPending ? <ButtonSpinner /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SheetContent>
  );
}
