"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ButtonSpinner, Field } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { usePageBanner } from "@/stores/page-banner";
import {
  ACCOUNT_HEAD_CANDIDATE_ROLES,
  useGeos,
  useRegions,
  type Account,
  type Geo,
  type Region,
} from "@/lib/api/reference-data";
import { useCreateAccount, useUpdateAccount, type AccountPayload } from "@/lib/api/accounts";
import { useAccountHead, useSetAccountHead } from "@/lib/api/users";
import { ACCOUNT_MANAGER_LABEL } from "@/lib/role-labels";

function toValues(account: Account | null): Record<string, string> {
  if (!account) return { is_active: "Yes" };
  return {
    name: account.name,
    geo_id: account.geo_id ?? "",
    region_id: account.region_id ?? "",
    description: account.description ?? "",
    is_active: account.is_active ? "Yes" : "No",
    tool_effective_date: account.tool_effective_date ?? "",
  };
}

export function buildAccountPayload(values: Record<string, string>): AccountPayload {
  return {
    name: values.name,
    geo_id: values.geo_id || undefined,
    region_id: values.region_id || undefined,
    description: values.description || undefined,
    is_active: values.is_active !== "No",
    tool_effective_date: values.tool_effective_date || undefined,
  };
}

// Shared by the drawer form and the bulk importer (which passes no selected
// Geo and swaps in the full region list — see CreateAccountPanel).
export function buildAccountFields(geos: Geo[], regions: Region[], selectedGeoId?: string): FieldDef[] {
  return [
    { key: "name", label: "Account Name", kind: "text", mandatory: true, fullWidth: true },
    {
      key: "geo_id",
      label: "Geo",
      kind: "select",
      mandatory: true,
      choices: geos.map((g) => ({ value: g.id, label: g.name })),
    },
    {
      // Regions are scoped to the selected Geo, so this stays empty until one is chosen.
      key: "region_id",
      label: "Region",
      kind: "select",
      mandatory: true,
      choices: regions.filter((r) => r.geo_id === selectedGeoId).map((r) => ({ value: r.id, label: r.name })),
    },
    { key: "is_active", label: "Active", kind: "select", options: ["Yes", "No"] },
    {
      key: "description",
      label: "Description",
      kind: "text",
      fullWidth: true,
      hint: "Short summary about the customer.",
    },
    {
      key: "tool_effective_date",
      label: "Governance Tool Implementation Effective Date",
      kind: "date",
      fullWidth: true,
      hint: "When this account started being tracked in the tool. Leave blank for no restriction.",
    },
  ];
}

// Right slide-over for adding / editing an account. `account === null` means
// "add". Radix unmounts SheetContent on close, so AccountForm's state starts
// fresh on every open.
export function AccountFormDrawer({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account: Account | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent className="gap-0 p-0">
        <SheetHeader>
          <SheetTitle>{account ? "Edit Account" : "New Account"}</SheetTitle>
          <SheetDescription>
            {account ? `Update ${account.name}.` : "Create an account and optionally assign its manager."}
          </SheetDescription>
        </SheetHeader>
        <AccountForm account={account} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}

function AccountForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { data: geos = [] } = useGeos();
  const { data: regions = [] } = useRegions();

  const [initialValues] = React.useState(() => toValues(account));
  const { values, set, setValue } = useEntryValues(initialValues);

  // Account Head — optional single owner, persisted via the account-head
  // endpoint (a user_accounts link), not part of AccountPayload.
  const [accountHeadId, setAccountHeadId] = React.useState<string | null>(null);
  const [headSynced, setHeadSynced] = React.useState(false);
  const { data: editingHead } = useAccountHead(account?.id ?? null);
  // Seed the picker once the current head arrives (setState during render,
  // guarded by `headSynced`).
  if (account && !headSynced && editingHead !== undefined) {
    setHeadSynced(true);
    setAccountHeadId(editingHead?.id ?? null);
  }

  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const setAccountHead = useSetAccountHead();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const fields = buildAccountFields(geos, regions, values.geo_id);

  // Drop a stale Region when the selected Geo no longer contains it, so the
  // mandatory check below can't pass on a region from another geo.
  React.useEffect(() => {
    if (
      regions.length > 0 &&
      values.region_id &&
      !regions.some((r) => r.id === values.region_id && r.geo_id === values.geo_id)
    ) {
      setValue("region_id", "");
    }
  }, [values.geo_id, values.region_id, regions, setValue]);

  const canSubmit = Boolean(values.name?.trim() && values.geo_id && values.region_id);
  const busy = createAccount.isPending || updateAccount.isPending || setAccountHead.isPending;

  async function submit() {
    if (!canSubmit) return;
    const payload = buildAccountPayload(values);

    try {
      if (account) {
        await updateAccount.mutateAsync({ id: account.id, payload });
        await setAccountHead.mutateAsync({ accountId: account.id, userId: accountHeadId });
      } else {
        const created = await createAccount.mutateAsync(payload);
        if (accountHeadId) {
          await setAccountHead.mutateAsync({ accountId: created.id, userId: accountHeadId });
        }
      }
      onClose();
      showSuccess(account ? "Account Updated Successfully" : "Account Created Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save account.");
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <EntryFields
          defs={fields}
          values={values}
          set={set}
          columns={2}
          trailingAfter="is_active"
          trailing={
            <Field label={ACCOUNT_MANAGER_LABEL} hint="Optional.">
              <ResourcePicker
                value={accountHeadId}
                onChange={setAccountHeadId}
                roleCodes={ACCOUNT_HEAD_CANDIDATE_ROLES}
                placeholder={`Select ${ACCOUNT_MANAGER_LABEL}…`}
              />
            </Field>
          }
        />
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
          {account ? "Save Changes" : "Add Account"}
        </Button>
      </SheetFooter>
    </>
  );
}
