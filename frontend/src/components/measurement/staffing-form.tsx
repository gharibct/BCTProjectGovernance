"use client";

import { ChartColumn, Timer, Users } from "lucide-react";

import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadAiSuggestionsButton } from "@/components/ai/load-ai-suggestions-button";
import { useStaffingTarget } from "@/lib/api/metric-targets";
import { useMetricReferenceLookup } from "@/lib/api/metric-reference";
import {
  useCreateStaffingMeasurement,
  useLatestStaffingMeasurement,
  type MeasurementStaffingPayload,
  type MeasurementStaffingRead,
  type StaffingPriorityCode,
} from "@/lib/api/measurement";
import { MetricTile, inputClass, num, str, useMeasurementForm } from "./shared";

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
    values[`resptot_${p.priority}`] = str(p.response_time_hours_total);
    values[`reqresp_${p.priority}`] = str(p.requests_responded_count);
    values[`leadtot_${p.priority}`] = str(p.lead_time_days_total);
    values[`onboard_${p.priority}`] = str(p.associates_onboarded_count);
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
      response_time_hours_total: m[`resptot_${key}`] || undefined,
      requests_responded_count: m[`reqresp_${key}`] || undefined,
      lead_time_days_total: m[`leadtot_${key}`] || undefined,
      associates_onboarded_count: m[`onboard_${key}`] || undefined,
    })),
  };
}

export function StaffingTab({ projectId }: { projectId: string }) {
  const { data: target } = useStaffingTarget(projectId);
  const reference = useMetricReferenceLookup("PROFESSIONAL_STAFFING");

  const latestQuery = useLatestStaffingMeasurement(projectId);
  const createMutation = useCreateStaffingMeasurement(projectId);
  const { latest, m, set, periodId, submit, isSaving, ai } = useMeasurementForm({
    projectId,
    screen: "measurement_staffing",
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
      <LoadAiSuggestionsButton
        projectId={projectId}
        screen="measurement_staffing"
        periodId={periodId || null}
        ai={ai}
      />
      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="rounded-xl bg-slate-50 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`avg-resp-${p.key}`}
              label="Avg Response Time"
              badge={p.label}
              metricKey="avg_response_time_hours"
              reference={reference}
              target={num(targetFor(p.key)?.target_avg_response_time_hours)}
              current={num(latestFor(p.key)?.avg_response_time_hours)}
              unit="Hours"
              direction="lower-is-better"
              digits={1}
            />
          ))}
          <MetricTile
            label="Profiles Qualifying for Submission"
            metricKey="pct_profiles_qualifying"
            reference={reference}
            target={num(target?.target_pct_profiles_qualifying)}
            current={num(latest?.pct_profiles_qualifying)}
            unit="%"
            direction="higher-is-better"
            digits={1}
          />
          <MetricTile
            label="Candidates Resulting in Joining"
            metricKey="pct_candidates_joining"
            reference={reference}
            target={num(target?.target_pct_candidates_joining)}
            current={num(latest?.pct_candidates_joining)}
            unit="%"
            direction="higher-is-better"
            digits={1}
          />
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`lead-time-${p.key}`}
              label="Lead Time"
              badge={p.label}
              metricKey="avg_lead_time_days"
              reference={reference}
              target={num(targetFor(p.key)?.target_avg_lead_time_days)}
              current={num(latestFor(p.key)?.avg_lead_time_days)}
              unit="Days"
              direction="lower-is-better"
              digits={1}
            />
          ))}
        </div>
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
        <p className="mt-6 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Response &amp; Onboarding — per priority
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Enter this period&apos;s total and count; the average is total &divide; count.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {PRIORITIES.map((p) => (
            <div key={`prio-${p.key}`} className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-4">
              <Field label={`Total Response Time — ${p.label}`} htmlFor={`resptot-${p.key}`} hint="Hours">
                <Input
                  id={`resptot-${p.key}`}
                  type="number"
                  min={0}
                  value={m[`resptot_${p.key}`] ?? ""}
                  onChange={set(`resptot_${p.key}`)}
                  className={inputClass}
                />
              </Field>
              <Field label={`# Requests Responded — ${p.label}`} htmlFor={`reqresp-${p.key}`}>
                <Input
                  id={`reqresp-${p.key}`}
                  type="number"
                  min={0}
                  value={m[`reqresp_${p.key}`] ?? ""}
                  onChange={set(`reqresp_${p.key}`)}
                  className={inputClass}
                />
              </Field>
              <Field label={`Total Lead Time — ${p.label}`} htmlFor={`leadtot-${p.key}`} hint="Days">
                <Input
                  id={`leadtot-${p.key}`}
                  type="number"
                  min={0}
                  value={m[`leadtot_${p.key}`] ?? ""}
                  onChange={set(`leadtot_${p.key}`)}
                  className={inputClass}
                />
              </Field>
              <Field label={`# Associates Onboarded — ${p.label}`} htmlFor={`onboard-${p.key}`}>
                <Input
                  id={`onboard-${p.key}`}
                  type="number"
                  min={0}
                  value={m[`onboard_${p.key}`] ?? ""}
                  onChange={set(`onboard_${p.key}`)}
                  className={inputClass}
                />
              </Field>
            </div>
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
