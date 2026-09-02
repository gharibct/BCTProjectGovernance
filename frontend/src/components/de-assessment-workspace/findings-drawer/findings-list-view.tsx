"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/forms/empty-state";
import { Segmented } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { useEffectiveRole } from "@/stores/session";
import { canWriteDeAssessment } from "@/lib/api/de-assessment-permissions";
import type { DEAssessmentFinding } from "@/lib/api/de-assessment";

type Filter = "active" | "overdue" | "awaiting" | "all";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "awaiting", label: "Awaiting Closure" },
  { value: "all", label: "All" },
] as const;

function matchesFilter(finding: DEAssessmentFinding, filter: Filter): boolean {
  switch (filter) {
    case "active":
      return finding.status === "Open" || finding.status === "In Progress";
    case "overdue":
      return finding.overdue;
    case "awaiting":
      return finding.status === "Awaiting Closure";
    case "all":
    default:
      return true;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function FindingsListView({
  findings,
  onSelect,
  onCreate,
}: {
  findings: DEAssessmentFinding[];
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = React.useState<Filter>("active");
  const canWrite = canWriteDeAssessment(useEffectiveRole());

  const filtered = findings.filter((f) => matchesFilter(f, filter));

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} className="h-9" />
        {canWrite ? (
          <Button size="sm" className="gap-1.5" onClick={onCreate}>
            <Plus className="size-4" />
            New Finding
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState>
          No findings {filter === "all" ? "raised yet." : `in "${FILTERS.find((f) => f.value === filter)?.label}".`}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((finding) => (
            <li key={finding.id}>
              <button
                type="button"
                onClick={() => onSelect(finding.id)}
                className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-[#1a6fc4]/40 hover:bg-blue-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    {finding.description?.trim() || `Finding #${finding.sequence_no}`}
                  </h4>
                  {finding.severity ? <StatusBadge value={finding.severity} /> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <StatusBadge value={finding.status} />
                  <span>{finding.classification}</span>
                  <span>Due {formatDate(finding.due_date)}</span>
                  {finding.overdue ? <span className="font-semibold text-red-600">Overdue</span> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
