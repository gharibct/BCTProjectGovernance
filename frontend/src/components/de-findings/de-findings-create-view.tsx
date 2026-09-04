"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, MandatoryBadge } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { useAccounts, useGeos, useUsers } from "@/lib/api/reference-data";
import { useProjects } from "@/lib/api/projects";
import { usePageBanner } from "@/stores/page-banner";
import {
  FINDING_CATEGORY_OPTIONS,
  FINDING_CLASSIFICATION_OPTIONS,
  useCreateDeFinding,
  type FindingCategory,
  type FindingClassification,
} from "@/lib/api/de-findings";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DeFindingsCreateView({ onDone }: { onDone: () => void }) {
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const createFinding = useCreateDeFinding();
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const [projectId, setProjectId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<FindingCategory | "">("");
  const [classification, setClassification] = React.useState<FindingClassification | "">("");
  // A finding is always owned by the project's PM — there is no assignee
  // picker. This tracks the picked project's PM so it is stored on the finding
  // (the backend `assigned_to` column is retained even though it is not shown).
  const [assignedTo, setAssignedTo] = React.useState("");
  const [findingDate, setFindingDate] = React.useState(today);
  const [dueDate, setDueDate] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [errors, setErrors] = React.useState<{
    project?: string;
    description?: string;
    category?: string;
    classification?: string;
  }>({});

  const project = projects.find((p) => p.id === projectId) ?? null;
  const accountName = accounts.find((a) => a.id === project?.account_id)?.name ?? "—";
  const geoName = geos.find((g) => g.id === project?.geo_id)?.name ?? "—";
  const pmName = users.find((u) => u.id === project?.project_manager_id)?.full_name ?? "—";

  const submit = () => {
    const next: typeof errors = {};
    if (!projectId) next.project = "Select a project.";
    if (!description.trim()) next.description = "Finding description is required.";
    if (!category) next.category = "Category is required.";
    if (!classification) next.classification = "Classification is required.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      showError(
        next.project ?? next.description ?? next.category ?? next.classification ?? "Please fix the highlighted fields."
      );
      return;
    }
    setErrors({});
    createFinding.mutate(
      {
        project_id: projectId,
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

      <Field label="Project" htmlFor="finding-project" badge={<MandatoryBadge />} error={errors.project}>
        <NativeSelect
          id="finding-project"
          value={projectId}
          onChange={(e) => {
            const id = e.target.value;
            setProjectId(id);
            if (errors.project) setErrors((p) => ({ ...p, project: undefined }));
            setAssignedTo(projects.find((p) => p.id === id)?.project_manager_id ?? "");
          }}
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_code} · {p.project_name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {project ? (
        <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Account</span>
            <span className="font-medium text-slate-800">{accountName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Geo</span>
            <span className="font-medium text-slate-800">{geoName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PM</span>
            <span className="font-medium text-slate-800">{pmName}</span>
          </div>
        </div>
      ) : null}

      <Field label="Finding" htmlFor="finding-description" badge={<MandatoryBadge />} error={errors.description}>
        <Textarea
          id="finding-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((p) => ({ ...p, description: undefined }));
          }}
          rows={3}
          placeholder="Describe the finding…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" htmlFor="finding-category" badge={<MandatoryBadge />} error={errors.category}>
          <NativeSelect
            id="finding-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as FindingCategory);
              if (errors.category) setErrors((p) => ({ ...p, category: undefined }));
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
          error={errors.classification}
        >
          <NativeSelect
            id="finding-classification"
            value={classification}
            onChange={(e) => {
              setClassification(e.target.value as FindingClassification);
              if (errors.classification) setErrors((p) => ({ ...p, classification: undefined }));
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
