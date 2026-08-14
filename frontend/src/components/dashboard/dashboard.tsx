"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CircleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PageBanner } from "@/components/shell/page-banner";
import {
  fetchProjects,
  type ProjectFilter,
  type ProjectRow,
} from "./data";
import { KpiCards } from "./kpi-cards";
import { ProblemTrend } from "./problem-trend";
import { ProjectDetails } from "./project-details";
import { TrendsChart } from "./trends-chart";

export function Dashboard() {
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [result, setResult] = useState<{
    filter: ProjectFilter;
    rows: ProjectRow[];
  } | null>(null);

  // Loading whenever the shown result doesn't match the selected filter yet.
  const loading = result?.filter !== filter;
  const projects = result?.rows ?? [];

  useEffect(() => {
    let cancelled = false;
    fetchProjects(filter).then((rows) => {
      if (!cancelled) setResult({ filter, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            My Summary
          </h1>
          <p className="mt-1.5 text-slate-500">
            Delivery health across all active engagements
          </p>
        </div>
        <span className="pb-1 text-sm text-slate-400">
          Updated today · 09:45 AM
        </span>
      </header>

      <PageBanner />

      <KpiCards selected={filter} onSelect={setFilter} />

      {/* 60% grid / 40% milestones & escalations */}
      <div className="grid items-start gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ProjectDetails
            filter={filter}
            projects={projects}
            loading={loading}
          />
        </div>
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Milestones />
          <Escalations />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <TrendsChart />
        <ProblemTrend />
      </div>
    </div>
  );
}

// Milestone and escalation panels — static sample content until there's a
// backend.

const MILESTONES = [
  {
    icon: Banknote,
    iconClass: "border-blue-200 bg-blue-50 text-blue-600",
    title: "Go-Live Phase 1: US Region",
    meta: "NorthStar Alpha · Due Oct 12",
    value: "$1.2M Payment",
    status: "At Risk",
    statusClass: "text-red-600",
  },
  {
    icon: BadgeCheck,
    iconClass: "border-emerald-200 bg-emerald-50 text-emerald-600",
    title: "UAT Sign-off: Core Banking",
    meta: "FinSync · Due Oct 15",
    value: "Contractual",
    status: "On Track",
    statusClass: "text-emerald-600",
  },
];

function Milestones() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="font-bold text-slate-900">Critical Milestones</h2>
        <span className="text-xs font-semibold text-slate-400 uppercase">
          Next 30 days
        </span>
      </div>
      <div className="divide-y divide-slate-100 px-5">
        {MILESTONES.map((milestone) => (
          <div
            key={milestone.title}
            className="flex items-center justify-between gap-4 py-3.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                  milestone.iconClass
                )}
              >
                <milestone.icon className="size-4.5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">
                  {milestone.title}
                </div>
                <div className="truncate text-sm text-slate-500">
                  {milestone.meta}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold text-slate-900">
                {milestone.value}
              </div>
              <div
                className={cn(
                  "text-xs font-bold uppercase",
                  milestone.statusClass
                )}
              >
                {milestone.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const ESCALATIONS = [
  {
    icon: CircleAlert,
    iconClass: "text-red-600",
    title: "Data Residency Breach",
    meta: "Chief Security Officer · 3h ago",
    description:
      "Trial SaaS instance provisioned in unauthorized region. Immediate shutdown required.",
  },
  {
    icon: AlertTriangle,
    iconClass: "text-amber-500",
    title: "Budget Overrun: Project Delta",
    meta: "Finance Manager · Yesterday",
    description:
      "Forecast exceeds baseline by 18%. Mitigation plan requested for next steering co.",
  },
];

function Escalations() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-5 py-3.5 font-bold text-slate-900">
        Executive Escalations
      </h2>
      <div className="divide-y divide-slate-100">
        {ESCALATIONS.map((escalation) => (
          <div key={escalation.title} className="flex items-start gap-3 px-5 py-3.5">
            <escalation.icon
              className={cn("mt-0.5 size-5 shrink-0", escalation.iconClass)}
            />
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-slate-900">
                  {escalation.title}
                </span>
                <span className="text-xs text-slate-400">
                  {escalation.meta}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {escalation.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
