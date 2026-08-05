"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  CalendarDays,
  Info,
  Lock,
  RefreshCw,
  ScanSearch,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  MandatoryBadge,
  SectionCard,
  Segmented,
} from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import {
  useAccounts,
  useGeos,
  useOrganizations,
  useProjectTypes,
  useUsers,
} from "@/lib/api/reference-data";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
  useProject,
  useProjectOracleIds,
  useProjectResourceSummary,
  useProjectResources,
  useUpdateProject,
  useUpdateProjectResource,
  type Project,
  type ProjectResource,
  type ProjectResourcePayload,
} from "@/lib/api/projects";
import { HealthDeclaration, useHealthDeclarationForm } from "./health-declaration";

const inputClass = "h-11";
const segmentedActiveClass = "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700";

function ProjectDescriptionTab({ project }: { project: Project | undefined }) {
  const { data: organizations } = useOrganizations();
  const { data: geos } = useGeos();
  const { data: projectTypes } = useProjectTypes();
  const { data: accounts } = useAccounts();
  const { data: users } = useUsers();
  const { data: oracleIds } = useProjectOracleIds(project?.id ?? null);

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Info} title="Project Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Contract Type" htmlFor="contract-type">
            <NativeSelect id="contract-type" value={project?.contract_type ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {["FPP", "T&M", "Capped T&M", "Internal"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project Type" htmlFor="project-type">
            <NativeSelect id="project-type" value={project?.project_type_id ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {(projectTypes ?? []).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Engagement Type">
            <Segmented
              options={[
                { value: "Implementation", label: "Implementation" },
                { value: "Support", label: "Support" },
              ]}
              value={project?.engagement_type ?? "Implementation"}
              onChange={() => {}}
              activeClassName={segmentedActiveClass}
              disabled
            />
          </Field>
          <Field label="Project Owned" htmlFor="project-owned">
            <NativeSelect id="project-owned" value={project?.project_owned ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {["Fully Owned", "Co-Owned", "Customer Driven"].map((owned) => (
                <option key={owned}>{owned}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Organization">
            <Segmented
              options={(organizations ?? []).map((org) => ({ value: org.id, label: org.code }))}
              value={project?.organization_id ?? ""}
              onChange={() => {}}
              activeClassName={segmentedActiveClass}
              disabled
            />
          </Field>
          <Field label="GEO">
            <Segmented
              options={(geos ?? []).map((geo) => ({ value: geo.id, label: geo.code }))}
              value={project?.geo_id ?? ""}
              onChange={() => {}}
              activeClassName={segmentedActiveClass}
              disabled
            />
          </Field>
          <Field label="Account Name" htmlFor="account-name">
            <NativeSelect id="account-name" value={project?.account_id ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {(accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={UserRound} title="Delivery Team">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="Project Manager" htmlFor="project-manager">
            <NativeSelect id="project-manager" value={project?.project_manager_id ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {(users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Delivery Manager" htmlFor="delivery-manager">
            <NativeSelect id="delivery-manager" value={project?.delivery_manager_id ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {(users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Delivery Excellence" htmlFor="delivery-excellence">
            <NativeSelect id="delivery-excellence" value={project?.delivery_excellence_id ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {(users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={Banknote} title="Commercials">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Project Revenue" htmlFor="project-revenue">
            <Input
              id="project-revenue"
              type="number"
              min={0}
              placeholder="0.00"
              value={project?.project_revenue ?? ""}
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Project Currency" htmlFor="project-currency">
            <NativeSelect id="project-currency" value={project?.project_currency ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {["USD", "OMR", "AED", "SAR", "INR", "EUR"].map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Oracle Project ID(s)"
            htmlFor="oracle-ids"
            hint="Comma-separated when the project maps to multiple Oracle IDs"
          >
            <Input
              id="oracle-ids"
              placeholder="e.g. ORA-88121, ORA-88122"
              value={(oracleIds ?? []).map((o) => o.oracle_project_id).join(", ")}
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Billing Type" htmlFor="billing-type">
            <NativeSelect id="billing-type" value={project?.billing_type ?? ""} disabled>
              <option value="" disabled>
                Select…
              </option>
              {["FPP", "FB", "T&M", "Product", "Unit Based Billing", "Others"].map(
                (type) => (
                  <option key={type}>{type}</option>
                )
              )}
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

function durationDays(from: string, to: string): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  return `${Math.round(ms / 86_400_000)} days`;
}

type ActualDates = { start: string; end: string };

// Planned dates come from Project Profile at charter time and are read-only
// here — Project Reporting's job is recording what actually happened
// against that plan, so only the Actual fields are editable.
function ScopeAndScheduleTab({
  project,
  actual,
  setActualDate,
}: {
  project: Project | undefined;
  actual: ActualDates;
  setActualDate: (key: keyof ActualDates) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ScanSearch} title="Scope Definition">
        <div className="flex flex-col gap-6">
          <Field label="Customer Overview" htmlFor="customer-overview">
            <Textarea
              id="customer-overview"
              placeholder="Who the customer is, their business, and the relationship context…"
              value={project?.customer_overview ?? ""}
              disabled
            />
          </Field>
          <Field
            label="Project Scope Description"
            htmlFor="scope-description"
            badge={<MandatoryBadge />}
          >
            <Textarea
              id="scope-description"
              className="min-h-32"
              placeholder="What the project will deliver — objectives, boundaries, and key deliverables…"
              value={project?.project_scope_description ?? ""}
              disabled
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={CalendarDays} title="Schedule">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Planned Start Date" htmlFor="planned-start">
            <Input
              id="planned-start"
              type="date"
              value={project?.planned_start_date ?? ""}
              disabled
              className={inputClass}
            />
          </Field>
          <Field label="Actual Start Date" htmlFor="actual-start">
            <Input
              id="actual-start"
              type="date"
              value={actual.start}
              onChange={setActualDate("start")}
              className={inputClass}
            />
          </Field>
          <Field label="Planned End Date" htmlFor="planned-end">
            <Input
              id="planned-end"
              type="date"
              value={project?.planned_end_date ?? ""}
              disabled
              className={inputClass}
            />
          </Field>
          <Field label="Actual End Date" htmlFor="actual-end">
            <Input
              id="actual-end"
              type="date"
              value={actual.end}
              onChange={setActualDate("end")}
              className={inputClass}
            />
          </Field>
          <Field label="Planned Duration" badge={<AutoBadge />}>
            <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
              {durationDays(project?.planned_start_date ?? "", project?.planned_end_date ?? "")}
            </div>
          </Field>
          <Field label="Actual Duration" badge={<AutoBadge />}>
            <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
              {durationDays(actual.start, actual.end)}
            </div>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// Resource allocation is normally synced from the BCT Oracle App; the New
// Resource form below covers manual additions/corrections — the backend
// supports full add/edit/delete on top of the sync, same register pattern
// as Contractual Compliance's Commitments/Milestones.
const RESOURCE_FIELDS: FieldDef[] = [
  { key: "resource_name", label: "Resource Name", kind: "text", mandatory: true, placeholder: "e.g. Priya Nair" },
  { key: "role", label: "Role", kind: "text", mandatory: true, placeholder: "e.g. Developer" },
  { key: "fte_allocation", label: "FTE Allocation", kind: "number" },
];

function toValues(item: ProjectResource): Record<string, string> {
  return {
    resource_name: item.resource_name,
    role: item.role ?? "",
    fte_allocation: item.fte_allocation,
  };
}

function ResourceAllocationTab() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: resources = [] } = useProjectResources(projectId);
  const { data: summary } = useProjectResourceSummary(projectId);
  const { values, set, reset, load } = useEntryValues();
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const createResource = useCreateProjectResource(projectId);
  const updateResource = useUpdateProjectResource(projectId);
  const deleteResourceMutation = useDeleteProjectResource(projectId);

  const startEdit = (item: ProjectResource) => {
    setEditingId(item.id);
    load(toValues(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const deleteResource = (item: ProjectResource) => {
    deleteResourceMutation.mutate(item.id, {
      onSuccess: () => {
        if (editingId === item.id) cancelEdit();
        toast.success("Resource Deleted Successfully");
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete resource."),
    });
  };

  const submit = () => {
    if (!values.resource_name?.trim() || !values.role?.trim()) return;
    const payload: ProjectResourcePayload = {
      resource_name: values.resource_name,
      role: values.role,
      fte_allocation: values.fte_allocation || "0",
    };

    if (editingId) {
      updateResource.mutate(
        { id: editingId, payload },
        {
          onSuccess: () => {
            cancelEdit();
            toast.success("Resource Updated Successfully");
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update resource."),
        }
      );
    } else {
      createResource.mutate(payload, {
        onSuccess: () => {
          reset();
          toast.success("Resource Added Successfully");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add resource."),
      });
    }
  };

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        Create the project on the Project Profile tab first.
      </p>
    );
  }

  const busy = createResource.isPending || updateResource.isPending;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Head Count
            </p>
            <AutoBadge />
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {summary?.head_count ?? resources.length}
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Total FTE
            </p>
            <AutoBadge />
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {summary?.total_fte ?? "—"}
          </p>
        </div>
      </div>

      <SectionCard
        icon={UserRound}
        title="Resource Allocation"
        aside={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <RefreshCw className="size-3.5" />
              Synced from BCT Oracle App
            </span>
            <AutoBadge label={`${resources.length} logged`} />
          </div>
        }
      >
        <RegisterTable
          items={resources}
          emptyLabel="No resources allocated yet."
          onEdit={startEdit}
          onDelete={deleteResource}
          columns={[
            { key: "resource_name", label: "Resource" },
            { key: "role", label: "Role" },
            { key: "fte_allocation", label: "FTE Allocation", align: "right" },
          ]}
        />
      </SectionCard>

      <SectionCard icon={UserRound} title="New Resource">
        <EntryFields defs={RESOURCE_FIELDS} values={values} set={set} />
        <div className="mt-6 flex justify-end gap-3">
          {editingId ? (
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={submit}
            disabled={busy}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {busy ? <ButtonSpinner /> : null}
            {editingId ? "Edit Resource" : "Add Resource"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// Each Project Charter screen is its own route (mirrors New Project's
// project-charter/schedule/self-assessment split) instead of a client-side
// section switch, so these are separate top-level exports — one per page,
// each with its own action bar/button.
export function ProjectProfileForm() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId ?? null);
  return (
    <div>
      <ProjectDescriptionTab project={project} />
      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Locked — this project is Approved and no longer editable.
        </p>
      </div>
    </div>
  );
}

export function ScopeScheduleForm() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);

  const [actual, setActual] = React.useState<ActualDates>({ start: "", end: "" });
  const [syncedKey, setSyncedKey] = React.useState<string | null>(null);
  const key = project ? project.id : projectId ? null : "none";
  if (key !== null && key !== syncedKey) {
    setSyncedKey(key);
    setActual({
      start: project?.actual_start_date ?? "",
      end: project?.actual_end_date ?? "",
    });
  }

  const setActualDate =
    (field: keyof ActualDates) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setActual((prev) => ({ ...prev, [field]: e.target.value }));

  if (!projectId) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No project selected.
      </p>
    );
  }

  return (
    <div>
      <ScopeAndScheduleTab project={project} actual={actual} setActualDate={setActualDate} />
      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Editable by the Project Manager while the project is unlocked.
        </p>
        <Button
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={updateProject.isPending}
          onClick={() =>
            updateProject.mutate(
              {
                actual_start_date: actual.start || undefined,
                actual_end_date: actual.end || undefined,
              },
              {
                onSuccess: () => toast.success("Schedule Saved Successfully"),
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : "Failed to save changes."),
              }
            )
          }
        >
          {updateProject.isPending ? <ButtonSpinner /> : null}
          Save Schedule
        </Button>
      </div>
    </div>
  );
}

export function ResourceAllocationForm() {
  return (
    <div>
      <ResourceAllocationTab />
      <p className="mt-10 flex items-center gap-2 text-sm text-slate-500">
        <Lock className="size-4" />
        Each resource saves immediately when added — there&apos;s no separate
        save step for this screen.
      </p>
    </div>
  );
}

export function SelfAssessmentForm() {
  const form = useHealthDeclarationForm();
  return (
    <div>
      <HealthDeclaration form={form} />
      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Editable by the Project Manager while the project is unlocked.
        </p>
        <Button
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={!form.projectId || form.isSubmitting}
          onClick={form.submit}
        >
          {form.isSubmitting ? <ButtonSpinner /> : null}
          Save Self Assessment
        </Button>
      </div>
    </div>
  );
}
