import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { apiContextFor, createProject } from "./utils/api";

// RAIDO register CRUD — /new-project/[projectId]/raido, one tab per RAID
// type (see components/new-project/raido/raido-tabs.tsx, role="tablist").
//
// IMPORTANT: as of this writing, none of the five logs (risk-log.tsx,
// issue-log.tsx, dependency-log.tsx, assumption-log.tsx, opportunity-log.tsx)
// pass onEdit/onDelete to RegisterTable — every one of them calls it with
// only `items`/`emptyLabel`/`columns`. RegisterTable only renders its
// Actions column (the pencil/trash icons) when at least one of those two
// callbacks is supplied (see register-table.tsx's `showActions`), so there
// is currently no edit or delete affordance anywhere in these five logs —
// only create. This deviates from this suite's original create/edit/delete
// brief; the tests below cover what's actually there (create -> row
// appears) and do not invent edit/delete UI that doesn't exist. If/when
// these logs grow edit/delete (matching admin's create-user-panel.tsx /
// create-account-panel.tsx pattern), extend these tests to match.
test.use({ storageState: "e2e/.auth/project-manager.json" });

let api: APIRequestContext;
let projectId: string;

test.beforeAll(async () => {
  api = await apiContextFor("project-manager");
  const project = await createProject(api, `E2E RAID Project ${Date.now()}`);
  projectId = project.id;
});

test.afterAll(async () => {
  await api.dispose();
});

async function gotoTab(page: Page, tabName: string) {
  await page.goto(`/new-project/${projectId}/raido`);
  await page.getByRole("tab", { name: tabName, exact: true }).click();
}

test.describe("Risk log", () => {
  test("add a risk and see it in the register", async ({ page }) => {
    await gotoTab(page, "Risk");
    const title = `E2E Risk ${Date.now()}`;

    await page.getByLabel("Risk Title").fill(title);
    await page.getByLabel("Probability").selectOption("Medium");
    await page.getByLabel("Impact").selectOption("Medium");
    await page.getByRole("button", { name: "Add Risk" }).click();

    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });
});

test.describe("Issue log", () => {
  test("add an issue and see it in the register", async ({ page }) => {
    await gotoTab(page, "Issue");
    const title = `E2E Issue ${Date.now()}`;

    await page.getByLabel("Issue Title").fill(title);
    await page.getByLabel("Priority").selectOption("Medium");
    await page.getByRole("button", { name: "Add Issue" }).click();

    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });
});

test.describe("Dependency log", () => {
  test("add a dependency and see it in the register", async ({ page }) => {
    await gotoTab(page, "Dependency");
    const title = `E2E Dependency ${Date.now()}`;

    await page.getByLabel("Dependency Title").fill(title);
    await page.getByLabel("Criticality").selectOption("Medium");
    await page.getByRole("button", { name: "Add Dependency" }).click();

    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });
});

test.describe("Assumption log", () => {
  test("add an assumption and see it in the register", async ({ page }) => {
    await gotoTab(page, "Assumption");
    const title = `E2E Assumption ${Date.now()}`;

    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Impact Rating").selectOption("Medium");
    await page.getByRole("button", { name: "Add Assumption" }).click();

    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });
});

test.describe("Opportunity log", () => {
  test("add an opportunity and see it in the register", async ({ page }) => {
    await gotoTab(page, "Opportunity");
    const title = `E2E Opportunity ${Date.now()}`;

    await page.getByLabel("Opportunity Title").fill(title);
    await page.getByLabel("Impact", { exact: true }).selectOption("Medium");
    await page.getByRole("button", { name: "Add Opportunity" }).click();

    await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  });
});
