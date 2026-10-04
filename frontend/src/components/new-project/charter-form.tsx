"use client";

import { StickyActionBar } from "@/components/forms/sticky-action-bar";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Banknote,
  CalendarDays,
  IdCard,
  Gauge,
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
import { ProductOptions } from "@/components/forms/product-options";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useNewProjectId } from "@/stores/new-project-ui";
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
import { useDevelopmentTarget, useSaveDevelopmentSizeEffort } from "@/lib/api/metric-targets";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  FieldInfoButton,
  MandatoryBadge,
  SectionCard,
  Segmented,
} from "@/components/forms/form-primitives";
import { useProjectOwnedReference } from "@/lib/api/project-owned-reference";
import { CONTRACT_TYPE_INFO_ENTRIES, CRITICAL_FLAG_INFO_ENTRIES } from "@/lib/contract-type-reference";
import type { useAiReview } from "@/components/ai/use-ai-review";
import { useAiFieldBinding, type FieldAi } from "@/components/ai/use-ai-field-binding";
import { useBaselinePeriodId } from "@/lib/period-utils";
import { BaselineLockLink, BaselineLockNotice, useBaselineEditable } from "./baseline-lock";
import { HealthDeclaration, useHealthDeclarationForm } from "./health-declaration";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

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
  "Support L0",
  "Support L1",
  "Support L2",
  "Support L3",
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

// An approved project's lifecycle is Ongoing until the PM explicitly moves it
// to Hold / Closed / Open Only for Billing on this page — the same default the
// backend stamps on DE approval. Projects approved before the lifecycle field
// existed carry a null lifecycle_status, so surface that default here rather
// than leaving the Amend combo on "Select…".
function seededLifecycleStatus(project: Project): ProjectLifecycleStatus | undefined {
  if (project.lifecycle_status) return project.lifecycle_status;
  return project.project_status === "Approved" || project.project_status === "Under Amendment"
    ? "Ongoing"
    : undefined;
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
    tool_effective_date: project.tool_effective_date ?? undefined,
    applicable_phase: project.applicable_phase ?? [],
    lifecycle_status: seededLifecycleStatus(project),
  };
}

