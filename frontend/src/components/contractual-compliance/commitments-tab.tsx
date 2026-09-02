"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ClipboardCheck, GaugeCircle } from "lucide-react";
import * as React from "react";

import { AutoBadge, ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { usePageBanner } from "@/stores/page-banner";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useReportingPeriods } from "@/lib/api/reference-data";
import {
  useCommitments,
  useCreateCommitmentActual,
  useLatestCommitmentActuals,
  type ContractualCommitment,
  type MetStatus,
} from "@/lib/api/contractual";

// Project Reporting is actuals-only: the commitment definitions are fixed at
// charter time (New Project → Contractual Compliance). This tab shows the
// register read-only and lets the PM record what was actually achieved for
// the selected reporting period.
export function CommitmentsTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: items = [] } = useCommitments(projectId);
  const commitmentIds = React.useMemo(() => items.map((i) => i.id), [items]);
  const actualsByCommitment = useLatestCommitmentActuals(projectId, commitmentIds);

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
              label: "Actual",
              align: "right",
              render: (item) => actualsByCommitment[item.id]?.actual_value ?? "—",
            },
            {
              key: "met_status",
              label: "Status",
              render: (item) => actualsByCommitment[item.id]?.met_status ?? "—",
            },
          ]}
        />
      </SectionCard>

      <MonthlyActualCapture projectId={projectId} commitments={items} />
    </div>
  );
}

// Monthly Project Reporting capture: the commitment definitions above are
// fixed at charter time; here the PM records what was actually achieved for
// the selected reporting period (period_date = the period's start date).
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

  const createActual = useCreateCommitmentActual(projectId, commitmentId);

  const save = () => {
    if (!commitmentId || !period) return;
    createActual.mutate(
      {
        period_date: period.start_date,
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
    <SectionCard icon={GaugeCircle} title="Record Monthly Actual">
      {commitments.length === 0 ? (
        <EmptyState>No commitments have been defined for this project.</EmptyState>
      ) : !period ? (
        <EmptyState>Open this screen for a reporting period to record actuals.</EmptyState>
      ) : (
        <>
          <p className="mb-6 text-sm text-slate-500">
            Reporting period: <span className="font-semibold text-slate-700">{period.label}</span>
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
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
                <option value="Met">Met</option>
                <option value="Not Met">Not Met</option>
                <option value="Breached">Breached</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={save}
              disabled={!commitmentId || createActual.isPending}
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
