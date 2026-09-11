"use client";

import * as React from "react";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { usePageBanner } from "@/stores/page-banner";
import {
  ACCOUNT_HEAD_CANDIDATE_ROLES,
  useAccounts,
  useGeos,
  useRegions,
  type Account,
} from "@/lib/api/reference-data";
import { useCreateAccount, useDeleteAccount, useUpdateAccount, type AccountPayload } from "@/lib/api/accounts";
import { useAccountHead, useSetAccountHead } from "@/lib/api/users";

function toValues(account: Account): Record<string, string> {
  return {
    name: account.name,
    geo_id: account.geo_id ?? "",
    region_id: account.region_id ?? "",
    description: account.description ?? "",
    is_active: account.is_active ? "Yes" : "No",
    tool_effective_date: account.tool_effective_date ?? "",
  };
}

function buildAccountPayload(values: Record<string, string>): AccountPayload {
  return {
    name: values.name,
    geo_id: values.geo_id || undefined,
    region_id: values.region_id || undefined,
    description: values.description || undefined,
    is_active: values.is_active !== "No",
    tool_effective_date: values.tool_effective_date || undefined,
  };
}

export function CreateAccountPanel() {
  const { data: accounts = [] } = useAccounts();
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();

  const { values, set, setValue, reset, load } = useEntryValues();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // Account Head — optional single owner, persisted via the account-head
  // endpoint (a user_accounts link), not part of AccountPayload.
  const [accountHeadId, setAccountHeadId] = React.useState<string | null>(null);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const setAccountHead = useSetAccountHead();
  const { data: editingHead } = useAccountHead(editingId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // Seed the picker once the current head arrives for this editingId (setState
  // during render, guarded by `syncedFor` — same pattern as create-user-panel).
  const [syncedHeadFor, setSyncedHeadFor] = React.useState<string | null>(null);
  if (editingId && editingId !== syncedHeadFor && editingHead !== undefined) {
    setSyncedHeadFor(editingId);
    setAccountHeadId(editingHead?.id ?? null);
  }

  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? "—";
  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? "—";

  const fields: FieldDef[] = [
    { key: "name", label: "Account Name", kind: "text", mandatory: true },
    {
      key: "geo_id",
      label: "Geo",
      kind: "select",
      mandatory: true,
      choices: geos.map((g) => ({ value: g.id, label: g.name })),
    },
    {
      key: "region_id",
      label: "Region",
      kind: "select",
      mandatory: true,
      hint: "Select a Geo first — regions are scoped to it.",
      choices: regions
        .filter((r) => r.geo_id === values.geo_id)
        .map((r) => ({ value: r.id, label: r.name })),
    },
    { key: "is_active", label: "Active", kind: "select", options: ["Yes", "No"] },
    {
      key: "description",
      label: "Description",
      kind: "textarea",
      hint: "Short summary about the customer.",
    },
    {
      key: "tool_effective_date",
      label: "Governance Tool Implementation Effective Date",
      kind: "date",
      hint: "When this account started being tracked in the tool. Leave blank for no restriction.",
    },
  ];

  // Bulk import runs with no Geo context, so the geo-filtered Region choices
  // above would be empty. Give the importer the full region list to match against.
  const importFields = fields.map((f) =>
    f.key === "region_id"
      ? { ...f, choices: regions.map((r) => ({ value: r.id, label: r.name })) }
      : f,
  );

  // Drop a stale Region when the selected Geo no longer contains it, so the
  // mandatory check below can't pass on a region from another geo.
  React.useEffect(() => {
    if (
      values.region_id &&
      !regions.some((r) => r.id === values.region_id && r.geo_id === values.geo_id)
    ) {
      setValue("region_id", "");
    }
  }, [values.geo_id, values.region_id, regions, setValue]);

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    load(toValues(account));
    setAccountHeadId(null);
    setSyncedHeadFor(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
    setAccountHeadId(null);
    setSyncedHeadFor(null);
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

  const canSubmit = Boolean(values.name?.trim() && values.geo_id && values.region_id);

  async function submit() {
    if (!canSubmit) return;
    const payload = buildAccountPayload(values);

    try {
      if (editingId) {
        await updateAccount.mutateAsync({ id: editingId, payload });
        await setAccountHead.mutateAsync({ accountId: editingId, userId: accountHeadId });
        cancelEdit();
        showSuccess("Account Updated Successfully");
      } else {
        const created = await createAccount.mutateAsync(payload);
        if (accountHeadId) {
          await setAccountHead.mutateAsync({ accountId: created.id, userId: accountHeadId });
        }
        reset();
        setAccountHeadId(null);
        showSuccess("Account Created Successfully");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save account.");
    }
  }

  const busy = createAccount.isPending || updateAccount.isPending || setAccountHead.isPending;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Building2} title="Account Directory">
        <RegisterImportToolbar
          defs={importFields}
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
      </SectionCard>

      <SectionCard icon={Building2} title={editingId ? "Edit Account" : "New Account"}>
        <EntryFields
          defs={fields}
          values={values}
          set={set}
          trailing={
            <Field
              label="Account Head"
              hint="Optional. An Account Head or Geo Head who owns this account. Can be changed later on Reassign Owners."
            >
              <ResourcePicker
                value={accountHeadId}
                onChange={setAccountHeadId}
                roleCodes={ACCOUNT_HEAD_CANDIDATE_ROLES}
                placeholder="Select Account Head…"
              />
            </Field>
          }
        />
        <div className="mt-6 flex justify-end gap-3">
          {editingId ? (
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={submit}
            disabled={busy || !canSubmit}
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
