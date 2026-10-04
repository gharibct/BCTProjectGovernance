"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { usePageBanner } from "@/stores/page-banner";
import {
  useAdminReportingPeriods,
  useGenerateReportingPeriods,
  useUpdatePeriodDueDate,
  type AdminReportingPeriod,
} from "@/lib/api/reporting-period-admin";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function PeriodRow({ period }: { period: AdminReportingPeriod }) {
  const updateDueDate = useUpdatePeriodDueDate();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);
  const saved = period.due_date ?? "";
  // null until the admin edits the date, so a refetch shows the saved value.
  const [edited, setEdited] = React.useState<string | null>(null);
  const draft = edited ?? saved;
  const dirty = draft !== saved && draft !== "";

  const save = () =>
    updateDueDate.mutate(
      { id: period.id, due_date: draft },
      {
        onSuccess: () => {
          setEdited(null);
          showSuccess(`Due date for ${period.label} updated successfully`);
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update the due date."),
      },
    );

  return (
    <tr className="border-t border-slate-100">
      <td className="px-6 py-2.5 font-semibold text-slate-800">{period.code}</td>
      <td className="px-3 py-2.5 text-slate-600">{period.label}</td>
      <td className="px-3 py-2.5 text-slate-600">
        {formatDate(period.start_date)} – {formatDate(period.end_date)}
      </td>
      <td className="px-3 py-2.5">
        <Input
          type="date"
          aria-label={`Due date for ${period.label}`}
          className="h-9 w-44"
          min={period.end_date}
          value={draft}
          onChange={(e) => setEdited(e.target.value)}
        />
      </td>
      <td className="px-6 py-2.5 text-right">
        <Button
          className="h-9 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={!dirty || updateDueDate.isPending}
          onClick={save}
        >
          {updateDueDate.isPending ? <ButtonSpinner /> : null}
          Save
        </Button>
      </td>
    </tr>
  );
}

function PeriodTable({ title, periods }: { title: string; periods: AdminReportingPeriod[] }) {
  return (
    <SectionCard icon={CalendarDays} title={title}>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#D6E9F8]">
            <tr className="text-xs tracking-wide text-[#205889] uppercase">
              <th className="px-6 py-3 font-bold">Code</th>
              <th className="px-3 py-3 font-bold">Label</th>
              <th className="px-3 py-3 font-bold">Period</th>
              <th className="px-3 py-3 font-bold">Due Date</th>
              <th className="px-6 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                  No periods match the selected filters.
                </td>
              </tr>
            ) : (
              periods.map((p) => <PeriodRow key={p.id} period={p} />)
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function ReportingPeriodsPanel() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const { data: periods = [] } = useAdminReportingPeriods(year);
  const [type, setType] = React.useState<"all" | "Weekly" | "Monthly">("all");
  const [month, setMonth] = React.useState("all");
  const generate = useGenerateReportingPeriods();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const years = Array.from({ length: 7 }, (_, i) => thisYear - 2 + i);
  // The month filter matches a period's end date (a week belongs to the month it ends in).
  const inMonth = (p: AdminReportingPeriod) => month === "all" || Number(p.end_date.slice(5, 7)) === Number(month);
  const weekly = type === "Monthly" ? [] : periods.filter((p) => p.period_type === "Weekly" && inMonth(p));
  const monthly = type === "Weekly" ? [] : periods.filter((p) => p.period_type === "Monthly" && inMonth(p));

  const handleGenerate = () =>
    generate.mutate(year, {
      onSuccess: (result) =>
        showSuccess(
          result.weekly_created + result.monthly_created === 0
            ? `All ${year} reporting periods already exist`
            : `Saved ${result.weekly_created} weekly and ${result.monthly_created} monthly periods for ${year}`,
        ),
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to save reporting periods."),
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-36">
            <NativeSelect
              aria-label="Year"
              className="h-10 bg-white text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-40">
            <NativeSelect
              aria-label="Report type"
              className="h-10 bg-white text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as "all" | "Weekly" | "Monthly")}
            >
              <option value="all">All Types</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </NativeSelect>
          </div>
          <div className="w-40">
            <NativeSelect
              aria-label="Month"
              className="h-10 bg-white text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="all">All Months</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {generate.isPending ? <ButtonSpinner /> : null}
          Save Reporting Periods for {year}
        </Button>
      </div>

      {type !== "Monthly" ? <PeriodTable title="Weekly Reporting Periods" periods={weekly} /> : null}
      {type !== "Weekly" ? <PeriodTable title="Monthly Reporting Periods" periods={monthly} /> : null}
    </div>
  );
}
