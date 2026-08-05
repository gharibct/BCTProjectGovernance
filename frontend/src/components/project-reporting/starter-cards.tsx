"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CalendarDays, Table2 } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";

// Reporting periods on offer — sample values until there's a backend.
const WEEKS = ["Week 29", "Week 30", "Week 31", "Week 32"];
const CURRENT_WEEK = "Week 31";
const MONTHS = ["May 2026", "Jun 2026", "Jul 2026"];
const CURRENT_MONTH = "Jul 2026";

export function StarterCards() {
  const { projectId } = useParams<{ projectId: string }>();
  const [week, setWeek] = useState(CURRENT_WEEK);
  const [month, setMonth] = useState(CURRENT_MONTH);

  const statusHref = `/project-reporting/${projectId}/project-status`;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <StarterCard
        icon={<Table2 className="size-6" />}
        title="New Weekly Report"
        description="Document operational progress, blockers, and milestone tracking for the current cycle."
        periodLabel="Reporting week"
        options={WEEKS}
        current={CURRENT_WEEK}
        value={week}
        onChange={setWeek}
        cta="Start Weekly Draft"
        href={`${statusHref}?period=${encodeURIComponent(week)}`}
      />
      <StarterCard
        icon={<CalendarDays className="size-6" />}
        title="New Monthly Report"
        description="Compile executive-level health checks, financial variance, and long-term risk assessment."
        periodLabel="Reporting month"
        options={MONTHS}
        current={CURRENT_MONTH}
        value={month}
        onChange={setMonth}
        cta="Start Monthly Audit"
        href={`${statusHref}?period=${encodeURIComponent(month)}`}
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
  current,
  value,
  onChange,
  cta,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  periodLabel: string;
  options: string[];
  current: string;
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
              {options.map((option) => (
                <option key={option} value={option}>
                  {option === current ? `${option} (Current)` : option}
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
