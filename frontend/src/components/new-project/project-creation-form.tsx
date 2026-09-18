"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Database, IdCard, Trash2, UserRound } from "lucide-react";

import {
  AutoBadge,
  ButtonSpinner,
  Field,
  MandatoryBadge,
  SectionCard,
  Segmented,
} from "@/components/forms/form-primitives";
import { RegisterTable } from "@/components/forms/register-table";
import { EmployeePicker } from "@/components/forms/employee-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole } from "@/stores/session";
import { ROLE_LANDING_ROUTE } from "@/lib/menu-config";
import {
  useCreateProjectCreationRequest,
  useProjectCreationRequests,
  type ProjectCreationRequestRow,
} from "@/lib/api/project-creation-requests";
import {
  PM_CANDIDATE_ROLES,
  useAccounts,
  useGeos,
  useOrganizations,
  useRegions,
} from "@/lib/api/reference-data";

const inputClass = "h-11";
const segmentedActiveClass = "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700";

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

  const { data: organizations } = useOrganizations();
  const { data: geos } = useGeos();
  const { data: regions } = useRegions();
  const { data: accounts } = useAccounts();
  const { data: creationRequests } = useProjectCreationRequests();

  const rejectedRequests = React.useMemo(
    () => (creationRequests ?? []).filter((request) => request.status === "Rejected"),
    [creationRequests]
  );

  const [projectName, setProjectName] = React.useState("");
  const [projectNameError, setProjectNameError] = React.useState<string | null>(null);

  const [selectedRejectedId, setSelectedRejectedId] = React.useState("");
  const selectedRejected = React.useMemo(
    () => rejectedRequests.find((request) => request.id === selectedRejectedId) ?? null,
    [rejectedRequests, selectedRejectedId]
  );

  const [projectManagerId, setProjectManagerId] = React.useState<string | null>(null);
  const [projectManagerError, setProjectManagerError] = React.useState<string | null>(null);

  // Project profile — same Org / GEO / Region / Account controls as the charter.
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [geoId, setGeoId] = React.useState<string | null>(null);
  const [regionId, setRegionId] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

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

  // Picking a prior Rejected request reloads it into the form so the same
  // request can be reviewed, tweaked, and resubmitted as a fresh request
  // (rejected rows are kept for their reason, not resubmitted in place).
  const loadRejectedRequest = (request: ProjectCreationRequestRow) => {
    setProjectName(request.project_name);
    setProjectNameError(null);
    setProjectManagerId(request.project_manager_id);
    setProjectManagerError(null);
    setOrganizationId(request.organization_id);
    setGeoId(request.geo_id);
    setRegionId(request.region_id);
    setAccountId(request.account_id);
    setProfileError(null);
    setPendingOracleIds(
      request.oracle_project_ids.map((oracleProjectId, index) => ({
        id: `${Date.now()}-${index}-${oracleProjectId}`,
        oracle_project_id: oracleProjectId,
      }))
    );
    setOracleListError(null);
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
    if (!organizationId || !geoId || !regionId || !accountId) {
      setProfileError("Organization, GEO, Region and Account are all required.");
      blocked = true;
    } else {
      setProfileError(null);
    }
    if (blocked) {
      showError("Fill in every mandatory field before submitting for approval.");
      return;
    }

    try {
      await createRequest.mutateAsync({
        project_name: projectName.trim(),
        project_manager_id: projectManagerId,
        organization_id: organizationId,
        geo_id: geoId,
        region_id: regionId,
        account_id: accountId,
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
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
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
          <Field
            label="Resubmit a Rejected Request"
            htmlFor="rejected-request"
            hint={
              selectedRejected?.review_remarks
                ? `Rejection reason: ${selectedRejected.review_remarks}`
                : rejectedRequests.length === 0
                  ? "No rejected requests to resubmit."
                  : "Load a rejected request's details into the form below."
            }
          >
            <NativeSelect
              id="rejected-request"
              value={selectedRejectedId}
              disabled={rejectedRequests.length === 0}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedRejectedId(id);
                const request = rejectedRequests.find((item) => item.id === id);
                if (request) loadRejectedRequest(request);
              }}
            >
              <option value="">
                {rejectedRequests.length === 0 ? "No rejected requests" : "Select a rejected request…"}
              </option>
              {rejectedRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.project_name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
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
            roleCodes={PM_CANDIDATE_ROLES}
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

      <SectionCard icon={Building2} title="Project Profile">
        {profileError ? (
          <p className="mb-4 text-sm font-medium text-red-600">{profileError}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Organization" badge={<MandatoryBadge />}>
            <Segmented
              options={(organizations ?? []).map((org) => ({ value: org.id, label: org.code }))}
              value={organizationId ?? ""}
              onChange={(v) => {
                setOrganizationId(v || null);
                if (profileError) setProfileError(null);
              }}
              activeClassName={segmentedActiveClass}
            />
          </Field>
          <Field label="GEO" badge={<MandatoryBadge />}>
            <Segmented
              options={(geos ?? []).map((geo) => ({ value: geo.id, label: geo.code }))}
              value={geoId ?? ""}
              onChange={(v) => {
                setGeoId(v || null);
                setRegionId(null);
                if (profileError) setProfileError(null);
              }}
              activeClassName={segmentedActiveClass}
            />
          </Field>
          <Field label="Region" htmlFor="region" badge={<MandatoryBadge />}>
            <NativeSelect
              id="region"
              value={regionId ?? ""}
              onChange={(e) => {
                setRegionId(e.target.value || null);
                if (profileError) setProfileError(null);
              }}
              disabled={!geoId}
            >
              <option value="" disabled>
                {geoId ? "Select…" : "Select a GEO first"}
              </option>
              {(regions ?? [])
                .filter((region) => region.geo_id === geoId)
                .map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Account Name" htmlFor="account-name" badge={<MandatoryBadge />}>
            <NativeSelect
              id="account-name"
              value={accountId ?? ""}
              onChange={(e) => {
                setAccountId(e.target.value || null);
                if (profileError) setProfileError(null);
              }}
            >
              <option value="" disabled>
                Select…
              </option>
              {(accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
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
