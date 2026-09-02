"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { useProject } from "@/lib/api/projects";
import { useUsers } from "@/lib/api/reference-data";
import { useDEAssessments } from "@/lib/api/de-assessment";
import { HealthDot } from "./shared";

function HistoryInner() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;

  const { data: project } = useProject(projectId);
  const { data: users = [] } = useUsers();
  const { data: assessments = [] } = useDEAssessments(projectId);

  const userName = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";

  const submitted = React.useMemo(
    () =>
      assessments
        .filter((a) => a.status === "Submitted")
        .sort((a, b) => (b.assessment_date ?? "").localeCompare(a.assessment_date ?? "")),
    [assessments]
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/de-assessment"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
          >
            <ArrowLeft className="size-4" />
            Back to Queue
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Assessment History — {project?.project_name ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All submitted Delivery Excellence assessments for this project
          </p>
        </div>
        {projectId ? (
          <Link
            href={`/de-assessment/${projectId}`}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#1a6fc4] hover:bg-slate-50"
          >
            Open Assessment
          </Link>
        ) : null}
      </div>

      <SectionCard icon={History} title="Assessments">
        {submitted.length === 0 ? (
          <EmptyState>No assessments have been submitted for this project yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Assessed By</th>
                  <th className="py-2 pr-3">DE Health</th>
                  <th className="py-2 pr-3 text-right">PCI</th>
                  <th className="py-2 pr-3">Next Due</th>
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
                        <HealthDot health={a.de_assessed_project_health} />
                        {a.de_assessed_project_health}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-600">
                      {a.pci_score ? `${a.pci_score}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                      {a.next_assessment_due_date ?? "—"}
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
