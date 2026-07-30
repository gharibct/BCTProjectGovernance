"use client";

import { ChartColumn } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, useMeasures } from "./shared";

export function TestingTab() {
  const { m, set } = useMeasures();

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
