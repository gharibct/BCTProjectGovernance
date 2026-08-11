"use client";

import {
  ChartColumn,
  CircleCheckBig,
  Gauge,
  TriangleAlert,
} from "lucide-react";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  SectionCard,
} from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { fromDevelopmentTarget } from "@/components/new-project/measurement/development-form";
import { useDevelopmentTarget } from "@/lib/api/metric-targets";
import {
  useCreateDevelopmentMeasurement,
  useLatestDevelopmentMeasurement,
  type MeasurementDevelopmentPayload,
  type MeasurementDevelopmentRead,
  type SdlcStage,
} from "@/lib/api/measurement";
import {
  MetricTile,
  fmt,
  inputClass,
  num,
  str,
  useMeasurementForm,
} from "./shared";

// SDLC stages with paired Internal/External defect counts (see backend
// SdlcStage enum); UAT and Production capture External only, and are their
// own flat fields on the measurement record rather than stage rows.
const DEFECT_STAGES: SdlcStage[] = ["URD", "Proto", "SRS", "ADD", "HLD", "USP/LLD", "Code", "UTC", "SITC", "UT", "SIT"];

function toValues(data: MeasurementDevelopmentRead): Record<string, string> {
  const values: Record<string, string> = {
    overall_planned_size: str(data.overall_planned_size),
    actual_size: str(data.actual_size),
    overall_estimated_effort: str(data.overall_estimated_effort),
    planned_effort_as_on_date: str(data.planned_effort_as_on_date),
    actual_effort_as_on_date: str(data.actual_effort_as_on_date),
    planned_pct_completion: str(data.planned_pct_completion),
    actual_pct_completion: str(data.actual_pct_completion),
    uat_defects_external: str(data.uat_defects_external),
    production_defects_external: str(data.production_defects_external),
    total_test_cases_designed: str(data.total_test_cases_designed),
    executed_test_cases: str(data.executed_test_cases),
    passed_test_cases: str(data.passed_test_cases),
  };
  for (const d of data.defects_by_stage) {
    values[`defect_${d.sdlc_stage}_int`] = str(d.internal_defects);
    values[`defect_${d.sdlc_stage}_ext`] = str(d.external_defects);
  }
  return values;
}

function toPayload(m: Record<string, string>, periodId: string): MeasurementDevelopmentPayload {
  return {
    period_id: periodId,
    overall_planned_size: m.overall_planned_size || undefined,
    actual_size: m.actual_size || undefined,
    overall_estimated_effort: m.overall_estimated_effort || undefined,
    planned_effort_as_on_date: m.planned_effort_as_on_date || undefined,
    actual_effort_as_on_date: m.actual_effort_as_on_date || undefined,
    planned_pct_completion: m.planned_pct_completion || undefined,
    actual_pct_completion: m.actual_pct_completion || undefined,
    uat_defects_external: m.uat_defects_external || undefined,
    production_defects_external: m.production_defects_external || undefined,
    total_test_cases_designed: m.total_test_cases_designed || undefined,
    executed_test_cases: m.executed_test_cases || undefined,
    passed_test_cases: m.passed_test_cases || undefined,
    defects_by_stage: DEFECT_STAGES.map((stage) => ({
      sdlc_stage: stage,
      internal_defects: Number(m[`defect_${stage}_int`] || 0),
      external_defects: Number(m[`defect_${stage}_ext`] || 0),
    })),
  };
}

