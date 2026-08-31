import { defineConfig, devices } from "@playwright/test";

// This config only owns the frontend dev/prod server. The backend (uvicorn,
// pointed at a throwaway SQLite db) is started separately by
// scripts/pre-release-check.ps1 before `playwright test` runs, since it needs
// its own bootstrap/seed steps first — see that script for details.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    // Logs in as each seeded demo role once and saves storageState JSON to
    // e2e/.auth/ — every other spec loads the matching file via
    // test.use({ storageState }) instead of re-logging-in per test.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
