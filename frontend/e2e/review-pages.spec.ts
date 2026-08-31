import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiContextFor, createProject, listAccounts, listGeos } from "./utils/api";
import { trackConsoleErrors } from "./utils/console";

// Review pages — one level up the org hierarchy from Reporting (see
// components/status-review/status-review-page.tsx): Account Manager reviews
// their accounts' projects, Geo Head reviews their geos' accounts, CXO
// reviews every geo. All read-only. GET endpoints backing these pages carry
// no role/scope dependency (see backend/app/api/v1/endpoints/regional_status.py
// — only the write/review-decision endpoints got scoped in the recent
// authorization fix), so any authenticated role can load any scopeId here;
// no route guard exists either way (auth-guard.tsx only checks login state).
//
// Project creation requires PROJECT_MANAGER or ADMIN server-side
// (projects.py's `_pm_write` dependency) — created via the project-manager
// role's API context even though the page itself is viewed as
// account-manager below.
let projectApi: APIRequestContext;
let projectId: string;
let refApi: APIRequestContext;
let accountId: string;
let geoId: string;

test.beforeAll(async () => {
  projectApi = await apiContextFor("project-manager");
  const project = await createProject(projectApi, `E2E Review Project ${Date.now()}`);
  projectId = project.id;

  refApi = await apiContextFor("admin");
  const accounts = await listAccounts(refApi);
  const account = accounts.find((a) => a.name === "Gulf National Bank");
  if (!account) throw new Error('Seeded account "Gulf National Bank" not found.');
  accountId = account.id;

  const geos = await listGeos(refApi);
  const geo = geos.find((g) => g.name === "APAC");
  if (!geo) throw new Error('Seeded geo "APAC" not found.');
  geoId = geo.id;
});

test.afterAll(async () => {
  await projectApi.dispose();
  await refApi.dispose();
});

test.describe("/project-review/[projectId]", () => {
  test.use({ storageState: "e2e/.auth/account-manager.json" });

  test("renders with no console errors", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto(`/project-review/${projectId}`);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("/account-review/[accountId]", () => {
  test.use({ storageState: "e2e/.auth/geo-head.json" });

  test("renders with no console errors", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto(`/account-review/${accountId}`);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("/geo-review/[geoId]", () => {
  test.use({ storageState: "e2e/.auth/cxo.json" });

  test("renders with no console errors", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto(`/geo-review/${geoId}`);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
