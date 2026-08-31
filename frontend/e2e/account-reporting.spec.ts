import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiContextFor, listAccounts } from "./utils/api";
import { trackConsoleErrors } from "./utils/console";

// Account Reporting — read-only, ACCOUNT_MANAGER. "Gulf National Bank" is
// seeded and owned by acchead (see backend/scripts/seed_sqlite_dev.py and
// this task brief's account list), so we look up its id via the API rather
// than hardcoding one.
test.use({ storageState: "e2e/.auth/account-manager.json" });

let api: APIRequestContext;
let accountId: string;

test.beforeAll(async () => {
  api = await apiContextFor("account-manager");
  const accounts = await listAccounts(api);
  const account = accounts.find((a) => a.name === "Gulf National Bank");
  if (!account) {
    throw new Error('Seeded account "Gulf National Bank" not found via GET /api/v1/accounts.');
  }
  accountId = account.id;
});

test.afterAll(async () => {
  await api.dispose();
});

const SUB_ROUTES = ["", "/dashboard", "/status", "/rag-status", "/ai-hub/document-processing"];

for (const sub of SUB_ROUTES) {
  test(`renders /account-reporting/[accountId]${sub}`, async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto(`/account-reporting/${accountId}${sub}`);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
