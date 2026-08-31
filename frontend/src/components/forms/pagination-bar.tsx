import * as React from "react";

import { cn } from "@/lib/utils";

// Skip/limit pagination controls for portfolio-wide report grids (Project
// Health drill-down screens) — the first paginated table in the app, so
// there's no existing component to reuse; styled to match RegisterTable/
// StatusBadge's slate/blue conventions.
export function PaginationBar({
  skip,
  limit,
  total,
  onPageChange,
}: {
  skip: number;
  limit: number;
  total: number;
  onPageChange: (skip: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(skip / limit) + 1;
  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + limit, total);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm">
      <p className="text-slate-500">
        Showing <span className="font-semibold text-slate-900">{rangeStart}</span> to{" "}
        <span className="font-semibold text-slate-900">{rangeEnd}</span> of{" "}
        <span className="font-semibold text-slate-900">{total}</span> entries
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(0, skip - limit))}
          className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        {pageNumbers.map((page, i) => {
          const prev = pageNumbers[i - 1];
          const showEllipsis = prev !== undefined && page - prev > 1;
          return (
            <React.Fragment key={page}>
              {showEllipsis ? <span className="px-1.5 text-slate-400">…</span> : null}
              <button
                type="button"
                onClick={() => onPageChange((page - 1) * limit)}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-semibold",
                  page === currentPage
                    ? "border-[#1a6fc4] bg-[#1a6fc4] text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {page}
              </button>
            </React.Fragment>
          );
        })}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(skip + limit)}
          className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
