import type { Metadata } from "next";

import { ReportingPeriodsPanel } from "@/components/admin/reporting-periods-panel";

export const metadata: Metadata = {
  title: "Reporting Periods | Governance One",
};

export default function AdminReportingPeriodsPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Reporting Periods</h1>
        <p className="mt-1 text-sm text-slate-500">
          Save a year&apos;s weekly and monthly reporting periods. Weekly reports are due the following Tuesday and
          monthly reports on the 7th of the next month. Change the due date of any period below.
        </p>
      </header>
      <ReportingPeriodsPanel />
    </div>
  );
}
