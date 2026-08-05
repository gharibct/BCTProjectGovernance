"use client";

import { ChartColumn } from "lucide-react";

import type {
  MetricTargetCloudMaintenance,
  MetricTargetCloudMaintenancePayload,
} from "@/lib/api/metric-targets";
import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, num, str, type MeasuresProps } from "./shared";

export function toCloudMaintenancePayload(m: Record<string, string>): MetricTargetCloudMaintenancePayload {
  return {
    target_service_availability_pct: num(m.targetServiceAvailability),
    target_application_availability_pct: num(m.targetAppAvailability),
  };
}

export function fromCloudMaintenanceTarget(data: MetricTargetCloudMaintenance | null): Record<string, string> {
  if (!data) return {};
  return {
    targetServiceAvailability: str(data.target_service_availability_pct),
    targetAppAvailability: str(data.target_application_availability_pct),
  };
}

export function CloudMaintenanceTab({ m, set }: MeasuresProps) {
  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Cloud Maintenance Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MetricTile
            label="Service Availability"
            value={m.targetServiceAvailability ?? ""}
            onChange={set("targetServiceAvailability")}
            unit="%"
          />
          <MetricTile
            label="Application Availability"
            value={m.targetAppAvailability ?? ""}
            onChange={set("targetAppAvailability")}
            unit="%"
          />
        </div>
      </SectionCard>
    </div>
  );
}
