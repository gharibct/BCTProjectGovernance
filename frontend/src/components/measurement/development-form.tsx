"use client";

import * as React from "react";
import {
  ChartColumn,
  CircleCheckBig,
  Gauge,
  TriangleAlert,
} from "lucide-react";

import {
  AutoBadge,
  Field,
  SectionCard,
} from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  MetricTile,
  fmt,
  inputClass,
  num,
  pct,
  useMeasures,
} from "./shared";

// SDLC stages with paired Internal/External defect counts; UAT and
// Production capture External only (per the Measurement sheet).
const DEFECT_STAGES = [
  "URD",
  "Proto",
  "SRS",
  "ADD",
  "HLD",
  "USP / LLD",
  "Code",
  "UTC",
  "SITC",
  "UT",
  "SIT",
] as const;
const EXTERNAL_ONLY_STAGES = ["UAT", "Production"] as const;

export function DevelopmentTab() {
  const { m, set } = useMeasures();
  const [defects, setDefects] = React.useState<Record<string, string>>({});

  const setDefect =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDefects((prev) => ({ ...prev, [key]: e.target.value }));

  const today = new Date().toISOString().slice(0, 10);

  const internalTotal = DEFECT_STAGES.reduce(
    (sum, s) => sum + (num(defects[`${s}-int`]) ?? 0),
    0
  );
  const externalTotal =
    DEFECT_STAGES.reduce((sum, s) => sum + (num(defects[`${s}-ext`]) ?? 0), 0) +
    EXTERNAL_ONLY_STAGES.reduce(
      (sum, s) => sum + (num(defects[`${s}-ext`]) ?? 0),
      0
    );

  const actualSize = num(m.actualSize);
  const actualEffort = num(m.actualEffort);
  const plannedEffort = num(m.plannedEffort);
  const estimatedEffort = num(m.estimatedEffort);
  const plannedPct = num(m.plannedPct);
  const actualPct = num(m.actualPct);

  const productivity =
    actualSize !== null && actualEffort !== null && actualEffort > 0
      ? actualSize / (actualEffort / 8)
      : null;
  const effortVariation =
    actualEffort !== null && plannedEffort !== null && plannedEffort > 0
      ? ((actualEffort - plannedEffort) / plannedEffort) * 100
      : null;
  const spi =
    actualPct !== null && plannedPct !== null && plannedPct > 0
      ? actualPct / plannedPct
      : null;
  const cpi =
    actualPct !== null &&
    estimatedEffort !== null &&
    actualEffort !== null &&
    actualEffort > 0
      ? ((actualPct / 100) * estimatedEffort) / actualEffort
      : null;
  const defectLeakage =
    internalTotal + externalTotal > 0
      ? (externalTotal / (internalTotal + externalTotal)) * 100
      : null;
  const execCoverage = pct(num(m.executed), num(m.designed));
  const passRate = pct(num(m.passed), num(m.executed));

  const defectCell = (key: string, disabled = false) =>
    disabled ? (
      <span className="text-slate-300">—</span>
    ) : (
      <Input
        type="number"
        min={0}
        value={defects[key] ?? ""}
        onChange={setDefect(key)}
        aria-label={key}
        className="h-9 w-24 text-right tabular-nums"
      />
    );

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={Gauge}
        title="Size & Effort"
        aside={
          <Field label="Last Updated Date" htmlFor="last-updated">
            <Input
              id="last-updated"
              type="date"
              defaultValue={today}
              className="h-10 w-44"
            />
          </Field>
        }
      >
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
          <Field label="Actual Size (End of Project)" htmlFor="actual-size">
            <Input
              id="actual-size"
              type="number"
              min={0}
              value={m.actualSize ?? ""}
              onChange={set("actualSize")}
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
          <Field
            label="Planned Effort (As on Date)"
            htmlFor="planned-effort"
            hint="Person-Hours"
          >
            <Input
              id="planned-effort"
              type="number"
              min={0}
              value={m.plannedEffort ?? ""}
              onChange={set("plannedEffort")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Actual Effort (As on Date)"
            htmlFor="actual-effort"
            hint="Person-Hours"
          >
            <Input
              id="actual-effort"
              type="number"
              min={0}
              value={m.actualEffort ?? ""}
              onChange={set("actualEffort")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Planned % of Completion (As on Date)"
            htmlFor="planned-pct"
          >
            <Input
              id="planned-pct"
              type="number"
              min={0}
              max={100}
              value={m.plannedPct ?? ""}
              onChange={set("plannedPct")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Actual % of Completion (As on Date)"
            htmlFor="actual-pct"
          >
            <Input
              id="actual-pct"
              type="number"
              min={0}
              max={100}
              value={m.actualPct ?? ""}
              onChange={set("actualPct")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={TriangleAlert} title="Defects by SDLC Stage">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Internal</th>
                <th className="px-4 py-3 text-right">External</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DEFECT_STAGES.map((stage) => (
                <tr key={stage}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {stage} Defects
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {defectCell(`${stage}-int`)}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {defectCell(`${stage}-ext`)}
                    </div>
                  </td>
                </tr>
              ))}
              {EXTERNAL_ONLY_STAGES.map((stage) => (
                <tr key={stage}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {stage} Defects
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {defectCell(`${stage}-int`, true)}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {defectCell(`${stage}-ext`)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-bold text-slate-800">
                <td className="px-4 py-3">
                  Total
                  <span className="ml-2 align-middle">
                    <AutoBadge />
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {internalTotal}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {externalTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={CircleCheckBig} title="Test Cases & Quality">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Total Test Cases Designed" htmlFor="designed">
            <Input
              id="designed"
              type="number"
              min={0}
              value={m.designed ?? ""}
              onChange={set("designed")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Executed Test Cases" htmlFor="executed">
            <Input
              id="executed"
              type="number"
              min={0}
              value={m.executed ?? ""}
              onChange={set("executed")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Passed Test Cases" htmlFor="passed">
            <Input
              id="passed"
              type="number"
              min={0}
              value={m.passed ?? ""}
              onChange={set("passed")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Code Coverage (Tool Based)"
            htmlFor="code-coverage"
            hint="% — optional"
          >
            <Input
              id="code-coverage"
              type="number"
              min={0}
              max={100}
              value={m.codeCoverage ?? ""}
              onChange={set("codeCoverage")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Productivity"
            value={fmt(productivity)}
            unit="Size / Person-Day"
          />
          <MetricTile
            label="Effort Variation"
            value={fmt(effortVariation, 1)}
            unit="%"
          />
          <MetricTile
            label="Schedule Performance Index"
            value={fmt(spi)}
            unit=""
          />
          <MetricTile label="Cost Performance Index" value={fmt(cpi)} unit="" />
          <MetricTile
            label="Defect Leakage (Int vs Ext)"
            value={fmt(defectLeakage, 1)}
            unit="%"
          />
          <MetricTile
            label="Test Execution Coverage"
            value={fmt(execCoverage, 1)}
            unit="%"
          />
          <MetricTile label="Test Pass Rate" value={fmt(passRate, 1)} unit="%" />
          <MetricTile
            label="Code Coverage"
            value={num(m.codeCoverage) === null ? "—" : m.codeCoverage}
            unit="%"
            note="Tool Based"
          />
        </div>
      </SectionCard>
    </div>
  );
}
