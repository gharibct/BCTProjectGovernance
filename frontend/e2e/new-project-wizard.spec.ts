import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./utils/console";

// The New Project wizard — the one flow in this suite that must go through
// the real UI step by step rather than being API-shortcut-created, since the
// wizard itself is what's under test. Follows components/new-project/new-project-nav.tsx's
// real nav rail where a link exists; falls back to page.goto for the two
// routes it deliberately doesn't link to (Self Assessment / RAG Status and
// Project Status — both period-driven reporting screens that, per that
// file's own comment, only live in the Project Reporting nav, not here) and
// for DE Assessment (also not in this nav rail, though its own route
// exists — see new-project/[projectId]/de-assessment/page.tsx).
test.use({ storageState: "e2e/.auth/project-manager.json" });

test("create a project and walk every New Project screen", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  const projectName = `E2E Wizard Project ${Date.now()}`;
  let projectId = "";

  const firstOracleId = `ORA-${Date.now()}`;

  await test.step("Create Project — Project Name + Oracle mapping are both required", async () => {
    await page.goto("/new-project/new/create");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByLabel("Project Name").fill(projectName);
    await page.getByLabel("Oracle Project ID").fill(firstOracleId);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("row", { name: new RegExp(firstOracleId) })).toBeVisible();

    await page.getByRole("button", { name: "Create Project" }).click();

    // Oracle mapping now happens before creation, so success routes straight
    // into the existing (untouched) Project Profile screen.
    await expect(page).toHaveURL(/\/new-project\/[^/]+\/project-charter$/);
    projectId = new URL(page.url()).pathname.split("/")[2];
    expect(projectId).toBeTruthy();
  });

  await test.step("Map Oracle Projects — add a second mapping", async () => {
    await page.getByRole("link", { name: "Map Oracle Projects" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The mapping added during creation should already be here.
    await expect(page.getByRole("row", { name: new RegExp(firstOracleId) })).toBeVisible();

    const secondOracleId = `ORA-${Date.now()}-2`;
    await page.getByLabel("Oracle Project ID").fill(secondOracleId);
    await page.getByRole("button", { name: "Add Projects" }).click();
    await expect(page.getByRole("row", { name: new RegExp(secondOracleId) })).toBeVisible();
  });

  await test.step("Back to Project Profile via the nav rail", async () => {
    await page.getByRole("link", { name: "Project Profile" }).click();
    await expect(page).toHaveURL(new RegExp(`/new-project/${projectId}/project-charter$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Now that the project exists, its code should render as the heading
    // base (see new-project-header.tsx) instead of the generic fallback.
    await expect(page.getByLabel("Project Code")).not.toHaveValue("");
  });

  await test.step("Scope & Schedule — fill and save", async () => {
    await page.getByRole("link", { name: "Scope & Schedule" }).click();
    await expect(page).toHaveURL(new RegExp(`/new-project/${projectId}/project-charter/schedule$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByLabel("Project Scope Description").fill("E2E smoke test scope description.");
    await page.getByLabel("Planned Start Date").fill("2026-01-01");
    await page.getByLabel("Planned End Date").fill("2026-06-30");
    await page.getByRole("button", { name: "Save Scope & Schedule" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  await test.step("Self Assessment / RAG Status — direct route (not nav-linked here)", async () => {
    await page.goto(`/new-project/${projectId}/project-charter/self-assessment`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("Project RAIDO Register — smoke (CRUD covered by raid-logs.spec.ts)", async () => {
    await page.getByRole("link", { name: "Project RAIDO Register" }).click();
    await expect(page).toHaveURL(new RegExp(`/new-project/${projectId}/raido$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("tablist")).toBeVisible();
  });

  await test.step("Contractual Compliance — smoke", async () => {
    await page.getByRole("link", { name: "Contractual Compliance" }).click();
    await expect(page).toHaveURL(new RegExp(`/new-project/${projectId}/contractual-compliance$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("DE Assessment — direct route (not nav-linked here)", async () => {
    await page.goto(`/new-project/${projectId}/de-assessment`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("Measurement — smoke", async () => {
    await page.getByRole("link", { name: "Measurement" }).click();
    await expect(page).toHaveURL(new RegExp(`/new-project/${projectId}/measurement$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("Project Status — direct route (not nav-linked here)", async () => {
    await page.goto(`/new-project/${projectId}/project-status`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("AI Document Processing — smoke", async () => {
    await page.getByRole("link", { name: "AI Document Processing" }).click();
    await expect(page).toHaveURL(new RegExp(`/new-project/${projectId}/ai-hub/document-processing$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  expect(errors).toEqual([]);
});
