import type { MenuEntryId } from "@/lib/menu-config";

// Account-level menu entries. Clicking one opens the Account Context page
// (/select-account/{entry}), which picks an account and then forwards to that
// entry's own screen — mirrors project-context-targets.ts.

export type AccountTargetId = Extract<MenuEntryId, "account-reporting" | "account-review" | "account-approval">;

type AccountTarget = {
  /** Screen name shown on the Context page ("Continue to …"). */
  label: string;
  /** Where the selected account's screen lives. */
  hrefFor: (accountId: string) => string;
  /** Message when there is nothing to pick. */
  emptyLabel: string;
};

export const ACCOUNT_TARGETS: Record<AccountTargetId, AccountTarget> = {
  "account-reporting": {
    label: "Report Account Status",
    hrefFor: (id) => `/account-reporting/${id}`,
    emptyLabel: "No accounts assigned yet.",
  },
  "account-review": {
    label: "Account Delivery Status",
    hrefFor: (id) => `/account-review/${id}`,
    emptyLabel: "No accounts to review yet.",
  },
  // Same report as Account Delivery Status, but with the Approve / Reject bar —
  // the Geo Head's worklist item (Account Delivery Status is view-only).
  "account-approval": {
    label: "Approve Account Delivery Status",
    hrefFor: (id) => `/account-approval/${id}`,
    emptyLabel: "No accounts to approve yet.",
  },
};

export function isAccountTargetId(value: string): value is AccountTargetId {
  return Object.prototype.hasOwnProperty.call(ACCOUNT_TARGETS, value);
}

export function selectAccountHref(target: AccountTargetId): string {
  return `/select-account/${target}`;
}
