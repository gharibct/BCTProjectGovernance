"use client";

import { useParams } from "next/navigation";
import { Link2 } from "lucide-react";

import { useProjectOracleIds } from "@/lib/api/projects";
import { SectionCard } from "@/components/forms/form-primitives";
import { RegisterTable } from "@/components/forms/register-table";

export function OracleMappingView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: oracleIds = [], isLoading } = useProjectOracleIds(projectId ?? null);

  if (isLoading) return <p className="text-slate-400">Loading…</p>;

  return (
    <SectionCard icon={Link2} title="Mapped Oracle Projects">
      <RegisterTable
        items={oracleIds}
        emptyLabel="No Oracle projects mapped."
        columns={[{ key: "oracle_project_id", label: "Oracle Project ID" }]}
      />
    </SectionCard>
  );
}
