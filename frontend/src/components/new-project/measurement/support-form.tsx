"use client";

import { ChartColumn } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, useMeasures } from "./shared";

export function SupportTab() {
  const { m, set } = useMeasures();

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ChartColumn} title="Target Support Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Incident MTTR — P1"
            value={m.targetMttrP1 ?? ""}
            onChange={set("targetMttrP1")}
            unit="Person-Hours / Incident"
          />
          <MetricTile
            label="Incident MTTR — P2"
            value={m.targetMttrP2 ?? ""}
            onChange={set("targetMttrP2")}
            unit="Person-Hours / Incident"
          />
          <MetricTile
            label="Incident MTTR — P3"
            value={m.targetMttrP3 ?? ""}
            onChange={set("targetMttrP3")}
            unit="Person-Hours / Incident"
          />
          <MetricTile
            label="Service Request MTTR"
            value={m.targetMttrSr ?? ""}
            onChange={set("targetMttrSr")}
            unit="Person-Hours / SR"
          />
          <MetricTile
            label="User Clarification MTTR"
            value={m.targetMttrUc ?? ""}
            onChange={set("targetMttrUc")}
            unit="Person-Hours / UC"
          />
          <MetricTile
            label="SLA Compliance — P1"
            value={m.targetSlaP1 ?? ""}
            onChange={set("targetSlaP1")}
            unit="%"
          />
          <MetricTile
            label="SLA Compliance — P2"
            value={m.targetSlaP2 ?? ""}
            onChange={set("targetSlaP2")}
            unit="%"
          />
          <MetricTile
            label="SLA Compliance — P3"
            value={m.targetSlaP3 ?? ""}
            onChange={set("targetSlaP3")}
            unit="%"
          />
        </div>
      </SectionCard>
    </div>
  );
}
