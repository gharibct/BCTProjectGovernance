"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  CalendarDays,
  IdCard,
  Info,
  Lock,
  ScanSearch,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/forms/empty-state";
import { MultiSelectChecklist } from "@/components/forms/multi-select-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useNewProjectId, useNewProjectUi } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import {
  useAccounts,
  useGeos,
  useOrganizations,
  useProducts,
  useProjectTypes,
  useRegions,
  useUsers,
} from "@/lib/api/reference-data";
import {
  useCreateProject,
  useProject,
  useUpdateProject,
  type Project,
  type ProjectLifecycleStatus,
  type ProjectPayload,
} from "@/lib/api/projects";
import { useAccountHead, useGeoHead } from "@/lib/api/users";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  MandatoryBadge,
  SectionCard,
  Segmented,
} from "@/components/forms/form-primitives";
import type { useAiReview } from "@/components/ai/use-ai-review";
import { useAiFieldBinding, type FieldAi } from "@/components/ai/use-ai-field-binding";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useBaselinePeriodId } from "@/lib/period-utils";
import { HealthDeclaration, useHealthDeclarationForm } from "./health-declaration";

const inputClass = "h-11";
const segmentedActiveClass = "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700";

const CONTRACT_TYPES = ["FPP", "T&M", "Capped T&M", "Internal"] as const;
const PROJECT_OWNED_OPTIONS = ["Fully Owned", "Co-Owned", "Customer Driven"] as const;
// Matches backend enums.py's ApplicablePhase. Multi-select — a project can be
// in more than one SDLC phase at once.
const APPLICABLE_PHASES = [
  "Discovery / POC / Assessment / Consulting",
  "Requirement",
  "Design",
  "CUT",
  "Build & Deployment",
  "Testing",
  "UAT Support",
  "Warranty",
  "Support",
  "Migration",
] as const;
const YES_NO_OPTIONS = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
] as const;
// Lifecycle statuses a PM sets while amending an approved project. Stored on
// the project's own `lifecycle_status` field, separate from the approval
// workflow (project_status).
const PROJECT_LIFECYCLE_STATUS_OPTIONS: ProjectLifecycleStatus[] = [
  "Ongoing",
  "Hold",
  "Closed",
  "Open Only for Billing",
];

// Every field the Project Profile page collects (a subset of the Project
// resource — Scope & Schedule owns the rest on its own page/PUT). Selects
// backed by reference data (project type, organization, geo, account,
// PM/DM/DE) store the referenced row's id, not its display label.
function emptyValues(): ProjectPayload {
  return {};
}

function valuesFromProject(project: Project): ProjectPayload {
  return {
    project_name: project.project_name,
    contract_type: project.contract_type ?? undefined,
    project_type_id: project.project_type_id ?? undefined,
    organization_id: project.organization_id ?? undefined,
    project_owned: project.project_owned ?? undefined,
    geo_id: project.geo_id ?? undefined,
    region_id: project.region_id ?? undefined,
    account_id: project.account_id ?? undefined,
    project_manager_id: project.project_manager_id ?? undefined,
    delivery_manager_id: project.delivery_manager_id ?? undefined,
    // delivery_excellence_id is set on the DE Project Allocation screen, not here.
    project_revenue: project.project_revenue ?? undefined,
    project_currency: project.project_currency ?? undefined,
    critical_flag: project.critical_flag ?? undefined,
    product_flag: project.product_flag ?? undefined,
    product_id: project.product_id ?? undefined,
    customer_overview: project.customer_overview ?? undefined,
    project_scope_description: project.project_scope_description ?? undefined,
    planned_start_date: project.planned_start_date ?? undefined,
    actual_start_date: project.actual_start_date ?? undefined,
    planned_end_date: project.planned_end_date ?? undefined,
    actual_end_date: project.actual_end_date ?? undefined,
    applicable_phase: project.applicable_phase ?? [],
    lifecycle_status: project.lifecycle_status ?? undefined,
  };
}

// The form only locks once a project moves past Draft — see
// ProjectDescriptionActions. A not-yet-created draft (no project loaded yet)
// counts as Draft too.
function isDraftStatus(project: Project | undefined): boolean {
  return !project || project.project_status === "Draft";
}

