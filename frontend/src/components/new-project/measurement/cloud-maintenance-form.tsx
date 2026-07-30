"use client";

import { ChartColumn } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, useMeasures } from "./shared";

export function CloudMaintenanceTab() {
  const { m, set } = useMeasures();

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
