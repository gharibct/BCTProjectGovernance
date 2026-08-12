"use client";

import * as React from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { MultiSelectChecklist } from "@/components/forms/multi-select-checklist";
import { usePageBanner } from "@/stores/page-banner";
import { useAccounts, useGeos, useRoles, useUsers, type User } from "@/lib/api/reference-data";
import {
  useCreateUser,
  useDeleteUser,
  useSetUserAccounts,
  useSetUserGeos,
  useUpdateUser,
  useUserAccounts,
  useUserGeos,
} from "@/lib/api/users";

function toValues(user: User): Record<string, string> {
  return {
    ldap_username: user.ldap_username,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    is_active: user.is_active ? "Yes" : "No",
  };
}

export function CreateUserPanel() {
  const { data: users = [] } = useUsers();
  const { data: roles = [] } = useRoles();
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();

  const { values, set, reset, load } = useEntryValues();
  const [accountIds, setAccountIds] = React.useState<string[]>([]);
  const [geoIds, setGeoIds] = React.useState<string[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const setUserAccounts = useSetUserAccounts();
  const setUserGeos = useSetUserGeos();
  const { data: editingAccountIds } = useUserAccounts(editingId);
  const { data: editingGeoIds } = useUserGeos(editingId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // The user's current scope loads asynchronously (a separate fetch from the
  // user row itself) — seed the checklists once it arrives for this editingId,
  // same render-time-sync pattern as regional-reporting/status-tabs.tsx's
  // `syncedFor` guard (setState during render, not in an effect).
  const [syncedAccountsFor, setSyncedAccountsFor] = React.useState<string | null>(null);
  if (editingId && editingId !== syncedAccountsFor && editingAccountIds) {
    setSyncedAccountsFor(editingId);
    setAccountIds(editingAccountIds);
  }
  const [syncedGeosFor, setSyncedGeosFor] = React.useState<string | null>(null);
  if (editingId && editingId !== syncedGeosFor && editingGeoIds) {
    setSyncedGeosFor(editingId);
    setGeoIds(editingGeoIds);
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";

  const fields: FieldDef[] = [
    { key: "ldap_username", label: "Username", kind: "text", mandatory: true },
    { key: "full_name", label: "Full Name", kind: "text", mandatory: true },
    { key: "email", label: "Email", kind: "text", mandatory: true },
    {
      key: "role_id",
      label: "Role",
      kind: "select",
      mandatory: true,
      choices: roles.map((r) => ({ value: r.id, label: r.name })),
    },
    { key: "is_active", label: "Active", kind: "select", options: ["Yes", "No"] },
  ];

  const busy =
    createUser.isPending || updateUser.isPending || setUserAccounts.isPending || setUserGeos.isPending;

  const startEdit = (user: User) => {
    setEditingId(user.id);
    load(toValues(user));
    setAccountIds([]);
    setGeoIds([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
    setAccountIds([]);
    setGeoIds([]);
  };

  const handleDelete = (user: User) => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        if (editingId === user.id) cancelEdit();
        showSuccess("User Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete user."),
    });
  };

  async function submit() {
    if (!values.ldap_username?.trim() || !values.full_name?.trim() || !values.email?.trim() || !values.role_id) {
      return;
    }
    const payload = {
      ldap_username: values.ldap_username,
      full_name: values.full_name,
      email: values.email,
      role_id: values.role_id,
      is_active: values.is_active !== "No",
    };

    try {
      const userId = editingId
        ? (await updateUser.mutateAsync({ id: editingId, payload })).id
        : (await createUser.mutateAsync(payload)).id;

      await setUserAccounts.mutateAsync({ userId, accountIds });
      await setUserGeos.mutateAsync({ userId, geoIds });

      const wasEditing = !!editingId;
      cancelEdit();
      showSuccess(wasEditing ? "User Updated Successfully" : "User Created Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save user.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Users} title="User Directory">
        <RegisterTable
          items={users}
          emptyLabel="No users yet."
          onEdit={startEdit}
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
          ]}
        />
      </SectionCard>

      <SectionCard icon={Users} title={editingId ? "Edit User" : "New User"}>
        <EntryFields defs={fields} values={values} set={set} />
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Accounts" hint="Accounts this user can see (Account Manager scope).">
            <MultiSelectChecklist
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              value={accountIds}
              onChange={setAccountIds}
              emptyLabel="No accounts exist yet."
            />
          </Field>
          <Field label="Geos" hint="Geos this user can see (Geo Head scope).">
            <MultiSelectChecklist
              options={geos.map((g) => ({ value: g.id, label: g.name }))}
              value={geoIds}
              onChange={setGeoIds}
              emptyLabel="No geos exist yet."
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {editingId ? (
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={submit}
            disabled={busy}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {busy ? <ButtonSpinner /> : null}
            {editingId ? "Save Changes" : "Add User"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
