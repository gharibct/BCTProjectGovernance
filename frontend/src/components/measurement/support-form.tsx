"use client";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartColumn, Headset } from "lucide-react";

import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useSupportTarget } from "@/lib/api/metric-targets";
import {
  useCreateSupportMeasurement,
  useLatestSupportMeasurement,
  type MeasurementSupportPayload,
  type MeasurementSupportRead,
} from "@/lib/api/measurement";
import { MetricTile, inputClass, num, str, useMeasurementForm } from "./shared";

// Ticket types with Count + Person-Days effort per the Measurement sheet.
const TICKET_ROWS = [
  { key: "p1", label: "Incidents — P1", count: "incidents_p1_count", effort: "incidents_p1_person_days" },
  { key: "p2", label: "Incidents — P2", count: "incidents_p2_count", effort: "incidents_p2_person_days" },
  { key: "p3", label: "Incidents — P3", count: "incidents_p3_count", effort: "incidents_p3_person_days" },
] as const;

function toValues(data: MeasurementSupportRead): Record<string, string> {
  return {
    incidents_p1_count: str(data.incidents_p1_count),
    incidents_p1_person_days: str(data.incidents_p1_person_days),
    incidents_p2_count: str(data.incidents_p2_count),
    incidents_p2_person_days: str(data.incidents_p2_person_days),
    incidents_p3_count: str(data.incidents_p3_count),
    incidents_p3_person_days: str(data.incidents_p3_person_days),
    service_requests_count: str(data.service_requests_count),
    user_clarifications_count: str(data.user_clarifications_count),
    tickets_reopened_count: str(data.tickets_reopened_count),
    aging_tickets_count: str(data.aging_tickets_count),
    first_time_resolutions_count: str(data.first_time_resolutions_count),
  };
}

function toPayload(m: Record<string, string>, periodId: string): MeasurementSupportPayload {
  return {
    period_id: periodId,
    incidents_p1_count: m.incidents_p1_count || undefined,
    incidents_p1_person_days: m.incidents_p1_person_days || undefined,
    incidents_p2_count: m.incidents_p2_count || undefined,
    incidents_p2_person_days: m.incidents_p2_person_days || undefined,
    incidents_p3_count: m.incidents_p3_count || undefined,
    incidents_p3_person_days: m.incidents_p3_person_days || undefined,
    service_requests_count: m.service_requests_count || undefined,
    user_clarifications_count: m.user_clarifications_count || undefined,
    tickets_reopened_count: m.tickets_reopened_count || undefined,
    aging_tickets_count: m.aging_tickets_count || undefined,
    first_time_resolutions_count: m.first_time_resolutions_count || undefined,
  };
}

export function SupportTab({ projectId }: { projectId: string }) {
  const { data: target } = useSupportTarget(projectId);

  const latestQuery = useLatestSupportMeasurement(projectId);
  const createMutation = useCreateSupportMeasurement(projectId);
  const { latest, m, set, periodId, submit, isSaving, ai } = useMeasurementForm({
    projectId,
    screen: "measurement_support",
    latestQuery,
    createMutation,
    toValues,
    toPayload,
  });

  const cell = (key: string, label: string) => (
    <Input
      type="number"
      min={0}
      value={m[key] ?? ""}
      onChange={set(key)}
      aria-label={label}
      className="h-9 w-28 text-right tabular-nums"
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_support"
        periodId={periodId || null}
        ai={ai}
      />
      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="rounded-xl bg-slate-50 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricTile
            label="Incident MTTR (Overall)"
            formula="(Total Incident Person-Days × 8) ÷ Total Incidents"
            target={null}
            current={num(latest?.incident_mttr_hours)}
            unit="Person-Hours / Incident"
            digits={1}
          />
          <MetricTile
            label="Service Request MTTR"
            formula="Not computed — no resolution-duration field captured on this form"
            target={num(target?.target_service_request_mttr_hours)}
            current={num(latest?.service_request_mttr_hours)}
            unit="Hours"
            digits={1}
          />
          <MetricTile
            label="User Clarification MTTR"
            formula="Not computed — no resolution-duration field captured on this form"
            target={num(target?.target_user_clarification_mttr_hours)}
            current={num(latest?.user_clarification_mttr_hours)}
            unit="Hours"
            digits={1}
          />
          <MetricTile
            label="SLA Compliance"
            badge="P1"
            formula="Not computed — no SLA target threshold captured on this form"
            target={num(target?.target_incident_sla_compliance_p1_pct)}
            current={num(latest?.incident_sla_compliance_p1_pct)}
            unit="%"
            digits={1}
          />
          <MetricTile
            label="SLA Compliance"
            badge="P2"
            formula="Not computed — no SLA target threshold captured on this form"
            target={num(target?.target_incident_sla_compliance_p2_pct)}
            current={num(latest?.incident_sla_compliance_p2_pct)}
            unit="%"
            digits={1}
          />
          <MetricTile
            label="SLA Compliance"
            badge="P3"
            formula="Not computed — no SLA target threshold captured on this form"
            target={num(target?.target_incident_sla_compliance_p3_pct)}
            current={num(latest?.incident_sla_compliance_p3_pct)}
            unit="%"
            digits={1}
          />
        </div>
        </div>
      </SectionCard>

      <SectionCard icon={Headset} title="Tickets">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
                <th className="px-4 py-3">Ticket Type</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3 text-right">Effort (Person-Days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TICKET_ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">{cell(row.count, `${row.label} count`)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">{cell(row.effort, `${row.label} effort`)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="# of Service Requests" htmlFor="service-requests">
            <Input
              id="service-requests"
              type="number"
              min={0}
              value={m.service_requests_count ?? ""}
              onChange={set("service_requests_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of User Clarifications" htmlFor="user-clarifications">
            <Input
              id="user-clarifications"
              type="number"
              min={0}
              value={m.user_clarifications_count ?? ""}
              onChange={set("user_clarifications_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Tickets Re-Opened" htmlFor="reopened">
            <Input
              id="reopened"
              type="number"
              min={0}
              value={m.tickets_reopened_count ?? ""}
              onChange={set("tickets_reopened_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Aging Tickets" htmlFor="aging">
            <Input
              id="aging"
              type="number"
              min={0}
              value={m.aging_tickets_count ?? ""}
              onChange={set("aging_tickets_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of First Time Resolutions" htmlFor="ftr">
            <Input
              id="ftr"
              type="number"
              min={0}
              value={m.first_time_resolutions_count ?? ""}
              onChange={set("first_time_resolutions_count")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={!periodId || isSaving}
          className="h-10 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {isSaving ? <ButtonSpinner /> : null}
          Save Measurements
        </Button>
      </div>
    </div>
  );
}
