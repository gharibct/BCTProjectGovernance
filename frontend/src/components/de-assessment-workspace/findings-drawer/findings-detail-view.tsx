"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { useUsers } from "@/lib/api/reference-data";
import { useEffectiveRole } from "@/stores/session";
import { usePageBanner } from "@/stores/page-banner";
import { canWriteDeAssessment } from "@/lib/api/de-assessment-permissions";
import {
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_SEVERITY_OPTIONS,
  useUpdateDEAssessmentFinding,
  type DEAssessmentFinding,
  type FindingClassification,
  type FindingSeverity,
  type FindingStatus,
} from "@/lib/api/de-assessment";

type Transition = { label: string; next: FindingStatus; className?: string };

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
    case "Awaiting Closure":
      return [{ label: "Close Finding", next: "Closed", className: "bg-emerald-600 hover:bg-emerald-700" }];
    default:
      return [];
  }
}

export function FindingsDetailView({
  projectId,
  assessmentId,
  finding,
  onBack,
}: {
  projectId: string;
  assessmentId: string | null;
  finding: DEAssessmentFinding;
  onBack: () => void;
}) {
  const { data: users = [] } = useUsers();
  const canWrite = canWriteDeAssessment(useEffectiveRole());
  const updateFinding = useUpdateDEAssessmentFinding(projectId, assessmentId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [description, setDescription] = React.useState(() => finding.description ?? "");
  const [classification, setClassification] = React.useState<FindingClassification>(finding.classification);
  const [severity, setSeverity] = React.useState<FindingSeverity | "">(finding.severity ?? "");
  const [assignedTo, setAssignedTo] = React.useState(() => finding.assigned_to ?? "");
  const [findingDate, setFindingDate] = React.useState(() => finding.finding_date ?? "");
  const [dueDate, setDueDate] = React.useState(() => finding.due_date ?? "");
  const [remarks, setRemarks] = React.useState(() => finding.remarks ?? "");

  const save = () => {
    updateFinding.mutate(
      {
        id: finding.id,
        payload: {
          classification,
          description: description.trim() || undefined,
          severity: severity || undefined,
          assigned_to: assignedTo || undefined,
          finding_date: findingDate || undefined,
          due_date: dueDate || undefined,
          remarks: remarks.trim() || undefined,
        },
      },
      {
        onSuccess: () => showSuccess("Finding updated."),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update finding."),
      }
    );
  };

  const runTransition = (next: FindingStatus) => {
    updateFinding.mutate(
      { id: finding.id, payload: { classification, status: next } },
      {
        onSuccess: () => showSuccess(`Finding marked ${next}.`),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update finding."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
      >
        <ArrowLeft className="size-4" />
        Back to Findings
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-400">Finding #{finding.sequence_no}</span>
        <StatusBadge value={finding.status} />
        {finding.overdue ? <span className="text-xs font-semibold text-red-600">Overdue</span> : null}
      </div>

      <Field label="Finding" htmlFor="detail-finding-description">
        <Textarea
          id="detail-finding-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={!canWrite}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Classification" htmlFor="detail-finding-classification">
          <NativeSelect
            id="detail-finding-classification"
            value={classification}
            onChange={(e) => setClassification(e.target.value as FindingClassification)}
            disabled={!canWrite}
          >
            {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {!FINDING_CLASSIFICATION_OPTIONS.includes(classification) ? (
              <option value={classification}>{classification}</option>
            ) : null}
          </NativeSelect>
        </Field>
        <Field label="Severity" htmlFor="detail-finding-severity">
          <NativeSelect
            id="detail-finding-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FindingSeverity | "")}
            disabled={!canWrite}
          >
            <option value="">—</option>
            {FINDING_SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label="Assigned To" htmlFor="detail-finding-assigned-to">
        <NativeSelect
          id="detail-finding-assigned-to"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          disabled={!canWrite}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Finding Date" htmlFor="detail-finding-date">
          <Input
            id="detail-finding-date"
            type="date"
            value={findingDate}
            onChange={(e) => setFindingDate(e.target.value)}
            disabled={!canWrite}
          />
        </Field>
        <Field label="Due Date" htmlFor="detail-finding-due-date">
          <Input
            id="detail-finding-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={!canWrite}
          />
        </Field>
      </div>

      <Field label="Remarks" htmlFor="detail-finding-remarks">
        <Textarea
          id="detail-finding-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          disabled={!canWrite}
        />
      </Field>

      {canWrite ? (
        <>
          <Button onClick={save} disabled={updateFinding.isPending} className="gap-2 self-start">
            {updateFinding.isPending ? <ButtonSpinner /> : null}
            Save Changes
          </Button>

          {transitionsFor(finding.status).length > 0 ? (
            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
              {transitionsFor(finding.status).map((t) => (
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
        </>
      ) : null}
    </div>
  );
}
