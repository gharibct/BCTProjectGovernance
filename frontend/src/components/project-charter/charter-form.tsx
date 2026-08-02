"use client";

import * as React from "react";
import {
  Banknote,
  CalendarDays,
  Info,
  Lock,
  RefreshCw,
  ScanSearch,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCharterUi } from "@/stores/charter-ui";

import {
  AutoBadge,
  Field,
  MandatoryBadge,
  SectionCard,
  Segmented,
} from "@/components/forms/form-primitives";
import { HealthDeclaration } from "./health-declaration";

const inputClass = "h-11";
const segmentedActiveClass = "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700";

function ProjectDescriptionTab() {
  const [engagementType, setEngagementType] = React.useState("Implementation");
  const [organization, setOrganization] = React.useState("BCTPL");
  const [geo, setGeo] = React.useState("APAC");

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Info} title="Project Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Contract Type" htmlFor="contract-type">
            <NativeSelect id="contract-type" defaultValue="FPP" disabled>
              {["FPP", "T&M", "Capped T&M", "Internal"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project Type" htmlFor="project-type">
            <NativeSelect id="project-type" defaultValue="Development" disabled>
              {[
                "Development",
                "Maintenance",
                "Professional Staffing",
                "Support (Application)",
                "Support (Infrastructure)",
                "Testing",
                "Cloud Maintenance",
                "Cloud Migration",
              ].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Engagement Type">
            <Segmented
              options={[
                { value: "Implementation", label: "Implementation" },
                { value: "Support", label: "Support" },
              ]}
              value={engagementType}
              onChange={setEngagementType}
              activeClassName={segmentedActiveClass}
              disabled
            />
          </Field>
          <Field label="Project Owned" htmlFor="project-owned">
            <NativeSelect id="project-owned" defaultValue="Fully Owned" disabled>
              {["Fully Owned", "Co-Owned", "Customer Driven"].map((owned) => (
                <option key={owned}>{owned}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Organization">
            <Segmented
              options={[
                { value: "BCTPL", label: "BCTPL" },
                { value: "BCTC", label: "BCTC" },
                { value: "FT", label: "FT" },
              ]}
              value={organization}
              onChange={setOrganization}
              activeClassName={segmentedActiveClass}
              disabled
            />
          </Field>
          <Field label="GEO">
            <Segmented
              options={[
                { value: "APAC", label: "APAC" },
                { value: "MEA", label: "MEA" },
                { value: "US", label: "US" },
              ]}
              value={geo}
              onChange={setGeo}
              activeClassName={segmentedActiveClass}
              disabled
            />
          </Field>
          <Field label="Account Name" htmlFor="account-name">
            <Input
              id="account-name"
              placeholder="e.g. Gulf National Bank"
              className={inputClass}
              disabled
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={UserRound} title="Delivery Team">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
          <Field label="Project Manager" htmlFor="project-manager">
            <Input
              id="project-manager"
              placeholder="Name of the PM"
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Delivery Manager" htmlFor="delivery-manager">
            <Input
              id="delivery-manager"
              placeholder="Name of the DM"
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Delivery Excellence" htmlFor="delivery-excellence">
            <Input
              id="delivery-excellence"
              placeholder="Assigned DE person"
              className={inputClass}
              disabled
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={Banknote} title="Commercials">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Project Revenue" htmlFor="project-revenue">
            <Input
              id="project-revenue"
              type="number"
              min={0}
              placeholder="0.00"
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Project Currency" htmlFor="project-currency">
            <NativeSelect id="project-currency" defaultValue="USD" disabled>
              {["USD", "OMR", "AED", "SAR", "INR", "EUR"].map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Oracle Project ID(s)"
            htmlFor="oracle-ids"
            hint="Comma-separated when the project maps to multiple Oracle IDs"
          >
            <Input
              id="oracle-ids"
              placeholder="e.g. ORA-88121, ORA-88122"
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Billing Type" htmlFor="billing-type">
            <NativeSelect id="billing-type" defaultValue="FPP" disabled>
              {["FPP", "FB", "T&M", "Product", "Unit Based Billing", "Others"].map(
                (type) => (
                  <option key={type}>{type}</option>
                )
              )}
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={ScanSearch} title="Scope Definition">
        <div className="flex flex-col gap-6">
          <Field label="Customer Overview" htmlFor="customer-overview">
            <Textarea
              id="customer-overview"
              placeholder="Who the customer is, their business, and the relationship context…"
              disabled
            />
          </Field>
          <Field
            label="Project Scope Description"
            htmlFor="scope-description"
            badge={<MandatoryBadge />}
          >
            <Textarea
              id="scope-description"
              className="min-h-32"
              placeholder="What the project will deliver — objectives, boundaries, and key deliverables…"
              disabled
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

function durationDays(from: string, to: string): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  return `${Math.round(ms / 86_400_000)} days`;
}

function ProgressTab() {
  const [dates, setDates] = React.useState({
    plannedStart: "",
    actualStart: "",
    plannedEnd: "",
    actualEnd: "",
  });

  const setDate =
    (key: keyof typeof dates) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDates((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <SectionCard icon={CalendarDays} title="Progress">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <Field label="Planned Start Date" htmlFor="planned-start">
          <Input
            id="planned-start"
            type="date"
            value={dates.plannedStart}
            onChange={setDate("plannedStart")}
            className={inputClass}
          />
        </Field>
        <Field label="Actual Start Date" htmlFor="actual-start">
          <Input
            id="actual-start"
            type="date"
            value={dates.actualStart}
            onChange={setDate("actualStart")}
            className={inputClass}
          />
        </Field>
        <Field label="Planned End Date" htmlFor="planned-end">
          <Input
            id="planned-end"
            type="date"
            value={dates.plannedEnd}
            onChange={setDate("plannedEnd")}
            className={inputClass}
          />
        </Field>
        <Field label="Actual End Date" htmlFor="actual-end">
          <Input
            id="actual-end"
            type="date"
            value={dates.actualEnd}
            onChange={setDate("actualEnd")}
            className={inputClass}
          />
        </Field>
        <Field label="Planned Duration" badge={<AutoBadge />}>
          <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
            {durationDays(dates.plannedStart, dates.plannedEnd)}
          </div>
        </Field>
        <Field label="Actual Duration" badge={<AutoBadge />}>
          <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
            {durationDays(dates.actualStart, dates.actualEnd)}
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

// Resource allocation is synced from the BCT Oracle App — read-only here.
const RESOURCES = [
  { name: "Anitha Raman", role: "Technical Lead", fte: 1.0 },
  { name: "Suresh Kumar", role: "Senior Developer", fte: 1.0 },
  { name: "Meera Venkat", role: "Developer", fte: 1.0 },
  { name: "Joseph Antony", role: "QA Engineer", fte: 0.5 },
  { name: "Fatima Al Balushi", role: "Business Analyst", fte: 0.5 },
];

function ResourceAllocationTab() {
  const totalFte = RESOURCES.reduce((sum, r) => sum + r.fte, 0);

  return (
    <SectionCard
      icon={UserRound}
      title="Resource Allocation"
      aside={
        <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <RefreshCw className="size-3.5" />
          Synced from BCT Oracle App · today 06:00
        </span>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-600 uppercase">
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">FTE Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RESOURCES.map((resource) => (
              <tr key={resource.name}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {resource.name}
                </td>
                <td className="px-4 py-3 text-slate-600">{resource.role}</td>
                <td className="px-4 py-3 text-right text-slate-800 tabular-nums">
                  {resource.fte.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-4">
        <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Head Count
            </p>
            <AutoBadge />
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {RESOURCES.length}
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Total FTE
            </p>
            <AutoBadge />
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {totalFte.toFixed(1)}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

export function CharterForm() {
  // Section switching lives in the right-side Project Navigation menu.
  const section = useCharterUi((state) => state.section);
  const isDescription = section === "description";

  return (
    <div>
      <div>
        {section === "description" && <ProjectDescriptionTab />}
        {section === "progress" && <ProgressTab />}
        {section === "resources" && <ResourceAllocationTab />}
        {section === "health" && <HealthDeclaration />}
      </div>

      {/* Actions */}
      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          {isDescription
            ? "Locked — this project is Approved and no longer editable."
            : "Editable by the Project Manager while the project is unlocked."}
        </p>
        {isDescription ? null : (
          <div className="flex gap-3">
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold">
              Save Draft
            </Button>
            <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
              Save Charter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
