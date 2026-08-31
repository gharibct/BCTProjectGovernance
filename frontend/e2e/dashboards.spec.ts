import { test, expect, type Page } from "@playwright/test";
import { trackConsoleErrors } from "./utils/console";

// One entry per seeded demo role (mirrors auth.setup.ts's ROLES map — kept
// as a separate copy here rather than imported, since auth.setup.ts doesn't
// export it and this task's constraints say not to modify that file).
// `expectMenu`/`avoidMenu` are sidebar labels chosen to be unique within that
// role's rendered nav (see app-sidebar.tsx + menu-config.ts's ROLE_MENUS) —
// picked so a single getByText(..., { exact: true }) can't hit more than one
// element for that role (e.g. admin renders "My Summary" three times over,
// so admin's list uses "Admin Dashboard" instead).
const ROLES = [
  {
    slug: "admin",
    identifier: "hari.g",
    landing: "/dashboard/admin",
    expectMenu: [
      "Admin Dashboard",
      "New Project",
      "Maintain Project",
      "Report Project",
      "System Health",
      "Users & Roles",
      "Accounts",
      "Account Reporting",
      "Geo Reporting",
    ],
    avoidMenu: [] as string[],
  },
  {
    slug: "project-manager",
    identifier: "pm",
    landing: "/dashboard",
    expectMenu: ["My Summary", "Project Dashboard", "New Project", "Maintain Project", "Report Project"],
    avoidMenu: ["Admin Dashboard", "Users & Roles", "Accounts", "Account Reporting", "Geo Reporting", "System Health"],
  },
  {
    slug: "delivery-excellence",
    identifier: "daniel.osei",
    landing: "/dashboard",
    expectMenu: ["My Summary", "DE Assessment"],
    avoidMenu: [
      "New Project",
      "Maintain Project",
      "Report Project",
      "System Health",
      "Admin Dashboard",
      "Account Reporting",
      "Geo Reporting",
      "Project Dashboard",
      "Users & Roles",
      "Accounts",
    ],
  },
  {
    slug: "cxo",
    identifier: "cxo",
    landing: "/dashboard/cxo",
    expectMenu: ["My Summary", "Geo Dashboard"],
    avoidMenu: ["New Project", "Account Reporting", "Geo Reporting", "Admin Dashboard", "Project Dashboard"],
  },
  {
    slug: "account-manager",
    identifier: "acchead",
    landing: "/dashboard/account-manager",
    expectMenu: ["My Summary", "Account Dashboard", "Account Reporting", "Project Dashboard"],
    avoidMenu: ["Admin Dashboard", "New Project", "Geo Reporting", "Geo Dashboard", "Maintain Project"],
  },
  {
    slug: "geo-head",
    identifier: "geohead",
    landing: "/dashboard/geo-head",
    expectMenu: ["My Summary", "Geo Dashboard", "Geo Reporting", "Account Dashboard"],
    avoidMenu: ["Admin Dashboard", "New Project", "Account Reporting", "Project Dashboard", "Maintain Project"],
  },
] as const;

async function expectMenuState(page: Page, expectMenu: readonly string[], avoidMenu: readonly string[]) {
  const nav = page.getByRole("navigation");
  await expect(nav).toBeVisible();
  for (const label of expectMenu) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }
  for (const label of avoidMenu) {
    await expect(nav.getByText(label, { exact: true })).toHaveCount(0);
  }
}

for (const role of ROLES) {
  test.describe(`${role.slug} dashboard`, () => {
    test.use({ storageState: `e2e/.auth/${role.slug}.json` });

    test(`renders ${role.landing}`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      const response = await page.goto(role.landing);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });

    test("shows the role-appropriate sidebar menu", async ({ page }) => {
      await page.goto(role.landing);
      await expectMenuState(page, role.expectMenu, role.avoidMenu);
    });
  });
}

// Menu correctness is real, testable behavior (menu-config.ts's ROLE_MENUS
// drives app-sidebar.tsx directly) — but "lands on the right page after
// login" is only meaningfully verified by actually going through the login
// form, not by loading a pre-authenticated storageState. Runs logged-out
// (no test.use(storageState) in this describe block).
test.describe("login landing routes", () => {
  for (const role of ROLES) {
    test(`${role.slug} identifier lands on ${role.landing}`, async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Corporate Email").fill(role.identifier);
      await page.getByRole("button", { name: "Sign in to System" }).click();
      await expect(page).toHaveURL(new RegExp(`${role.landing}$`));
    });
  }
});
