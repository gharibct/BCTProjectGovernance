"use client";

import * as React from "react";
import { Building2, FolderOpen, Globe, UserCog, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  useReassignableAccounts,
  useReassignableGeos,
  useReassignableProjects,
  useReassignAccountManager,
  useReassignGeoHead,
  useReassignProjectManager,
} from "@/lib/api/reassignment";
import {
  canReassignGeoHead,
  canReassignOwners,
} from "@/lib/api/reassignment-permissions";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard, ButtonSpinner } from "@/components/forms/form-primitives";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { ACCOUNT_HEAD_CANDIDATE_ROLES, PM_CANDIDATE_ROLES } from "@/lib/api/reference-data";

const GEO_HEAD_ROLES = ["GEO_HEAD"] as const;

// Rows shown per page in each reassignment tab (matches pm-findings-view).
const PAGE_SIZE = 15;

// Reassign Owners — a Geo Head, Account Head or Delivery Excellence user
// changes a Project's Project Manager, an Account's Account Manager, or a
// Geo's Geo Head at any time, independent of the project/amendment workflow.
// The three sections are tabs; each row has its own picker + Save (no bulk
// apply). The server scopes every list by role — a Geo Head sees its geo(s),
// an Account Head only its own accounts (and no Geo Head tab).

// Sentinel option value for "no owner set" in the Current PM / Current AM
// filters — distinct from "" (which means "All").
const NOT_ALLOCATED = "__not_allocated__";

function distinct(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b),
  );
}

// --- shared row -----------------------------------------------------------

type ReassignRowProps = {
  /** One node per leading entity column (Project / Geo / Region / Account …). */
  leading: React.ReactNode[];
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  /** Roles eligible for the New-owner picker (any-of). */
  roleCodes: readonly string[];
  canWrite: boolean;
  saving: boolean;
  onSave: (userId: string) => void;
};

function ReassignRow({
  leading,
  currentOwnerId,
  currentOwnerName,
  roleCodes,
  canWrite,
  saving,
  onSave,
}: ReassignRowProps) {
  // `undefined` = untouched (show the current owner); a string / null = an
  // explicit pick that differs from what's stored.
  const [pending, setPending] = React.useState<string | null | undefined>(undefined);
  const chosen = pending === undefined ? currentOwnerId : pending;
  const dirty = !!chosen && chosen !== currentOwnerId;

  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
      {leading.map((cell, i) => (
        <td key={i} className="px-3 py-2.5 text-slate-600">
          {cell}
        </td>
      ))}
      <td className="px-3 py-2.5 text-slate-600">{currentOwnerName ?? "—"}</td>
      <td className="px-3 py-2.5 min-w-[240px]">
        <ResourcePicker
          value={chosen}
          onChange={(id) => setPending(id)}
          roleCodes={roleCodes}
          disabled={!canWrite || saving}
          initialLabel={
            pending === undefined && currentOwnerName ? currentOwnerName : undefined
          }
          placeholder="Select person…"
          className={cn(dirty && "border-[#1a6fc4]")}
        />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button
          size="sm"
          disabled={!canWrite || !dirty || saving}
          onClick={() => chosen && onSave(chosen)}
          className="gap-2 bg-[#1a4a7a] font-semibold text-white hover:bg-[#15406b]"
        >
          {saving ? <ButtonSpinner /> : null}
          Save
        </Button>
      </td>
    </tr>
  );
}

// --- table frame -------------------------------------------------------

