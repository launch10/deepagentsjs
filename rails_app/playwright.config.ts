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
  /* Build tracking-test website before tests */
  globalSetup: "./e2e/global-setup.ts",
  /* Clean up uploads after tests */
  globalTeardown: "./e2e/global-teardown.ts",
  /* Single worker to prevent database race conditions */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - keep low to avoid long test runs on failures */
  retries: process.env.CI ? 1 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Global timeout for each test including retries - 2 minutes max */
  timeout: 120 * 1000,
  /* Timeout for expect() assertions */
  expect: {
    timeout: 10 * 1000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* Timeout for each action (click, fill, etc) - 15 seconds */
    actionTimeout: 15 * 1000,

    /* Timeout for page navigations - 30 seconds */
    navigationTimeout: 30 * 1000,
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

  /* Run your local dev server before starting the tests.
   * Disabled — services are started separately via bin/dev-test.
   * The webServer plugin's reuseExistingServer check hangs in Playwright 1.57+,
   * so we skip it entirely and rely on the server already running. */
  webServer: undefined,
});
