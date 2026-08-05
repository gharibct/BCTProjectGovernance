"use client";

import { ChartColumn } from "lucide-react";

import type {
  MetricTargetStaffing,
  MetricTargetStaffingPayload,
  StaffingPriorityCode,
} from "@/lib/api/metric-targets";
import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, num, str, type MeasuresProps } from "./shared";

const PRIORITIES = [
  { key: "p1", label: "Critical (P1)", code: "Critical" },
  { key: "p2", label: "High (P2)", code: "High" },
  { key: "p3", label: "Medium (P3)", code: "Medium" },
  { key: "p4", label: "Low (P4)", code: "Low" },
] as const satisfies { key: string; label: string; code: StaffingPriorityCode }[];

export function toStaffingPayload(m: Record<string, string>): MetricTargetStaffingPayload {
  return {
    target_pct_profiles_qualifying: num(m.targetProfilesQualifying),
    target_pct_candidates_joining: num(m.targetCandidatesJoining),
    priority_targets: PRIORITIES.map((p) => ({
      priority: p.code,
      target_avg_response_time_hours: num(m[`target-avg-resp-${p.key}`]),
      target_avg_lead_time_days: num(m[`target-lead-time-${p.key}`]),
    })),
  };
}

export function fromStaffingTarget(data: MetricTargetStaffing | null): Record<string, string> {
  if (!data) return {};
  const seed: Record<string, string> = {
    targetProfilesQualifying: str(data.target_pct_profiles_qualifying),
    targetCandidatesJoining: str(data.target_pct_candidates_joining),
  };
  for (const p of PRIORITIES) {
    const row = data.priority_targets.find((r) => r.priority === p.code);
    seed[`target-avg-resp-${p.key}`] = str(row?.target_avg_response_time_hours);
    seed[`target-lead-time-${p.key}`] = str(row?.target_avg_lead_time_days);
  }
  return seed;
}

export function StaffingTab({ m, set }: MeasuresProps) {
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
