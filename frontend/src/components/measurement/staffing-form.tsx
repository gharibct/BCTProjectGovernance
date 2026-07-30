"use client";

import * as React from "react";
import { ChartColumn, Timer, Users } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { MetricTile, fmt, inputClass, num, pct, ratio, useMeasures } from "./shared";

const PRIORITIES = [
  { key: "p1", label: "Critical (P1)" },
  { key: "p2", label: "High (P2)" },
  { key: "p3", label: "Medium (P3)" },
  { key: "p4", label: "Low (P4)" },
] as const;

export function StaffingTab() {
  const { m, set } = useMeasures();

  const requests = num(m.requests);
  const joined = num(m.joined);

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Timer} title="Requests & Response">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="No. of Requests" htmlFor="requests">
            <Input
              id="requests"
              type="number"
              min={0}
              value={m.requests ?? ""}
              onChange={set("requests")}
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
              hint="Person-Hours"
            >
              <Input
                id={`resp-${p.key}`}
                type="number"
                min={0}
                value={m[`resp-${p.key}`] ?? ""}
                onChange={set(`resp-${p.key}`)}
                className={inputClass}
              />
            </Field>
          ))}
          {PRIORITIES.map((p) => (
            <Field
              key={`lead-${p.key}`}
              label={`Lead Time to Onboarding — ${p.label}`}
              htmlFor={`lead-${p.key}`}
              hint="Person-Days"
            >
              <Input
                id={`lead-${p.key}`}
                type="number"
                min={0}
                value={m[`lead-${p.key}`] ?? ""}
                onChange={set(`lead-${p.key}`)}
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
              value={m.profiles ?? ""}
              onChange={set("profiles")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Client Interviews" htmlFor="interviews">
            <Input
              id="interviews"
              type="number"
              min={0}
              value={m.interviews ?? ""}
              onChange={set("interviews")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Interview Selects" htmlFor="selects">
            <Input
              id="selects"
              type="number"
              min={0}
              value={m.selects ?? ""}
              onChange={set("selects")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Associates Joined" htmlFor="joined">
            <Input
              id="joined"
              type="number"
              min={0}
              value={m.joined ?? ""}
              onChange={set("joined")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`avg-resp-${p.key}`}
              label={`Avg Response Time — ${p.label}`}
              value={fmt(ratio(num(m[`resp-${p.key}`]), requests), 1)}
              unit="Person-Hours / Request"
            />
          ))}
          <MetricTile
            label="Profiles Qualifying for Submission"
            value={fmt(pct(num(m.interviews), num(m.profiles)), 1)}
            unit="%"
          />
          <MetricTile
            label="Candidates Resulting in Joining"
            value={fmt(pct(num(m.joined), num(m.selects)), 1)}
            unit="%"
          />
          {PRIORITIES.map((p) => (
            <MetricTile
              key={`lead-time-${p.key}`}
              label={`Lead Time — ${p.label}`}
              value={fmt(ratio(num(m[`lead-${p.key}`]), joined), 1)}
              unit="Person-Days / Onboarding"
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
