"use client";

import * as React from "react";
import { Building2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard } from "@/components/forms/form-primitives";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { usePageBanner } from "@/stores/page-banner";
import { useAccounts, useGeos, useRegions, type Account } from "@/lib/api/reference-data";
import { useCreateAccount, useDeleteAccount } from "@/lib/api/accounts";
import { AccountFormDrawer, buildAccountFields, buildAccountPayload } from "./account-form-drawer";

const PAGE_SIZE = 10;

type ActiveFilter = "" | "true" | "false";

// `null` = drawer closed, `{ account: null }` = add, `{ account }` = edit.
type DrawerState = { account: Account | null } | null;

export function CreateAccountPanel() {
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();

  const [search, setSearch] = React.useState("");
  const [geoId, setGeoId] = React.useState("");
  const [regionId, setRegionId] = React.useState("");
  const [active, setActive] = React.useState<ActiveFilter>("");
  const [skip, setSkip] = React.useState(0);
  const [drawer, setDrawer] = React.useState<DrawerState>(null);

  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? "—";
  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? "—";

  // Bulk import runs with no Geo context, so the geo-filtered Region choices
  // would be empty. Give the importer the full region list to match against.
  const importFields = buildAccountFields(geos, regions).map((f) =>
    f.key === "region_id"
      ? { ...f, choices: regions.map((r) => ({ value: r.id, label: r.name })) }
      : f,
  );

  // Region options cascade off the selected Geo.
  const regionOptions = geoId ? regions.filter((r) => r.geo_id === geoId) : regions;

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (term && !a.name.toLowerCase().includes(term)) return false;
      if (geoId && a.geo_id !== geoId) return false;
      if (regionId && a.region_id !== regionId) return false;
      if (active && a.is_active !== (active === "true")) return false;
      return true;
    });
  }, [accounts, search, geoId, regionId, active]);

  // Clamp to the last page so deleting the final row of a page (or a refetch
  // that shrinks the list) never strands the grid on an empty page.
  const lastPageSkip = Math.max(0, Math.floor((filtered.length - 1) / PAGE_SIZE) * PAGE_SIZE);
  const pageSkip = Math.min(skip, lastPageSkip);
  const pageItems = filtered.slice(pageSkip, pageSkip + PAGE_SIZE);

  const filtersActive = Boolean(search || geoId || regionId || active);
  const resetFilters = () => {
    setSearch("");
    setGeoId("");
    setRegionId("");
    setActive("");
    setSkip(0);
  };

  const handleDelete = (account: Account) => {
    deleteAccount.mutate(account.id, {
      onSuccess: () => showSuccess("Account Deleted Successfully"),
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete account."),
    });
  };

  return (
    <>
      <SectionCard
        icon={Building2}
        title="Account Directory"
        aside={
          <Button
            onClick={() => setDrawer({ account: null })}
            className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            <Plus className="size-4" />
            Add Account
          </Button>
        }
      >
        <RegisterImportToolbar
          defs={importFields}
          itemLabelPlural="Accounts"
          buildPayload={buildAccountPayload}
          createMutation={createAccount}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search accounts"
              placeholder="Search account name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              className="h-9 pl-9 text-sm"
            />
          </div>

          <div className="w-44">
            <NativeSelect
              aria-label="Geo filter"
              className="h-9 text-sm"
              value={geoId}
              onChange={(e) => {
                setGeoId(e.target.value);
                setRegionId("");
                setSkip(0);
              }}
            >
              <option value="">Geo [All]</option>
              {geos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="w-44">
            <NativeSelect
              aria-label="Region filter"
              className="h-9 text-sm"
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setSkip(0);
              }}
            >
              <option value="">Region [All]</option>
              {regionOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="w-40">
            <NativeSelect
              aria-label="Active filter"
              className="h-9 text-sm"
              value={active}
              onChange={(e) => {
                setActive(e.target.value as ActiveFilter);
                setSkip(0);
              }}
            >
              <option value="">Active [All]</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </NativeSelect>
          </div>

          {filtersActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto text-sm font-semibold text-[#1a6fc4] hover:underline"
            >
              Reset
            </button>
          ) : null}
        </div>

        <RegisterTable
          items={pageItems}
          emptyLabel={
            isLoading
              ? "Loading…"
              : filtersActive
                ? "No accounts match the current filters."
                : "No accounts yet."
          }
          onEdit={(account) => setDrawer({ account })}
          onDelete={handleDelete}
          columns={[
            { key: "name", label: "Account Name" },
            { key: "geo_id", label: "Geo", render: (item) => geoName(item.geo_id) },
            { key: "region_id", label: "Region", render: (item) => regionName(item.region_id) },
            {
              key: "description",
              label: "Description",
              render: (item) => (
                <span className="line-clamp-1 max-w-xs" title={item.description ?? ""}>
                  {item.description || "—"}
                </span>
              ),
            },
            {
              key: "is_active",
              label: "Active",
              render: (item) => (item.is_active ? "Yes" : "No"),
            },
            {
              key: "tool_effective_date",
              label: "Tool Effective Date",
              render: (item) => item.tool_effective_date || "—",
            },
          ]}
        />
        <PaginationBar skip={pageSkip} limit={PAGE_SIZE} total={filtered.length} onPageChange={setSkip} />
      </SectionCard>

      <AccountFormDrawer
        open={drawer !== null}
        account={drawer?.account ?? null}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}