export function DevelopmentTab({ projectId }: { projectId: string }) {
  const { data: targetData } = useDevelopmentTarget(projectId);
  const target = targetData ? fromDevelopmentTarget(targetData) : ({} as Record<string, string>);

  const latestQuery = useLatestDevelopmentMeasurement(projectId);
  const createMutation = useCreateDevelopmentMeasurement(projectId);
  const { latest, m, set, periodId, submit, isSaving, ai } = useMeasurementForm({
    projectId,
    screen: "measurement_development",
    latestQuery,
    createMutation,
    toValues,
    toPayload,
  });

  const defectCell = (key: string) => (
    <Input
      type="number"
      min={0}
      value={m[key] ?? ""}
      onChange={set(key)}
      aria-label={key}
      className="h-9 w-24 text-right tabular-nums"
    />
  );

  const internalTotal = DEFECT_STAGES.reduce((sum, s) => sum + (num(m[`defect_${s}_int`]) ?? 0), 0);
  const externalTotal =
    DEFECT_STAGES.reduce((sum, s) => sum + (num(m[`defect_${s}_ext`]) ?? 0), 0) +
    (num(m.uat_defects_external) ?? 0) +
    (num(m.production_defects_external) ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_development"
        periodId={periodId || null}
        ai={ai}
      />
      <SectionCard
        icon={ChartColumn}
        title="Metrics"
        aside={
          <div className="flex items-end gap-4">
            <Button
              onClick={submit}
              disabled={!periodId || isSaving}
              className="h-10 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
            >
              {isSaving ? <ButtonSpinner /> : null}
              Save Measurements
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Productivity"
            target={target.targetProductivity ?? ""}
            current={fmt(num(latest?.productivity))}
            unit="Size Units / Person-Hour"
          />
          <MetricTile
            label="Effort Variation"
            target={target.targetEffortVariation ?? ""}
            current={fmt(num(latest?.effort_variation_pct), 1)}
            unit="%"
          />
          <MetricTile
            label="Schedule Performance Index"
            target={target.targetSpi ?? ""}
            current={fmt(num(latest?.schedule_performance_index))}
            unit="Index (Actual/Planned % Complete)"
          />
          <MetricTile
            label="Cost Performance Index"
            target={target.targetCpi ?? ""}
            current={fmt(num(latest?.cost_performance_index))}
            unit="Index"
          />
          <MetricTile
            label="Defect Leakage (Int vs Ext)"
            target={target.targetDefectLeakage ?? ""}
            current={fmt(num(latest?.defect_leakage_pct), 1)}
            unit="%"
          />
          <MetricTile
            label="Test Execution Coverage"
            target={target.targetExecCoverage ?? ""}
            current={fmt(num(latest?.test_execution_coverage_pct), 1)}
            unit="%"
          />
          <MetricTile
            label="Test Pass Rate"
            target={target.targetPassRate ?? ""}
            current={fmt(num(latest?.test_pass_rate_pct), 1)}
            unit="%"
          />
          <MetricTile
            label="Code Coverage"
            target={target.targetCodeCoverage ?? ""}
            current={fmt(num(latest?.code_coverage_pct), 1)}
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
              value={m.overall_planned_size ?? ""}
              onChange={set("overall_planned_size")}
              className={inputClass}
            />
          </Field>
          <Field label="Actual Size (End of Project)" htmlFor="actual-size">
            <Input
              id="actual-size"
              type="number"
              min={0}
              value={m.actual_size ?? ""}
              onChange={set("actual_size")}
              className={inputClass}
            />
          </Field>
          <Field label="Overall Estimated Effort" htmlFor="estimated-effort" hint="Person-Hours">
            <Input
              id="estimated-effort"
              type="number"
              min={0}
              value={m.overall_estimated_effort ?? ""}
              onChange={set("overall_estimated_effort")}
              className={inputClass}
            />
          </Field>
          <Field label="Planned Effort (As on Date)" htmlFor="planned-effort" hint="Person-Hours">
            <Input
              id="planned-effort"
              type="number"
              min={0}
              value={m.planned_effort_as_on_date ?? ""}
              onChange={set("planned_effort_as_on_date")}
              className={inputClass}
            />
          </Field>
          <Field label="Actual Effort (As on Date)" htmlFor="actual-effort" hint="Person-Hours">
            <Input
              id="actual-effort"
              type="number"
              min={0}
              value={m.actual_effort_as_on_date ?? ""}
              onChange={set("actual_effort_as_on_date")}
              className={inputClass}
            />
          </Field>
          <Field label="Planned % of Completion (As on Date)" htmlFor="planned-pct">
            <Input
              id="planned-pct"
              type="number"
              min={0}
              max={100}
              value={m.planned_pct_completion ?? ""}
              onChange={set("planned_pct_completion")}
              className={inputClass}
            />
          </Field>
          <Field label="Actual % of Completion (As on Date)" htmlFor="actual-pct">
            <Input
              id="actual-pct"
              type="number"
              min={0}
              max={100}
              value={m.actual_pct_completion ?? ""}
              onChange={set("actual_pct_completion")}
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
                  <td className="px-4 py-2 font-medium text-slate-800">{stage} Defects</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">{defectCell(`defect_${stage}_int`)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">{defectCell(`defect_${stage}_ext`)}</div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2 font-medium text-slate-800">UAT Defects</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <span className="text-slate-300">—</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">{defectCell("uat_defects_external")}</div>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-slate-800">Production Defects</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <span className="text-slate-300">—</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">{defectCell("production_defects_external")}</div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-bold text-slate-800">
                <td className="px-4 py-3">
                  Total
                  <span className="ml-2 align-middle">
                    <AutoBadge />
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{internalTotal}</td>
                <td className="px-4 py-3 text-right tabular-nums">{externalTotal}</td>
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
              value={m.total_test_cases_designed ?? ""}
              onChange={set("total_test_cases_designed")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Executed Test Cases" htmlFor="executed">
            <Input
              id="executed"
              type="number"
              min={0}
              value={m.executed_test_cases ?? ""}
              onChange={set("executed_test_cases")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Passed Test Cases" htmlFor="passed">
            <Input
              id="passed"
              type="number"
              min={0}
              value={m.passed_test_cases ?? ""}
              onChange={set("passed_test_cases")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
