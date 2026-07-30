"use client";

import * as React from "react";
import { Lock } from "lucide-react";

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

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Metrics are computed from the entered measures and are not editable.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="h-11 px-6 text-sm font-semibold">
            Save Draft
          </Button>
          <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
            Save Measurements
          </Button>
        </div>
      </div>
    </div>
  );
}
