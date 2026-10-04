"use client";

import * as React from "react";
import { Plus, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard } from "@/components/forms/form-primitives";
import { PaginationBar } from "@/components/forms/pagination-bar";
import { RegisterTable } from "@/components/forms/register-table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageBanner } from "@/stores/page-banner";
import { useRoles, useUserDirectory, type User } from "@/lib/api/reference-data";
import { useDeleteUser } from "@/lib/api/users";
import { roleDisplayName } from "@/lib/role-labels";
import { UserFormDrawer } from "./user-form-drawer";

const PAGE_SIZE = 10;

type ActiveFilter = "" | "true" | "false";

// `null` = drawer closed, `{ user: null }` = add, `{ user }` = edit.
type DrawerState = { user: User | null } | null;

export function CreateUserPanel() {
  const { data: roles = [] } = useRoles();

  const [search, setSearch] = React.useState("");
  const [roleCode, setRoleCode] = React.useState("");
  const [active, setActive] = React.useState<ActiveFilter>("");
  const [skip, setSkip] = React.useState(0);
  const [drawer, setDrawer] = React.useState<DrawerState>(null);

  const debouncedSearch = useDebouncedValue(search, 250);
  const directory = useUserDirectory({
    search: debouncedSearch,
    roleCode: roleCode || undefined,
    isActive: active === "" ? undefined : active === "true",
    skip,
    limit: PAGE_SIZE,
  });
  const users = directory.data?.items ?? [];
  const total = directory.data?.total ?? 0;

  const deleteUser = useDeleteUser();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const roleName = (id: string) => {
    const role = roles.find((r) => r.id === id);
    return role ? roleDisplayName(role) : "—";
  };

  const filtersActive = Boolean(search || roleCode || active);
  const resetFilters = () => {
    setSearch("");
    setRoleCode("");
    setActive("");
    setSkip(0);
  };

  const handleDelete = (user: User) => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        // Deleting the last row of a page would leave it empty — step back.
        if (users.length === 1 && skip > 0) setSkip(Math.max(0, skip - PAGE_SIZE));
        showSuccess("User Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete user."),
    });
  };

  return (
    <>
      <SectionCard
        icon={Users}
        title="User Directory"
        aside={
          <Button
            onClick={() => setDrawer({ user: null })}
            className="h-10 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            <Plus className="size-4" />
            Add User
          </Button>
        }
      >
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
          items={users}
          emptyLabel={
            directory.isLoading
              ? "Loading…"
              : filtersActive
                ? "No users match the current filters."
                : "No users yet."
          }
          onEdit={(user) => setDrawer({ user })}
          onDelete={handleDelete}
          columns={[
            { key: "ldap_username", label: "Username" },
            { key: "full_name", label: "Full Name" },
            { key: "email", label: "Email" },
            { key: "role_id", label: "Role", render: (item) => roleName(item.role_id) },
            {
              key: "is_active",
              label: "Active",
              render: (item) => (item.is_active ? "Yes" : "No"),
            },
            {
              key: "password_set",
              label: "Password",
              render: (item) => (item.password_set ? "Set" : "—"),
            },
          ]}
        />
        <PaginationBar skip={skip} limit={PAGE_SIZE} total={total} onPageChange={setSkip} />
      </SectionCard>

      <UserFormDrawer
        open={drawer !== null}
        user={drawer?.user ?? null}
        onClose={() => setDrawer(null)}
      />
    </>
  );
}
