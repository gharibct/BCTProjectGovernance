"use client";

import * as React from "react";
import { ClipboardList, Lock } from "lucide-react";

import { Field, SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Weekly narrative report — three bulleted free-text sections per the
// requirements (§4.4).
const STATUS_SECTIONS = [
  {
    label: "Key Accomplishments",
    placeholder:
      "• Provide the accomplishments from last report to now, including client appreciations — in the form of bullets",
  },
  {
    label: "Upcoming Key Releases / Milestones / Actions",
    placeholder:
      "• Provide upcoming key activities to focus — in the form of bullets",
  },
  {
    label: "Leadership Support / Attention Required",
    placeholder:
      "• Provide the areas where leadership support is required — in the form of bullets",
  },
];

export function StatusForm() {
  return (
    <div>
      <SectionCard
        icon={ClipboardList}
        title="Project Status"
        aside={
          <Field label="Report Date" htmlFor="report-date">
            <Input id="report-date" type="date" className="h-10 w-44" />
          </Field>
        }
      >
        <div className="grid grid-cols-[minmax(14rem,18rem)_1fr] gap-x-8">
          <p className="pb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Project Current Status
          </p>
          <p className="pb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Description
          </p>

          {STATUS_SECTIONS.map((s) => (
            <React.Fragment key={s.label}>
              <p className="border-t border-slate-100 py-5 text-sm font-bold text-slate-800">
                {s.label}
              </p>
              <div className="border-t border-slate-100 py-5">
                <Textarea
                  aria-label={s.label}
                  placeholder={s.placeholder}
                  className="min-h-28"
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </SectionCard>

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          One report per week — past reports are retained in history.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="h-11 px-6 text-sm font-semibold">
            Save Draft
          </Button>
          <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
