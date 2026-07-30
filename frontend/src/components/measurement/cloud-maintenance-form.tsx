"use client";

import * as React from "react";
import { ChartColumn, Server } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { MetricTile, fmt, inputClass, num, pct, useMeasures } from "./shared";

export function CloudMaintenanceTab() {
  const { m, set } = useMeasures();

  const uptime = num(m.uptime);
  const scheduled = num(m.scheduled);
  const downtime = num(m.downtime);

  const appAvailability =
    scheduled !== null && scheduled > 0 && downtime !== null
      ? ((scheduled - downtime) / scheduled) * 100
      : null;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Server} title="Availability Measures">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="Total Uptime" htmlFor="uptime" hint="Hours">
            <Input
              id="uptime"
              type="number"
              min={0}
              value={m.uptime ?? ""}
              onChange={set("uptime")}
              className={inputClass}
            />
          </Field>
          <Field label="Total Scheduled Time" htmlFor="scheduled" hint="Hours">
            <Input
              id="scheduled"
              type="number"
              min={0}
              value={m.scheduled ?? ""}
              onChange={set("scheduled")}
              className={inputClass}
            />
          </Field>
          <Field label="Application Downtime" htmlFor="downtime" hint="Hours">
            <Input
              id="downtime"
              type="number"
              min={0}
              value={m.downtime ?? ""}
              onChange={set("downtime")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MetricTile
            label="Service Availability"
            value={fmt(pct(uptime, scheduled), 2)}
            unit="%"
          />
          <MetricTile
            label="Application Availability"
            value={fmt(appAvailability, 2)}
            unit="%"
          />
        </div>
      </SectionCard>
    </div>
  );
}
