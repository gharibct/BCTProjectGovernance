"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { useProject } from "@/lib/api/projects";
import { useReportingPeriods, useUsers } from "@/lib/api/reference-data";
import { useHealthDeclarations } from "@/lib/api/health-declarations";
import { useDEAssessments } from "@/lib/api/de-assessment";
import { HealthDot } from "./shared";

function HistoryInner() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;

  // History hangs off the assessment screen, so Back returns to it for every role.
  const backHref = `/de-assessment/${projectId}`;
  const backLabel = "Back to Assessment";

  const { data: project } = useProject(projectId);
  const { data: users = [] } = useUsers();
  const { data: assessments = [] } = useDEAssessments(projectId);
  const { data: declarations = [] } = useHealthDeclarations(projectId);
  const { data: periods = [] } = useReportingPeriods();

  // The PM's declared overall health for the assessment's period — the period
  // saved on the assessment, else the weekly period its date falls in.
  const overallHealthFor = (a: (typeof assessments)[number]) => {
    const periodId =
      a.period_id ??
      periods.find(
        (p) =>
          p.period_type === "Weekly" &&
          !!a.assessment_date &&
          p.start_date <= a.assessment_date &&
          a.assessment_date <= p.end_date,
      )?.id;
    return declarations.find((d) => d.period_id === periodId)?.overall_rating ?? null;
  };

  const userName = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";

  const submitted = React.useMemo(
    () =>
      assessments
        .filter((a) => a.status === "Submitted")
        .sort((a, b) => (b.assessment_date ?? "").localeCompare(a.assessment_date ?? "")),
    [assessments]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Assessment History — {project?.project_name ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All submitted Delivery Excellence assessments for this project
          </p>
        </div>
      </div>

      <SectionCard icon={History} title="Assessments">
        {submitted.length === 0 ? (
          <EmptyState>No assessments have been submitted for this project yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#8EBBE0] bg-[#D6E9F8] text-xs font-bold tracking-wide text-[#205889] uppercase">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Assessed By</th>
                  <th className="py-2 pr-3">Overall Project Health</th>
                  <th className="py-2 pr-3">DE Health</th>
                  <th className="py-2 pr-3 text-right">DE Score</th>
                  <th className="py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {submitted.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                      {a.assessment_date ?? "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                      {userName(a.assessed_by)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <HealthDot health={overallHealthFor(a)} />
                        {overallHealthFor(a) ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <HealthDot health={a.de_assessed_project_health} />
                        {a.de_assessed_project_health}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-600">
                      {a.pci_score ? `${a.pci_score}%` : "—"}
                    </td>
                    <td className="py-2 whitespace-pre-wrap text-slate-600">{a.remarks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export function DeAssessmentHistory() {
  return (
    <Suspense fallback={null}>
      <HistoryInner />
    </Suspense>
  );
}
