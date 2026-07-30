"use client";

import * as React from "react";
import { CirclePlus, Lock, ShieldCheck, Siren, Table } from "lucide-react";

import {
  AutoBadge,
  Field,
  MandatoryBadge,
  SectionCard,
  Segmented,
} from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

// Delivery Excellence periodic audit — health rating, PCI score, alert when
// not Green, and a key-findings register per the requirements (§4.12).
const HEALTH_OPTIONS = [
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "potential-red", label: "Potential Red" },
  { value: "red", label: "Red" },
] as const;

type Health = (typeof HEALTH_OPTIONS)[number]["value"];

const ALERT_CATEGORIES = [
  "Core Delivery",
  "People",
  "Operational",
  "Customer",
  "Financial",
  "Compliance",
];

const CLASSIFICATIONS = ["Observation", "Recommendation"];

const FINDING_STATUSES = ["Open", "Closed", "On Hold", "Deferred"];

export function DeAssessmentForm() {
  const [health, setHealth] = React.useState<Health>("green");
  const [findings, setFindings] = React.useState([0]);
  const nextFinding = React.useRef(1);

  return (
    <div>
      <SectionCard
        icon={ShieldCheck}
        title="DE Assessment"
        aside={
          <Field label="Assessment Date" htmlFor="assessment-date">
            <Input id="assessment-date" type="date" className="h-10 w-44" />
          </Field>
        }
      >
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <Field label="DE Assessed Project Health" badge={<MandatoryBadge />}>
            <Segmented
              options={HEALTH_OPTIONS}
              value={health}
              onChange={setHealth}
            />
          </Field>
          <Field label="PCI Score" htmlFor="pci-score" badge={<MandatoryBadge />}>
            <Input
              id="pci-score"
              type="number"
              min={0}
              placeholder="0.00"
              className="h-11 w-36"
            />
          </Field>
        </div>
      </SectionCard>

      {health !== "green" ? (
        <div className="mt-8">
          <SectionCard icon={Siren} title="Alert">
            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
              <Field label="Alert ID" htmlFor="alert-id" badge={<AutoBadge />}>
                <Input id="alert-id" value="ALT-0012" disabled className="h-11" />
              </Field>
              <Field label="Alert Category" htmlFor="alert-category">
                <NativeSelect id="alert-category" defaultValue="">
                  <option value="" disabled>
                    Select category
                  </option>
                  {ALERT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label="Alert Brief Description"
                htmlFor="alert-brief"
                className="col-start-1 col-end-4"
              >
                <Input
                  id="alert-brief"
                  placeholder="One-line summary of the alert"
                  className="h-11"
                />
              </Field>
              <Field
                label="Detailed Description"
                htmlFor="alert-detail"
                className="col-start-1 col-end-4"
              >
                <Textarea
                  id="alert-detail"
                  placeholder="Describe the concern, its impact, and the support needed"
                  className="min-h-28"
                />
              </Field>
              <Field label="Raised By" htmlFor="alert-raised-by" badge={<AutoBadge />}>
                <Input
                  id="alert-raised-by"
                  value="Delivery Excellence"
                  disabled
                  className="h-11"
                />
              </Field>
              <Field label="Raised On" htmlFor="alert-raised-on">
                <Input id="alert-raised-on" type="date" className="h-11" />
              </Field>
            </div>
          </SectionCard>
        </div>
      ) : null}

      <div className="mt-8">
        <SectionCard icon={Table} title="Key Findings">
          <div className="grid grid-cols-[2.5rem_11rem_1fr_9.5rem_9rem_1fr] gap-x-3">
            {["#", "Classification", "Action Taken", "Date", "Status", "Remarks"].map(
              (h) => (
                <p
                  key={h}
                  className="pb-3 text-xs font-bold tracking-wide text-slate-500 uppercase"
                >
                  {h}
                </p>
              )
            )}

            {findings.map((id, index) => (
              <React.Fragment key={id}>
                <p className="flex h-11 items-center border-t border-slate-100 pt-3 text-sm font-semibold text-slate-500 tabular-nums">
                  {index + 1}
                </p>
                <div className="border-t border-slate-100 pt-3">
                  <NativeSelect aria-label={`Finding ${index + 1} classification`}>
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <Input
                    aria-label={`Finding ${index + 1} action taken`}
                    placeholder="Action taken"
                    className="h-11"
                  />
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <Input
                    aria-label={`Finding ${index + 1} date`}
                    type="date"
                    className="h-11"
                  />
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <NativeSelect aria-label={`Finding ${index + 1} status`}>
                    {FINDING_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <Input
                    aria-label={`Finding ${index + 1} remarks`}
                    placeholder="Remarks"
                    className="h-11"
                  />
                </div>
              </React.Fragment>
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-5 h-10 gap-2 text-sm font-semibold"
            onClick={() => setFindings((f) => [...f, nextFinding.current++])}
          >
            <CirclePlus className="size-4" />
            Add Finding
          </Button>
        </SectionCard>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          One assessment per cycle — past assessments are retained in history.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="h-11 px-6 text-sm font-semibold">
            Save Draft
          </Button>
          <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
            Submit Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}
