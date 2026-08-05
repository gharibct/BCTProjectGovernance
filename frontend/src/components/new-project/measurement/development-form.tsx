"use client";

import { ChartColumn, Gauge } from "lucide-react";

import type {
  MetricTargetDevelopment,
  MetricTargetDevelopmentPayload,
} from "@/lib/api/metric-targets";
import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MetricTile, inputClass, num, str, type MeasuresProps } from "./shared";

export function toDevelopmentPayload(m: Record<string, string>): MetricTargetDevelopmentPayload {
  return {
    target_productivity: num(m.targetProductivity),
    target_effort_variation_pct: num(m.targetEffortVariation),
    target_schedule_performance_index: num(m.targetSpi),
    target_cost_performance_index: num(m.targetCpi),
    target_defect_leakage_pct: num(m.targetDefectLeakage),
    target_code_coverage_pct: num(m.targetCodeCoverage),
    target_test_execution_coverage_pct: num(m.targetExecCoverage),
    target_test_pass_rate_pct: num(m.targetPassRate),
  };
}

export function fromDevelopmentTarget(data: MetricTargetDevelopment | null): Record<string, string> {
  if (!data) return {};
  return {
    targetProductivity: str(data.target_productivity),
    targetEffortVariation: str(data.target_effort_variation_pct),
    targetSpi: str(data.target_schedule_performance_index),
    targetCpi: str(data.target_cost_performance_index),
    targetDefectLeakage: str(data.target_defect_leakage_pct),
    targetCodeCoverage: str(data.target_code_coverage_pct),
    targetExecCoverage: str(data.target_test_execution_coverage_pct),
    targetPassRate: str(data.target_test_pass_rate_pct),
  };
}

export function DevelopmentTab({ m, set }: MeasuresProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Development Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Productivity"
            value={m.targetProductivity ?? ""}
            onChange={set("targetProductivity")}
            unit="Size Units / Person-Hour"
          />
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
            unit="Index"
          />
          <MetricTile
            label="Defect Leakage (Int vs Ext)"
            value={m.targetDefectLeakage ?? ""}
            onChange={set("targetDefectLeakage")}
            unit="%"
          />
          <MetricTile
            label="Test Execution Coverage"
            value={m.targetExecCoverage ?? ""}
            onChange={set("targetExecCoverage")}
            unit="%"
          />
          <MetricTile
            label="Test Pass Rate"
            value={m.targetPassRate ?? ""}
            onChange={set("targetPassRate")}
            unit="%"
          />
          <MetricTile
            label="Code Coverage"
            value={m.targetCodeCoverage ?? ""}
            onChange={set("targetCodeCoverage")}
            unit="%"
          />
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} title="Size & Effort">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="Size Unit" htmlFor="size-unit">
            <NativeSelect id="size-unit" defaultValue="FP">
              {["CP", "FP", "LOC", "Other"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Overall Planned Size" htmlFor="planned-size">
            <Input
              id="planned-size"
              type="number"
              min={0}
              value={m.plannedSize ?? ""}
              onChange={set("plannedSize")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Overall Estimated Effort"
            htmlFor="estimated-effort"
            hint="Person-Hours"
          >
            <Input
              id="estimated-effort"
              type="number"
              min={0}
              value={m.estimatedEffort ?? ""}
              onChange={set("estimatedEffort")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