// Statuses in which the charter is directly editable without an "Edit Project"
// click: a Draft, or a project put back into edit via Amend ("Under Amendment").
function isAmendableStatus(project: Project | undefined): boolean {
  return isDraftStatus(project) || project?.project_status === "Under Amendment";
}

function useProjectProfileForm() {
  const projectId = useNewProjectId();
  const { data: project } = useProject(projectId);
  const [values, setValues] = React.useState<ProjectPayload>(emptyValues);
  // Re-seed `values` from the fetched project whenever a *different* project
  // finishes loading (or we drop back to a blank draft) — done during render
  // rather than in an effect, per React's "adjusting state" guidance, so the
  // fields don't flash their previous contents for a frame first. `syncedKey`
  // stays null (skipping the reset) while a projectId is set but its fetch
  // hasn't resolved yet, so in-flight loads don't blank the form early.
  const [syncedKey, setSyncedKey] = React.useState<string | null>(null);
  const key = project ? project.id : projectId ? null : "draft";
  if (key !== null && key !== syncedKey) {
    setSyncedKey(key);
    setValues(project ? valuesFromProject(project) : emptyValues());
  }

  const set =
    <K extends keyof ProjectPayload>(key: K) =>
    (value: ProjectPayload[K]) =>
      setValues((prev) => ({ ...prev, [key]: value }));

  return { project, values, set };
}

