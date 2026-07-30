"use client";

import * as React from "react";
import { ChartColumn, CloudUpload } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { MetricTile, fmt, inputClass, num, pct, useMeasures } from "./shared";

export function CloudMigrationTab() {
  const { m, set } = useMeasures();

  // Migration Downtime = End − Start, in hours.
  const start = m.start ? new Date(m.start).getTime() : NaN;
  const end = m.end ? new Date(m.end).getTime() : NaN;
  const downtimeHours =
    Number.isFinite(start) && Number.isFinite(end) && end >= start
      ? (end - start) / 3_600_000
      : null;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={CloudUpload} title="Migration Measures">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field
            label="Planned Application Migration"
            htmlFor="planned"
            hint="Count"
          >
            <Input
              id="planned"
              type="number"
              min={0}
              value={m.planned ?? ""}
              onChange={set("planned")}
              className={inputClass}
            />
          </Field>
          <Field label="Applications Migrated" htmlFor="migrated" hint="Count">
            <Input
              id="migrated"
              type="number"
              min={0}
              value={m.migrated ?? ""}
              onChange={set("migrated")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Total Migration Attempts"
            htmlFor="attempts"
            hint="Count"
          >
            <Input
              id="attempts"
              type="number"
              min={0}
              value={m.attempts ?? ""}
              onChange={set("attempts")}
              className={inputClass}
            />
          </Field>
          <Field
            label="Successful Migrations"
            htmlFor="successful"
            hint="Count"
          >
            <Input
              id="successful"
              type="number"
              min={0}
              value={m.successful ?? ""}
              onChange={set("successful")}
              className={inputClass}
            />
          </Field>
          <Field label="Migration Start Time" htmlFor="start">
            <Input
              id="start"
              type="datetime-local"
              value={m.start ?? ""}
              onChange={set("start")}
              className={inputClass}
            />
          </Field>
          <Field label="Migration End Time" htmlFor="end">
            <Input
              id="end"
              type="datetime-local"
              value={m.end ?? ""}
              onChange={set("end")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricTile
            label="Applications Migrated (Planned vs Actual)"
            value={fmt(pct(num(m.migrated), num(m.planned)), 1)}
            unit="%"
          />
          <MetricTile
            label="Migration Success Rate"
            value={fmt(pct(num(m.successful), num(m.attempts)), 1)}
            unit="%"
          />
          <MetricTile
            label="Migration Downtime"
            value={fmt(downtimeHours, 1)}
            unit="Hours"
          />
        </div>
      </SectionCard>
    </div>
  );
}
