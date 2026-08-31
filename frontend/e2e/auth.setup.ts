import { test as setup, expect } from "@playwright/test";

// Seeded by backend/scripts/seed_sqlite_dev.py. auth_type=no_password means
// the login form only needs an identifier that resolves to an active user
// (ldap_username or email) — no password is checked.
const ROLES: Record<string, { identifier: string; landing: string }> = {
  admin: { identifier: "hari.g", landing: "/dashboard/admin" },
  "project-manager": { identifier: "pm", landing: "/dashboard" },
  "delivery-excellence": { identifier: "daniel.osei", landing: "/dashboard" },
  cxo: { identifier: "cxo", landing: "/dashboard/cxo" },
  "account-manager": { identifier: "acchead", landing: "/dashboard/account-manager" },
  "geo-head": { identifier: "geohead", landing: "/dashboard/geo-head" },
};

for (const [role, { identifier, landing }] of Object.entries(ROLES)) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Corporate Email").fill(identifier);
    await page.getByRole("button", { name: "Sign in to System" }).click();
    await expect(page).toHaveURL(new RegExp(`${landing}$`));
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
