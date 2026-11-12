"use client";

import * as React from "react";
import { LogIn, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard } from "@/components/forms/form-primitives";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { ProjectHealthExportButton } from "@/components/dashboard/project-health-export-button";
import { RegisterTable, type RegisterColumn } from "@/components/forms/register-table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api/client";
import { useRoles } from "@/lib/api/reference-data";
import { useUserLoginDetails, userLoginDetailsPath, type UserLoginDetail } from "@/lib/api/users";
import { roleDisplayName } from "@/lib/role-labels";

const PAGE_SIZE = 15;

type LoginFilter = "" | "never";
type ActiveFilter = "" | "true" | "false";

function formatLastLogin(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Delivery Excellence: who has signed in to the tool and when they last did.
export function LoginDetailsView() {
  const { data: roles = [] } = useRoles();
  const [search, setSearch] = React.useState("");
  const [roleCode, setRoleCode] = React.useState("");
  const [active, setActive] = React.useState<ActiveFilter>("");
  const [login, setLogin] = React.useState<LoginFilter>("");
  const [skip, setSkip] = React.useState(0);
  const debouncedSearch = useDebouncedValue(search, 250);

  const query = {
    search: debouncedSearch,
    roleCode: roleCode || undefined,
    isActive: active === "" ? undefined : active === "true",
    neverLoggedIn: login === "never",
  };
  const result = useUserLoginDetails({ ...query, skip, limit: PAGE_SIZE });
  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;

  const roleName = (id: string) => {
    const role = roles.find((r) => r.id === id);
    return role ? roleDisplayName(role) : "";
  };

  const columns: RegisterColumn<UserLoginDetail>[] = [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "ldap_username", label: "Username" },
    {
      key: "role_id",
      label: "Role",
      render: (item) => roleName(item.role_id) || "—",
      excelValue: (item) => roleName(item.role_id),
    },
    {
      key: "is_active",
      label: "Active",
      render: (item) => (item.is_active ? "Yes" : "No"),
      excelValue: (item) => (item.is_active ? "Yes" : "No"),
    },
    {
      key: "last_login_at",
      label: "Last Login",
      render: (item) => formatLastLogin(item.last_login_at),
      excelValue: (item) => formatLastLogin(item.last_login_at),
    },
  ];

  // The grid is server-paged — the export pulls every user matching the filters.
  const fetchAll = async (): Promise<UserLoginDetail[]> => {
    const all: UserLoginDetail[] = [];
    const size = 200;
    for (let at = 0; ; at += size) {
      const page = await api.get<{ items: UserLoginDetail[]; total: number }>(
        userLoginDetailsPath({ ...query, skip: at, limit: size }),
      );
      all.push(...page.items);
      if (all.length >= page.total || page.items.length === 0) return all;
    }
  };

  const filtersActive = Boolean(search || roleCode || active || login);
  const reset = () => {
    setSearch("");
    setRoleCode("");
    setActive("");
    setLogin("");
    setSkip(0);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900">User Login Details</h1>
      <SectionCard icon={LogIn} title="Who has logged in">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search users"
              placeholder="Search name, username or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSkip(0);
              }}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="w-52">
            <NativeSelect
              aria-label="Role filter"
              className="h-9 text-sm"
              value={roleCode}
              onChange={(e) => {
                setRoleCode(e.target.value);
                setSkip(0);
              }}
            >
              <option value="">Role [All]</option>
              {roles.map((r) => (
                <option key={r.id} value={r.code}>
                  {roleDisplayName(r)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="w-44">
            <NativeSelect
              aria-label="Login filter"
              className="h-9 text-sm"
              value={login}
              onChange={(e) => {
                setLogin(e.target.value as LoginFilter);
                setSkip(0);
              }}
            >
              <option value="">Login [All]</option>
              <option value="never">Never logged in</option>
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
            <button type="button" onClick={reset} className="ml-auto text-sm font-semibold text-[#1a6fc4] hover:underline">
              Reset
            </button>
          ) : null}
        </div>

        <div className="mb-3 flex justify-end">
          <ProjectHealthExportButton filename="user-login-details.xlsx" columns={columns} fetchAll={fetchAll} />
        </div>
        <RegisterTable
          items={items}
          emptyLabel={result.isLoading ? "Loading…" : "No users match the current filters."}
          columns={columns}
        />
        <PaginationBar skip={skip} limit={PAGE_SIZE} total={total} onPageChange={setSkip} />
      </SectionCard>
    </div>
  );
}
