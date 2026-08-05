"use client";

import Link from "next/link";
import { ArrowRightToLine, CircleCheck, Flag, HeartPulse, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjects } from "@/lib/api/projects";
import { StarterCards } from "./starter-cards";

// Sample project identity and reporting data until there's a backend.
const PROJECT_CODE = "PRJ-2026-0042";
const PROJECT_DESCRIPTION =
  "Modernization of the core banking platform for Gulf National Bank, covering deposits, lending and payments modules across APAC operations.";

// Frontend-only for now — backend mapping for these KPIs hasn't started yet.
// The three health tiles mirror health-declaration.tsx's own three fields:
// Delivery Declared Overall, DE Assessed Project Health, and the
// highest-severity Overall Health rollup between them.
const STATS = [
  {
    label: "Milestones",
    value: "12/15",
    qualifier: "On Track",
    qualifierClass: "text-[#1a6fc4]",
    icon: Flag,
  },
  { label: "Delivery Declared Health", value: "Green", icon: HeartPulse, pill: true },
  { label: "DE Assessed Health", value: "Green", icon: ShieldCheck, pill: true },
  { label: "Overall Health", value: "Green", icon: CircleCheck, pill: true },
];

// Same rating→color mapping as HealthPill (health-declaration.tsx) — kept
// local since this file has no backend health data to share that type with
// yet.
const HEALTH_PILL_STYLES: Record<string, { pillClass: string; dotClass: string }> = {
  Green: { pillClass: "bg-emerald-50 text-emerald-700 ring-emerald-200", dotClass: "bg-emerald-500" },
  Amber: { pillClass: "bg-amber-50 text-amber-700 ring-amber-200", dotClass: "bg-amber-400" },
  "Potential Red": { pillClass: "bg-orange-50 text-orange-700 ring-orange-200", dotClass: "bg-orange-500" },
  Red: { pillClass: "bg-red-50 text-red-700 ring-red-200", dotClass: "bg-red-500" },
};

function HealthValuePill({ value }: { value: string }) {
  const style = HEALTH_PILL_STYLES[value] ?? HEALTH_PILL_STYLES.Green;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1",
        style.pillClass
      )}
    >
      <span className={cn("size-2 rounded-full", style.dotClass)} />
      {value}
    </span>
  );
}

const HISTORY = [
  {
    period: "Week 31",
    type: "Weekly",
    createdOn: "Aug 01, 2024",
    status: "Completed",
    completion: "100%",
    lastUpdated: "Aug 03, 2024",
  },
  {
    period: "Week 32",
    type: "Weekly",
    createdOn: "Aug 08, 2024",
    status: "Completed",
    completion: "100%",
    lastUpdated: "Aug 10, 2024",
  },
  {
    period: "Jul 2026",
    type: "Monthly",
    createdOn: "Jul 01, 2026",
    status: "Completed",
    completion: "100%",
    lastUpdated: "Jul 28, 2026",
  },
];

export function ReportingHub() {
  // Only one project has screens built today, so we just take the first one
  // — this whole dashboard is still sample data pending its own :projectId
  // route (see project-nav.tsx / [projectId]/* for the screens that already
  // have one).
  const { data: projects } = useProjects();
  const project = projects?.[0];
  const charterHref = project ? `/project-reporting/${project.id}/project-charter` : "#";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {project?.project_code ?? PROJECT_CODE} - Project Reporting
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">{PROJECT_DESCRIPTION}</p>
        </div>
        <Button
          asChild
          className="h-11 shrink-0 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          <Link href={charterHref}>
            <ArrowRightToLine className="size-4" />
            Goto Latest Report
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                {stat.label}
              </span>
              <stat.icon className="size-4.5 text-[#1a6fc4]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {stat.pill ? (
                <HealthValuePill value={stat.value} />
              ) : (
                <>
                  <span className="text-2xl font-bold text-slate-900">
                    {stat.value}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold tracking-wide uppercase",
                      stat.qualifierClass
                    )}
                  >
                    {stat.qualifier}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <StarterCards />

      <section>
        <h2 className="text-lg font-bold text-slate-900">Reporting History</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs tracking-wide text-slate-500 uppercase">
                <th className="px-6 py-3 font-bold">Reporting Period</th>
                <th className="px-3 py-3 font-bold">Type</th>
                <th className="px-3 py-3 font-bold">Created On</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-3 py-3 text-right font-bold">Completion</th>
                <th className="px-3 py-3 font-bold">Last Updated</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((report) => (
                <tr
                  key={report.period}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-6 py-3.5 font-bold text-slate-900">
                    {report.period}
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold",
                        report.type === "Weekly"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-blue-50 text-[#1a6fc4]"
                      )}
                    >
                      {report.type}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">
                    {report.createdOn}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {report.status}
                    </span>
                  </td>
                  <td
                    className="px-3 py-3.5 text-right text-slate-700"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {report.completion}
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">
                    {report.lastUpdated}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Button
                      asChild
                      variant="outline"
                      className="h-8 w-20 text-xs font-semibold"
                    >
                      <Link href={charterHref}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
