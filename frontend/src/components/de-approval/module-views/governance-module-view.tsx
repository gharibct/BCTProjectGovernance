"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { useDeReviewDetail } from "@/lib/api/de-approval";
import { EmptyState } from "@/components/forms/empty-state";

// Shared chrome for the read-only governance module views launched from the
// Completeness Checklist on /de-approval/[projectId]. No edit affordances; the
// only navigation is the uniform "Back to Governance Review" link.
export function GovernanceModuleView({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;

  const { data: detail, isLoading, isError, error } = useDeReviewDetail(projectId);

  if (!projectId) return <EmptyState>No project selected.</EmptyState>;

  const backLink = (
    <Link
      href={`/de-approval/${projectId}`}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]"
    >
      <ArrowLeft className="size-4" />
      Back to Governance Review
    </Link>
  );

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl">
        {backLink}
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold">Couldn&apos;t load this project.</p>
          <p className="mt-1 text-red-600">
            {error instanceof ApiError ? String(error.detail ?? error.message) : "Something went wrong."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        {backLink}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {title}
          {detail ? ` — ${detail.project_name}` : ""}
        </h1>
        {detail ? (
          <p className="mt-1 text-sm text-slate-500">
            {detail.project_code}
            {" · "}
            {detail.account_name ?? "—"}
          </p>
        ) : null}
      </div>

      {isLoading && !detail ? <p className="text-slate-400">Loading…</p> : children}
    </div>
  );
}
