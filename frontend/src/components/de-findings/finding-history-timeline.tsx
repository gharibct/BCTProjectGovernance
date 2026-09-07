"use client";

import * as React from "react";
import { History } from "lucide-react";

import { useUsersByIds, type User } from "@/lib/api/reference-data";
import type { FindingHistoryEntry } from "@/lib/api/de-findings";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userName(users: User[], userId: string): string {
  return users.find((u) => u.id === userId)?.full_name ?? "Unknown";
}

function describe(entry: FindingHistoryEntry): string {
  switch (entry.event_type) {
    case "CREATED":
      return "Finding raised";
    case "ACTION_TAKEN":
      return `Action recorded${entry.new_value ? ` — moved to ${entry.new_value}` : ""}`;
    case "STATUS_CHANGE":
      return `Status changed from ${entry.old_value ?? "—"} to ${entry.new_value ?? "—"}`;
    default:
      return entry.comment ?? "";
  }
}

// "Progress & History" for a finding — the append-only audit trail
// (de_assessment_finding_history), mirrors the Action Tracker's timeline.
export function FindingHistoryTimeline({ entries }: { entries: FindingHistoryEntry[] }) {
  const { data: userList = [] } = useUsersByIds(
    React.useMemo(() => entries.map((e) => e.created_by), [entries]),
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-5">
      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <History className="size-4 text-slate-400" />
        Progress &amp; History
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">No history yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 text-xs">
              <span className="text-slate-700">{describe(entry)}</span>
              {entry.event_type === "ACTION_TAKEN" && entry.comment ? (
                <span className="text-slate-500 italic">“{entry.comment}”</span>
              ) : null}
              <span className="text-slate-400">
                {formatDateTime(entry.created_at)} · {userName(userList, entry.created_by)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
