"use client";

import { ChartColumn } from "lucide-react";

import type { MetricTargetSupport, MetricTargetSupportPayload } from "@/lib/api/metric-targets";
import { SectionCard } from "@/components/forms/form-primitives";
import { MetricTile, num, str, type MeasuresProps } from "./shared";

export function toSupportPayload(m: Record<string, string>): MetricTargetSupportPayload {
  return {
    target_incident_mttr_p1_hours: num(m.targetMttrP1),
    target_incident_mttr_p2_hours: num(m.targetMttrP2),
    target_incident_mttr_p3_hours: num(m.targetMttrP3),
    target_service_request_mttr_hours: num(m.targetMttrSr),
    target_user_clarification_mttr_hours: num(m.targetMttrUc),
    target_incident_sla_compliance_p1_pct: num(m.targetSlaP1),
    target_incident_sla_compliance_p2_pct: num(m.targetSlaP2),
    target_incident_sla_compliance_p3_pct: num(m.targetSlaP3),
  };
}

export function fromSupportTarget(data: MetricTargetSupport | null): Record<string, string> {
  if (!data) return {};
  return {
    targetMttrP1: str(data.target_incident_mttr_p1_hours),
    targetMttrP2: str(data.target_incident_mttr_p2_hours),
    targetMttrP3: str(data.target_incident_mttr_p3_hours),
    targetMttrSr: str(data.target_service_request_mttr_hours),
    targetMttrUc: str(data.target_user_clarification_mttr_hours),
    targetSlaP1: str(data.target_incident_sla_compliance_p1_pct),
    targetSlaP2: str(data.target_incident_sla_compliance_p2_pct),
    targetSlaP3: str(data.target_incident_sla_compliance_p3_pct),
  };
}

export function SupportTab({ m, set }: MeasuresProps) {
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
