"use client";

import * as React from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { usePageBanner } from "@/stores/page-banner";
import { useRoles, useUsers, type User } from "@/lib/api/reference-data";
import {
  useClearUserPassword,
  useCreateUser,
  useDeleteUser,
  useSetUserPassword,
  useUpdateUser,
} from "@/lib/api/users";

// Keep in sync with backend PASSWORD_MIN_LENGTH (app/schemas/users.py).
const PASSWORD_MIN_LENGTH = 8;

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

  const { values, set, reset, load } = useEntryValues();
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const setUserPassword = useSetUserPassword();
  const clearUserPassword = useClearUserPassword();
  const [passwordInput, setPasswordInput] = React.useState("");
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

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

  const busy = createUser.isPending || updateUser.isPending;

  const startEdit = (user: User) => {
    setEditingId(user.id);
    load(toValues(user));
    setPasswordInput("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
    setPasswordInput("");
  };

  const editingUser = editingId ? users.find((u) => u.id === editingId) : undefined;
  const passwordBusy = setUserPassword.isPending || clearUserPassword.isPending;

  const submitPassword = () => {
    if (!editingId || passwordInput.length < PASSWORD_MIN_LENGTH) return;
    setUserPassword.mutate(
      { userId: editingId, password: passwordInput },
      {
        onSuccess: () => {
          setPasswordInput("");
          showSuccess("Password Set Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to set password."),
      },
    );
  };

  const revokePassword = () => {
    if (!editingId) return;
    clearUserPassword.mutate(editingId, {
      onSuccess: () => showSuccess("Password Removed"),
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to remove password."),
    });
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
      if (editingId) {
        await updateUser.mutateAsync({ id: editingId, payload });
      } else {
        await createUser.mutateAsync(payload);
      }

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
            {
              key: "password_set",
              label: "Password",
              render: (item) => (item.password_set ? "Set" : "—"),
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Users} title={editingId ? "Edit User" : "New User"}>
        <EntryFields defs={fields} values={values} set={set} />
        {/* Account / Geo mapping moved out of here: an Account Head is set on
            Admin → Accounts, a Geo Head on Admin → Geos, and any owner can be
            changed later on Reassign Owners. */}
        {editingId ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <Field
              label="Local Password"
              hint={
                editingUser?.password_set
                  ? "A password is set. Enter a new one to replace it (AUTH_TYPE=password only)."
                  : `No password set. At least ${PASSWORD_MIN_LENGTH} characters (AUTH_TYPE=password only).`
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="h-11 max-w-xs"
                />
                <Button
                  type="button"
                  onClick={submitPassword}
                  disabled={passwordBusy || passwordInput.length < PASSWORD_MIN_LENGTH}
                  className="h-11 gap-2 bg-[#1a4a7a] px-5 text-sm font-semibold text-white hover:bg-[#15406b]"
                >
                  {setUserPassword.isPending ? <ButtonSpinner /> : null}
                  Set Password
                </Button>
                {editingUser?.password_set ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={revokePassword}
                    disabled={passwordBusy}
                    className="h-11 px-5 text-sm font-semibold"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>
        ) : null}

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
