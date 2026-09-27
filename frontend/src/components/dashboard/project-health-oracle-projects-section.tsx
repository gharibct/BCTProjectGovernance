"use client";

import { Database } from "lucide-react";

import type { ProjectHealthDashboardFilters } from "@/lib/api/project-health-dashboard";
import { useProjectHealthOracleProjectSummary } from "@/lib/api/project-health-lists";
import { BigStat, Card, SubStat } from "./project-health-kpi";

// Body of the Project Health dashboard's "Oracle Projects" section (the section
// header lives in project-health-dashboard.tsx): like every other widget, just
// the KPIs here, with the project list on the /project-health/oracle-projects
// page behind the card's footer link. Only rendered for roles that may see
// Oracle projects — never for Project Managers.
export function ProjectHealthOracleProjectsSection({ filters }: { filters: ProjectHealthDashboardFilters }) {
  const { data: summary } = useProjectHealthOracleProjectSummary(filters);
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
          label="Mapped Projects"
          valueClass="text-emerald-600"
        />
        <div className="flex flex-col gap-1">
          <SubStat
            label="Not Mapped"
            value={summary?.unmapped_count ?? "—"}
            valueClass={unmapped > 0 ? "text-red-600" : undefined}
          />
          <SubStat
            label="Not Mapped · No GEO"
            value={summary?.unmapped_no_geo_count ?? "—"}
            valueClass={(summary?.unmapped_no_geo_count ?? 0) > 0 ? "text-amber-600" : undefined}
          />
        </div>
      </Card>
    </div>
  );
}
