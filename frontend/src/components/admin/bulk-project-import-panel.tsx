"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import type { FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import {
  useAccounts,
  useGeos,
  useOrganizations,
  useProducts,
  useProjectTypes,
  useRegions,
} from "@/lib/api/reference-data";
import {
  useBulkCreateProject,
  type ApplicablePhase,
  type Project,
  type ProjectBulkPayload,
} from "@/lib/api/projects";

const CONTRACT_TYPES = ["FPP", "T&M", "Capped T&M", "Internal"] as const;
const PROJECT_OWNED_OPTIONS = ["Fully Owned", "Co-Owned", "Customer Driven"] as const;
const YES_NO = ["Yes", "No"] as const;
const CURRENCIES = ["USD", "OMR", "AED", "SAR", "INR", "EUR"] as const;
// Matches backend enums.py's ApplicablePhase.
const APPLICABLE_PHASES: readonly ApplicablePhase[] = [
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
];

// Applicable Phase is multi-select; in a spreadsheet cell it's a ";"-separated
// list, matched case-insensitively. Unrecognised entries are dropped.
function parsePhases(raw: string): ApplicablePhase[] {
  return raw
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => APPLICABLE_PHASES.find((phase) => phase.toLowerCase() === part))
    .filter((phase): phase is ApplicablePhase => phase !== undefined);
}

function buildProjectPayload(values: Record<string, string>): ProjectBulkPayload {
  const opt = (key: string) => values[key]?.trim() || undefined;
  return {
    project_name: values.project_name.trim(),
    project_manager_email: values.project_manager_email.trim(),
    oracle_project_id: values.oracle_project_id.trim(),
    organization_id: opt("organization_id"),
    geo_id: opt("geo_id"),
    region_id: opt("region_id"),
    account_id: opt("account_id"),
    contract_type: opt("contract_type") as ProjectBulkPayload["contract_type"],
    project_type_id: opt("project_type_id"),
    project_owned: opt("project_owned") as ProjectBulkPayload["project_owned"],
    critical_flag: opt("critical_flag") as ProjectBulkPayload["critical_flag"],
    product_flag: opt("product_flag") as ProjectBulkPayload["product_flag"],
    product_id: opt("product_id"),
    applicable_phase: parsePhases(values.applicable_phase ?? ""),
    project_revenue: opt("project_revenue"),
    project_currency: opt("project_currency"),
    customer_overview: opt("customer_overview"),
    project_scope_description: opt("project_scope_description"),
    planned_start_date: opt("planned_start_date"),
    planned_end_date: opt("planned_end_date"),
    tool_effective_date: opt("tool_effective_date"),
  };
}

// Admin-only bulk import of Draft projects. Grid only — no create/edit form:
// rows come in via Export Template → fill → Import Excel / Paste from Excel.
// Columns mirror Create Project, Project Profile and Scope & Schedule.
export function BulkProjectImportPanel() {
  const { data: organizations = [] } = useOrganizations();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();
  const { data: accounts = [] } = useAccounts();
  const { data: projectTypes = [] } = useProjectTypes();
  const { data: products = [] } = useProducts();
  const bulkCreate = useBulkCreateProject();
  // Only projects created by an import in this visit are listed; the grid
  // starts empty on launch rather than showing every existing project.
  const [imported, setImported] = React.useState<Project[]>([]);
  const createProject = {
    mutateAsync: async (payload: ProjectBulkPayload) => {
      const created = await bulkCreate.mutateAsync(payload);
      setImported((prev) => [created, ...prev]);
      return created;
    },
  };

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";
  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? "—";

  const defs: FieldDef[] = [
    // Create Project
    { key: "project_name", label: "Project Name", kind: "text", mandatory: true },
    {
      key: "project_manager_email",
      label: "Project Manager Email",
      kind: "text",
      mandatory: true,
      hint: "Email of an active user.",
    },
    { key: "oracle_project_id", label: "Oracle Project ID", kind: "text", mandatory: true },
    {
      key: "organization_id",
      label: "Organization",
      kind: "select",
      mandatory: true,
      choices: organizations.map((o) => ({ value: o.id, label: o.code })),
    },
    {
      key: "geo_id",
      label: "GEO",
      kind: "select",
      mandatory: true,
      choices: geos.map((g) => ({ value: g.id, label: g.name })),
    },
    {
      key: "region_id",
      label: "Region",
      kind: "select",
      mandatory: true,
      choices: regions.map((r) => ({ value: r.id, label: r.name })),
    },
    {
      key: "account_id",
      label: "Account Name",
      kind: "select",
      mandatory: true,
      choices: accounts.map((a) => ({ value: a.id, label: a.name })),
    },
    // Project Profile
    { key: "contract_type", label: "Contract Type", kind: "select", options: CONTRACT_TYPES },
    {
      key: "project_type_id",
      label: "Project Type",
      kind: "select",
      choices: projectTypes.map((t) => ({ value: t.id, label: t.name })),
    },
    { key: "project_owned", label: "Project Owned", kind: "select", options: PROJECT_OWNED_OPTIONS },
    { key: "critical_flag", label: "Critical Flag", kind: "select", options: YES_NO },
    { key: "product_flag", label: "Product Flag", kind: "select", options: YES_NO },
    {
      key: "product_id",
      label: "Product",
      kind: "select",
      hint: "Required when Product Flag is Yes.",
      choices: products.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      key: "applicable_phase",
      label: "Applicable Phase",
      kind: "text",
      hint: "Separate multiple phases with ;",
    },
    { key: "project_revenue", label: "Project Revenue", kind: "number" },
    { key: "project_currency", label: "Project Currency", kind: "select", options: CURRENCIES },
    // Scope & Schedule
    { key: "customer_overview", label: "Customer Overview", kind: "textarea" },
    { key: "project_scope_description", label: "Project Scope Description", kind: "textarea" },
    { key: "planned_start_date", label: "Planned Start Date", kind: "date" },
    { key: "planned_end_date", label: "Planned End Date", kind: "date" },
    {
      key: "tool_effective_date",
      label: "Governance Tool Implementation Effective Date",
      kind: "date",
    },
  ];

  return (
    <SectionCard icon={FolderPlus} title="Imported Projects">
      <RegisterImportToolbar
        defs={defs}
        itemLabelPlural="Projects"
        buildPayload={buildProjectPayload}
        createMutation={createProject}
      />
      <RegisterTable
        items={imported}
        emptyLabel="No projects imported yet. Use Import Excel or Paste from Excel."
        columns={[
          { key: "project_code", label: "Project Code" },
          { key: "project_name", label: "Project Name" },
          { key: "account_id", label: "Account", render: (item) => accountName(item.account_id) },
          { key: "geo_id", label: "GEO", render: (item) => geoName(item.geo_id) },
          { key: "planned_start_date", label: "Planned Start", render: (item) => item.planned_start_date || "—" },
          { key: "planned_end_date", label: "Planned End", render: (item) => item.planned_end_date || "—" },
          { key: "project_status", label: "Status", badge: true },
        ]}
      />
    </SectionCard>
  );
}
