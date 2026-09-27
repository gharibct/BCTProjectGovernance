"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Field, ButtonSpinner } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { usePageBanner } from "@/stores/page-banner";
import { useRoles, type User } from "@/lib/api/reference-data";
import {
  useClearUserPassword,
  useCreateUser,
  useSetUserPassword,
  useUpdateUser,
} from "@/lib/api/users";

// Keep in sync with backend PASSWORD_MIN_LENGTH (app/schemas/users.py).
const PASSWORD_MIN_LENGTH = 8;

function toValues(user: User | null): Record<string, string> {
  if (!user) return { is_active: "Yes" };
  return {
    ldap_username: user.ldap_username,
    full_name: user.full_name,
    email: user.email,
    role_id: user.role_id,
    is_active: user.is_active ? "Yes" : "No",
  };
}

// Right slide-over for adding / editing a user. `user === null` means "add".
// Radix unmounts SheetContent on close, so UserForm's state starts fresh on
// every open — no manual reset needed.
export function UserFormDrawer({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent className="gap-0 p-0 sm:w-[560px] lg:w-[40%]">
        <SheetHeader>
          <SheetTitle>{user ? "Edit User" : "New User"}</SheetTitle>
          <SheetDescription>
            {user ? `Update ${user.full_name}.` : "Create a user and assign their role."}
          </SheetDescription>
        </SheetHeader>
        <UserForm user={user} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}

function UserForm({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { data: roles = [] } = useRoles();
  const [initialValues] = React.useState(() => toValues(user));
  const { values, set } = useEntryValues(initialValues);
  const [passwordInput, setPasswordInput] = React.useState("");
  // `user` is a snapshot from when the drawer opened, so track the flag locally
  // to reflect a password set/removed while the drawer stays open.
  const [passwordSet, setPasswordSet] = React.useState(Boolean(user?.password_set));

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setUserPassword = useSetUserPassword();
  const clearUserPassword = useClearUserPassword();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const fields: FieldDef[] = [
    { key: "ldap_username", label: "Username", kind: "text", mandatory: true },
    { key: "full_name", label: "Full Name", kind: "text", mandatory: true },
    { key: "email", label: "Email", kind: "text", mandatory: true, fullWidth: true },
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
  const passwordBusy = setUserPassword.isPending || clearUserPassword.isPending;
  const canSubmit = Boolean(
    values.ldap_username?.trim() && values.full_name?.trim() && values.email?.trim() && values.role_id,
  );

  const submitPassword = () => {
    if (!user || passwordInput.length < PASSWORD_MIN_LENGTH) return;
    setUserPassword.mutate(
      { userId: user.id, password: passwordInput },
      {
        onSuccess: () => {
          setPasswordInput("");
          setPasswordSet(true);
          showSuccess("Password Set Successfully");
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to set password."),
      },
    );
  };

  const revokePassword = () => {
    if (!user) return;
    clearUserPassword.mutate(user.id, {
      onSuccess: () => {
        setPasswordSet(false);
        showSuccess("Password Removed");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to remove password."),
    });
  };

  async function submit() {
    if (!canSubmit) return;
    const payload = {
      ldap_username: values.ldap_username,
      full_name: values.full_name,
      email: values.email,
      role_id: values.role_id,
      is_active: values.is_active !== "No",
    };

    try {
      if (user) {
        await updateUser.mutateAsync({ id: user.id, payload });
      } else {
        await createUser.mutateAsync(payload);
      }
      onClose();
      showSuccess(user ? "User Updated Successfully" : "User Created Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save user.");
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Account / Geo mapping lives elsewhere: an Account Head is set on
            Admin → Accounts, a Geo Head on Admin → Geos, and any owner can be
            changed later on Reassign Owners. */}
        <EntryFields defs={fields} values={values} set={set} columns={2} />

        {user ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <Field
              label="Local Password"
              hint={
                passwordSet
                  ? "A password is set. Enter a new one to replace it (AUTH_TYPE=password only)."
                  : `No password set. At least ${PASSWORD_MIN_LENGTH} characters (AUTH_TYPE=password only).`
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="h-11 min-w-0 flex-1"
                />
                <Button
                  type="button"
                  onClick={submitPassword}
                  disabled={passwordBusy || passwordInput.length < PASSWORD_MIN_LENGTH}
                  className="h-11 shrink-0 gap-2 bg-[#1a4a7a] px-4 text-sm font-semibold text-white hover:bg-[#15406b]"
                >
                  {setUserPassword.isPending ? <ButtonSpinner /> : null}
                  Set
                </Button>
                {passwordSet ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={revokePassword}
                    disabled={passwordBusy}
                    className="h-11 shrink-0 px-4 text-sm font-semibold"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>
        ) : null}
      </div>

      <SheetFooter>
        <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={busy || !canSubmit}
          className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
        >
          {busy ? <ButtonSpinner /> : null}
          {user ? "Save Changes" : "Add User"}
        </Button>
      </SheetFooter>
    </>
  );
}
