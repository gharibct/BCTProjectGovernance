"use client";

import { ChartColumn, Gauge } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MetricTile, inputClass, useMeasures } from "./shared";

export function DevelopmentTab() {
  const { m, set } = useMeasures();

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Development Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
