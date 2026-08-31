"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ClipboardList } from "lucide-react";

import { useUsers } from "@/lib/api/reference-data";
import {
  useRisks,
  useAssumptions,
  useIssues,
  useDependencies,
  useOpportunities,
} from "@/lib/api/raid";
import { SectionCard, Segmented } from "@/components/forms/form-primitives";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";

type Row = { id: string } & Record<string, unknown>;
type LogKey = "risks" | "assumptions" | "issues" | "dependencies" | "opportunities";

const TABS: readonly { value: LogKey; label: string }[] = [
  { value: "risks", label: "Risks" },
  { value: "assumptions", label: "Assumptions" },
  { value: "issues", label: "Issues" },
  { value: "dependencies", label: "Dependencies" },
  { value: "opportunities", label: "Opportunities" },
];

export function RaidoView() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const [tab, setTab] = React.useState<LogKey>("risks");

  const { data: users } = useUsers();
  const userName = (id: unknown) => users?.find((u) => u.id === id)?.full_name ?? "—";

  const risks = useRisks(projectId);
  const assumptions = useAssumptions(projectId);
  const issues = useIssues(projectId);
  const dependencies = useDependencies(projectId);
  const opportunities = useOpportunities(projectId);

  const config: Record<
    LogKey,
    { items: Row[]; emptyLabel: string; columns: RegisterColumn<Row>[] }
  > = {
    risks: {
      items: (risks.data ?? []) as Row[],
      emptyLabel: "No risks logged.",
      columns: [
        { key: "risk_code", label: "Risk ID" },
        { key: "risk_title", label: "Title" },
        { key: "risk_category", label: "Category" },
        { key: "risk_owner", label: "Owner", render: (item) => userName(item.risk_owner) },
        { key: "severity", label: "Severity", badge: true },
        { key: "current_status", label: "Status", badge: true },
      ],
    },
    assumptions: {
      items: (assumptions.data ?? []) as Row[],
      emptyLabel: "No assumptions logged.",
      columns: [
        { key: "assumption_code", label: "Assumption ID" },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "owner", label: "Owner", render: (item) => userName(item.owner) },
        { key: "impact_rating", label: "Impact", badge: true },
        { key: "current_status", label: "Status", badge: true },
      ],
    },
    issues: {
      items: (issues.data ?? []) as Row[],
      emptyLabel: "No issues logged.",
      columns: [
        { key: "issue_code", label: "Issue ID" },
        { key: "issue_title", label: "Title" },
        { key: "issue_category", label: "Category" },
        { key: "assigned_to", label: "Owner", render: (item) => userName(item.assigned_to) },
        { key: "priority", label: "Priority", badge: true },
        { key: "status", label: "Status", badge: true },
      ],
    },
    dependencies: {
      items: (dependencies.data ?? []) as Row[],
      emptyLabel: "No dependencies logged.",
      columns: [
        { key: "dependency_code", label: "Dependency ID" },
        { key: "dependency_title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "owner", label: "Owner", render: (item) => userName(item.owner) },
        { key: "criticality", label: "Criticality", badge: true },
        { key: "dependency_status", label: "Status", badge: true },
      ],
    },
    opportunities: {
      items: (opportunities.data ?? []) as Row[],
      emptyLabel: "No opportunities logged.",
      columns: [
        { key: "opportunity_code", label: "Opportunity ID" },
        { key: "opportunity_title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "opportunity_owner", label: "Owner", render: (item) => userName(item.opportunity_owner) },
        { key: "impact", label: "Impact", badge: true },
        { key: "status", label: "Status", badge: true },
      ],
    },
  };

  const active = config[tab];

  return (
    <SectionCard icon={ClipboardList} title="RAIDO Register">
      <Segmented options={TABS} value={tab} onChange={setTab} />
      <div className="mt-6 overflow-x-auto">
        <RegisterTable items={active.items} columns={active.columns} emptyLabel={active.emptyLabel} />
      </div>
    </SectionCard>
  );
}
