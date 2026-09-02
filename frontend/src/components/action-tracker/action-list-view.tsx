"use client";

import * as React from "react";
import { Plus, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/forms/empty-state";
import { Segmented } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { useUsersByIds } from "@/lib/api/reference-data";
import {
  ACTION_PRIORITY_LABEL,
  ACTION_STATUS_LABEL,
  useActions,
  type Action,
  type ActionLevel,
} from "@/lib/api/actions";

type Filter = "active" | "overdue" | "all" | "completed";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
] as const;

function matchesFilter(action: Action, filter: Filter): boolean {
  switch (filter) {
    case "active":
      return action.status === "OPEN" || action.status === "IN_PROGRESS";
    case "overdue":
      return action.overdue;
    case "completed":
      return action.status === "COMPLETED" || action.status === "CLOSED" || action.status === "CANCELLED";
    case "all":
    default:
      return true;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function ActionListView({
  level,
  id,
  onSelect,
  onCreate,
}: {
  level: ActionLevel;
  id: string;
  onSelect: (actionId: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = React.useState<Filter>("active");
  const { data: actions = [], isLoading } = useActions(level, id);
  const ownerIds = React.useMemo(() => actions.map((a) => a.action_by_id), [actions]);
  const { data: users = [] } = useUsersByIds(ownerIds);

  const ownerName = (ownerId: string) => users.find((u) => u.id === ownerId)?.full_name ?? "Unassigned";
  const filtered = actions.filter((a) => matchesFilter(a, filter));

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} className="h-9" />
        <Button size="sm" className="gap-1.5" onClick={onCreate}>
          <Plus className="size-4" />
          New Action
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState>
          No actions {filter === "all" ? "raised yet." : `in "${FILTERS.find((f) => f.value === filter)?.label}".`}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onSelect(action.id)}
                className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-[#1a6fc4]/40 hover:bg-blue-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">{action.title}</h4>
                  <StatusBadge value={ACTION_PRIORITY_LABEL[action.priority]} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <StatusBadge value={ACTION_STATUS_LABEL[action.status]} />
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="size-3" />
                    {ownerName(action.action_by_id)}
                  </span>
                  <span>Due {formatDate(action.due_date)}</span>
                  {action.overdue ? <span className="font-semibold text-red-600">Overdue</span> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
