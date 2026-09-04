"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { useProjects } from "@/lib/api/projects";
import { usePageBanner } from "@/stores/page-banner";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  useCreateDEAssessmentFinding,
  type FindingCategory,
  type FindingClassification,
} from "@/lib/api/de-assessment";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FindingsCreateView({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const { data: projects = [] } = useProjects();
  const createFinding = useCreateDEAssessmentFinding(projectId);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  // A finding is always owned by the project's PM — there is no assignee picker.
  // The PM id is stored on the finding's (retained) `assigned_to` column.
  const assignedTo = projects.find((p) => p.id === projectId)?.project_manager_id ?? "";

  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<FindingCategory | "">("");
  const [classification, setClassification] = React.useState<FindingClassification | "">("");
  const [findingDate, setFindingDate] = React.useState(today);
  const [dueDate, setDueDate] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [descriptionError, setDescriptionError] = React.useState<string | null>(null);
  const [categoryError, setCategoryError] = React.useState<string | null>(null);
  const [classificationError, setClassificationError] = React.useState<string | null>(null);

  const submit = () => {
    const missingDescription = !description.trim();
    const missingCategory = !category;
    const missingClassification = !classification;
    if (missingDescription || missingCategory || missingClassification) {
      setDescriptionError(missingDescription ? "Finding description is required." : null);
      setCategoryError(missingCategory ? "Category is required." : null);
      setClassificationError(missingClassification ? "Classification is required." : null);
      showError("Please fix the highlighted fields.");
      return;
    }
    setDescriptionError(null);
    setCategoryError(null);
    setClassificationError(null);
    createFinding.mutate(
      {
        description: description.trim(),
        category: category as FindingCategory,
        classification: classification as FindingClassification,
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
        <Field
          label="Category"
          htmlFor="finding-category"
          badge={<MandatoryBadge />}
          error={categoryError ?? undefined}
        >
          <NativeSelect
            id="finding-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as FindingCategory);
              if (categoryError) setCategoryError(null);
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {FINDING_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Classification"
          htmlFor="finding-classification"
          badge={<MandatoryBadge />}
          error={classificationError ?? undefined}
        >
          <NativeSelect
            id="finding-classification"
            value={classification}
            onChange={(e) => {
              setClassification(e.target.value as FindingClassification);
              if (classificationError) setClassificationError(null);
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {FINDING_CLASSIFICATION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

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
