import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiContextFor, createProject } from "./utils/api";
import { trackConsoleErrors } from "./utils/console";

// DE Assessment — the DE-owned flow: queue (/de-assessment) -> workspace
// (/de-assessment/[projectId]) -> Findings drawer. The dev seed creates no
// Project rows and doesn't assign delivery_excellence_id, so the queue may be
// empty for the seeded DE user; the workspace is reachable by direct URL for
// any signed-in user (auth-guard.tsx only checks "is anyone logged in") and
// DELIVERY_EXCELLENCE is in the backend write gate, so the draft/submit and
// findings flow still works against a PM-created project.
test.use({ storageState: "e2e/.auth/delivery-excellence.json" });

let api: APIRequestContext;
let projectId: string;

test.beforeAll(async () => {
  api = await apiContextFor("project-manager");
  const project = await createProject(api, `E2E DE Assessment ${Date.now()}`);
  projectId = project.id;
});

test.afterAll(async () => {
  await api.dispose();
});

test("queue page renders", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  const response = await page.goto("/de-assessment");
  expect(response?.status() ?? 0).toBeLessThan(400);
  await expect(page.getByRole("heading", { level: 1, name: "DE Assessment" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("workspace: save draft, add a finding, submit", async ({ page }) => {
  const errors = trackConsoleErrors(page);

  await page.goto(`/de-assessment/${projectId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Project Assessment");

  await test.step("save draft", async () => {
    await page.getByLabel("PCI Score").fill("72");
    await page.getByLabel("Assessment Remarks").fill("E2E draft — rating justified by schedule slippage.");
    await page.getByRole("button", { name: "Save Draft" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  await test.step("add a finding via the drawer", async () => {
    await page.getByRole("button", { name: /Findings/ }).click();
    await page.getByRole("button", { name: "New Finding" }).click();
    await page.getByLabel("Finding", { exact: true }).fill("RAID log not maintained for the period.");
    await page.getByRole("button", { name: "Create Finding" }).click();
    await expect(page.getByText("RAID log not maintained for the period.")).toBeVisible();
  });

  await test.step("submit the assessment", async () => {
    await page.getByRole("button", { name: "Submit Assessment" }).click();
    await expect(page).toHaveURL(/\/de-assessment$/);
    await expect(page.getByRole("alert")).toBeVisible();
  });

  expect(errors).toEqual([]);
});
