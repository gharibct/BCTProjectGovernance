import Link from "next/link";
import {
  ArrowRightToLine,
  CircleCheck,
  Flag,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StarterCards } from "./starter-cards";

// Sample project identity and reporting data until there's a backend.
const PROJECT_CODE = "PRJ-2026-0042";
const PROJECT_DESCRIPTION =
  "Modernization of the core banking platform for Gulf National Bank, covering deposits, lending and payments modules across APAC operations.";

const STATS = [
  {
    label: "Risk Index",
    value: "3/10",
    qualifier: "Low",
    qualifierClass: "text-emerald-600",
    icon: ShieldCheck,
  },
  {
    label: "Utilization",
    value: "92%",
    qualifier: "Optimal",
    qualifierClass: "text-[#1a6fc4]",
    icon: Users,
  },
  {
    label: "Milestones",
    value: "12/15",
    qualifier: "On Track",
    qualifierClass: "text-[#1a6fc4]",
    icon: Flag,
  },
  {
    label: "Overall Status",
    value: "Healthy",
    qualifier: "Green",
    qualifierClass: "text-emerald-600",
    icon: CircleCheck,
  },
];

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
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {PROJECT_CODE} - Project Reporting
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">{PROJECT_DESCRIPTION}</p>
        </div>
        <Button
          asChild
          className="h-11 shrink-0 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          <Link href="/project-charter">
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
                      <Link href="/project-charter">Open</Link>
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
