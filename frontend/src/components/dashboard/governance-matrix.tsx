"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CATEGORIES, HEALTH_LEVELS, RATING_FROM_API } from "@/components/project-charter/health-declaration";
import type { SectionAccentColor } from "@/lib/section-accent-colors";
import type { HealthMatrixRow } from "@/lib/api/dashboard";
import type { HealthRating } from "@/lib/api/projects";

// Account/Project Governance Matrix — one row per entity, one column per
// health category (Overall + the app's canonical 6, from CATEGORIES) —
// replaces the old Project Health / Account Health lists (name + single
// rolled-up badge only) with the full per-category breakdown. Adapted from
// design-reference/geo-dashbaord.html's content design: solid-color blocks
// per cell, no per-cell text — a `title` tooltip covers accessibility
// instead, same lightweight pattern as status-review/rag-status-section.tsx's
// dot indicator.
export function RagCell({ rating, circle = false }: { rating: HealthRating | null; circle?: boolean }) {
  const level = rating ? HEALTH_LEVELS.find((l) => l.value === RATING_FROM_API[rating])! : null;
  const color = level ? level.dotClass : "bg-slate-200";
  const title = level ? level.label : "Not assessed";
  if (circle) {
    return (
      <div className="flex justify-center">
        <div className={cn("size-4 rounded-full", color)} title={title} />
      </div>
    );
  }
  return <div className={cn("h-8 w-full rounded-md", color)} title={title} />;
}

export function GovernanceMatrix<T extends HealthMatrixRow = HealthMatrixRow>({
  heading,
  icon: Icon,
  accentColor,
  entityColumnLabel,
  showAccountColumn = false,
  rows = [],
  entityHref,
  renderEntity,
  onEntityClick,
  entityClickable,
  actionColumn,
  emptyLabel,
  overallLabel = "Overall",
  circleCategories = false,
}: {
  heading: string;
  // Optional colored PPT-divider-style header (see lib/section-accent-colors.ts)
  // — omit both for the plain header every other caller (CXO/Account/Geo Head
  // Dashboard) already uses.
  icon?: LucideIcon;
  accentColor?: SectionAccentColor;
  entityColumnLabel: string;
  // Adds an "Account" column before the entity column — only meaningful for
  // the Project Governance Matrix, where each row's own entity is a project
  // and row.account_name says which account it belongs to.
  showAccountColumn?: boolean;
  rows: T[] | undefined;
  entityHref: (id: string) => string;
  // Replaces the default name link in the entity column (e.g. High Risks adds
  // Geo / Region / Delivery Manager under the account name).
  renderEntity?: (row: T) => React.ReactNode;
  // Makes the whole entity (first) cell clickable. Controls inside it that do
  // their own thing (filter bubbles) should stop propagation.
  onEntityClick?: (row: T) => void;
  // Rows for which the entity cell is not clickable (default: all are).
  entityClickable?: (row: T) => boolean;
  // Optional extra column right after the entity column (e.g. a "View Report" button).
  actionColumn?: { label: string; render: (row: T) => React.ReactNode };
  emptyLabel: string;
  // Header for the rolled-up rating column (High Risk Dashboard: "Delivery RAG").
  overallLabel?: string;
  // Render the per-category cells as small circles instead of full-width blocks.
  circleCategories?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {accentColor ? (
        <h2
          className={cn("flex items-center gap-3 px-6 py-4 text-lg font-bold tracking-wide", accentColor.text)}
          style={{ backgroundColor: accentColor.bg }}
        >
          {Icon ? <Icon className="size-5 shrink-0" /> : null}
          {heading}
        </h2>
      ) : (
        <h2 className="border-b border-slate-200 px-5 py-3.5 font-bold text-slate-900">{heading}</h2>
      )}
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                {showAccountColumn ? <th className="min-w-[140px] px-4 py-3">Account</th> : null}
                <th className="min-w-[170px] px-4 py-3">{entityColumnLabel}</th>
                {actionColumn ? <th className="px-3 py-3">{actionColumn.label}</th> : null}
                <th className="min-w-[72px] px-2 py-3 text-center">{overallLabel}</th>
                {CATEGORIES.map((category) => (
                  <th key={category.key} className="min-w-[72px] px-2 py-3 text-center">
                    {category.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.entity_id} data-row-key={row.entity_id} className="border-b border-[#E4E9EE] bg-white last:border-b-0 even:bg-[#F8FAFB] hover:bg-[#EDF3F7]">
                  {showAccountColumn ? (
                    <td className="px-4 py-2.5 text-slate-700">{row.account_name ?? "—"}</td>
                  ) : null}
                  <td
                    className={cn(
                      "px-4 py-2.5 font-semibold text-slate-900",
                      onEntityClick && (entityClickable?.(row) ?? true) && "cursor-pointer"
                    )}
                    onClick={onEntityClick && (entityClickable?.(row) ?? true) ? () => onEntityClick(row) : undefined}
                  >
                    {renderEntity ? (
                      renderEntity(row)
                    ) : (
                      <Link href={entityHref(row.entity_id)} className="hover:underline">
                        {row.entity_label}
                      </Link>
                    )}
                  </td>
                  {actionColumn ? <td className="px-3 py-2.5">{actionColumn.render(row)}</td> : null}
                  <td className="px-2 py-2.5">
                    <RagCell rating={row.overall_rating} />
                  </td>
                  {CATEGORIES.map((category) => (
                    <td key={category.key} className="px-2 py-2.5">
                      <RagCell rating={row[category.ratingField]} circle={circleCategories} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
