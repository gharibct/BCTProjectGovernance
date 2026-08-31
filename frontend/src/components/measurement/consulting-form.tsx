"use client";

import { ChartColumn, Gauge } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useConsultingTarget } from "@/lib/api/metric-targets";
import {
  useCreateConsultingMeasurement,
  useLatestConsultingMeasurement,
  type MeasurementConsultingPayload,
  type MeasurementConsultingRead,
} from "@/lib/api/measurement";
import { MetricTile, inputClass, num, str, useMeasurementForm } from "./shared";

const MEASURES = [
  { key: "planned_effort_as_on_date", label: "Planned Effort (As on Date)", hint: "Person-Days" },
  { key: "actual_effort_as_on_date", label: "Actual Effort (As on Date)", hint: "Person-Days" },
  { key: "planned_pct_completion", label: "Planned % of Completion (As on Date)", hint: "%" },
  { key: "actual_pct_completion", label: "Actual % of Completion (As on Date)", hint: "%" },
  { key: "planned_cost", label: "Planned Cost (As on Date)", hint: "Same currency as Project Revenue" },
  { key: "actual_cost", label: "Actual Cost (As on Date)", hint: "Same currency as Project Revenue" },
] as const;

function toValues(data: MeasurementConsultingRead): Record<string, string> {
  return {
    planned_effort_as_on_date: str(data.planned_effort_as_on_date),
    actual_effort_as_on_date: str(data.actual_effort_as_on_date),
    planned_pct_completion: str(data.planned_pct_completion),
    actual_pct_completion: str(data.actual_pct_completion),
    planned_cost: str(data.planned_cost),
    actual_cost: str(data.actual_cost),
  };
}

function toPayload(m: Record<string, string>, periodId: string): MeasurementConsultingPayload {
  return {
    period_id: periodId,
    planned_effort_as_on_date: m.planned_effort_as_on_date || undefined,
    actual_effort_as_on_date: m.actual_effort_as_on_date || undefined,
    planned_pct_completion: m.planned_pct_completion || undefined,
    actual_pct_completion: m.actual_pct_completion || undefined,
    planned_cost: m.planned_cost || undefined,
    actual_cost: m.actual_cost || undefined,
  };
}

export function ConsultingTab({ projectId }: { projectId: string }) {
  const { data: target } = useConsultingTarget(projectId);

  const latestQuery = useLatestConsultingMeasurement(projectId);
  const createMutation = useCreateConsultingMeasurement(projectId);
  const { latest, m, set, periodId, submit, isSaving, ai } = useMeasurementForm({
    projectId,
    screen: "measurement_consulting",
    latestQuery,
    createMutation,
    toValues,
    toPayload,
  });

  return (
    <div className="flex flex-col gap-8">
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_consulting"
        periodId={periodId || null}
        ai={ai}
      />
      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="rounded-xl bg-slate-50 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricTile
            label="Effort Variation"
            formula="(Actual Effort − Planned Effort) ÷ Planned Effort × 100"
            target={num(target?.target_effort_variation_pct)}
            current={num(latest?.effort_variation_pct)}
            unit="%"
            direction="lower-is-better"
            digits={1}
          />
          <MetricTile
            label="Schedule Performance Index"
            formula="Actual % Completion ÷ Planned % Completion"
            target={num(target?.target_schedule_performance_index)}
            current={num(latest?.schedule_performance_index)}
            unit="Index (Actual/Planned % Complete)"
            direction="higher-is-better"
          />
          <MetricTile
            label="Cost Performance Index"
            formula="Planned Cost ÷ Actual Cost"
            target={num(target?.target_cost_performance_index)}
            current={num(latest?.cost_performance_index)}
            unit="Index (Planned/Actual Cost)"
            direction="higher-is-better"
          />
        </div>
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} title="Effort, Schedule & Cost">
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
