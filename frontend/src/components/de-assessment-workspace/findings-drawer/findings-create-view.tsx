"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { useUsers } from "@/lib/api/reference-data";
import { usePageBanner } from "@/stores/page-banner";
import {
  FINDING_CLASSIFICATION_OPTIONS,
  FINDING_SEVERITY_OPTIONS,
  useCreateDEAssessmentFinding,
  type FindingClassification,
  type FindingSeverity,
} from "@/lib/api/de-assessment";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FindingsCreateView({
  projectId,
  assessmentId,
  onDone,
}: {
  projectId: string;
  assessmentId: string;
  onDone: () => void;
}) {
  const { data: users = [] } = useUsers();
  const createFinding = useCreateDEAssessmentFinding(projectId, assessmentId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [description, setDescription] = React.useState("");
  const [classification, setClassification] = React.useState<FindingClassification>("Governance");
  const [severity, setSeverity] = React.useState<FindingSeverity>("Low");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [findingDate, setFindingDate] = React.useState(today);
  const [dueDate, setDueDate] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [descriptionError, setDescriptionError] = React.useState<string | null>(null);

  const submit = () => {
    if (!description.trim()) {
      const message = "Finding description is required.";
      setDescriptionError(message);
      showError(message);
      return;
    }
    setDescriptionError(null);
    createFinding.mutate(
      {
        description: description.trim(),
        classification,
        severity,
        assigned_to: assignedTo || undefined,
        finding_date: findingDate || undefined,
        due_date: dueDate || undefined,
        remarks: remarks.trim() || undefined,
        status: "Open",
      },
      {
        onSuccess: () => {
          showSuccess("Finding Added Successfully");
          onDone();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to add finding."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">Status</span>
        <StatusBadge value="Open" />
      </div>

      <Field label="Finding" htmlFor="finding-description" badge={<MandatoryBadge />} error={descriptionError ?? undefined}>
        <Textarea
          id="finding-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (descriptionError) setDescriptionError(null);
          }}
          rows={3}
          placeholder="Describe the finding…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Classification" htmlFor="finding-classification" badge={<MandatoryBadge />}>
          <NativeSelect
            id="finding-classification"
            value={classification}
            onChange={(e) => setClassification(e.target.value as FindingClassification)}
          >
            {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Severity" htmlFor="finding-severity" badge={<MandatoryBadge />}>
          <NativeSelect
            id="finding-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FindingSeverity)}
          >
            {FINDING_SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label="Assigned To" htmlFor="finding-assigned-to">
        <NativeSelect
          id="finding-assigned-to"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
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
        <Field label="Finding Date" htmlFor="finding-date">
          <Input
            id="finding-date"
            type="date"
            value={findingDate}
            onChange={(e) => setFindingDate(e.target.value)}
          />
        </Field>
        <Field label="Due Date" htmlFor="finding-due-date">
          <Input
            id="finding-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Remarks" htmlFor="finding-remarks">
        <Textarea
          id="finding-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          placeholder="Additional context or observations…"
        />
      </Field>

      <div className="mt-2 flex justify-end gap-3">
        <Button variant="outline" onClick={onDone} disabled={createFinding.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={createFinding.isPending} className="gap-2">
          {createFinding.isPending ? <ButtonSpinner /> : null}
          Create Finding
        </Button>
      </div>
    </div>
  );
}