function TableFrame({
  headers,
  toolbar,
  isLoading,
  isError,
  error,
  onRetry,
  empty,
  footer,
  children,
}: {
  /** Leading entity column headers; the New-owner picker + actions are appended. */
  headers: string[];
  toolbar: React.ReactNode;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  /** Pagination bar, rendered below the table when there are rows. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-semibold">Couldn&apos;t load this list.</p>
        <p className="mt-1 text-red-600">
          {error instanceof ApiError
            ? String(error.detail ?? error.message)
            : "Something went wrong."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1 font-semibold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }
  if (isLoading) return <p className="text-slate-400">Loading…</p>;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">{toolbar}</div>
      {empty ? (
        <p className="py-4 text-sm text-slate-400">Nothing to show.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={cn("px-3 py-3", i === headers.length - 1 && "min-w-[240px]")}
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>{children}</tbody>
            </table>
          </div>
          {footer}
        </>
      )}
    </>
  );
}

// --- filter select ---------------------------------------------------

function FilterSelect({
  label,
  value,
  onChange,
  options,
  width = "w-44",
  notAllocated = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  width?: string;
  /** Add a "Not Allocated" choice (Current PM / Current AM filters). */
  notAllocated?: boolean;
}) {
  return (
    <div className={cn(width, "shrink-0")}>
      <NativeSelect
        aria-label={label}
        className="h-9 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{label} [All]</option>
        {notAllocated ? <option value={NOT_ALLOCATED}>Not Allocated</option> : null}
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

// --- tabs -----------------------------------------------------------

type TabId = "pm" | "am" | "geo";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "pm", label: "Project Manager", icon: FolderOpen },
  { id: "am", label: "Account Manager", icon: Building2 },
  { id: "geo", label: "Geo Head", icon: Globe },
];

