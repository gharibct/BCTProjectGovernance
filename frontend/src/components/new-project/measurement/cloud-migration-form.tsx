"use client";

import { ChartColumn } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, useMeasures } from "./shared";

export function CloudMigrationTab() {
  const { m, set } = useMeasures();

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Cloud Migration Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricTile
            label="Applications Migrated"
            value={m.targetAppsMigrated ?? ""}
            onChange={set("targetAppsMigrated")}
            unit="%"
          />
          <MetricTile
            label="Migration Success Rate"
            value={m.targetSuccessRate ?? ""}
            onChange={set("targetSuccessRate")}
            unit="%"
          />
          <MetricTile
            label="Migration Downtime"
            value={m.targetDowntime ?? ""}
            onChange={set("targetDowntime")}
            unit="Hours"
          />
        </div>
      </SectionCard>
    </div>
  );
}
