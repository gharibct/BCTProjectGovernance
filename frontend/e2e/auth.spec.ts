import { test, expect } from "@playwright/test";

// Unauthenticated flows — none of these tests set storageState, so they run
// with a fresh, logged-out context regardless of what the "chromium" project
// otherwise inherits. Mirrors auth.setup.ts's own login mechanics (email
// field only, no password, auth_type=no_password dev mode — see
// backend/app/api/v1/endpoints/auth.py) but exercises the form's own
// behavior (validation error, redirect) rather than just producing
// storageState.

test.describe("login page", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
    await expect(page.getByLabel("Corporate Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to System" })).toBeVisible();
  });

  test("unknown identifier shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Corporate Email").fill("nobody@nowhere.example.com");
    await page.getByRole("button", { name: "Sign in to System" }).click();
    // login-form.tsx's onError: a 404 from POST /auth/login renders this
    // exact copy — asserting it here (not just "some error is visible") is
    // the one deliberately content-specific check in this suite, since it's
    // the one line of UI copy this test exists to cover.
    await expect(page.getByText("No active user found for that identifier.")).toBeVisible();
    // Never navigated away.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("empty submit shows a validation error instead of calling the API", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in to System" }).click();
    await expect(page.getByText("Enter your corporate email or LDAP username.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("known identifier redirects to that role's landing route", async ({ page }) => {
    await page.goto("/login");
    // "pm" is the seeded PROJECT_MANAGER demo user (see auth.setup.ts) —
    // lands on /dashboard per menu-config.ts's ROLE_LANDING_ROUTE.
    await page.getByLabel("Corporate Email").fill("pm");
    await page.getByRole("button", { name: "Sign in to System" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("root route", () => {
  test("redirects to /login when logged out", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login$/);
  });
});
