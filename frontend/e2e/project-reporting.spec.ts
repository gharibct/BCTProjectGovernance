import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiContextFor, createProject } from "./utils/api";
import { trackConsoleErrors } from "./utils/console";

// Project Reporting — hub + every sub-page, heading-only smoke checks.
// CRUD depth on RAIDO is already covered by raid-logs.spec.ts and the
// Project Profile / Scope & Schedule / Map Oracle Projects create flow by
// new-project-wizard.spec.ts, so this file only asserts each route renders
// its heading with no console errors (per the read-only pattern) — no route
// guard exists (auth-guard.tsx only checks "is anyone logged in"), so these
// are reachable via direct URL regardless of the project's Draft status.
test.use({ storageState: "e2e/.auth/project-manager.json" });

let api: APIRequestContext;
let projectId: string;

test.beforeAll(async () => {
  api = await apiContextFor("project-manager");
  const project = await createProject(api, `E2E Reporting Project ${Date.now()}`);
  projectId = project.id;
});

test.afterAll(async () => {
  await api.dispose();
});

const SUB_ROUTES = [
  "",
  "/dashboard",
  "/project-charter",
  "/project-charter/schedule",
  "/project-charter/self-assessment",
  "/raido",
  "/contractual-compliance",
  "/de-assessment",
  "/measurement",
  "/project-status",
  "/resource-allocation",
  "/ai-hub/document-processing",
];

for (const sub of SUB_ROUTES) {
  test(`renders /project-reporting/[projectId]${sub}`, async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto(`/project-reporting/${projectId}${sub}`);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
