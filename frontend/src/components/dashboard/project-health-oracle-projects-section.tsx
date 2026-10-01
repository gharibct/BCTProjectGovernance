"use client";

import { Database, PieChart } from "lucide-react";

import type { ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import {
  useProjectHealthOracleProjectDemography,
  useProjectHealthOracleProjectSummary,
} from "@/lib/api/project-health-lists";
import { BigStat, Card, SubStat } from "./project-health-kpi";

// Body of the Project Health dashboard's "Oracle Projects" section (the section
// header lives in project-health-dashboard.tsx): like every other widget, just
// the KPIs here, with the project list on the /project-health/oracle-projects
// page behind the card's footer link. Only rendered for roles that may see
// Oracle projects — never for Project Managers.
export function ProjectHealthOracleProjectsSection({ filters }: { filters: ProjectHealthDashboardFilters }) {
  const { data: summary } = useProjectHealthOracleProjectSummary(filters);
  const { data: demography } = useProjectHealthOracleProjectDemography(filters);
  const unmapped = summary?.unmapped_count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card
        title="Oracle Projects"
        icon={Database}
        iconClassName="text-[#1a6fc4]"
        href="/project-health/oracle-projects"
        footerLabel="View Oracle Projects"
      >
        <BigStat
          value={summary?.mapped_count ?? "—"}
          label="Onboarded to GovOne"
          valueClass="text-emerald-600"
        />
        <div className="flex flex-col gap-1">
          <SubStat
            label="Not Onboarded to GovOne"
            value={summary?.unmapped_count ?? "—"}
            valueClass={unmapped > 0 ? "text-red-600" : undefined}
          />
          <SubStat
            label="Not Mapped to Geo in Oracle"
            value={summary?.unmapped_no_geo_count ?? "—"}
            valueClass={(summary?.unmapped_no_geo_count ?? 0) > 0 ? "text-amber-600" : undefined}
          />
        </div>
      </Card>
      <Card title="Project Demography" icon={PieChart} iconClassName="text-[#1a6fc4]">
        <p className="mb-3 text-xs tracking-wide text-slate-400 uppercase">Projects by Project Type</p>
        {demography && demography.length === 0 ? (
          <p className="text-sm text-slate-400">No projects.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(demography ?? []).map((entry) => (
              <div key={entry.project_type ?? "none"} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-700">{entry.project_type ?? "Not specified"}</p>
                  {entry.description ? <p className="text-xs text-slate-400">{entry.description}</p> : null}
                </div>
                <span className="font-semibold text-slate-900">{entry.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
