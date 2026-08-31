import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./utils/console";

// ADMIN-only, real CRUD screens — see components/admin/create-user-panel.tsx
// and components/admin/create-account-panel.tsx. Both share the same
// RegisterTable (edit pencil / delete trash icons, aria-label "Edit row" /
// "Delete row") and ConfirmationDialog ("Delete this row?", confirm button
// labeled "Delete") from components/forms/register-table.tsx.
test.use({ storageState: "e2e/.auth/admin.json" });

test.describe("/admin/users", () => {
  test("renders with no console errors", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto("/admin/users");
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("create, edit, and delete a user", async ({ page }) => {
    await page.goto("/admin/users");

    const username = `e2e-user-${Date.now()}`;
    const fullName = `E2E Test User ${Date.now()}`;
    const updatedFullName = `${fullName} (Updated)`;

    // --- Create ---
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Full Name").fill(fullName);
    await page.getByLabel("Email").fill(`${username}@example.com`);
    // Index 0 is the disabled "Select…" placeholder — index 1 is the first
    // real role option. Role names are seed data, not hardcoded here.
    await page.getByLabel("Role").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Add User" }).click();

    const row = page.getByRole("row", { name: new RegExp(username) });
    await expect(row).toBeVisible();

    // --- Edit ---
    await row.getByRole("button", { name: "Edit row" }).click();
    await expect(page.getByRole("heading", { name: "Edit User" })).toBeVisible();
    await page.getByLabel("Full Name").fill(updatedFullName);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(row.getByText(updatedFullName)).toBeVisible();

    // --- Delete ---
    await row.getByRole("button", { name: "Delete row" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Delete this row?")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row", { name: new RegExp(username) })).toHaveCount(0);
  });
});

test.describe("/admin/accounts", () => {
  test("renders with no console errors", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto("/admin/accounts");
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("create, edit, and delete an account", async ({ page }) => {
    await page.goto("/admin/accounts");

    const accountName = `E2E Account ${Date.now()}`;
    const description = "Created by the e2e suite.";
    const updatedDescription = "Updated by the e2e suite.";

    // --- Create ---
    await page.getByLabel("Account Name").fill(accountName);
    await page.getByLabel("Description").fill(description);
    await page.getByRole("button", { name: "Add Account" }).click();

    const row = page.getByRole("row", { name: new RegExp(accountName) });
    await expect(row).toBeVisible();

    // --- Edit ---
    await row.getByRole("button", { name: "Edit row" }).click();
    await expect(page.getByRole("heading", { name: "Edit Account" })).toBeVisible();
    await page.getByLabel("Description").fill(updatedDescription);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(row.getByText(updatedDescription)).toBeVisible();

    // --- Delete ---
    await row.getByRole("button", { name: "Delete row" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Delete this row?")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row", { name: new RegExp(accountName) })).toHaveCount(0);
  });
});
