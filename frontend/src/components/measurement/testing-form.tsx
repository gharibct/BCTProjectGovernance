"use client";

import { ChartColumn, CircleCheckBig } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useTestingTarget } from "@/lib/api/metric-targets";
import {
  useCreateTestingMeasurement,
  useLatestTestingMeasurement,
  type MeasurementTestingPayload,
  type MeasurementTestingRead,
} from "@/lib/api/measurement";
import { MetricTile, inputClass, num, str, useMeasurementForm } from "./shared";

const MEASURES = [
  { key: "total_test_cases_designed", label: "Total Test Cases Designed", hint: "Count" },
  { key: "executed_test_cases", label: "# of Executed Test Cases", hint: "Count" },
  { key: "passed_test_cases", label: "# of Passed Test Cases", hint: "Count" },
  { key: "automated_test_cases", label: "# of Test Cases Automated", hint: "Count" },
  { key: "effort_test_case_design", label: "Effort Spent for Test Case Design", hint: "Person-Days" },
  { key: "effort_test_execution", label: "Effort Spent for Test Execution", hint: "Person-Days" },
] as const;

function toValues(data: MeasurementTestingRead): Record<string, string> {
  return {
    total_test_cases_designed: str(data.total_test_cases_designed),
    executed_test_cases: str(data.executed_test_cases),
    passed_test_cases: str(data.passed_test_cases),
    automated_test_cases: str(data.automated_test_cases),
    effort_test_case_design: str(data.effort_test_case_design),
    effort_test_execution: str(data.effort_test_execution),
  };
}

function toPayload(m: Record<string, string>, periodId: string): MeasurementTestingPayload {
  return {
    period_id: periodId,
    total_test_cases_designed: m.total_test_cases_designed || undefined,
    executed_test_cases: m.executed_test_cases || undefined,
    passed_test_cases: m.passed_test_cases || undefined,
    automated_test_cases: m.automated_test_cases || undefined,
    effort_test_case_design: m.effort_test_case_design || undefined,
    effort_test_execution: m.effort_test_execution || undefined,
  };
}

export function TestingTab({ projectId }: { projectId: string }) {
  const { data: target } = useTestingTarget(projectId);

  const latestQuery = useLatestTestingMeasurement(projectId);
  const createMutation = useCreateTestingMeasurement(projectId);
  const { latest, m, set, periodId, submit, isSaving, ai } = useMeasurementForm({
    projectId,
    screen: "measurement_testing",
    latestQuery,
    createMutation,
    toValues,
    toPayload,
  });

  return (
    <div className="flex flex-col gap-8">
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_testing"
        periodId={periodId || null}
        ai={ai}
      />
      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="rounded-xl bg-slate-50 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricTile
            label="Test Execution Coverage"
            formula="# Executed Test Cases ÷ Total Test Cases Designed × 100"
            target={num(target?.target_test_execution_coverage_pct)}
            current={num(latest?.test_execution_coverage_pct)}
            unit="%"
            direction="higher-is-better"
            digits={1}
          />
          <MetricTile
            label="Test Pass Rate"
            formula="# Passed Test Cases ÷ # Executed Test Cases × 100"
            target={num(target?.target_test_pass_rate_pct)}
            current={num(latest?.test_pass_rate_pct)}
            unit="%"
            direction="higher-is-better"
            digits={1}
          />
          <MetricTile
            label="Automation Coverage"
            formula="# Automated Test Cases ÷ Total Test Cases Designed × 100"
            target={num(target?.target_automation_coverage_pct)}
            current={num(latest?.automation_coverage_pct)}
            unit="%"
            direction="higher-is-better"
            digits={1}
          />
          <MetricTile
            label="Test Design Productivity"
            formula="Total Test Cases Designed ÷ Effort for Test Case Design"
            target={num(target?.target_test_design_productivity)}
            current={num(latest?.test_design_productivity)}
            unit="Test Cases / Person-Day"
            direction="higher-is-better"
            digits={1}
          />
          <MetricTile
            label="Test Execution Productivity"
            formula="# Executed Test Cases ÷ Effort for Test Execution"
            target={num(target?.target_test_execution_productivity)}
            current={num(latest?.test_execution_productivity)}
            unit="Test Cases / Person-Day"
            direction="higher-is-better"
            digits={1}
          />
        </div>
        </div>
      </SectionCard>

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

      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={!periodId || isSaving}
          className="h-10 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {isSaving ? <ButtonSpinner /> : null}
          Save Measurements
        </Button>
      </div>
    </div>
  );
}
