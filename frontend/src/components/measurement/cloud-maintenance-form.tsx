"use client";

import { ChartColumn, Server } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useCloudMaintenanceTarget } from "@/lib/api/metric-targets";
import {
  useCreateCloudMaintenanceMeasurement,
  useLatestCloudMaintenanceMeasurement,
  type MeasurementCloudMaintenancePayload,
  type MeasurementCloudMaintenanceRead,
} from "@/lib/api/measurement";
import { MetricTile, fmt, inputClass, num, str, useMeasurementForm } from "./shared";

function toValues(data: MeasurementCloudMaintenanceRead): Record<string, string> {
  return {
    total_uptime_hours: str(data.total_uptime_hours),
    total_scheduled_time_hours: str(data.total_scheduled_time_hours),
    application_downtime_hours: str(data.application_downtime_hours),
  };
}

function toPayload(m: Record<string, string>, periodId: string): MeasurementCloudMaintenancePayload {
  return {
    period_id: periodId,
    total_uptime_hours: m.total_uptime_hours || undefined,
    total_scheduled_time_hours: m.total_scheduled_time_hours || undefined,
    application_downtime_hours: m.application_downtime_hours || undefined,
  };
}

export function CloudMaintenanceTab({ projectId }: { projectId: string }) {
  const { data: target } = useCloudMaintenanceTarget(projectId);

  const latestQuery = useLatestCloudMaintenanceMeasurement(projectId);
  const createMutation = useCreateCloudMaintenanceMeasurement(projectId);
  const { latest, m, set, periodId, submit, isSaving, ai } = useMeasurementForm({
    projectId,
    screen: "measurement_cloud_maintenance",
    latestQuery,
    createMutation,
    toValues,
    toPayload,
  });

  return (
    <div className="flex flex-col gap-8">
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_cloud_maintenance"
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MetricTile
            label="Service Availability"
            target={str(target?.target_service_availability_pct)}
            current={fmt(num(latest?.service_availability_pct), 2)}
            unit="%"
          />
          <MetricTile
            label="Application Availability"
            target={str(target?.target_application_availability_pct)}
            current={fmt(num(latest?.application_availability_pct), 2)}
            unit="%"
          />
        </div>
      </SectionCard>

      <SectionCard icon={Server} title="Availability Measures">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="Total Uptime" htmlFor="uptime" hint="Hours">
            <Input
              id="uptime"
              type="number"
              min={0}
              value={m.total_uptime_hours ?? ""}
              onChange={set("total_uptime_hours")}
              className={inputClass}
            />
          </Field>
          <Field label="Total Scheduled Time" htmlFor="scheduled" hint="Hours">
            <Input
              id="scheduled"
              type="number"
              min={0}
              value={m.total_scheduled_time_hours ?? ""}
              onChange={set("total_scheduled_time_hours")}
              className={inputClass}
            />
          </Field>
          <Field label="Application Downtime" htmlFor="downtime" hint="Hours">
            <Input
              id="downtime"
              type="number"
              min={0}
              value={m.application_downtime_hours ?? ""}
              onChange={set("application_downtime_hours")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
