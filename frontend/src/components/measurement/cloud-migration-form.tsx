"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ChartColumn, CloudUpload } from "lucide-react";

import { ButtonSpinner, Field, MandatoryBadge, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useAiReview } from "@/components/ai/use-ai-review";
import { useCloudMigrationTarget } from "@/lib/api/metric-targets";
import {
  useCreateCloudMigrationMeasurement,
  useLatestCloudMigrationMeasurement,
} from "@/lib/api/measurement";
import { MetricTile, fmt, inputClass, num, str, useMeasures } from "./shared";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CloudMigrationTab({ projectId }: { projectId: string }) {
  const { data: target } = useCloudMigrationTarget(projectId);
  const { data: latest } = useLatestCloudMigrationMeasurement(projectId);
  const createMutation = useCreateCloudMigrationMeasurement(projectId);

  const { m, set: rawSet, setValue, setAll } = useMeasures();
  const [asOfDate, setAsOfDate] = React.useState(today);
  const [syncedFor, setSyncedFor] = React.useState<string | null>(null);

  const key = latest ? latest.id : latest === null ? "none" : null;
  if (key !== null && key !== syncedFor) {
    setSyncedFor(key);
    if (latest) {
      setAll({
        planned_application_migration_count: str(latest.planned_application_migration_count),
        applications_migrated_count: str(latest.applications_migrated_count),
        total_migration_attempts: str(latest.total_migration_attempts),
        successful_migrations: str(latest.successful_migrations),
        migration_start_time: latest.migration_start_time?.slice(0, 16) ?? "",
        migration_end_time: latest.migration_end_time?.slice(0, 16) ?? "",
      });
      setAsOfDate(latest.as_of_date);
    }
  }

  // Cloud Migration has no period_id of its own (uses as_of_date instead —
  // see 16_measurement_cloud_migration.sql), so the ambient ?period= from
  // the Reporting Hub is used purely as the AI-suggestion dimension.
  const periodId = useSearchParams().get("period");
  const ai = useAiReview(projectId, "measurement_cloud_migration", periodId);
  const appliedSignatures = React.useRef<Map<string, string>>(new Map());
  React.useEffect(() => {
    for (const suggestion of ai.pendingFields) {
      const signature = `${suggestion.id}:${suggestion.value ?? ""}`;
      if (appliedSignatures.current.get(suggestion.field_key) !== signature) {
        appliedSignatures.current.set(suggestion.field_key, signature);
        ai.notePreviousValue(suggestion.field_key, m[suggestion.field_key]);
        setValue(suggestion.field_key, suggestion.value ?? "");
      }
    }
  }, [ai, m, setValue]);
  const set = (fieldKey: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    rawSet(fieldKey)(e);
    ai.noteManualEdit(fieldKey);
  };
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const submit = () => {
    if (!projectId || !asOfDate) return;
    createMutation.mutate(
      {
        as_of_date: asOfDate,
        planned_application_migration_count: m.planned_application_migration_count || undefined,
        applications_migrated_count: m.applications_migrated_count || undefined,
        total_migration_attempts: m.total_migration_attempts || undefined,
        successful_migrations: m.successful_migrations || undefined,
        migration_start_time: m.migration_start_time || undefined,
        migration_end_time: m.migration_end_time || undefined,
      },
      {
        onSuccess: () => {
          ai.resolveAll();
          showSuccess("Measurement Saved Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to save measurement."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_cloud_migration"
        periodId={periodId}
        ai={ai}
      />
      <SectionCard
        icon={ChartColumn}
        title="Metrics"
        aside={
          <Field label="As Of Date" htmlFor="as-of-date" badge={<MandatoryBadge />}>
            <Input
              id="as-of-date"
              type="date"
              className="h-10 w-44"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </Field>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricTile
            label="Applications Migrated (Planned vs Actual)"
            target={str(target?.target_applications_migrated_pct)}
            current={fmt(num(latest?.applications_migrated_pct), 1)}
            unit="%"
          />
          <MetricTile
            label="Migration Success Rate"
            target={str(target?.target_migration_success_rate_pct)}
            current={fmt(num(latest?.migration_success_rate_pct), 1)}
            unit="%"
          />
          <MetricTile
            label="Migration Downtime"
            target={str(target?.target_migration_downtime_minutes)}
            current={fmt(num(latest?.migration_downtime_minutes), 1)}
            unit="Minutes"
          />
        </div>
      </SectionCard>

      <SectionCard icon={CloudUpload} title="Migration Measures">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Planned Application Migration" htmlFor="planned" hint="Count">
            <Input
              id="planned"
              type="number"
              min={0}
              value={m.planned_application_migration_count ?? ""}
              onChange={set("planned_application_migration_count")}
              className={inputClass}
            />
          </Field>
          <Field label="Applications Migrated" htmlFor="migrated" hint="Count">
            <Input
              id="migrated"
              type="number"
              min={0}
              value={m.applications_migrated_count ?? ""}
              onChange={set("applications_migrated_count")}
              className={inputClass}
            />
          </Field>
          <Field label="Total Migration Attempts" htmlFor="attempts" hint="Count">
            <Input
              id="attempts"
              type="number"
              min={0}
              value={m.total_migration_attempts ?? ""}
              onChange={set("total_migration_attempts")}
              className={inputClass}
            />
          </Field>
          <Field label="Successful Migrations" htmlFor="successful" hint="Count">
            <Input
              id="successful"
              type="number"
              min={0}
              value={m.successful_migrations ?? ""}
              onChange={set("successful_migrations")}
              className={inputClass}
            />
          </Field>
          <Field label="Migration Start Time" htmlFor="start">
            <Input
              id="start"
              type="datetime-local"
              value={m.migration_start_time ?? ""}
              onChange={set("migration_start_time")}
              className={inputClass}
            />
          </Field>
          <Field label="Migration End Time" htmlFor="end">
            <Input
              id="end"
              type="datetime-local"
              value={m.migration_end_time ?? ""}
              onChange={set("migration_end_time")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={!asOfDate || createMutation.isPending}
          className="h-10 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {createMutation.isPending ? <ButtonSpinner /> : null}
          Save Measurements
        </Button>
      </div>
    </div>
  );
}
