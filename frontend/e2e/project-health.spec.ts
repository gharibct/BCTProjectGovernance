import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./utils/console";

// Project Health — the org-wide portfolio dashboard + its 15 drill-down grids
// (components/dashboard/project-health-*.tsx). Every backing endpoint is gated
// to PMO/ADMIN/CXO (backend/app/api/v1/endpoints/dashboard.py::_project_health_role),
// so these run as admin. The dev seed creates no Project rows, so the grids
// render empty — this suite is about every route being mounted, rendering a
// heading, and staying console-error-free, not about row data.
test.describe("Project Health", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  const SCREENS: Array<{ path: string; heading: string }> = [
    { path: "/project-health", heading: "Project Health" },
    { path: "/project-health/project-list", heading: "Project List" },
    { path: "/project-health/rag", heading: "RAG Report" },
    { path: "/project-health/account-rag", heading: "Account RAG" },
    { path: "/project-health/risks", heading: "Risks" },
    { path: "/project-health/issues", heading: "Issues" },
    { path: "/project-health/dependencies", heading: "Dependencies" },
    { path: "/project-health/assumptions", heading: "Assumptions" },
    { path: "/project-health/opportunities", heading: "Opportunities" },
    { path: "/project-health/metrics", heading: "Metrics" },
    { path: "/project-health/commitments", heading: "Commitments" },
    { path: "/project-health/payment-milestones", heading: "Payment Milestones" },
    { path: "/project-health/assessments", heading: "Assessments" },
    { path: "/project-health/findings", heading: "Findings" },
    { path: "/project-health/actions", heading: "Actions" },
    { path: "/project-health/data-integrity", heading: "Data Integrity" },
  ];

  for (const { path, heading } of SCREENS) {
    test(`${path} renders without console errors`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      const response = await page.goto(path);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      expect(errors).toEqual([]);
    });
  }
});

// Report Submissions — the 4 KPI-scoped sub screens drilled into from the
// dashboard's "Report Submissions" cards. Each has its own route + heading and
// defaults its status filter to Pending.
test.describe("/project-health/report-submissions sub screens", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  const SUB_SCREENS: Array<{ path: string; heading: string }> = [
    {
      path: "/project-health/report-submissions/delivery-status-projects",
      heading: "Delivery Status (Projects) — Submission Reporting",
    },
    {
      path: "/project-health/report-submissions/metrics-projects",
      heading: "Metrics (Projects) — Submission Reporting",
    },
    {
      path: "/project-health/report-submissions/delivery-status-account",
      heading: "Delivery Status (Account) — Submission Reporting",
    },
    {
      path: "/project-health/report-submissions/delivery-status-geo",
      heading: "Delivery Status (Geo) — Submission Reporting",
    },
  ];

  for (const { path, heading } of SUB_SCREENS) {
    test(`${path} renders with its scoped heading and no console errors`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      const response = await page.goto(path);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(page.getByLabel("Submission status")).toHaveValue("pending");
      expect(errors).toEqual([]);
    });
  }
});

// Project Listing screen specifics — the Ownership column + the Region and
// Ownership filters (this is the change this spec was originally added for).
test.describe("/project-health/project-list", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("shows the Ownership column in the grid", async ({ page }) => {
    await page.goto("/project-health/project-list");
    await expect(page.getByRole("columnheader", { name: "Ownership" })).toBeVisible();
  });

  test("exposes Region and Ownership filters", async ({ page }) => {
    await page.goto("/project-health/project-list");

    const region = page.getByLabel("Region");
    const ownership = page.getByLabel("Ownership");
    await expect(region).toBeVisible();
    await expect(ownership).toBeVisible();

    // Ownership options mirror backend schemas.enums.ProjectOwned.
    await expect(ownership.getByRole("option")).toHaveText([
      "Ownership [All]",
      "Fully Owned",
      "Co-Owned",
      "Customer Driven",
    ]);
    await expect(region.getByRole("option", { name: "Region [All]" })).toHaveCount(1);
  });

  test("selecting an Ownership filter re-queries without error", async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await page.goto("/project-health/project-list");

    await page.getByLabel("Ownership").selectOption("Co-Owned");
    await expect(page.getByLabel("Ownership")).toHaveValue("Co-Owned");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByLabel("Ownership")).toHaveValue("");

    expect(errors).toEqual([]);
  });
});
