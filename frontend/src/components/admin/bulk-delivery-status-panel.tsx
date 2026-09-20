"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import type { FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { useAccounts } from "@/lib/api/reference-data";
import {
  useBulkCreateAccountStatusReport,
  useBulkCreateProjectStatusReport,
  type BulkAccountStatusPayload,
  type BulkProjectStatusPayload,
  type BulkStatusPayload,
} from "@/lib/api/bulk-delivery-status";

// A narrative cell holds several register items separated by a line break or "|".
function splitItems(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/\r?\n|\|/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildStatusPayload(values: Record<string, string>): BulkStatusPayload {
  const opt = (key: string) => values[key]?.trim() || undefined;
  const count = opt("projects_count");
  return {
    period: values.period.trim(),
    revenue: opt("revenue"),
    onsite_fte: opt("onsite_fte"),
    offshore_fte: opt("offshore_fte"),
    projects_count: count === undefined ? undefined : Math.trunc(Number(count)),
    key_accomplishments: splitItems(values.key_accomplishments),
    upcoming_key_releases: splitItems(values.upcoming_key_releases),
    leadership_support_required: splitItems(values.leadership_support_required),
    key_risks_issues: splitItems(values.key_risks_issues),
  };
}

const ITEM_HINT = "Several items: separate with | or a line break.";

// Columns shared by both uploads — period, Key Metrics and the four narrative
// categories the Delivery Status screen collects.
const REPORT_DEFS: FieldDef[] = [
  {
    key: "period",
    label: "Reporting Period",
    kind: "text",
    mandatory: true,
    hint: "Period code (e.g. 2026-W31, 2026-07) or label.",
  },
  { key: "revenue", label: "Revenue (USD)", kind: "number" },
  { key: "onsite_fte", label: "Onsite FTE", kind: "number" },
  { key: "offshore_fte", label: "Offshore FTE", kind: "number" },
  { key: "projects_count", label: "Projects Count", kind: "number" },
  { key: "key_accomplishments", label: "Key Accomplishments", kind: "textarea", hint: ITEM_HINT },
  {
    key: "upcoming_key_releases",
    label: "Upcoming Key Releases / Milestones / Actions",
    kind: "textarea",
    hint: ITEM_HINT,
  },
  {
    key: "leadership_support_required",
    label: "Leadership Support / Attention Required",
    kind: "textarea",
    hint: ITEM_HINT,
  },
  { key: "key_risks_issues", label: "Key Risks / Issues", kind: "textarea", hint: ITEM_HINT },
];

type UploadedRow = {
  id: string;
  subject: string;
  period: string;
  revenue: string;
  itemCount: number;
  status: string;
};

function toUploadedRow(subject: string, payload: BulkStatusPayload, report: { id: string; status: string }): UploadedRow {
  return {
    id: report.id,
    subject,
    period: payload.period,
    revenue: payload.revenue ?? "—",
    itemCount:
      payload.key_accomplishments.length +
      payload.upcoming_key_releases.length +
      payload.leadership_support_required.length +
      payload.key_risks_issues.length,
    status: report.status,
  };
}

function UploadedGrid({ rows, subjectLabel }: { rows: UploadedRow[]; subjectLabel: string }) {
  return (
    <RegisterTable
      items={rows}
      emptyLabel="No reports uploaded yet. Use Import Excel or Paste from Excel."
      columns={[
        { key: "subject", label: subjectLabel },
        { key: "period", label: "Reporting Period" },
        { key: "revenue", label: "Revenue (USD)" },
        { key: "itemCount", label: "Status Items" },
        { key: "status", label: "Status", badge: true },
      ]}
    />
  );
}

// Admin-only bulk upload of Draft Delivery Status reports for Projects. Grid
// only — the grid lists reports uploaded in this visit, starting empty.
export function BulkProjectStatusPanel() {
  const bulkCreate = useBulkCreateProjectStatusReport();
  const [uploaded, setUploaded] = React.useState<UploadedRow[]>([]);
  const createMutation = {
    mutateAsync: async (payload: BulkProjectStatusPayload) => {
      const report = await bulkCreate.mutateAsync(payload);
      setUploaded((prev) => [toUploadedRow(payload.project_code, payload, report), ...prev]);
      return report;
    },
  };
  const defs: FieldDef[] = [
    { key: "project_code", label: "Project Code", kind: "text", mandatory: true },
    ...REPORT_DEFS,
  ];
  const buildPayload = (values: Record<string, string>): BulkProjectStatusPayload => ({
    project_code: values.project_code.trim(),
    ...buildStatusPayload(values),
  });

  return (
    <SectionCard icon={ClipboardList} title="Uploaded Delivery Status Reports">
      <RegisterImportToolbar
        defs={defs}
        itemLabelPlural="Delivery Status - Projects"
        buildPayload={buildPayload}
        createMutation={createMutation}
      />
      <UploadedGrid rows={uploaded} subjectLabel="Project Code" />
    </SectionCard>
  );
}

// Same for Accounts — the account is matched by name.
export function BulkAccountStatusPanel() {
  const { data: accounts = [] } = useAccounts();
  const bulkCreate = useBulkCreateAccountStatusReport();
  const [uploaded, setUploaded] = React.useState<UploadedRow[]>([]);
  const createMutation = {
    mutateAsync: async (payload: BulkAccountStatusPayload) => {
      const report = await bulkCreate.mutateAsync(payload);
      const name = accounts.find((a) => a.id === payload.account_id)?.name ?? payload.account_id;
      setUploaded((prev) => [toUploadedRow(name, payload, report), ...prev]);
      return report;
    },
  };
  const defs: FieldDef[] = [
    {
      key: "account_id",
      label: "Account Name",
      kind: "select",
      mandatory: true,
      choices: accounts.map((a) => ({ value: a.id, label: a.name })),
    },
    ...REPORT_DEFS,
  ];
  const buildPayload = (values: Record<string, string>): BulkAccountStatusPayload => ({
    account_id: values.account_id,
    ...buildStatusPayload(values),
  });

  return (
    <SectionCard icon={ClipboardList} title="Uploaded Delivery Status Reports">
      <RegisterImportToolbar
        defs={defs}
        itemLabelPlural="Delivery Status - Accounts"
        buildPayload={buildPayload}
        createMutation={createMutation}
      />
      <UploadedGrid rows={uploaded} subjectLabel="Account" />
    </SectionCard>
  );
}
