"use client";

import { ChartColumn } from "lucide-react";

import type {
  MetricTargetCloudMigration,
  MetricTargetCloudMigrationPayload,
} from "@/lib/api/metric-targets";
import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, num, str, type MeasuresProps } from "./shared";

export function toCloudMigrationPayload(m: Record<string, string>): MetricTargetCloudMigrationPayload {
  return {
    target_applications_migrated_pct: num(m.targetAppsMigrated),
    target_migration_success_rate_pct: num(m.targetSuccessRate),
    target_migration_downtime_hours: num(m.targetDowntime),
  };
}

export function fromCloudMigrationTarget(data: MetricTargetCloudMigration | null): Record<string, string> {
  if (!data) return {};
  return {
    targetAppsMigrated: str(data.target_applications_migrated_pct),
    targetSuccessRate: str(data.target_migration_success_rate_pct),
    targetDowntime: str(data.target_migration_downtime_hours),
  };
}

export function CloudMigrationTab({ m, set }: MeasuresProps) {
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
