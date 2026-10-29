"use client";

import * as React from "react";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";

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
import { ContractDocumentsLink } from "@/components/projects/contract-documents-link";
import {
  useAddOracleId,
  useDeleteOracleId,
  useProjectOracleIds,
  useUpdateOracleContractUrl,
  type ProjectOracleId,
} from "@/lib/api/projects";
import { SHAREPOINT_HOST, SHAREPOINT_SITE, validateContractUrl } from "@/lib/sharepoint-link";

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

// Link Contract Documents — each mapped Oracle project carries its own Contract
// Documents link (a SharePoint folder whose name contains that Oracle ID). The
// link is captured with the Oracle project and can be changed later via Edit.
export function OracleMappingForm() {
  const projectId = useNewProjectId();
  const { data: items = [] } = useProjectOracleIds(projectId);
  const addOracleId = useAddOracleId(projectId);
  const updateContractUrl = useUpdateOracleContractUrl(projectId);
  const deleteOracleId = useDeleteOracleId(projectId);
  // null = add a new Oracle project; otherwise the mapping whose link is being edited.
  const [editing, setEditing] = React.useState<ProjectOracleId | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [oracleProjectId, setOracleProjectId] = React.useState("");
  const [contractUrl, setContractUrl] = React.useState("");
  const [oracleIdError, setOracleIdError] = React.useState<string | null>(null);
  const [contractUrlError, setContractUrlError] = React.useState<string | null>(null);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);
  const saving = addOracleId.isPending || updateContractUrl.isPending;

  const openDrawer = (item: ProjectOracleId | null) => {
    setEditing(item);
    setOracleProjectId(item?.oracle_project_id ?? "");
    setContractUrl(item?.contract_url ?? "");
    setOracleIdError(null);
    setContractUrlError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  // Server errors about the Oracle ID (not in the Oracle master, already mapped)
  // go under that field; everything else is about the link.
  const showServerError = (err: unknown, fallback: string) => {
    const message = errorMessage(err, fallback);
    if (!editing && message.startsWith("Oracle Project ID")) setOracleIdError(message);
    else setContractUrlError(message);
    showError(message);
  };

  const save = () => {
    const oracleId = oracleProjectId.trim();
    const idError = oracleId ? null : "Oracle Project ID is required.";
    const urlError = oracleId ? validateContractUrl(contractUrl, oracleId) : null;
    setOracleIdError(idError);
    setContractUrlError(urlError);
    const firstError = idError ?? urlError;
    if (firstError) {
      showError(firstError);
      return;
    }
    if (editing) {
      updateContractUrl.mutate(
        { id: editing.id, contractUrl: contractUrl.trim() },
        {
          onSuccess: () => {
            closeDrawer();
            showSuccess("Contract Documents Link Saved Successfully");
          },
          onError: (err) => showServerError(err, "Failed to save Contract Documents link."),
        },
      );
      return;
    }
    addOracleId.mutate(
      { oracle_project_id: oracleId, contract_url: contractUrl.trim() },
      {
        onSuccess: () => {
          closeDrawer();
          showSuccess("Oracle Project Mapped Successfully");
        },
        onError: (err) => showServerError(err, "Failed to map Oracle project."),
      },
    );
  };

  const removeMapping = (item: ProjectOracleId) => {
    deleteOracleId.mutate(item.id, {
      onSuccess: () => showSuccess("Oracle Project Removed Successfully"),
      onError: (err) => showError(errorMessage(err, "Failed to remove Oracle project.")),
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
          title="Oracle Projects & Contract Documents"
          aside={
            <div className="flex items-center gap-3">
              <AutoBadge label={`${items.length} mapped`} />
              <Button
                onClick={() => openDrawer(null)}
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
                key: "contract_url",
                label: "Contract Documents",
                render: (item: ProjectOracleId) =>
                  item.contract_url ? (
                    <ContractDocumentsLink url={item.contract_url} label="Open folder" />
                  ) : (
                    <span className="font-medium text-red-600">Link missing</span>
                  ),
              },
              {
                key: "actions",
                label: "",
                render: (item: ProjectOracleId) => (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      aria-label={`Edit contract link for ${item.oracle_project_id}`}
                      title="Edit Contract Documents link"
                      onClick={() => openDrawer(item)}
                      className="text-slate-400 hover:text-[#1a4a7a]"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.oracle_project_id}`}
                      onClick={() => removeMapping(item)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </SectionCard>

        <Sheet open={drawerOpen} onOpenChange={(open) => (open ? setDrawerOpen(true) : closeDrawer())}>
          <SheetContent className="gap-0 p-0">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit Contract Documents Link" : "New Oracle Project"}</SheetTitle>
              <SheetDescription>
                Open the Oracle project&apos;s contract folder in SharePoint ({SHAREPOINT_SITE}) and paste the browser
                address-bar URL. The folder name must contain the Oracle Project ID.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Field
                  label="Oracle Project ID"
                  htmlFor="oracle-project-id"
                  badge={editing ? undefined : <MandatoryBadge />}
                  error={oracleIdError ?? undefined}
                >
                  <Input
                    id="oracle-project-id"
                    placeholder="e.g. ORA-88121"
                    value={oracleProjectId}
                    disabled={!!editing}
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
                    value={editing?.project_description ?? ""}
                    disabled
                    className="h-11"
                  />
                </Field>
                <div className="col-span-2">
                  <Field
                    label="Contract Documents Link"
                    htmlFor="contract-url"
                    badge={<MandatoryBadge />}
                    error={contractUrlError ?? undefined}
                  >
                    <Input
                      id="contract-url"
                      placeholder={`https://${SHAREPOINT_HOST}/sites/${SHAREPOINT_SITE}/...`}
                      value={contractUrl}
                      onChange={(e) => {
                        setContractUrl(e.target.value);
                        if (contractUrlError) setContractUrlError(null);
                      }}
                      className="h-11"
                    />
                  </Field>
                </div>
              </div>
            </div>
            <SheetFooter className="flex-row justify-end gap-3 border-t border-slate-200 p-4">
              <Button variant="outline" className="h-10 px-5 text-sm font-semibold" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
              >
                {saving ? <ButtonSpinner /> : null}
                {editing ? "Save Link" : "Add Projects"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </BaselineGate>
  );
}
