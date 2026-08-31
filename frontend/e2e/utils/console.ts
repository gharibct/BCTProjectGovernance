import type { Page } from "@playwright/test";

// Shared "no console.error / no uncaught page error during load" assertion
// helper — call trackConsoleErrors(page) once near the top of a test (before
// the navigation you want to watch), then assert the returned array is empty
// once the page has settled. Filtered to console type "error" only (matches
// what the pattern in the task brief asks for) — warnings/info/log are noisy
// and not what we're trying to catch here.
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  return errors;
}