export function ReassignmentView() {
  const user = useSession((s) => s.user);
  const roleCode = user?.role.code;
  const canWrite = canReassignOwners(roleCode);
  const showGeoTab = canReassignGeoHead(roleCode);
  const tabs = React.useMemo(
    () => (showGeoTab ? TABS : TABS.filter((t) => t.id !== "geo")),
    [showGeoTab],
  );

  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  const projects = useReassignableProjects();
  const accounts = useReassignableAccounts();
  const geos = useReassignableGeos();

  const reassignPm = useReassignProjectManager();
  const reassignAm = useReassignAccountManager();
  const reassignGeoHead = useReassignGeoHead();

  const [tab, setTab] = React.useState<TabId>("pm");
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [pSearch, setPSearch] = React.useState("");
  const [aSearch, setASearch] = React.useState("");
  const [gSearch, setGSearch] = React.useState("");

  // Filter state — "" means "All"; NOT_ALLOCATED means "no owner set".
  const [pmGeo, setPmGeo] = React.useState("");
  const [pmRegion, setPmRegion] = React.useState("");
  const [pmAccount, setPmAccount] = React.useState("");
  const [pmPm, setPmPm] = React.useState("");
  const [amGeo, setAmGeo] = React.useState("");
  const [amAm, setAmAm] = React.useState("");

  // Per-tab pagination — each tab keeps its own page position. Every filter /
  // search change routes through these setters so it also jumps back to page 1
  // (a narrowed result set must never strand the user on an empty page).
  const [pmSkip, setPmSkip] = React.useState(0);
  const [amSkip, setAmSkip] = React.useState(0);
  const [geoSkip, setGeoSkip] = React.useState(0);

  const onError = (err: unknown) =>
    showError(err instanceof Error ? err.message : "Reassignment failed.");

  // --- Project Manager tab ------------------------------------------
  const allProjects = React.useMemo(() => projects.data ?? [], [projects.data]);
  const pmOptions = React.useMemo(() => {
    const byGeo = pmGeo ? allProjects.filter((r) => r.geo_name === pmGeo) : allProjects;
    const byRegion = pmRegion ? byGeo.filter((r) => r.region_name === pmRegion) : byGeo;
    return {
      geos: distinct(allProjects.map((r) => r.geo_name)),
      regions: distinct(byGeo.map((r) => r.region_name)),
      accounts: distinct(byRegion.map((r) => r.account_name)),
      pms: distinct(allProjects.map((r) => r.project_manager_name)),
    };
  }, [allProjects, pmGeo, pmRegion]);

  const projectRows = allProjects.filter((r) => {
    if (pmGeo && r.geo_name !== pmGeo) return false;
    if (pmRegion && r.region_name !== pmRegion) return false;
    if (pmAccount && r.account_name !== pmAccount) return false;
    if (pmPm === NOT_ALLOCATED && r.project_manager_id) return false;
    if (pmPm && pmPm !== NOT_ALLOCATED && r.project_manager_name !== pmPm) return false;
    const q = pSearch.trim().toLowerCase();
    if (q && !`${r.project_code} ${r.project_name}`.toLowerCase().includes(q)) return false;
    return true;
  });

  // --- Account Manager tab ----------------------------------------
  const allAccounts = React.useMemo(() => accounts.data ?? [], [accounts.data]);
  const amOptions = React.useMemo(
    () => ({
      geos: distinct(allAccounts.map((r) => r.geo_name)),
      ams: distinct(allAccounts.map((r) => r.account_manager_name)),
    }),
    [allAccounts],
  );

  const accountRows = allAccounts.filter((r) => {
    if (amGeo && r.geo_name !== amGeo) return false;
    if (amAm === NOT_ALLOCATED && r.account_manager_id) return false;
    if (amAm && amAm !== NOT_ALLOCATED && r.account_manager_name !== amAm) return false;
    const q = aSearch.trim().toLowerCase();
    if (q && !r.account_name.toLowerCase().includes(q)) return false;
    return true;
  });

  // --- Geo Head tab ---------------------------------------------
  const geoRows = (geos.data ?? []).filter((r) => {
    const q = gSearch.trim().toLowerCase();
    return !q || `${r.geo_code} ${r.geo_name}`.toLowerCase().includes(q);
  });

  // Current page of each filtered list (client-side — the API returns all rows).
  const projectPage = projectRows.slice(pmSkip, pmSkip + PAGE_SIZE);
  const accountPage = accountRows.slice(amSkip, amSkip + PAGE_SIZE);
  const geoPage = geoRows.slice(geoSkip, geoSkip + PAGE_SIZE);

  // Filter setters that also jump back to page 1 for that tab.
  const withPmReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPmSkip(0);
    };
  const withAmReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setAmSkip(0);
    };

  const searchInput = (value: string, onChange: (v: string) => void, label: string) => (
    <Input
      aria-label={label}
      placeholder="Search…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-48"
    />
  );

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight text-slate-900">
          <UserCog className="size-8 text-slate-700" />
          Reassign Owners
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Change a project&apos;s Project Manager, an account&apos;s Account Manager, or a geo&apos;s
          Geo Head — any time.
        </p>
      </header>

      {!canWrite ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have read-only access to this screen.
        </p>
      ) : null}

      <div role="tablist" className="flex gap-8 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === t.id
                ? "border-[#1a4a7a] text-[#1a4a7a]"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      <SectionCard icon={active.icon} title={active.label}>
        {tab === "pm" ? (
          <TableFrame
            headers={["Project", "Geo", "Region", "Account", "Current PM", "New PM"]}
            toolbar={
              <>
                <FilterSelect
                  label="Geo"
                  value={pmGeo}
                  onChange={withPmReset((v) => {
                    setPmGeo(v);
                    setPmRegion("");
                    setPmAccount("");
                  })}
                  options={pmOptions.geos}
                  width="w-40"
                />
                <FilterSelect
                  label="Region"
                  value={pmRegion}
                  onChange={withPmReset((v) => {
                    setPmRegion(v);
                    setPmAccount("");
                  })}
                  options={pmOptions.regions}
                />
                <FilterSelect
                  label="Account"
                  value={pmAccount}
                  onChange={withPmReset(setPmAccount)}
                  options={pmOptions.accounts}
                  width="w-48"
                />
                <FilterSelect
                  label="Current PM"
                  value={pmPm}
                  onChange={withPmReset(setPmPm)}
                  options={pmOptions.pms}
                  width="w-48"
                  notAllocated
                />
                {searchInput(pSearch, withPmReset(setPSearch), "Search projects")}
              </>
            }
            isLoading={projects.isLoading}
            isError={projects.isError}
            error={projects.error}
            onRetry={projects.refetch}
            empty={projectRows.length === 0}
            footer={
              <PaginationBar
                skip={pmSkip}
                limit={PAGE_SIZE}
                total={projectRows.length}
                onPageChange={setPmSkip}
              />
            }
          >
            {projectPage.map((row) => (
              <ReassignRow
                key={row.project_id}
                leading={[
                  <div key="p">
                    <div className="font-semibold text-slate-900">{row.project_name}</div>
                    <div className="font-mono text-xs text-slate-400">{row.project_code}</div>
                  </div>,
                  row.geo_name ?? "—",
                  row.region_name ?? "—",
                  row.account_name ?? "—",
                ]}
                currentOwnerId={row.project_manager_id}
                currentOwnerName={row.project_manager_name}
                roleCodes={PM_CANDIDATE_ROLES}
                canWrite={canWrite}
                saving={savingId === row.project_id}
                onSave={(userId) => {
                  setSavingId(row.project_id);
                  reassignPm.mutate(
                    { projectId: row.project_id, userId },
                    {
                      onSuccess: () =>
                        showSuccess(`Project Manager updated for ${row.project_code}`),
                      onError,
                      onSettled: () => setSavingId(null),
                    },
                  );
                }}
              />
            ))}
          </TableFrame>
        ) : null}

        {tab === "am" ? (
          <TableFrame
            headers={["Account", "Geo", "Current AM", "New AM"]}
            toolbar={
              <>
                <FilterSelect
                  label="Geo"
                  value={amGeo}
                  onChange={withAmReset(setAmGeo)}
                  options={amOptions.geos}
                  width="w-44"
                />
                <FilterSelect
                  label="Current AM"
                  value={amAm}
                  onChange={withAmReset(setAmAm)}
                  options={amOptions.ams}
                  width="w-48"
                  notAllocated
                />
                {searchInput(aSearch, withAmReset(setASearch), "Search accounts")}
              </>
            }
            isLoading={accounts.isLoading}
            isError={accounts.isError}
            error={accounts.error}
            onRetry={accounts.refetch}
            empty={accountRows.length === 0}
            footer={
              <PaginationBar
                skip={amSkip}
                limit={PAGE_SIZE}
                total={accountRows.length}
                onPageChange={setAmSkip}
              />
            }
          >
            {accountPage.map((row) => (
              <ReassignRow
                key={row.account_id}
                leading={[
                  <span key="a" className="font-semibold text-slate-900">
                    {row.account_name}
                  </span>,
                  row.geo_name ?? "—",
                ]}
                currentOwnerId={row.account_manager_id}
                currentOwnerName={row.account_manager_name}
                roleCodes={ACCOUNT_HEAD_CANDIDATE_ROLES}
                canWrite={canWrite}
                saving={savingId === row.account_id}
                onSave={(userId) => {
                  setSavingId(row.account_id);
                  reassignAm.mutate(
                    { accountId: row.account_id, userId },
                    {
                      onSuccess: () =>
                        showSuccess(`Account Manager updated for ${row.account_name}`),
                      onError,
                      onSettled: () => setSavingId(null),
                    },
                  );
                }}
              />
            ))}
          </TableFrame>
        ) : null}

        {tab === "geo" && showGeoTab ? (
          <TableFrame
            headers={["Geo", "Current Geo Head", "New Geo Head"]}
            toolbar={searchInput(
              gSearch,
              (v) => {
                setGSearch(v);
                setGeoSkip(0);
              },
              "Search geos",
            )}
            isLoading={geos.isLoading}
            isError={geos.isError}
            error={geos.error}
            onRetry={geos.refetch}
            empty={geoRows.length === 0}
            footer={
              <PaginationBar
                skip={geoSkip}
                limit={PAGE_SIZE}
                total={geoRows.length}
                onPageChange={setGeoSkip}
              />
            }
          >
            {geoPage.map((row) => (
              <ReassignRow
                key={row.geo_id}
                leading={[
                  <div key="g">
                    <div className="font-semibold text-slate-900">{row.geo_name}</div>
                    <div className="font-mono text-xs text-slate-400">{row.geo_code}</div>
                  </div>,
                ]}
                currentOwnerId={row.geo_head_id}
                currentOwnerName={row.geo_head_name}
                roleCodes={GEO_HEAD_ROLES}
                canWrite={canWrite}
                saving={savingId === row.geo_id}
                onSave={(userId) => {
                  setSavingId(row.geo_id);
                  reassignGeoHead.mutate(
                    { geoId: row.geo_id, userId },
                    {
                      onSuccess: () => showSuccess(`Geo Head updated for ${row.geo_name}`),
                      onError,
                      onSettled: () => setSavingId(null),
                    },
                  );
                }}
              />
            ))}
          </TableFrame>
        ) : null}
      </SectionCard>
    </div>
  );
}
