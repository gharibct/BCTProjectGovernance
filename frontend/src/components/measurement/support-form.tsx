"use client";

import * as React from "react";
import { ChartColumn, Headset } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Input } from "@/components/ui/input";
import { MetricTile, fmt, inputClass, num, useMeasures } from "./shared";

// Ticket types with Count + Person-Days effort per the Measurement sheet.
const TICKET_ROWS = [
  { key: "p1", label: "Incidents — P1" },
  { key: "p2", label: "Incidents — P2" },
  { key: "p3", label: "Incidents — P3" },
  { key: "sr", label: "Service Request" },
  { key: "uc", label: "User Clarification" },
] as const;

// MTTR = effort (Person-Days × 8) ÷ ticket count → Person-Hours per ticket.
function mttr(effortDays: number | null, count: number | null): number | null {
  return effortDays !== null && count !== null && count > 0
    ? (effortDays * 8) / count
    : null;
}

export function SupportTab() {
  const { m, set } = useMeasures();

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
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {row.label}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {cell(`${row.key}-count`, `${row.label} count`)}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end">
                      {cell(`${row.key}-effort`, `${row.label} effort`)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="# of Tickets Re-Opened" htmlFor="reopened">
            <Input
              id="reopened"
              type="number"
              min={0}
              value={m.reopened ?? ""}
              onChange={set("reopened")}
              className={inputClass}
            />
          </Field>
          <Field label="# of Aging Tickets" htmlFor="aging">
            <Input
              id="aging"
              type="number"
              min={0}
              value={m.aging ?? ""}
              onChange={set("aging")}
              className={inputClass}
            />
          </Field>
          <Field label="# of First Time Resolutions" htmlFor="ftr">
            <Input
              id="ftr"
              type="number"
              min={0}
              value={m.ftr ?? ""}
              onChange={set("ftr")}
              className={inputClass}
            />
          </Field>
          <Field
            label="SLA Compliance % — P1"
            htmlFor="sla-p1"
            hint="From ticketing tool"
          >
            <Input
              id="sla-p1"
              type="number"
              min={0}
              max={100}
              value={m.slaP1 ?? ""}
              onChange={set("slaP1")}
              className={inputClass}
            />
          </Field>
          <Field
            label="SLA Compliance % — P2"
            htmlFor="sla-p2"
            hint="From ticketing tool"
          >
            <Input
              id="sla-p2"
              type="number"
              min={0}
              max={100}
              value={m.slaP2 ?? ""}
              onChange={set("slaP2")}
              className={inputClass}
            />
          </Field>
          <Field
            label="SLA Compliance % — P3"
            htmlFor="sla-p3"
            hint="From ticketing tool"
          >
            <Input
              id="sla-p3"
              type="number"
              min={0}
              max={100}
              value={m.slaP3 ?? ""}
              onChange={set("slaP3")}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ChartColumn} title="Metrics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Incident MTTR — P1"
            value={fmt(mttr(num(m["p1-effort"]), num(m["p1-count"])), 1)}
            unit="Person-Hours / Incident"
          />
          <MetricTile
            label="Incident MTTR — P2"
            value={fmt(mttr(num(m["p2-effort"]), num(m["p2-count"])), 1)}
            unit="Person-Hours / Incident"
          />
          <MetricTile
            label="Incident MTTR — P3"
            value={fmt(mttr(num(m["p3-effort"]), num(m["p3-count"])), 1)}
            unit="Person-Hours / Incident"
          />
          <MetricTile
            label="Service Request MTTR"
            value={fmt(mttr(num(m["sr-effort"]), num(m["sr-count"])), 1)}
            unit="Person-Hours / SR"
          />
          <MetricTile
            label="User Clarification MTTR"
            value={fmt(mttr(num(m["uc-effort"]), num(m["uc-count"])), 1)}
            unit="Person-Hours / UC"
          />
          <MetricTile
            label="SLA Compliance — P1"
            value={num(m.slaP1) === null ? "—" : m.slaP1}
            unit="%"
            note="Entered"
          />
          <MetricTile
            label="SLA Compliance — P2"
            value={num(m.slaP2) === null ? "—" : m.slaP2}
            unit="%"
            note="Entered"
          />
          <MetricTile
            label="SLA Compliance — P3"
            value={num(m.slaP3) === null ? "—" : m.slaP3}
            unit="%"
            note="Entered"
          />
        </div>
      </SectionCard>
    </div>
  );
}
