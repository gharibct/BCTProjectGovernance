"use client";

import { useParams } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { useProject } from "@/lib/api/projects";
import { SectionCard, Field } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";

function durationDays(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  return `${Math.round(ms / 86_400_000)} days`;
}

function Value({ children }: { children: React.ReactNode }) {
  return <p className="text-sm whitespace-pre-wrap text-slate-800">{children || "—"}</p>;
}

export function ScopeScheduleView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProject(projectId ?? null);

  if (isLoading && !project) return <p className="text-slate-400">Loading…</p>;
  if (!project) return <EmptyState>No project data.</EmptyState>;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard icon={CalendarRange} title="Scope">
        <div className="grid gap-6">
          <Field label="Project Scope Description">
            <Value>{project.project_scope_description}</Value>
          </Field>
          <Field label="Customer Overview">
            <Value>{project.customer_overview}</Value>
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={CalendarRange} title="Schedule">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Planned Start Date">
            <Value>{project.planned_start_date}</Value>
          </Field>
          <Field label="Planned End Date">
            <Value>{project.planned_end_date}</Value>
          </Field>
          <Field label="Planned Duration">
            <Value>
              {project.planned_duration_days != null
                ? `${project.planned_duration_days} days`
                : durationDays(project.planned_start_date, project.planned_end_date)}
            </Value>
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