function ProjectDescriptionTab({
  values,
  fieldAi,
  setAndClear,
  projectNameError,
}: {
  values: ProjectPayload;
  fieldAi: FieldAi<ProjectPayload>;
  setAndClear: <K extends keyof ProjectPayload>(key: K) => (value: ProjectPayload[K]) => void;
  projectNameError?: string;
}) {
  const projectId = useNewProjectId();
  const { data: project } = useProject(projectId);
  const isEditing = useNewProjectUi((state) => state.isEditing);
  const locked = !isAmendableStatus(project) && !isEditing;
  // The same charter form serves /new-project and /amend-project — the
  // lifecycle Project Status combo only belongs to the Amend flow.
  const isAmend = (usePathname() ?? "").split("/")[1] === "amend-project";
  // Project Type is fixed once a project exists and is being amended — the
  // amendment snapshot/measurement wiring is keyed to the original type.
  const projectTypeLocked = locked || project?.project_status === "Under Amendment";

  const { data: organizations } = useOrganizations();
  const { data: geos } = useGeos();
  const { data: regions } = useRegions();
  const { data: projectTypes } = useProjectTypes();
  const { data: products } = useProducts();
  const { data: accounts } = useAccounts();
  const { data: users } = useUsers();
  const { data: geoHead } = useGeoHead(values.geo_id ?? null);
  const { data: accountHead, isLoading: accountHeadLoading } = useAccountHead(values.account_id ?? null);

  // Delivery Manager is read-only, defaulted from the Account Head mapping
  // for the selected account rather than picked manually. Skipped while the
  // lookup is still in flight so an existing project's saved value isn't
  // blanked out for a frame before the mapping resolves.
  React.useEffect(() => {
    if (accountHeadLoading) return;
    if (values.delivery_manager_id !== accountHead?.id) {
      setAndClear("delivery_manager_id")(accountHead?.id ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountHeadLoading, accountHead?.id]);

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={IdCard} title="Project Identity">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Project Code" htmlFor="project-code" badge={<AutoBadge />}>
            <Input
              id="project-code"
              placeholder="Generated on Create"
              value={project?.project_code ?? ""}
              disabled
              className={inputClass}
            />
          </Field>
          <Field
            label="Project Name"
            htmlFor="project-name"
            required
            badge={<MandatoryBadge />}
            ai={fieldAi("project_name")}
            error={projectNameError}
          >
            <Input
              id="project-name"
              placeholder="e.g. Core Banking Modernization"
              value={values.project_name ?? ""}
              onChange={(e) => setAndClear("project_name")(e.target.value)}
              className={inputClass}
              disabled={locked}
            />
          </Field>
        </div>
      </SectionCard>

      {isAmend && project ? (
        <SectionCard icon={Activity} title="Project Lifecycle">
          <Field
            label="Project Status"
            htmlFor="lifecycle-status"
            className="max-w-xs"
            hint={
              locked
                ? "Editable once the amendment is initiated."
                : "The project's current lifecycle state — optional."
            }
          >
            <NativeSelect
              id="lifecycle-status"
              value={values.lifecycle_status ?? ""}
              onChange={(e) =>
                setAndClear("lifecycle_status")(
                  (e.target.value || undefined) as ProjectLifecycleStatus | undefined,
                )
              }
              disabled={locked}
            >
              <option value="">Select…</option>
              {PROJECT_LIFECYCLE_STATUS_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
          </Field>
        </SectionCard>
      ) : null}

      {projectId ? (
        <>
        <SectionCard icon={Info} title="Project Details">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <Field label="Contract Type" htmlFor="contract-type" required ai={fieldAi("contract_type")}>
              <NativeSelect
                id="contract-type"
                value={values.contract_type ?? ""}
                onChange={(e) =>
                  setAndClear("contract_type")(e.target.value as ProjectPayload["contract_type"])
                }
                disabled={locked}
              >
                <option value="" disabled>
                  Select…
                </option>
                {CONTRACT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Project Type" htmlFor="project-type" required ai={fieldAi("project_type_id")}>
              <NativeSelect
                id="project-type"
                value={values.project_type_id ?? ""}
                onChange={(e) => setAndClear("project_type_id")(e.target.value)}
                disabled={projectTypeLocked}
              >
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
            <Field label="Project Owned" htmlFor="project-owned" required ai={fieldAi("project_owned")}>
              <NativeSelect
                id="project-owned"
                value={values.project_owned ?? ""}
                onChange={(e) =>
                  setAndClear("project_owned")(e.target.value as ProjectPayload["project_owned"])
                }
                disabled={locked}
              >
                <option value="" disabled>
                  Select…
                </option>
                {PROJECT_OWNED_OPTIONS.map((owned) => (
                  <option key={owned}>{owned}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Organization" required ai={fieldAi("organization_id")}>
              <Segmented
                options={(organizations ?? []).map((org) => ({ value: org.id, label: org.code }))}
                value={values.organization_id ?? ""}
                onChange={(v) => setAndClear("organization_id")(v)}
                activeClassName={segmentedActiveClass}
                disabled={locked}
              />
            </Field>
            <Field label="GEO" required ai={fieldAi("geo_id")}>
              <Segmented
                options={(geos ?? []).map((geo) => ({ value: geo.id, label: geo.code }))}
                value={values.geo_id ?? ""}
                onChange={(v) => {
                  setAndClear("geo_id")(v);
                  setAndClear("region_id")(undefined);
                }}
                activeClassName={segmentedActiveClass}
                disabled={locked}
              />
            </Field>
            <Field label="Region" htmlFor="region" required ai={fieldAi("region_id")}>
              <NativeSelect
                id="region"
                value={values.region_id ?? ""}
                onChange={(e) => setAndClear("region_id")(e.target.value)}
                disabled={locked || !values.geo_id}
              >
                <option value="" disabled>
                  {values.geo_id ? "Select…" : "Select a GEO first"}
                </option>
                {(regions ?? [])
                  .filter((region) => region.geo_id === values.geo_id)
                  .map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Account Name" htmlFor="account-name" required ai={fieldAi("account_id")}>
              <NativeSelect
                id="account-name"
                value={values.account_id ?? ""}
                onChange={(e) => setAndClear("account_id")(e.target.value)}
                disabled={locked}
              >
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
            <Field label="Critical Flag" required ai={fieldAi("critical_flag")}>
              <Segmented
                options={YES_NO_OPTIONS}
                value={values.critical_flag ?? ""}
                onChange={(v) => setAndClear("critical_flag")(v as ProjectPayload["critical_flag"])}
                activeClassName={segmentedActiveClass}
                disabled={locked}
              />
            </Field>
            <Field label="Product Flag" required ai={fieldAi("product_flag")}>
              <Segmented
                options={YES_NO_OPTIONS}
                value={values.product_flag ?? ""}
                onChange={(v) => {
                  setAndClear("product_flag")(v as ProjectPayload["product_flag"]);
                  if (v !== "Yes") setAndClear("product_id")(undefined);
                }}
                activeClassName={segmentedActiveClass}
                disabled={locked}
              />
            </Field>
            {values.product_flag === "Yes" ? (
              <Field label="Product" htmlFor="product" required ai={fieldAi("product_id")}>
                <NativeSelect
                  id="product"
                  value={values.product_id ?? ""}
                  onChange={(e) => setAndClear("product_id")(e.target.value)}
                  disabled={locked}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field label="Applicable Phase" className="md:col-span-2">
              <MultiSelectChecklist
                options={APPLICABLE_PHASES.map((phase) => ({ value: phase, label: phase }))}
                value={values.applicable_phase ?? []}
                onChange={(next) =>
                  setAndClear("applicable_phase")(next as ProjectPayload["applicable_phase"])
                }
                emptyLabel="No phases"
                disabled={locked}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={UserRound} title="Delivery Team">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <Field label="Project Manager" htmlFor="project-manager" required ai={fieldAi("project_manager_id")}>
              <NativeSelect
                id="project-manager"
                value={values.project_manager_id ?? ""}
                onChange={(e) => setAndClear("project_manager_id")(e.target.value)}
                disabled={locked}
              >
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
            <Field label="Delivery Manager" badge={<AutoBadge />}>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
                {accountHead?.full_name ?? "Not Assigned"}
              </div>
            </Field>
            {/* Delivery Excellence is no longer assigned here — a DE (or Admin)
                picks it up on the DE Project Allocation screen after the PM
                sends the project for approval (docs/PendingPoints.txt 17-18). */}
            <Field label="Geo Head" badge={<AutoBadge />}>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
                {geoHead?.full_name ?? "Not Assigned"}
              </div>
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={Banknote} title="Commercials">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <Field label="Project Revenue" htmlFor="project-revenue" required ai={fieldAi("project_revenue")}>
              <Input
                id="project-revenue"
                type="number"
                min={0}
                placeholder="0.00"
                value={values.project_revenue ?? ""}
                onChange={(e) =>
                  setAndClear("project_revenue")(e.target.value === "" ? undefined : e.target.value)
                }
                className={inputClass}
                disabled={locked}
              />
            </Field>
            <Field label="Project Currency" htmlFor="project-currency" required ai={fieldAi("project_currency")}>
              <NativeSelect
                id="project-currency"
                value={values.project_currency ?? ""}
                onChange={(e) => setAndClear("project_currency")(e.target.value)}
                disabled={locked}
              >
                <option value="" disabled>
                  Select…
                </option>
                {["USD", "OMR", "AED", "SAR", "INR", "EUR"].map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </SectionCard>
        </>
      ) : null}
    </div>
  );
}

function durationDays(from: string, to: string): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  return `${Math.round(ms / 86_400_000)} days`;
}

function ScopeAndScheduleTab({
  values,
  fieldAi,
  setAndClear,
  locked,
}: {
  values: ProjectPayload;
  fieldAi: FieldAi<ProjectPayload>;
  setAndClear: <K extends keyof ProjectPayload>(key: K) => (value: ProjectPayload[K]) => void;
  locked: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ScanSearch} title="Scope Definition">
        <div className="flex flex-col gap-6">
          <Field
            label="Customer Overview"
            htmlFor="customer-overview"
            required
            ai={fieldAi("customer_overview")}
          >
            <Textarea
              id="customer-overview"
              placeholder="Who the customer is, their business, and the relationship context…"
              value={values.customer_overview ?? ""}
              onChange={(e) => setAndClear("customer_overview")(e.target.value)}
              disabled={locked}
            />
          </Field>
          <Field
            label="Project Scope Description"
            htmlFor="scope-description"
            required
            badge={<MandatoryBadge />}
            ai={fieldAi("project_scope_description")}
          >
            <Textarea
              id="scope-description"
              className="min-h-32"
              placeholder="What the project will deliver — objectives, boundaries, and key deliverables…"
              value={values.project_scope_description ?? ""}
              onChange={(e) => setAndClear("project_scope_description")(e.target.value)}
              disabled={locked}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={CalendarDays} title="Schedule">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field
            label="Planned Start Date"
            htmlFor="planned-start"
            required
            ai={fieldAi("planned_start_date")}
          >
            <Input
              id="planned-start"
              type="date"
              value={values.planned_start_date ?? ""}
              onChange={(e) => setAndClear("planned_start_date")(e.target.value)}
              className={inputClass}
              disabled={locked}
            />
          </Field>
          <Field
            label="Planned End Date"
            htmlFor="planned-end"
            required
            ai={fieldAi("planned_end_date")}
          >
            <Input
              id="planned-end"
              type="date"
              value={values.planned_end_date ?? ""}
              onChange={(e) => setAndClear("planned_end_date")(e.target.value)}
              className={inputClass}
              disabled={locked}
            />
          </Field>
          <Field label="Planned Duration" badge={<AutoBadge />}>
            <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
              {durationDays(values.planned_start_date ?? "", values.planned_end_date ?? "")}
            </div>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

// Project Profile action bar: Create Project (POST) and Edit Project (PUT —
// saves the current fields, and unlocks them if the project is locked).
// Submitting the project for approval now has its own dedicated screen
// (new-project/[projectId]/send-to-approval), which validates governance
// completeness server-side before moving Draft -> Pending Approval.
function ProjectDescriptionActions({
  values,
  ai,
  onProjectNameErrorChange,
}: {
  values: ProjectPayload;
  ai: ReturnType<typeof useAiReview>;
  onProjectNameErrorChange: (error: string | null) => void;
}) {
  const router = useRouter();
  const projectId = useNewProjectId();
  const { isEditing, setEditing } = useNewProjectUi();
  const { data: project } = useProject(projectId);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(projectId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const primaryClass =
    "h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]";
  const secondaryClass =
    "h-11 bg-slate-600 px-6 text-sm font-semibold text-white hover:bg-slate-700";

  const status = project?.project_status;
  const isCreated = !!projectId;
  const isDraft = isDraftStatus(project);
  // Tracks whether an Edit Project save is in flight, so only that button shows
  // a spinner (Create has its own `createProject.isPending`).
  const [pendingAction, setPendingAction] = React.useState<"edit" | null>(null);

  const statusMessage = isDraft
    ? "Editable by the Project Manager while the project is in Draft."
    : status === "Under Amendment"
      ? "Under Amendment — every field except Project Type can be changed; then use Send To Approve."
      : status === "Pending Approval"
        ? "Pending Approval — Delivery Excellence will review and approve. Click Edit Project to make changes."
        : status === "Approved"
          ? "Approved — click Edit Project to make changes."
          : isEditing
            ? "Editable by the Project Manager while the project is unlocked."
            : "Locked — click Edit Project to make changes.";

  const handleCreate = async () => {
    if (!values.project_name?.trim()) {
      const message = "Project Name is required before you can create the project.";
      onProjectNameErrorChange(message);
      showError(message);
      return;
    }
    onProjectNameErrorChange(null);
    try {
      const created = await createProject.mutateAsync(values);
      setEditing(false);
      // Survives the redirect below so it's visible on the destination page
      // instead of flashing away before the navigation completes.
      showSuccess("Project Created Successfully", { persistThroughNavigation: true });
      router.push(`/new-project/${created.id}/map-oracle-projects`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create project.");
    }
  };

  // Edit Project saves whatever is currently in the fields (a PUT — there is
  // no client-only "unlock" step) and, for a project that's locked because
  // it's past Draft, also unlocks it for further edits.
  const handleEdit = async () => {
    onProjectNameErrorChange(null);
    setPendingAction("edit");
    try {
      await updateProject.mutateAsync(values);
      await ai.resolveAll();
      setEditing(true);
      showSuccess("Project Updated Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setPendingAction(null);
    }
  };

  const busy = createProject.isPending || updateProject.isPending;

  return (
    <>
      <div className="flex justify-end gap-3">
        {!isCreated ? (
          <Button
            className={cn(primaryClass, "gap-2")}
            disabled={busy}
            onClick={handleCreate}
          >
            {createProject.isPending ? <ButtonSpinner /> : null}
            Create Project
          </Button>
        ) : null}
        {isCreated ? (
          <Button
            className={cn(secondaryClass, "gap-2")}
            disabled={busy}
            onClick={handleEdit}
          >
            {pendingAction === "edit" ? <ButtonSpinner /> : null}
            Edit Project
          </Button>
        ) : null}
      </div>
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Lock className="size-4" />
        {statusMessage}
      </p>
    </>
  );
}

// Each New Project charter screen is its own route, so these are separate
// top-level exports (one per page) instead of a single tab-switched form.
export function ProjectProfileForm() {
  const projectId = useNewProjectId();
  const periodId = useBaselinePeriodId();
  const { values, set } = useProjectProfileForm();
  const { ai, fieldAi, setAndClear } = useAiFieldBinding(projectId, "project_profile", periodId, values, set);
  const [projectNameError, setProjectNameError] = React.useState<string | null>(null);

  return (
    <div>
      <LoadAiSuggestionsButton projectId={projectId} screen="project_profile" periodId={periodId} ai={ai} />
      <ProjectDescriptionTab
        values={values}
        fieldAi={fieldAi}
        setAndClear={setAndClear}
        projectNameError={projectNameError ?? undefined}
      />
      <div className="mt-10 flex flex-col gap-4">
        <ProjectDescriptionActions values={values} ai={ai} onProjectNameErrorChange={setProjectNameError} />
      </div>
    </div>
  );
}

export function ScopeScheduleForm() {
  const projectId = useNewProjectId();
  const periodId = useBaselinePeriodId();
  const isEditing = useNewProjectUi((state) => state.isEditing);
  const { project, values, set } = useProjectProfileForm();
  const updateProject = useUpdateProject(projectId);
  const { ai, fieldAi, setAndClear } = useAiFieldBinding(projectId, "scope_schedule", periodId, values, set);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const isDraft = isDraftStatus(project);
  const isUnderAmendment = project?.project_status === "Under Amendment";
  const locked = !isAmendableStatus(project) && !isEditing;

  return (
    <div>
      <LoadAiSuggestionsButton projectId={projectId} screen="scope_schedule" periodId={periodId} ai={ai} />
      <ScopeAndScheduleTab values={values} fieldAi={fieldAi} setAndClear={setAndClear} locked={locked} />
      <div className="mt-10 flex flex-col gap-4">
        <div className="flex justify-end gap-3">
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={locked || updateProject.isPending}
            onClick={() =>
              updateProject.mutate(values, {
                onSuccess: () => {
                  ai.resolveAll();
                  showSuccess("Scope & Schedule Saved Successfully");
                },
                onError: (err) =>
                  showError(err instanceof Error ? err.message : "Failed to save changes."),
              })
            }
          >
            {updateProject.isPending ? <ButtonSpinner /> : null}
            Save Scope &amp; Schedule
          </Button>
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          {isDraft
            ? "Editable by the Project Manager while the project is in Draft."
            : isUnderAmendment
              ? "Under Amendment — editable; submit via Send To Approve when done."
              : isEditing
                ? "Editable by the Project Manager while the project is unlocked."
                : "Locked — click Edit Project on the Project Profile tab to make changes."}
        </p>
      </div>
    </div>
  );
}

function SelfAssessmentFormInner() {
  const form = useHealthDeclarationForm();
  return (
    <div>
      {form.projectId ? (
        <LoadAiSuggestionsButton
          projectId={form.projectId}
          screen="self_assessment"
          periodId={form.periodId}
          ai={form.ai}
        />
      ) : null}
      <HealthDeclaration form={form} />
      <div className="mt-10 flex flex-col gap-4">
        <div className="flex justify-end gap-3">
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={!form.projectId || form.isSubmitting}
            onClick={form.submit}
          >
            {form.isSubmitting ? <ButtonSpinner /> : null}
            Submit Self Assessment
          </Button>
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Editable by the Project Manager while the project is unlocked.
        </p>
      </div>
    </div>
  );
}

export function SelfAssessmentForm() {
  // HealthDeclaration now renders HealthItemsTab, which reads ?period=
  // (useSearchParams) — that requires a Suspense boundary at prerender,
  // same reason project-charter/charter-form.tsx's SelfAssessmentForm wraps.
  return (
    <React.Suspense fallback={null}>
      <SelfAssessmentFormInner />
    </React.Suspense>
  );
}
