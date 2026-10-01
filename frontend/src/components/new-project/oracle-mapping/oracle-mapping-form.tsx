"use client";

import * as React from "react";
import { Database, Plus, Trash2 } from "lucide-react";

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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNewProjectId } from "@/stores/new-project-ui";
import { usePageBanner } from "@/stores/page-banner";
import { BaselineGate } from "../baseline-lock";
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
  // The add form lives in a right drawer.
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const openDrawer = () => {
    setOracleProjectId("");
    setOracleIdError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setOracleProjectId("");
    setOracleIdError(null);
    setDrawerOpen(false);
  };

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
        closeDrawer();
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
    <BaselineGate>
      <div className="flex flex-col gap-8">
        <SectionCard
          icon={Database}
          title="Oracle Projects Register"
          aside={
            <div className="flex items-center gap-3">
              <AutoBadge label={`${items.length} mapped`} />
              <Button
                onClick={openDrawer}
                className="h-9 gap-1.5 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                <Plus className="size-4" />
                Add Oracle Project
              </Button>
            </div>
          }
        >
          <RegisterTable
            items={items}
            emptyLabel="No Oracle Project IDs mapped yet."
            columns={[
              { key: "oracle_project_id", label: "Oracle Project ID" },
              {
                key: "description",
                label: "Project Description",
                render: (item: ProjectOracleId) =>
                  item.project_description ? (
                    item.project_description
                  ) : (
                    <span className="text-slate-400 italic">Not found in Oracle project master</span>
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

        <Sheet open={drawerOpen} onOpenChange={(open) => (open ? setDrawerOpen(true) : closeDrawer())}>
          <SheetContent className="gap-0 p-0">
            <SheetHeader>
              <SheetTitle>New Oracle Project</SheetTitle>
              <SheetDescription>The description is filled in from the Oracle project master once mapped.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
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
                    placeholder="Shown in the register once mapped"
                    disabled
                    className="h-11"
                  />
                </Field>
              </div>
            </div>
            <SheetFooter className="flex-row justify-end gap-3 border-t border-slate-200 p-4">
              <Button variant="outline" className="h-10 px-5 text-sm font-semibold" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button
                onClick={addMapping}
                disabled={addOracleId.isPending}
                className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                {addOracleId.isPending ? <ButtonSpinner /> : null}
                Add Projects
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </BaselineGate>
  );
}
