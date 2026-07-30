"use client";

import * as React from "react";
import { ChartColumn, CircleCheckBig } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { MetricTile, fmt, inputClass, num, pct, ratio, useMeasures } from "./shared";

const MEASURES = [
  { key: "designed", label: "Total Test Cases Designed", hint: "Count" },
  { key: "executed", label: "# of Executed Test Cases", hint: "Count" },
  { key: "passed", label: "# of Passed Test Cases", hint: "Count" },
  { key: "automated", label: "# of Test Cases Automated", hint: "Count" },
  {
    key: "designEffort",
    label: "Effort Spent for Test Case Design",
    hint: "Person-Days",
  },
  {
    key: "execEffort",
    label: "Effort Spent for Test Execution",
    hint: "Person-Days",
  },
] as const;

export function TestingTab() {
  const { m, set } = useMeasures();

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={CircleCheckBig} title="Test Measures">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          {MEASURES.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={f.key} hint={f.hint}>
              <Input
                id={f.key}
                type="number"
                min={0}
                value={m[f.key] ?? ""}
                onChange={set(f.key)}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricTile
            label="Test Execution Coverage"
            value={fmt(pct(num(m.executed), num(m.designed)), 1)}
            unit="%"
          />
          <MetricTile
            label="Test Pass Rate"
            value={fmt(pct(num(m.passed), num(m.executed)), 1)}
            unit="%"
          />
          <MetricTile
            label="Automation Coverage"
            value={fmt(pct(num(m.automated), num(m.designed)), 1)}
            unit="%"
          />
          <MetricTile
            label="Test Design Productivity"
            value={fmt(ratio(num(m.designed), num(m.designEffort)), 1)}
            unit="Test Cases / Person-Day"
          />
          <MetricTile
            label="Test Execution Productivity"
            value={fmt(ratio(num(m.executed), num(m.execEffort)), 1)}
            unit="Test Cases / Person-Day"
          />
        </div>
      </SectionCard>
    </div>
  );
}
