"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Table2 } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { useReportingPeriods, type ReportingPeriod } from "@/lib/api/reference-data";
import { currentPeriod } from "@/lib/period-utils";
import type { RegionalScope } from "@/lib/api/regional-status";

// Mirrors project-reporting/starter-cards.tsx, parameterized by scope/scopeId
// instead of reading :projectId from the route.
export function StarterCards({ scope, scopeId }: { scope: RegionalScope; scopeId: string }) {
  const { data: periods = [] } = useReportingPeriods();
  const weeks = periods.filter((p) => p.period_type === "Weekly");
  const months = periods.filter((p) => p.period_type === "Monthly");
  const currentWeek = currentPeriod(periods, "Weekly");
  const currentMonth = currentPeriod(periods, "Monthly");

  const [weekOverride, setWeekOverride] = useState<string | undefined>(undefined);
  const [monthOverride, setMonthOverride] = useState<string | undefined>(undefined);
  const weekId = weekOverride ?? currentWeek?.id ?? "";
  const monthId = monthOverride ?? currentMonth?.id ?? "";

  const statusHref = `/${scope}-reporting/${scopeId}/status`;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <StarterCard
        icon={<Table2 className="size-6" />}
        title="New Weekly Report"
        description="Document operational progress, blockers, and milestone tracking for the current cycle."
        periodLabel="Reporting week"
        options={weeks}
        currentId={currentWeek?.id}
        value={weekId}
        onChange={setWeekOverride}
        cta="Start Weekly Draft"
        href={weekId ? `${statusHref}?period=${weekId}` : statusHref}
      />
      <StarterCard
        icon={<CalendarDays className="size-6" />}
        title="New Monthly Report"
        description="Compile executive-level health checks, financial variance, and long-term risk assessment."
        periodLabel="Reporting month"
        options={months}
        currentId={currentMonth?.id}
        value={monthId}
        onChange={setMonthOverride}
        cta="Start Monthly Audit"
        href={monthId ? `${statusHref}?period=${monthId}` : statusHref}
      />
    </div>
  );
}

function StarterCard({
  icon,
  title,
  description,
  periodLabel,
  options,
  currentId,
  value,
  onChange,
  cta,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  periodLabel: string;
  options: ReportingPeriod[];
  currentId: string | undefined;
  value: string;
  onChange: (value: string) => void;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex items-start gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1a6fc4]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1.5 text-slate-600">{description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="w-44">
            <NativeSelect
              aria-label={periodLabel}
              className="h-9 bg-white text-sm"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="" disabled>
                Select…
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.id === currentId ? `${option.label} (Current)` : option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1a6fc4] hover:underline"
          >
            {cta}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
