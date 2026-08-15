"use client";

import * as React from "react";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { usePageBanner } from "@/stores/page-banner";
import { useAccounts, useGeos, type Account } from "@/lib/api/reference-data";
import { useCreateAccount, useDeleteAccount, useUpdateAccount, type AccountPayload } from "@/lib/api/accounts";

function toValues(account: Account): Record<string, string> {
  return {
    name: account.name,
    geo_id: account.geo_id ?? "",
    description: account.description ?? "",
    is_active: account.is_active ? "Yes" : "No",
  };
}

function buildAccountPayload(values: Record<string, string>): AccountPayload {
  return {
    name: values.name,
    geo_id: values.geo_id || undefined,
    description: values.description || undefined,
    is_active: values.is_active !== "No",
  };
}

export function CreateAccountPanel() {
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();

  const { values, set, reset, load } = useEntryValues();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? "—";

  const fields: FieldDef[] = [
    { key: "name", label: "Account Name", kind: "text", mandatory: true },
    {
      key: "geo_id",
      label: "Geo",
      kind: "select",
      choices: geos.map((g) => ({ value: g.id, label: g.name })),
    },
    { key: "is_active", label: "Active", kind: "select", options: ["Yes", "No"] },
    {
      key: "description",
      label: "Description",
      kind: "textarea",
      hint: "Short summary about the customer.",
    },
  ];

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    load(toValues(account));
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const handleDelete = (account: Account) => {
    deleteAccount.mutate(account.id, {
      onSuccess: () => {
        if (editingId === account.id) cancelEdit();
        showSuccess("Account Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete account."),
    });
  };

  async function submit() {
    if (!values.name?.trim()) return;
    const payload = buildAccountPayload(values);

    try {
      if (editingId) {
        await updateAccount.mutateAsync({ id: editingId, payload });
        cancelEdit();
        showSuccess("Account Updated Successfully");
      } else {
        await createAccount.mutateAsync(payload);
        reset();
        showSuccess("Account Created Successfully");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save account.");
    }
  }

  const busy = createAccount.isPending || updateAccount.isPending;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Building2} title="Account Directory">
        <RegisterImportToolbar
          defs={fields}
          itemLabelPlural="Accounts"
          buildPayload={buildAccountPayload}
          createMutation={createAccount}
        />
        <RegisterTable
          items={accounts}
          emptyLabel="No accounts yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "name", label: "Account Name" },
            { key: "geo_id", label: "Geo", render: (item) => geoName(item.geo_id) },
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
          ]}
        />
      </SectionCard>

      <SectionCard icon={Building2} title={editingId ? "Edit Account" : "New Account"}>
        <EntryFields defs={fields} values={values} set={set} />
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
            {editingId ? "Save Changes" : "Add Account"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
