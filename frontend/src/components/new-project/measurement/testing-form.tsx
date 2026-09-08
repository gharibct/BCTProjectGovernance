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

export function TestingTab({ m, set, reference, errors }: MeasuresProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Testing Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricTile
            label="Test Execution Coverage"
            metricKey="test_execution_coverage_pct"
            reference={reference}
            value={m.targetExecCoverage ?? ""}
            onChange={set("targetExecCoverage")}
            error={errors?.targetExecCoverage}
            unit="%"
          />
          <MetricTile
            label="Test Pass Rate"
            metricKey="test_pass_rate_pct"
            reference={reference}
            value={m.targetPassRate ?? ""}
            onChange={set("targetPassRate")}
            error={errors?.targetPassRate}
            unit="%"
          />
          <MetricTile
            label="Automation Coverage"
            metricKey="automation_coverage_pct"
            reference={reference}
            value={m.targetAutomationCoverage ?? ""}
            onChange={set("targetAutomationCoverage")}
            error={errors?.targetAutomationCoverage}
            unit="%"
          />
          <MetricTile
            label="Test Design Productivity"
            metricKey="test_design_productivity"
            reference={reference}
            value={m.targetDesignProductivity ?? ""}
            onChange={set("targetDesignProductivity")}
            error={errors?.targetDesignProductivity}
            unit="Test Cases / Person-Day"
          />
          <MetricTile
            label="Test Execution Productivity"
            metricKey="test_execution_productivity"
            reference={reference}
            value={m.targetExecProductivity ?? ""}
            onChange={set("targetExecProductivity")}
            error={errors?.targetExecProductivity}
            unit="Test Cases / Person-Day"
          />
        </div>
      </SectionCard>
    </div>
  );
}
