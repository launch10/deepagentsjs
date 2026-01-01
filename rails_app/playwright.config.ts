import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Launch10 E2E tests.
 * See https://playwright.dev/docs/test-configuration
 *
 * Port configuration comes from config/services.sh via RAILS_PORT env var.
 * Test environment uses port 3001 by default.
 */

// Test environment defaults to port 3001 (set via config/services.sh with LAUNCH10_ENV=test)
const testPort = process.env.RAILS_PORT || "3001";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${testPort}`;

export default defineConfig({
  testDir: "./e2e",
  /* Single worker to prevent database race conditions */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: "bin/dev-test",
        url: baseURL,
        reuseExistingServer: true, // Reuse existing server if running
        timeout: 120 * 1000,
      },
});
