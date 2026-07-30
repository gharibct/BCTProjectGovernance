"use client";

import * as React from "react";
import {
  Banknote,
  CalendarDays,
  IdCard,
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
import { useNewProjectUi } from "@/stores/new-project-ui";

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
  const { projectCode, setProjectCode, projectName, setProjectName } =
    useNewProjectUi();

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={IdCard} title="Project Identity">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Project Code" htmlFor="project-code" badge={<MandatoryBadge />}>
            <Input
              id="project-code"
              placeholder="e.g. PRJ-2026-0043"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Project Name" htmlFor="project-name" badge={<MandatoryBadge />}>
            <Input
              id="project-name"
              placeholder="e.g. Core Banking Modernization"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={Info} title="Project Details">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Contract Type" htmlFor="contract-type">
            <NativeSelect id="contract-type" defaultValue="FPP">
              {["FPP", "T&M", "Capped T&M", "Internal"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Project Type" htmlFor="project-type">
            <NativeSelect id="project-type" defaultValue="Development">
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
            />
          </Field>
          <Field label="Project Owned" htmlFor="project-owned">
            <NativeSelect id="project-owned" defaultValue="Fully Owned">
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
            />
          </Field>
          <Field label="Account Name" htmlFor="account-name">
            <Input
              id="account-name"
              placeholder="e.g. Gulf National Bank"
              className={inputClass}
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
            />
          </Field>
          <Field label="Delivery Manager" htmlFor="delivery-manager">
            <Input
              id="delivery-manager"
              placeholder="Name of the DM"
              className={inputClass}
            />
          </Field>
          <Field label="Delivery Excellence" htmlFor="delivery-excellence">
            <Input
              id="delivery-excellence"
              placeholder="Assigned DE person"
              className={inputClass}
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
            />
          </Field>
          <Field label="Project Currency" htmlFor="project-currency">
            <NativeSelect id="project-currency" defaultValue="USD">
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
            />
          </Field>
          <Field label="Billing Type" htmlFor="billing-type">
            <NativeSelect id="billing-type" defaultValue="FPP">
              {["FPP", "FB", "T&M", "Product", "Unit Based Billing", "Others"].map(
                (type) => (
                  <option key={type}>{type}</option>
                )
              )}
            </NativeSelect>
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

function ScopeAndScheduleTab() {
  const [dates, setDates] = React.useState({
    plannedStart: "",
    plannedEnd: "",
  });

  const setDate =
    (key: keyof typeof dates) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDates((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={ScanSearch} title="Scope Definition">
        <div className="flex flex-col gap-6">
          <Field label="Customer Overview" htmlFor="customer-overview">
            <Textarea
              id="customer-overview"
              placeholder="Who the customer is, their business, and the relationship context…"
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
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={CalendarDays} title="Schedule">
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
          <Field label="Planned End Date" htmlFor="planned-end">
            <Input
              id="planned-end"
              type="date"
              value={dates.plannedEnd}
              onChange={setDate("plannedEnd")}
              className={inputClass}
            />
          </Field>
          <Field label="Planned Duration" badge={<AutoBadge />}>
            <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
              {durationDays(dates.plannedStart, dates.plannedEnd)}
            </div>
          </Field>
        </div>
      </SectionCard>
    </div>
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
  const section = useNewProjectUi((state) => state.section);
  const isSchedule = section === "progress";
  const isHealth = section === "health";

  return (
    <div>
      <div>
        {section === "description" && <ProjectDescriptionTab />}
        {section === "progress" && <ScopeAndScheduleTab />}
        {section === "resources" && <ResourceAllocationTab />}
        {section === "health" && <HealthDeclaration />}
      </div>

      {/* Actions */}
      <div className="mt-10 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Lock className="size-4" />
          Editable by the Project Manager while the project is unlocked.
        </p>
        <div className="flex gap-3">
          {isSchedule ? (
            <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
              Save Scope &amp; Schedule
            </Button>
          ) : isHealth ? (
            <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
              Submit Self Assessment
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-11 border-slate-300 bg-slate-100 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Edit Project
              </Button>
              <Button className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]">
                Create Project
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