// Whether the charter forms are editable is decided by useBaselineEditable
// (baseline-lock.tsx): only a Draft or an Under Amendment project can be edited —
// there is no "Edit Project" unlock any more. To change an Approved project,
// initiate an amendment; a Pending Approval project must be recalled first.

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
  const { project, editable } = useBaselineEditable();
  const locked = !editable;
  // The same charter form serves /new-project and /amend-project — the
  // lifecycle Project Status combo only belongs to the Amend flow.
  const isAmend = (usePathname() ?? "").split("/")[1] === "amend-project";
  // Project Type is fixed once a project exists and is being amended — the
  // amendment snapshot/measurement wiring is keyed to the original type.
  const projectTypeLocked = locked || project?.project_status === "Under Amendment";
  // The lifecycle state (Ongoing / Hold / Closed / …) moves only through an
  // amendment — the server rejects a change in any other status.
  const lifecycleEditable = project?.project_status === "Under Amendment";

  const { data: organizations } = useOrganizations();
  const { data: geos } = useGeos();
  const { data: regions } = useRegions();
  const { data: projectTypes } = useProjectTypes();
  const { data: products } = useProducts();
  const { data: accounts } = useAccounts();
  const { data: users } = useUsers();
  const { data: projectOwnedReference } = useProjectOwnedReference();
  const projectOwnedInfoEntries = React.useMemo(
    () =>
      PROJECT_OWNED_OPTIONS.map((owned) => ({
        label: owned,
        description: projectOwnedReference?.[owned]?.description ?? "",
      })).filter((entry) => entry.description),
    [projectOwnedReference]
  );
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
              lifecycleEditable
                ? "The project's current lifecycle state — optional."
                : "Editable only while the project is Under Amendment."
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
              disabled={!lifecycleEditable}
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
            <Field
              label="Contract Type"
              htmlFor="contract-type"
              required
              ai={fieldAi("contract_type")}
              badge={
                <FieldInfoButton ariaLabel="What does Contract Type mean?" entries={CONTRACT_TYPE_INFO_ENTRIES} />
              }
            >
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
            <Field
              label="Project Owned"
              htmlFor="project-owned"
              required
              ai={fieldAi("project_owned")}
              badge={
                projectOwnedInfoEntries.length ? (
                  <FieldInfoButton ariaLabel="What does Project Owned mean?" entries={projectOwnedInfoEntries} />
                ) : undefined
              }
            >
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
                  setAndClear("account_id")(undefined);
                }}
                activeClassName={segmentedActiveClass}
                disabled={locked}
              />
            </Field>
            <Field label="Region" htmlFor="region" required ai={fieldAi("region_id")}>
              <NativeSelect
                id="region"
                value={values.region_id ?? ""}
                onChange={(e) => {
                  setAndClear("region_id")(e.target.value);
                  setAndClear("account_id")(undefined);
                }}
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
                disabled={locked || !values.region_id}
              >
                <option value="" disabled>
                  {values.region_id ? "Select…" : "Select a Region first"}
                </option>
                {(accounts ?? [])
                  .filter(
                    (account) =>
                      account.id === values.account_id ||
                      (account.geo_id === values.geo_id && account.region_id === values.region_id)
                  )
                  .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Critical Flag"
              required
              ai={fieldAi("critical_flag")}
              badge={
                <FieldInfoButton ariaLabel="What does Critical Flag mean?" entries={CRITICAL_FLAG_INFO_ENTRIES} />
              }
            >
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
                  <ProductOptions products={products ?? []} />
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
            <Field
              label="Project Manager"
              htmlFor="project-manager"
              required
              ai={fieldAi("project_manager_id")}
              hint="Assigned when the project creation request is approved — not editable here."
            >
              <div
                id="project-manager"
                className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600"
              >
                {(users ?? []).find((user) => user.id === values.project_manager_id)?.full_name ?? "Not Assigned"}
              </div>
            </Field>
            <Field label={ACCOUNT_MANAGER_LABEL} badge={<AutoBadge />}>
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
            <Field label="Project TCV Revenue" htmlFor="project-revenue" required ai={fieldAi("project_revenue")}>
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
            <Field label="Revenue in USD" htmlFor="project-revenue-usd">
              <Input
                id="project-revenue-usd"
                value={project?.project_revenue_usd ?? ""}
                placeholder="Set from the Admin exchange rate"
                className={inputClass}
                disabled
              />
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

type SizeEffortValues = { sizeUnit: string; plannedSize: string; estimatedEffort: string };
const SIZE_UNITS = ["CP", "FP", "LOC", "SP"] as const;

function ScopeAndScheduleTab({
  values,
  fieldAi,
  setAndClear,
  locked,
  sizeEffort,
  onSizeEffortChange,
}: {
  values: ProjectPayload;
  fieldAi: FieldAi<ProjectPayload>;
  setAndClear: <K extends keyof ProjectPayload>(key: K) => (value: ProjectPayload[K]) => void;
  locked: boolean;
  // Development projects only (null = not applicable, section hidden).
  sizeEffort: SizeEffortValues | null;
  onSizeEffortChange: (patch: Partial<SizeEffortValues>) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ScanSearch} title="Scope Definition">
        <div className="flex flex-col gap-6">
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
          <Field
            label="Governance Tool Implementation Effective Date"
            htmlFor="tool-effective-date"
            ai={fieldAi("tool_effective_date")}
            hint="When this project started being tracked in the tool — may differ from its actual start date (e.g. an older ongoing project onboarded later). Leave blank to use Planned/Actual Start Date."
          >
            <Input
              id="tool-effective-date"
              type="date"
              value={values.tool_effective_date ?? ""}
              onChange={(e) => setAndClear("tool_effective_date")(e.target.value)}
              className={inputClass}
              disabled={locked}
            />
          </Field>
        </div>
      </SectionCard>

      {sizeEffort ? (
        <SectionCard icon={Gauge} title="Size & Effort">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
            <Field label="Size Unit" htmlFor="size-type" required>
              <NativeSelect
                id="size-type"
                value={sizeEffort.sizeUnit}
                onChange={(e) => onSizeEffortChange({ sizeUnit: e.target.value })}
                disabled={locked}
              >
                <option value="">Select</option>
                {SIZE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Overall Planned Size" htmlFor="total-size" required>
              <Input
                id="total-size"
                type="number"
                min={0}
                value={sizeEffort.plannedSize}
                onChange={(e) => onSizeEffortChange({ plannedSize: e.target.value })}
                className={inputClass}
                disabled={locked}
              />
            </Field>
            <Field label="Overall Estimated Effort" htmlFor="total-effort" required hint="Person-Days">
              <Input
                id="total-effort"
                type="number"
                min={0}
                value={sizeEffort.estimatedEffort}
                onChange={(e) => onSizeEffortChange({ estimatedEffort: e.target.value })}
                className={inputClass}
                disabled={locked}
              />
            </Field>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

// Project Profile action bar: Create Project (POST, only before the project
// exists) and Save (PUT — only while the baseline is editable, i.e. Draft or Under
// Amendment). There is no "Edit Project" unlock: an Approved project is changed by
// initiating an amendment, a Pending Approval one by recalling it — when locked the
// Save button is replaced by a link to that action. Submitting the project for
// approval has its own screen (new-project/[projectId]/send-to-approval), which
// validates governance completeness server-side.
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
  const { project, editable } = useBaselineEditable();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(projectId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const primaryClass =
    "h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]";

  const status = project?.project_status;
  const isCreated = !!projectId;
  // Tracks whether a Save is in flight, so only that button shows a spinner
  // (Create has its own `createProject.isPending`).
  const [pendingAction, setPendingAction] = React.useState<"save" | null>(null);

  const statusMessage =
    status === "Under Amendment"
      ? "Under Amendment — every field except Project Type can be changed; then use Send To Approve."
      : status === "Pending Approval"
        ? "Pending Approval — Delivery Excellence will review and approve."
        : status === "Approved"
          ? "Approved — the project baseline is locked."
          : "Editable by the Project Manager while the project is in Draft.";

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
      // Survives the redirect below so it's visible on the destination page
      // instead of flashing away before the navigation completes.
      showSuccess("Project Created Successfully", { persistThroughNavigation: true });
      router.push(`/new-project/${created.id}/map-oracle-projects`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create project.");
    }
  };

  const handleSave = async () => {
    onProjectNameErrorChange(null);
    setPendingAction("save");
    try {
      await updateProject.mutateAsync(values);
      await ai.resolveAll();
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
      <StickyActionBar>
        {!isCreated ? (
          <Button
            className={cn(primaryClass, "gap-2")}
            disabled={busy}
            onClick={handleCreate}
          >
            {createProject.isPending ? <ButtonSpinner /> : null}
            Create Project
          </Button>
        ) : editable ? (
          <Button
            className={cn(primaryClass, "gap-2")}
            disabled={busy}
            onClick={handleSave}
          >
            {pendingAction === "save" ? <ButtonSpinner /> : null}
            Save Project Profile
          </Button>
        ) : project ? (
          <BaselineLockLink project={project} />
        ) : null}
      </StickyActionBar>
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
  const { project, editable } = useBaselineEditable();

  return (
    <div>
      {!editable && project ? <BaselineLockNotice project={project} /> : null}
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
  const { project, values, set } = useProjectProfileForm();
  const { editable } = useBaselineEditable();
  const updateProject = useUpdateProject(projectId);
  const { ai, fieldAi, setAndClear } = useAiFieldBinding(projectId, "scope_schedule", periodId, values, set);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // Size Unit / Overall Planned Size / Overall Estimated Effort exist for Development projects only;
  // they live on the Development target row but are declared (and validated) here.
  const { data: projectTypes = [] } = useProjectTypes();
  const isDevelopment =
    projectTypes.find((t) => t.id === project?.project_type_id)?.code === "DEVELOPMENT";
  const { data: developmentTarget, isSuccess: developmentTargetLoaded } = useDevelopmentTarget(
    projectId,
    isDevelopment,
  );
  const saveSizeEffort = useSaveDevelopmentSizeEffort(projectId);
  const [sizeEffort, setSizeEffort] = React.useState<SizeEffortValues>({
    sizeUnit: "",
    plannedSize: "",
    estimatedEffort: "",
  });
  // Seed once the saved row has loaded (render-time sync, as in useProjectProfileForm).
  const [sizeEffortSeed, setSizeEffortSeed] = React.useState<string | null>(null);
  const seedKey = developmentTargetLoaded ? (developmentTarget?.id ?? "none") : null;
  if (seedKey !== null && seedKey !== sizeEffortSeed) {
    setSizeEffortSeed(seedKey);
    setSizeEffort({
      sizeUnit: developmentTarget?.target_size_unit ?? "",
      plannedSize: developmentTarget?.target_overall_planned_size?.toString() ?? "",
      estimatedEffort: developmentTarget?.target_overall_estimated_effort?.toString() ?? "",
    });
  }
  const saveAll = () => {
    updateProject.mutate(values, {
      onSuccess: async () => {
        try {
          if (isDevelopment) {
            await saveSizeEffort.mutateAsync({
              target_size_unit: sizeEffort.sizeUnit || null,
              target_overall_planned_size: sizeEffort.plannedSize === "" ? null : Number(sizeEffort.plannedSize),
              target_overall_estimated_effort:
                sizeEffort.estimatedEffort === "" ? null : Number(sizeEffort.estimatedEffort),
            });
          }
          ai.resolveAll();
          showSuccess("Scope & Schedule Saved Successfully");
        } catch (err) {
          showError(err instanceof Error ? err.message : "Failed to save size and effort.");
        }
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to save changes."),
    });
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  const locked = !editable;
  const status = project?.project_status;

  return (
    <div>
      {locked && project ? <BaselineLockNotice project={project} /> : null}
      <ScopeAndScheduleTab
        values={values}
        fieldAi={fieldAi}
        setAndClear={setAndClear}
        locked={locked}
        sizeEffort={isDevelopment ? sizeEffort : null}
        onSizeEffortChange={(patch) => setSizeEffort((prev) => ({ ...prev, ...patch }))}
      />
      <div className="mt-10 flex flex-col gap-4">
        <StickyActionBar>
          {locked && project ? (
            <BaselineLockLink project={project} />
          ) : (
            <Button
              className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
              disabled={updateProject.isPending || saveSizeEffort.isPending}
              onClick={saveAll}
            >
              {updateProject.isPending || saveSizeEffort.isPending ? <ButtonSpinner /> : null}
              Save Scope &amp; Schedule
            </Button>
          )}
        </StickyActionBar>
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          {status === "Under Amendment"
            ? "Under Amendment — editable; submit via Send To Approve when done."
            : status === "Pending Approval"
              ? "Pending Approval — Delivery Excellence will review and approve."
              : status === "Approved"
                ? "Approved — the project baseline is locked."
                : "Editable by the Project Manager while the project is in Draft."}
        </p>
      </div>
    </div>
  );
}

function SelfAssessmentFormInner() {
  const form = useHealthDeclarationForm();
  return (
    <div>
      <HealthDeclaration form={form} />
      <div className="mt-10 flex flex-col gap-4">
        <StickyActionBar>
          <Button
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            disabled={!form.projectId || form.isSubmitting}
            onClick={form.submit}
          >
            {form.isSubmitting ? <ButtonSpinner /> : null}
            Submit Self Assessment
          </Button>
        </StickyActionBar>
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
