"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Database, IdCard, Trash2, UserRound } from "lucide-react";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  MandatoryBadge,
  SectionCard,
} from "@/components/forms/form-primitives";
import { RegisterTable } from "@/components/forms/register-table";
import { EmployeePicker } from "@/components/forms/employee-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole } from "@/stores/session";
import { ROLE_LANDING_ROUTE } from "@/lib/menu-config";
import { useCreateProjectCreationRequest } from "@/lib/api/project-creation-requests";

const inputClass = "h-11";

type PendingOracleId = { id: string; oracle_project_id: string };

// Create Project (Account Head / Geo Head). Collects only what the pre-approval
// step needs — Project Name, Project Manager, and at least one Oracle Project
// mapping — and submits it as a creation REQUEST. No project exists yet: the
// allocated Delivery Excellence approves the request from "Project Creation
// Requests", which is what actually creates the Draft project and hands it to
// the PM under "Provide Project Details".
export function ProjectCreationForm() {
  const router = useRouter();
  const createRequest = useCreateProjectCreationRequest();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);
  const effectiveRole = useEffectiveRole();

  const [projectName, setProjectName] = React.useState("");
  const [projectNameError, setProjectNameError] = React.useState<string | null>(null);

  const [projectManagerId, setProjectManagerId] = React.useState<string | null>(null);
  const [projectManagerError, setProjectManagerError] = React.useState<string | null>(null);

  const [oracleInput, setOracleInput] = React.useState("");
  const [oracleInputError, setOracleInputError] = React.useState<string | null>(null);
  const [pendingOracleIds, setPendingOracleIds] = React.useState<PendingOracleId[]>([]);
  const [oracleListError, setOracleListError] = React.useState<string | null>(null);

  const addOracleId = () => {
    const value = oracleInput.trim();
    if (!value) {
      setOracleInputError("Oracle Project ID is required.");
      return;
    }
    if (pendingOracleIds.some((item) => item.oracle_project_id === value)) {
      setOracleInputError("This Oracle Project ID has already been added.");
      return;
    }
    setOracleInputError(null);
    setOracleListError(null);
    setPendingOracleIds((prev) => [...prev, { id: `${Date.now()}-${value}`, oracle_project_id: value }]);
    setOracleInput("");
  };

  const removeOracleId = (item: PendingOracleId) => {
    setPendingOracleIds((prev) => prev.filter((entry) => entry.id !== item.id));
  };

  const handleSubmit = async () => {
    let blocked = false;
    if (!projectName.trim()) {
      setProjectNameError("Project Name is required.");
      blocked = true;
    } else {
      setProjectNameError(null);
    }
    if (!projectManagerId) {
      setProjectManagerError("Select the Project Manager for this project.");
      blocked = true;
    } else {
      setProjectManagerError(null);
    }
    if (pendingOracleIds.length === 0) {
      setOracleListError("Add at least one Oracle Project before submitting.");
      blocked = true;
    } else {
      setOracleListError(null);
    }
    if (blocked) {
      showError("Project Name, Project Manager and at least one Oracle Project are required.");
      return;
    }

    try {
      await createRequest.mutateAsync({
        project_name: projectName.trim(),
        project_manager_id: projectManagerId,
        oracle_project_ids: pendingOracleIds.map((item) => item.oracle_project_id),
      });
      showSuccess("Project creation request submitted for DE approval.", {
        persistThroughNavigation: true,
      });
      router.push(effectiveRole ? ROLE_LANDING_ROUTE[effectiveRole] : "/dashboard");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to submit the project creation request.");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={IdCard} title="Project Identity">
        <Field
          label="Project Name"
          htmlFor="project-name"
          badge={<MandatoryBadge />}
          error={projectNameError ?? undefined}
        >
          <Input
            id="project-name"
            placeholder="e.g. Core Banking Modernization"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              if (projectNameError) setProjectNameError(null);
            }}
            className={inputClass}
          />
        </Field>
      </SectionCard>

      <SectionCard icon={UserRound} title="Project Manager">
        <Field
          label="Project Manager"
          htmlFor="project-manager"
          badge={<MandatoryBadge />}
          error={projectManagerError ?? undefined}
        >
          <EmployeePicker
            id="project-manager"
            roleCode="PROJECT_MANAGER"
            value={projectManagerId}
            onChange={(id) => {
              setProjectManagerId(id);
              if (projectManagerError) setProjectManagerError(null);
            }}
            placeholder="Search Project Managers…"
            searchPlaceholder="Search Project Managers…"
          />
        </Field>
      </SectionCard>

      <SectionCard
        icon={Database}
        title="Oracle Projects Register"
        aside={<AutoBadge label={`${pendingOracleIds.length} mapped`} />}
      >
        {oracleListError ? (
          <p className="mb-4 text-sm font-medium text-red-600">{oracleListError}</p>
        ) : null}
        <RegisterTable
          items={pendingOracleIds}
          emptyLabel="No Oracle Project IDs added yet."
          columns={[
            { key: "oracle_project_id", label: "Oracle Project ID" },
            {
              key: "actions",
              label: "",
              render: (item: PendingOracleId) => (
                <button
                  type="button"
                  aria-label={`Remove ${item.oracle_project_id}`}
                  onClick={() => removeOracleId(item)}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Database} title="Add Oracle Project">
        <Field
          label="Oracle Project ID"
          htmlFor="oracle-project-id"
          badge={<MandatoryBadge />}
          error={oracleInputError ?? undefined}
        >
          <Input
            id="oracle-project-id"
            placeholder="e.g. ORA-88121"
            value={oracleInput}
            onChange={(e) => {
              setOracleInput(e.target.value);
              if (oracleInputError) setOracleInputError(null);
            }}
            className={inputClass}
          />
        </Field>
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addOracleId}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add
          </Button>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          disabled={createRequest.isPending}
          onClick={handleSubmit}
        >
          {createRequest.isPending ? <ButtonSpinner /> : null}
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
