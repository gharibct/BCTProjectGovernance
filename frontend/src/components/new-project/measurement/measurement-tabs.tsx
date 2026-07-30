"use client";

import * as React from "react";
import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CloudMaintenanceTab } from "./cloud-maintenance-form";
import { CloudMigrationTab } from "./cloud-migration-form";
import { DevelopmentTab } from "./development-form";
import { StaffingTab } from "./staffing-form";
import { SupportTab } from "./support-form";
import { TestingTab } from "./testing-form";

const TABS = [
  { label: "Development", content: DevelopmentTab },
  { label: "Support", content: SupportTab },
  { label: "Professional Staffing", content: StaffingTab },
  { label: "Testing", content: TestingTab },
  { label: "Cloud Maintenance", content: CloudMaintenanceTab },
  { label: "Cloud Migration", content: CloudMigrationTab },
] as const;

export function MeasurementTabs() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["label"]>(
    "Development"
  );
  const Active = TABS.find((t) => t.label === tab)!.content;

  return (
    <div>
      <div role="tablist" className="flex gap-8 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={tab === t.label}
            onClick={() => setTab(t.label)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === t.label
                ? "border-[#1a4a7a] text-[#1a4a7a]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Active />
      </div>

      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm text-slate-500">
          <Target className="mt-0.5 size-4 shrink-0" />
          We&apos;re at the planning stage — only target metrics can be set;
          actuals follow once the project is underway.
        </p>
        <div className="flex shrink-0 gap-3">
          <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
            Submit Measurements
          </Button>
        </div>
      </div>
    </div>
  );
}
