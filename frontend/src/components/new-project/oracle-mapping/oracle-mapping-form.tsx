"use client";

import * as React from "react";
import { Database, Trash2 } from "lucide-react";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  MandatoryBadge,
  SectionCard,
} from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import {
  useAddOracleId,
  useDeleteOracleId,
  useProjectOracleIds,
  type ProjectOracleId,
} from "@/lib/api/projects";

export function OracleMappingForm() {
  const projectId = useNewProjectId();
  const { data: items = [] } = useProjectOracleIds(projectId);
  const addOracleId = useAddOracleId(projectId);
  const deleteOracleId = useDeleteOracleId(projectId);
  const [oracleProjectId, setOracleProjectId] = React.useState("");
  const [oracleIdError, setOracleIdError] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const addMapping = () => {
    if (!oracleProjectId.trim()) {
      const message = "Oracle Project ID is required.";
      setOracleIdError(message);
      showError(message);
      return;
    }
    setOracleIdError(null);
    addOracleId.mutate(oracleProjectId.trim(), {
      onSuccess: () => {
        setOracleProjectId("");
        showSuccess("Oracle Project Mapped Successfully");
      },
      onError: (err) =>
        showError(err instanceof Error ? err.message : "Failed to map Oracle project."),
    });
  };

  const removeMapping = (item: ProjectOracleId) => {
    deleteOracleId.mutate(item.id, {
      onSuccess: () => showSuccess("Oracle Project Removed Successfully"),
      onError: (err) =>
        showError(err instanceof Error ? err.message : "Failed to remove Oracle project."),
    });
  };

  if (!projectId) {
    return (
      <EmptyState>Create the project on the Project Profile tab first.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={Database}
        title="Oracle Projects Register"
        aside={<AutoBadge label={`${items.length} mapped`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No Oracle Project IDs mapped yet."
          columns={[
            { key: "oracle_project_id", label: "Oracle Project ID" },
            {
              key: "description",
              label: "Project Description",
              render: () => (
                <span className="text-slate-400 italic">Pending Oracle sync…</span>
              ),
            },
            {
              key: "actions",
              label: "",
              render: (item: ProjectOracleId) => (
                <button
                  type="button"
                  aria-label={`Remove ${item.oracle_project_id}`}
                  onClick={() => removeMapping(item)}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Database} title="New Oracle Project">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field
            label="Oracle Project ID"
            htmlFor="oracle-project-id"
            badge={<MandatoryBadge />}
            error={oracleIdError ?? undefined}
          >
            <Input
              id="oracle-project-id"
              placeholder="e.g. ORA-88121"
              value={oracleProjectId}
              onChange={(e) => {
                setOracleProjectId(e.target.value);
                if (oracleIdError) setOracleIdError(null);
              }}
              className="h-11"
            />
          </Field>
          <Field
            label="Project Description"
            htmlFor="oracle-project-description"
            badge={<AutoBadge label="From Oracle" />}
          >
            <Input
              id="oracle-project-description"
              placeholder="Fetched automatically once synced"
              disabled
              className="h-11"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addMapping}
            disabled={addOracleId.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {addOracleId.isPending ? <ButtonSpinner /> : null}
            Add Projects
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
