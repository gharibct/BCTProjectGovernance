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

    // --- Create (right-side drawer) ---
    await page.getByRole("button", { name: "Add User" }).click();
    const drawer = page.getByRole("dialog", { name: "New User" });
    await drawer.getByLabel("Username").fill(username);
    await drawer.getByLabel("Full Name").fill(fullName);
    await drawer.getByLabel("Email").fill(`${username}@example.com`);
    // Index 0 is the disabled "Select…" placeholder — index 1 is the first
    // real role option. Role names are seed data, not hardcoded here.
    await drawer.getByLabel("Role").selectOption({ index: 1 });
    await drawer.getByRole("button", { name: "Add User" }).click();
    await expect(drawer).toHaveCount(0);

    // The directory is paginated — narrow it to the new user so the row is on
    // page 1 regardless of how many users exist.
    await page.getByLabel("Search users").fill(username);
    const row = page.getByRole("row", { name: new RegExp(username) });
    await expect(row).toBeVisible();

    // --- Edit ---
    await row.getByRole("button", { name: "Edit row" }).click();
    const editDrawer = page.getByRole("dialog", { name: "Edit User" });
    await expect(editDrawer).toBeVisible();
    await editDrawer.getByLabel("Full Name").fill(updatedFullName);
    await editDrawer.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDrawer).toHaveCount(0);

    await expect(row.getByText(updatedFullName)).toBeVisible();

    // --- Delete ---
    await row.getByRole("button", { name: "Delete row" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Delete this row?" });
    await expect(dialog).toBeVisible();
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

    // --- Create (right-side drawer) ---
    await page.getByRole("button", { name: "Add Account" }).click();
    const drawer = page.getByRole("dialog", { name: "New Account" });
    await drawer.getByLabel("Account Name").fill(accountName);
    await drawer.getByLabel("Description").fill(description);
    await drawer.getByLabel("Geo").selectOption({ index: 1 });
    await drawer.getByLabel("Region").selectOption({ index: 1 });
    await drawer.getByRole("button", { name: "Add Account" }).click();
    await expect(drawer).toHaveCount(0);

    // The directory is paginated — narrow it to the new account.
    await page.getByLabel("Search accounts").fill(accountName);
    const row = page.getByRole("row", { name: new RegExp(accountName) });
    await expect(row).toBeVisible();

    // --- Edit ---
    await row.getByRole("button", { name: "Edit row" }).click();
    const editDrawer = page.getByRole("dialog", { name: "Edit Account" });
    await expect(editDrawer).toBeVisible();
    await editDrawer.getByLabel("Description").fill(updatedDescription);
    await editDrawer.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDrawer).toHaveCount(0);

    await expect(row.getByText(updatedDescription)).toBeVisible();

    // --- Delete ---
    await row.getByRole("button", { name: "Delete row" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Delete this row?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row", { name: new RegExp(accountName) })).toHaveCount(0);
  });
});

test.describe("/admin/regions", () => {
  test("renders with no console errors", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto("/admin/regions");
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("create, edit, and delete a region", async ({ page }) => {
    await page.goto("/admin/regions");

    const regionName = `E2E Region ${Date.now()}`;
    const updatedName = `${regionName} (Updated)`;

    // --- Create --- (index 0 is the disabled "Select…" placeholder)
    await page.getByLabel("Geo").selectOption({ index: 1 });
    await page.getByLabel("Region Code").fill(`E2E-${Date.now()}`);
    await page.getByLabel("Region Name").fill(regionName);
    await page.getByRole("button", { name: "Add Region" }).click();

    const row = page.getByRole("row", { name: new RegExp(regionName) });
    await expect(row).toBeVisible();

    // --- Edit ---
    await row.getByRole("button", { name: "Edit row" }).click();
    await expect(page.getByRole("heading", { name: "Edit Region" })).toBeVisible();
    await page.getByLabel("Region Name").fill(updatedName);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toBeVisible();

    // --- Delete ---
    await page
      .getByRole("row", { name: new RegExp(updatedName) })
      .getByRole("button", { name: "Delete row" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Delete this row?")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row", { name: new RegExp(updatedName) })).toHaveCount(0);
  });
});
