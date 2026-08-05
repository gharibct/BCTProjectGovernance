"use client";

import { ChartColumn, Timer, Users } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaffingTarget } from "@/lib/api/metric-targets";
import {
  useCreateStaffingMeasurement,
  useLatestStaffingMeasurement,
  type MeasurementStaffingPayload,
  type MeasurementStaffingRead,
  type StaffingPriorityCode,
} from "@/lib/api/measurement";
import { useReportingPeriods } from "@/lib/api/reference-data";
import { MetricTile, PeriodField, fmt, inputClass, num, str, useMeasurementForm } from "./shared";

const PRIORITIES: { key: StaffingPriorityCode; label: string }[] = [
  { key: "Critical", label: "Critical" },
  { key: "High", label: "High" },
  { key: "Medium", label: "Medium" },
  { key: "Low", label: "Low" },
];

function toValues(data: MeasurementStaffingRead): Record<string, string> {
  const values: Record<string, string> = {
    requests_count: str(data.requests_count),
    profiles_submitted_count: str(data.profiles_submitted_count),
    client_interviews_count: str(data.client_interviews_count),
    interview_selects_count: str(data.interview_selects_count),
    associates_joined_count: str(data.associates_joined_count),
  };
  for (const p of data.priority_metrics) {
    values[`resp_${p.priority}`] = str(p.response_time_hours);
    values[`lead_${p.priority}`] = str(p.lead_time_days);
  }
  return values;
}

function toPayload(m: Record<string, string>, periodId: string): MeasurementStaffingPayload {
  return {
    period_id: periodId,
    requests_count: m.requests_count || undefined,
    profiles_submitted_count: m.profiles_submitted_count || undefined,
    client_interviews_count: m.client_interviews_count || undefined,
    interview_selects_count: m.interview_selects_count || undefined,
    associates_joined_count: m.associates_joined_count || undefined,
    priority_metrics: PRIORITIES.map(({ key }) => ({
      priority: key,
      response_time_hours: m[`resp_${key}`] || undefined,
      lead_time_days: m[`lead_${key}`] || undefined,
    })),
  };
}

export function StaffingTab({ projectId }: { projectId: string }) {
  const { data: periods } = useReportingPeriods();
  const { data: target } = useStaffingTarget(projectId);

  const latestQuery = useLatestStaffingMeasurement(projectId);
  const createMutation = useCreateStaffingMeasurement(projectId);
  const { latest, m, set, periodId, setPeriodId, submit, isSaving } = useMeasurementForm({
    projectId,
    latestQuery,
    createMutation,
    toValues,
    toPayload,
  });

  const targetFor = (priority: StaffingPriorityCode) =>
    target?.priority_targets.find((p) => p.priority === priority);
  const latestFor = (priority: StaffingPriorityCode) =>
    latest?.priority_metrics.find((p) => p.priority === priority);

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={ChartColumn}
        title="Metrics"
        aside={
          <div className="flex items-end gap-4">
            <PeriodField periods={periods} value={periodId} onChange={(e) => setPeriodId(e.target.value)} />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`avg-resp-${p.key}`}
              label={`Avg Response Time — ${p.label}`}
              target={str(targetFor(p.key)?.target_avg_response_time_hours)}
              current={fmt(num(latestFor(p.key)?.avg_response_time_hours), 1)}
              unit="Hours (trailing avg)"
            />
          ))}
          <MetricTile
            label="Profiles Qualifying for Submission"
            target={str(target?.target_pct_profiles_qualifying)}
            current={fmt(num(latest?.pct_profiles_qualifying), 1)}
            unit="%"
          />
          <MetricTile
            label="Candidates Resulting in Joining"
            target={str(target?.target_pct_candidates_joining)}
            current={fmt(num(latest?.pct_candidates_joining), 1)}
            unit="%"
          />
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`lead-time-${p.key}`}
              label={`Lead Time — ${p.label}`}
              target={str(targetFor(p.key)?.target_avg_lead_time_days)}
              current={fmt(num(latestFor(p.key)?.avg_lead_time_days), 1)}
              unit="Days (trailing avg)"
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={Timer} title="Requests & Response">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="No. of Requests" htmlFor="requests">
            <Input
              id="requests"
              type="number"
              min={0}
              value={m.requests_count ?? ""}
              onChange={set("requests_count")}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-4">
          {PRIORITIES.map((p) => (
            <Field
              key={`resp-${p.key}`}
              label={`Response Time — ${p.label}`}
              htmlFor={`resp-${p.key}`}
              hint="Hours"
            >
              <Input
                id={`resp-${p.key}`}
                type="number"
                min={0}
                value={m[`resp_${p.key}`] ?? ""}
                onChange={set(`resp_${p.key}`)}
                className={inputClass}
              />
            </Field>
          ))}
          {PRIORITIES.map((p) => (
            <Field
              key={`lead-${p.key}`}
              label={`Lead Time to Onboarding — ${p.label}`}
              htmlFor={`lead-${p.key}`}
              hint="Days"
            >
              <Input
                id={`lead-${p.key}`}
                type="number"
                min={0}
                value={m[`lead_${p.key}`] ?? ""}
                onChange={set(`lead_${p.key}`)}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={Users} title="Candidate Pipeline">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-4">
          <Field label="# of Profiles Submitted" htmlFor="profiles">
            <Input
              id="profiles"
              type="number"
              min={0}
              value={m.profiles_submitted_count ?? ""}
              onChange={set("profiles_submitted_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Client Interviews" htmlFor="interviews">
            <Input
              id="interviews"
              type="number"
              min={0}
              value={m.client_interviews_count ?? ""}
              onChange={set("client_interviews_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Interview Selects" htmlFor="selects">
            <Input
              id="selects"
              type="number"
              min={0}
              value={m.interview_selects_count ?? ""}
              onChange={set("interview_selects_count")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Associates Joined" htmlFor="joined">
            <Input
              id="joined"
              type="number"
              min={0}
              value={m.associates_joined_count ?? ""}
              onChange={set("associates_joined_count")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
