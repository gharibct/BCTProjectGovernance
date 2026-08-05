"use client";

import { ChartColumn } from "lucide-react";

import type { MetricTargetTesting, MetricTargetTestingPayload } from "@/lib/api/metric-targets";
import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, num, str, type MeasuresProps } from "./shared";

export function toTestingPayload(m: Record<string, string>): MetricTargetTestingPayload {
  return {
    target_test_execution_coverage_pct: num(m.targetExecCoverage),
    target_test_pass_rate_pct: num(m.targetPassRate),
    target_automation_coverage_pct: num(m.targetAutomationCoverage),
    target_test_design_productivity: num(m.targetDesignProductivity),
    target_test_execution_productivity: num(m.targetExecProductivity),
  };
}

export function fromTestingTarget(data: MetricTargetTesting | null): Record<string, string> {
  if (!data) return {};
  return {
    targetExecCoverage: str(data.target_test_execution_coverage_pct),
    targetPassRate: str(data.target_test_pass_rate_pct),
    targetAutomationCoverage: str(data.target_automation_coverage_pct),
    targetDesignProductivity: str(data.target_test_design_productivity),
    targetExecProductivity: str(data.target_test_execution_productivity),
  };
}

export function TestingTab({ m, set }: MeasuresProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Testing Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            label="Automation Coverage"
            value={m.targetAutomationCoverage ?? ""}
            onChange={set("targetAutomationCoverage")}
            unit="%"
          />
          <MetricTile
            label="Test Design Productivity"
            value={m.targetDesignProductivity ?? ""}
            onChange={set("targetDesignProductivity")}
            unit="Test Cases / Person-Day"
          />
          <MetricTile
            label="Test Execution Productivity"
            value={m.targetExecProductivity ?? ""}
            onChange={set("targetExecProductivity")}
            unit="Test Cases / Person-Day"
          />
        </div>
      </SectionCard>
    </div>
  );
}
