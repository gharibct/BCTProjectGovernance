"use client";

import { ChartColumn } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, useMeasures } from "./shared";

const PRIORITIES = [
  { key: "p1", label: "Critical (P1)" },
  { key: "p2", label: "High (P2)" },
  { key: "p3", label: "Medium (P3)" },
  { key: "p4", label: "Low (P4)" },
] as const;

export function StaffingTab() {
  const { m, set } = useMeasures();

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Professional Staffing Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`avg-resp-${p.key}`}
              label={`Avg Response Time — ${p.label}`}
              value={m[`target-avg-resp-${p.key}`] ?? ""}
              onChange={set(`target-avg-resp-${p.key}`)}
              unit="Person-Hours / Request"
            />
          ))}
          <MetricTile
            label="Profiles Qualifying for Submission"
            value={m.targetProfilesQualifying ?? ""}
            onChange={set("targetProfilesQualifying")}
            unit="%"
          />
          <MetricTile
            label="Candidates Resulting in Joining"
            value={m.targetCandidatesJoining ?? ""}
            onChange={set("targetCandidatesJoining")}
            unit="%"
          />
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`lead-time-${p.key}`}
              label={`Lead Time — ${p.label}`}
              value={m[`target-lead-time-${p.key}`] ?? ""}
              onChange={set(`target-lead-time-${p.key}`)}
              unit="Person-Days / Onboarding"
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
