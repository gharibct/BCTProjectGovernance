"use client";

import { ChartColumn } from "lucide-react";

import type {
  MetricTargetConsulting,
  MetricTargetConsultingPayload,
} from "@/lib/api/metric-targets";
import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, num, str, type MeasuresProps } from "./shared";

export function toConsultingPayload(m: Record<string, string>): MetricTargetConsultingPayload {
  return {
    target_effort_variation_pct: num(m.targetEffortVariation),
    target_schedule_performance_index: num(m.targetSpi),
    target_cost_performance_index: num(m.targetCpi),
  };
}

export function fromConsultingTarget(data: MetricTargetConsulting | null): Record<string, string> {
  if (!data) return {};
  return {
    targetEffortVariation: str(data.target_effort_variation_pct),
    targetSpi: str(data.target_schedule_performance_index),
    targetCpi: str(data.target_cost_performance_index),
  };
}

export function ConsultingTab({ m, set }: MeasuresProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Consulting Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricTile
            label="Effort Variation"
            value={m.targetEffortVariation ?? ""}
            onChange={set("targetEffortVariation")}
            unit="%"
          />
          <MetricTile
            label="Schedule Performance Index"
            value={m.targetSpi ?? ""}
            onChange={set("targetSpi")}
            unit="Index (Actual/Planned % Complete)"
          />
          <MetricTile
            label="Cost Performance Index"
            value={m.targetCpi ?? ""}
            onChange={set("targetCpi")}
            unit="Index (Planned/Actual Cost)"
          />
        </div>
      </SectionCard>
    </div>
  );
}
