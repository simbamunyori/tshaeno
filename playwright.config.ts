import { defineConfig, devices } from "@playwright/test";

/**
 * Rendering tests: every starter signature drawn in real browser engines
 * (Chromium for Gmail and Outlook on the web and Windows, WebKit for
 * Apple Mail), light and dark, desktop and phone width.
 *
 * Locally, PLAYWRIGHT_CHROMIUM_PATH points at an installed Chromium when
 * Playwright's own download isn't available.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "rendering",
  outputDir: "test-results/rendering",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "test-results/rendering-report" }]] : "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    ...(executablePath ? [] : [{ name: "webkit", use: { ...devices["Desktop Safari"] } }]),
  ],
});
