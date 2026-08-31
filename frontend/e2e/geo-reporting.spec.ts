import { test, expect, type APIRequestContext } from "@playwright/test";
import { apiContextFor, listGeos } from "./utils/api";
import { trackConsoleErrors } from "./utils/console";

// Geo Reporting — GEO_HEAD. "APAC" is the seeded geo owned by geohead (see
// this task brief), looked up via the API rather than hardcoded.
test.use({ storageState: "e2e/.auth/geo-head.json" });

let api: APIRequestContext;
let geoId: string;

test.beforeAll(async () => {
  api = await apiContextFor("geo-head");
  const geos = await listGeos(api);
  const geo = geos.find((g) => g.name === "APAC");
  if (!geo) {
    throw new Error('Seeded geo "APAC" not found via GET /api/v1/geos.');
  }
  geoId = geo.id;
});

test.afterAll(async () => {
  await api.dispose();
});

const READ_ONLY_SUB_ROUTES = ["", "/dashboard", "/status", "/ai-hub/document-processing"];

for (const sub of READ_ONLY_SUB_ROUTES) {
  test(`renders /geo-reporting/[geoId]${sub}`, async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const response = await page.goto(`/geo-reporting/${geoId}${sub}`);
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// Executive Update is a form (components/regional-reporting/executive-update-view.tsx)
// — fill + save smoke only, per the brief, not asserting saved content since
// the report content model is still evolving.
test("executive update: add content and save (smoke)", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto(`/geo-reporting/${geoId}/executive-update`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Default sections (Delivery/People/Financials/Operations — see
  // executive-update-view.tsx's defaultExecutiveUpdate) start with no
  // content blocks, so "Add Content" -> "Rich Text" is needed before any
  // text box exists to type into. Targets the first section's button.
  await page.getByRole("button", { name: "Add Content" }).first().click();
  await page.getByRole("menuitem", { name: "Rich Text" }).click();

  // The Tiptap editor renders as a contenteditable div, exposed to the
  // accessibility tree with an implicit "textbox" role — it's the only one
  // on this page once the block above is added.
  const editor = page.getByRole("textbox").first();
  await editor.click();
  await editor.pressSequentially("E2E smoke test update content.");

  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  expect(errors).toEqual([]);
});
