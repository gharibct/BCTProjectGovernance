"use client";

import { Suspense, type ChangeEvent } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { PerformanceDashboardBody } from "@/components/project-dashboard/project-performance-dashboard-view";
import { useProjects } from "@/lib/api/projects";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { useStatusReports } from "@/lib/api/project-status";

// Account Manager's read-only counterpart to the PM's own monthly Project
// Dashboard — same Measurements/Commitments/Payment Milestones/RAIDO summary
// and completion checklist, no Submit Report or "Reviewed and No Changes"
// controls. Modeled on status-review-page.tsx's header + period-combo
// layout, filtered to Monthly periods only (there is no weekly Project
// Performance Report).
function PeriodAwareBody({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: projects = [] } = useProjects();
  const name = projects.find((p) => p.id === projectId)?.project_code ?? "Project Performance Dashboard";

  const { data: periods = [] } = useReportingPeriods();
  const { data: reports = [] } = useStatusReports(projectId);
  // Reports are ordered by the period's start_date desc, so the first
  // Monthly one is the latest.
  const monthlyReports = reports.filter(
    (r) => periods.find((p) => p.id === r.period_id)?.period_type === "Monthly"
  );

  const urlPeriodId = searchParams.get("period");
  const periodId = urlPeriodId ?? monthlyReports[0]?.period_id ?? null;
  const period = periods.find((p) => p.id === periodId);

  const onPeriodChange = (e: ChangeEvent<HTMLSelectElement>) => {
    router.replace(`${pathname}?period=${e.target.value}`);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-[#1a6fc4]">Project Performance Dashboard</span>
          {period ? (
            <>
              <ChevronRight className="size-4 text-slate-400" />
              <span className="font-semibold text-slate-600">{period.label}</span>
            </>
          ) : null}
        </nav>
        <div className="mt-4 flex items-center gap-4">
          <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight text-slate-900">{name}</h1>
          {monthlyReports.length > 0 ? (
            <div className="w-64 shrink-0">
              <NativeSelect
                value={periodId ?? ""}
                onChange={onPeriodChange}
                chevronClassName="text-[#1a6fc4]"
                className="h-11 rounded-full border-2 border-[#1a6fc4] bg-blue-50 pl-4 pr-10 text-sm font-bold text-[#15406b] shadow-sm transition-colors hover:bg-blue-100"
              >
                {monthlyReports.map((r) => {
                  const p = periods.find((pd) => pd.id === r.period_id);
                  return (
                    <option key={r.id} value={r.period_id}>
                      {p?.label ?? r.period_id}
                    </option>
                  );
                })}
              </NativeSelect>
            </div>
          ) : null}
        </div>
      </div>

      {!periodId ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-400">
          No monthly reports submitted yet.
        </p>
      ) : (
        <PerformanceDashboardBody projectId={projectId} periodId={periodId} readOnly />
      )}
    </div>
  );
}

export function ProjectPerformancePage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    // useSearchParams (for the selected reporting period) requires a
    // Suspense boundary at prerender.
    <Suspense fallback={null}>
      <PeriodAwareBody projectId={projectId} />
    </Suspense>
  );
}
