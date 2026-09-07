import { test, expect } from "@playwright/test";
import { trackConsoleErrors } from "./utils/console";

// PM Findings and DE Findings list screens. Backends are role-gated
// (pm_findings.py: PROJECT_MANAGER/ADMIN; de_findings.py: DELIVERY_EXCELLENCE/
// ADMIN), so these run as admin. The dev seed has no findings, so the grids
// render empty — this is a render/regression smoke for the recent field
// changes (PM "Action Taken", DE closure date / verification remarks / reopen).
test.describe("Findings screens", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  for (const path of ["/pm-findings", "/de-findings"]) {
    test(`${path} renders without console errors`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      const response = await page.goto(path);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
