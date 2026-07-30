import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export type RegisterColumn<T> = {
  key: string;
  label: string;
  align?: "right";
  badge?: boolean;
  render?: (item: T) => React.ReactNode;
};

// Shared list-view table for RAIDO registers (§4.5–4.9 of the spec): ID,
// Title, Category, Owner, Status, and Severity/Priority/Criticality/Impact
// with color coding — one component reused across all five logs.
export function RegisterTable<T extends { id: string } & Record<string, unknown>>({
  items,
  columns,
  emptyLabel,
}: {
  items: T[];
  columns: RegisterColumn<T>[];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn("px-4 py-3", c.align === "right" && "text-right")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-slate-400"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3",
                      c.align === "right" && "text-right tabular-nums"
                    )}
                  >
                    {c.render ? (
                      c.render(item)
                    ) : c.badge ? (
                      <StatusBadge value={(item[c.key] as string) ?? ""} />
                    ) : (
                      (item[c.key] as string) || "—"
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
