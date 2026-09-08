// Open / Closed / All status filter shared by the RAIDO register in the PM
// reporting view (components/raido/*) and the DE governance-review view
// (components/de-approval/module-views/raido-view.tsx).

export type RaidoStatusFilter = "open" | "closed" | "all";

export const RAIDO_STATUS_FILTER_OPTIONS: readonly { value: RaidoStatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export type RaidoLogKey = "risks" | "assumptions" | "issues" | "dependencies" | "opportunities";

// Terminal statuses per log — an item whose status is in this set counts as
// "closed"; anything else (including blank) counts as "open".
const CLOSED_STATUSES: Record<RaidoLogKey, readonly string[]> = {
  risks: ["Closed"],
  assumptions: ["Closed", "Cancelled"],
  issues: ["Resolved", "Closed"],
  dependencies: ["Completed"],
  opportunities: ["Implemented", "Closed"],
};

export function filterRaidoByStatus<T>(
  items: readonly T[],
  logKey: RaidoLogKey,
  statusKey: string,
  filter: RaidoStatusFilter,
): T[] {
  if (filter === "all") return [...items];
  const closed = new Set<string>(CLOSED_STATUSES[logKey]);
  return items.filter((item) => {
    const isClosed = closed.has(String((item as Record<string, unknown>)[statusKey] ?? ""));
    return filter === "closed" ? isClosed : !isClosed;
  });
}
