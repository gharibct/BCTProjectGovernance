import * as React from "react";

// Generic labelled key/value renderer for the read-only governance module
// views. Skips plumbing columns and renders primitives as-is; nested
// objects/arrays are summarised rather than dumped.
const SKIP_KEYS = new Set([
  "id",
  "project_id",
  "measurement_id",
  "period_id",
  "created_at",
  "updated_at",
  "last_updated",
]);

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "—";
  if (typeof value === "object") return "—";
  return String(value);
}

export function ReadOnlyValueGrid({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([k]) => !SKIP_KEYS.has(k));
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">{humanize(key)}</dt>
          <dd className="mt-1 text-sm text-slate-800">{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
