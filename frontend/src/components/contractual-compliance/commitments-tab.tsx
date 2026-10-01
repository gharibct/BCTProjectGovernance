"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ChevronRight, ClipboardCheck, History, Plus } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { ReviewedNoChangesButton } from "@/components/reporting/reviewed-no-changes-button";
import { usePageBanner } from "@/stores/page-banner";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

const MET_STATUSES: MetStatus[] = ["Met", "Not Met"];

// Project Reporting is actuals-only: the commitment definitions are fixed at
// charter time (New Project → Contractual Compliance). This tab shows the
// register read-only and lets the PM record what was actually achieved for
// the selected reporting period, then review the full history per commitment.
export function CommitmentsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const periodId = useSearchParams().get("period");
  const { data: items = [] } = useCommitments(projectId);
  const commitmentIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const actualsByCommitment = useLatestCommitmentActuals(projectId, commitmentIds);
  const [openFor, setOpenFor] = React.useState<ContractualCommitment | null>(null);
  const [recording, setRecording] = React.useState(false);

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <ReviewedNoChangesButton projectId={projectId} periodId={periodId} pageType="COMMITMENTS" />
      </div>
      <SectionCard
        icon={ClipboardCheck}
        title="Commitments Register"
        aside={
          <div className="flex items-center gap-3">
            <AutoBadge label={`${items.length} logged`} />
            <Button
              onClick={() => setRecording(true)}
              disabled={items.length === 0}
              className="h-9 gap-1.5 bg-[#1a4a7a] px-4 text-xs font-semibold text-white hover:bg-[#15406b]"
            >
              <Plus className="size-3.5" />
              Record Actual
            </Button>
          </div>
        }
      >
        <RegisterTable
          items={items}
          emptyLabel="No commitments defined yet."
          onRowClick={(c) => setOpenFor(c)}
          columns={[
            { key: "commitment_name", label: "Commitment" },
            { key: "frequency", label: "Frequency" },
            {
              key: "penalty_applicable",
              label: "Penalty Applicability",
              render: (item) => (item.penalty_applicable ? "Yes" : "No"),
            },
            { key: "commitment_details", label: "Commitment Details" },
            {
              key: "actual",
              label: "Latest Actual",
              render: (item) => actualsByCommitment[item.id]?.latest?.actual_details ?? "—",
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

      <Sheet open={recording} onOpenChange={setRecording}>
        {recording ? (
          <RecordActualDrawer
            projectId={projectId}
            commitments={items}
            onClose={() => setRecording(false)}
          />
        ) : null}
      </Sheet>

      <Sheet open={!!openFor} onOpenChange={(open) => !open && setOpenFor(null)}>
        {openFor ? <CommitmentActualsDrawer projectId={projectId} commitment={openFor} /> : null}
      </Sheet>
    </div>
  );
}

// Record Actual drawer: the commitment definitions are fixed at charter time;
// here the PM records what was actually achieved. The date defaults to the
// selected reporting period's start date but is editable so a reading can be
// logged for the actual period it covers. Radix unmounts SheetContent on
// close, so the form state starts fresh each time.
function RecordActualDrawer({
  projectId,
  commitments,
  onClose,
}: {
  projectId: string;
  commitments: ContractualCommitment[];
  onClose: () => void;
}) {
  const periodId = useSearchParams().get("period");
  const { data: periods = [] } = useReportingPeriods();
  const period = periods.find((p) => p.id === periodId) ?? null;
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const [commitmentId, setCommitmentId] = React.useState("");
  const [actualDetails, setActualDetails] = React.useState("");
  const [metStatus, setMetStatus] = React.useState<"" | MetStatus>("");

  const todayISO = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateEdit, setDateEdit] = React.useState<string | null>(null);
  const periodDate = dateEdit ?? period?.start_date ?? todayISO;

  const createActual = useCreateCommitmentActual(projectId, commitmentId);
  const canSubmit = !!commitmentId && !!periodDate && !!metStatus;

  const save = () => {
    if (!canSubmit) return;
    createActual.mutate(
      {
        period_date: periodDate,
        actual_details: actualDetails || undefined,
        met_status: metStatus || undefined,
      },
      {
        onSuccess: () => {
          showSuccess("Commitment Actual Recorded");
          onClose();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to record the actual."),
      },
    );
  };

  return (
    <SheetContent className="gap-0 p-0">
      <SheetHeader>
        <SheetTitle>Record Actual</SheetTitle>
        <SheetDescription>
          {period ? `Reporting period: ${period.label}` : "No reporting period in context — the date defaults to today and is editable."}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid gap-6 sm:grid-cols-2">
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
            <Input type="date" value={periodDate} onChange={(e) => setDateEdit(e.target.value)} />
          </Field>
          <Field label="Status">
            <NativeSelect value={metStatus} onChange={(e) => setMetStatus(e.target.value as "" | MetStatus)}>
              <option value="" disabled>
                Select…
              </option>
              {MET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="mt-6">
          <Field label="Actual Details">
            <Textarea rows={8} value={actualDetails} onChange={(e) => setActualDetails(e.target.value)} />
          </Field>
        </div>
      </div>
      <SheetFooter>
        <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={!canSubmit || createActual.isPending}
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {createActual.isPending ? <ButtonSpinner /> : null}
          Record Actual
        </Button>
      </SheetFooter>
    </SheetContent>
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

  const updateActual = useUpdateCommitmentActual(projectId, commitment.id);
  const deleteActual = useDeleteCommitmentActual(projectId, commitment.id);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDetails, setEditDetails] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<"" | MetStatus>("");

  const startEdit = (row: ContractualCommitmentActual) => {
    setEditingId(row.id);
    setEditDetails(row.actual_details ?? "");
    setEditStatus(row.met_status ?? "");
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = () => {
    if (!editingId) return;
    updateActual.mutate(
      {
        id: editingId,
        payload: { actual_details: editDetails || undefined, met_status: editStatus || undefined },
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
    <SheetContent className="gap-0 p-0">
      <SheetHeader>
        <SheetTitle>Actuals — {commitment.commitment_name}</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-xs text-slate-500">
          {commitment.frequency} cadence · {actuals.length} recorded
        </p>

        <RegisterTable
          items={actuals}
          emptyLabel={isLoading ? "Loading…" : "No actuals recorded yet."}
          onEdit={startEdit}
          onDelete={remove}
          columns={[
            { key: "period_date", label: "Date", render: (r) => formatDate(r.period_date) },
            { key: "actual_details", label: "Actual Details", render: (r) => r.actual_details ?? "—" },
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
            <div className="grid gap-4">
              <Field label="Actual Details">
<Textarea rows={8} value={editDetails} onChange={(e) => setEditDetails(e.target.value)} />
</Field>
              <Field label="Status">
                <NativeSelect
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "" | MetStatus)}
                >
                  <option value="" disabled>
Select…
</option>
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
                disabled={!editStatus || updateActual.isPending}
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
