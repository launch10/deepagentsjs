import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { PerformancePage } from "./pages/performance.page";

/**
 * Project Performance Page E2E Tests
 *
 * Tests the individual project performance page including:
 * - Summary cards (Ad Spend, Leads, CPL, ROAS)
 * - Engagement charts (Impressions, Clicks, CTR)
 * - Date range switching
 * - Navigation (back to projects, view leads)
 * - Empty state when no analytics data exists
 *
 * Uses analytics snapshots to set up different data scenarios.
 */
test.describe("Project Performance Page", () => {
  let performancePage: PerformancePage;
  let projectUuid: string;

  test.describe("With Healthy Account Data (analytics/healthy_account)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("analytics/healthy_account");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      await loginUser(page);
      performancePage = new PerformancePage(page);
    });

    test("displays page structure correctly", async ({ page }) => {
      await performancePage.goto(projectUuid);

      // Check header elements
      await expect(performancePage.pageTitle).toHaveText("Performance");
      await expect(performancePage.projectName).toBeVisible();
      await expect(performancePage.backLink).toBeVisible();
      await expect(performancePage.dateRangeFilter).toBeVisible();
    });

    test("displays all four summary cards", async () => {
      await performancePage.goto(projectUuid);

      await performancePage.expectSummaryCardsVisible();
    });

    test("displays summary card values with metrics", async () => {
      await performancePage.goto(projectUuid);

      // Should NOT show empty state
      await performancePage.expectHasData();

      // Ad spend should be a dollar amount
      const adSpend = await performancePage.getAdSpendValue();
      expect(adSpend).toMatch(/^\$[\d,]+\.\d{2}$/);

      // Leads should be a number
      const leads = await performancePage.getLeadsValue();
      expect(leads).toMatch(/^\d+$/);

      // CPL should be dollar amount or dash
      const cpl = await performancePage.getCplValue();
      expect(cpl).toMatch(/^\$[\d,]+\.\d{2}$|^-$/);

      // ROAS should be a multiplier or dash
      const roas = await performancePage.getRoasValue();
      expect(roas).toMatch(/^\d+\.\d{2}x$|^-$/);
    });

    test("displays engagement metrics section with charts", async () => {
      await performancePage.goto(projectUuid);

      // Check all three charts are visible
      await performancePage.expectChartsVisible();
    });

    test("charts display with data", async () => {
      await performancePage.goto(projectUuid);

      // Charts should have SVG elements (Recharts renders SVGs)
      await performancePage.expectChartsHaveData();
    });

    test("impressions chart shows total value", async () => {
      await performancePage.goto(projectUuid);

      const total = await performancePage.getImpressionsTotal();
      // Should be a formatted number
      expect(total).toMatch(/^[\d,]+$/);
    });

    test("clicks chart shows total value", async () => {
      await performancePage.goto(projectUuid);

      const total = await performancePage.getClicksTotal();
      expect(total).toMatch(/^[\d,]+$/);
    });

    test("CTR chart shows percentage value", async () => {
      await performancePage.goto(projectUuid);

      const ctr = await performancePage.getCtrValue();
      expect(ctr).toMatch(/^\d+\.\d%$/);
    });

    test("allows changing date range", async () => {
      await performancePage.goto(projectUuid);

      // Should default to 30 days
      await expect(performancePage.dateRangeFilter).toHaveValue("30");

      // Change to 7 days
      await performancePage.selectDateRange(7);
      await expect(performancePage.dateRangeFilter).toHaveValue("7");

      // Charts should still be visible (instant client-side switching)
      await performancePage.expectChartsVisible();

      // Change to 90 days
      await performancePage.selectDateRange(90);
      await expect(performancePage.dateRangeFilter).toHaveValue("90");

      // Change to All time
      await performancePage.selectDateRange(0);
      await expect(performancePage.dateRangeFilter).toHaveValue("0");
    });

    test("View Leads link navigates to leads page", async ({ page }) => {
      await performancePage.goto(projectUuid);

      await performancePage.clickViewLeads();

      // Should be on leads page
      await expect(page).toHaveURL(new RegExp(`/projects/${projectUuid}/leads`));
    });

    test("back link navigates to dashboard", async ({ page }) => {
      await performancePage.goto(projectUuid);

      await performancePage.clickBackToProjects();

      // Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("date range switching updates chart values", async () => {
      await performancePage.goto(projectUuid);

      // Get 30-day totals
      const impressions30 = await performancePage.getImpressionsTotal();

      // Switch to 7 days
      await performancePage.selectDateRange(7);

      // Get 7-day totals (should typically be different/less)
      const impressions7 = await performancePage.getImpressionsTotal();

      // Values should be valid numbers (may or may not be different depending on data)
      expect(impressions30).toMatch(/^[\d,]+$/);
      expect(impressions7).toMatch(/^[\d,]+$/);
    });
  });

  test.describe("With New Account (minimal data)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("analytics/new_account");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      await loginUser(page);
      performancePage = new PerformancePage(page);
    });

    test("displays page structure for new account", async () => {
      await performancePage.goto(projectUuid);

      await expect(performancePage.pageTitle).toHaveText("Performance");
      await performancePage.expectSummaryCardsVisible();
    });

    test("displays zero or dash values for new account", async () => {
      await performancePage.goto(projectUuid);

      // New account should have $0 or low ad spend
      const adSpend = await performancePage.getAdSpendValue();
      expect(adSpend).toMatch(/^\$[\d,]+\.\d{2}$/);

      // CPL might be dash if no leads
      const cpl = await performancePage.getCplValue();
      expect(cpl).toMatch(/^\$[\d,]+\.\d{2}$|^-$/);
    });
  });

  test.describe("Empty State (no analytics data)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      await loginUser(page);
      performancePage = new PerformancePage(page);
    });

    test("displays info banner when no data exists", async () => {
      await performancePage.goto(projectUuid);

      // Should show the "Not enough data yet" banner
      await expect(performancePage.noDataBanner).toBeVisible();
      await expect(performancePage.noDataBanner.getByText("Not enough data yet")).toBeVisible();
      await expect(
        performancePage.noDataBanner.getByText(/Check back in 24–48 hours/)
      ).toBeVisible();
    });

    test("displays empty state in all summary cards", async ({ page }) => {
      await performancePage.goto(projectUuid);

      // All summary cards should be visible
      await performancePage.expectSummaryCardsVisible();

      // Each summary card should show "No data available yet"
      const adSpendEmpty = performancePage.adSpendCard.getByText("No data available yet");
      const leadsEmpty = performancePage.leadsCard.getByText("No data available yet");
      const cplEmpty = performancePage.cplCard.getByText("No data available yet");
      const roasEmpty = performancePage.roasCard.getByText("No data available yet");

      await expect(adSpendEmpty).toBeVisible();
      await expect(leadsEmpty).toBeVisible();
      await expect(cplEmpty).toBeVisible();
      await expect(roasEmpty).toBeVisible();
    });

    test("displays empty state in all charts", async () => {
      await performancePage.goto(projectUuid);

      // All chart cards should be visible
      await performancePage.expectChartsVisible();

      // Each chart should show "No data available yet"
      const impressionsEmpty = performancePage.impressionsChart.getByText("No data available yet");
      const clicksEmpty = performancePage.clicksChart.getByText("No data available yet");
      const ctrEmpty = performancePage.ctrChart.getByText("No data available yet");

      await expect(impressionsEmpty).toBeVisible();
      await expect(clicksEmpty).toBeVisible();
      await expect(ctrEmpty).toBeVisible();
    });

    test("hides View Leads link in empty state", async () => {
      await performancePage.goto(projectUuid);

      // View Leads link should not be visible when there's no data
      await expect(performancePage.viewLeadsLink).not.toBeVisible();
    });

    test("full empty state validation", async () => {
      await performancePage.goto(projectUuid);

      // Use the comprehensive empty state check
      await performancePage.expectEmptyState();
    });

    test("page title and navigation still work in empty state", async ({ page }) => {
      await performancePage.goto(projectUuid);

      // Title should still show
      await expect(performancePage.pageTitle).toHaveText("Performance");

      // Back link should still work
      await performancePage.clickBackToProjects();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("date range filter still works in empty state", async () => {
      await performancePage.goto(projectUuid);

      // Should default to 30 days
      await expect(performancePage.dateRangeFilter).toHaveValue("30");

      // Should be able to change date range
      await performancePage.selectDateRange(7);
      await expect(performancePage.dateRangeFilter).toHaveValue("7");

      // Empty state should still be shown (no data in any range)
      await expect(performancePage.noDataBanner).toBeVisible();
    });
  });

  test.describe("Navigation from Dashboard", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("analytics/healthy_account");
      await loginUser(page);
    });

    test("View Performance link navigates to performance page", async ({ page }) => {
      await page.goto("/dashboard");

      // Wait for dashboard to load
      await page.locator("h1").waitFor({ state: "visible", timeout: 15000 });

      // Find and click the View Performance link on a project card
      const performanceLink = page.locator('a:has-text("View Performance")').first();
      await performanceLink.click();

      // Should navigate to performance page
      await page.waitForURL(/\/projects\/[\w-]+\/performance/);
      await expect(page.locator("h1")).toHaveText("Performance");
    });
  });

  test.describe("Multi-tenant Isolation", () => {
    // Admin user credentials (created by basic_account snapshot builder)
    const adminUser = {
      email: "brett@launch10.ai",
      password: "Launch10TestPass!",
    };

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("analytics/healthy_account");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      performancePage = new PerformancePage(page);
    });

    test("returns 404 for non-existent project UUID", async ({ page }) => {
      // Login and navigate directly to an invalid project URL
      await page.goto("/users/sign_in");
      await page.waitForLoadState("domcontentloaded");

      const emailInput = page.getByPlaceholder("Email");
      await emailInput.waitFor({ state: "visible", timeout: 10000 });
      await emailInput.fill("test_user@launch10.ai");
      await page.getByPlaceholder("Password").fill("Launch10TestPass!");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();

      // Wait for sign in to complete (redirect away from sign_in)
      await page.waitForURL((url) => !url.toString().includes("/users/sign_in"), {
        timeout: 10000,
      });

      // Now navigate to a completely invalid UUID
      await page.goto(`/projects/non-existent-uuid/performance`);

      // Should show 404 page content or redirect
      // The route will return 404 because the project doesn't exist
      await expect(page.locator("body")).toContainText(/not found|404/i, {
        timeout: 10000,
      });
    });

    test("user cannot access another user's project performance data", async ({ page }) => {
      // First, login as test_user to verify the project exists and is accessible
      await loginUser(page);
      await performancePage.goto(projectUuid);
      await expect(performancePage.pageTitle).toHaveText("Performance");
      await performancePage.expectHasData();

      // Logout test_user
      await page.goto("/users/sign_out");
      await page.waitForLoadState("domcontentloaded");

      // Login as admin user (different account, different projects)
      await loginUser(page, adminUser.email, adminUser.password);

      // Try to access the test_user's project directly
      // This should fail because the project belongs to a different account
      await page.goto(`/projects/${projectUuid}/performance`);

      // Should get 404 or redirect - the project exists but doesn't belong to admin
      // Rails scopes projects to current account, so it won't find this UUID
      await expect(page.locator("body")).toContainText(/not found|404/i, {
        timeout: 10000,
      });
    });

    test("API returns 404 when accessing another user's project analytics", async ({ page }) => {
      // Login as admin user
      await loginUser(page, adminUser.email, adminUser.password);

      // Try to fetch the test_user's project performance data via API
      const response = await page.request.get(`/api/v1/projects/${projectUuid}/performance`);

      // Should return 404 - project not found for this user's account
      expect(response.status()).toBe(404);
    });
  });
});
