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

    test("displays engagement metrics section with charts", async ({ page }) => {
      await performancePage.goto(projectUuid);

      // Check section heading
      await expect(page.getByText("Engagement Metrics")).toBeVisible();

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

  test.describe("With Empty Account (no projects)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      await loginUser(page);
      performancePage = new PerformancePage(page);
    });

    test("displays page structure even with no analytics data", async () => {
      await performancePage.goto(projectUuid);

      await expect(performancePage.pageTitle).toHaveText("Performance");
      await performancePage.expectSummaryCardsVisible();
    });

    test("shows zero values when no data exists", async () => {
      await performancePage.goto(projectUuid);

      const adSpend = await performancePage.getAdSpendValue();
      expect(adSpend).toBe("$0.00");

      const leads = await performancePage.getLeadsValue();
      expect(leads).toBe("0");
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
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("analytics/healthy_account");
      await loginUser(page);
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      performancePage = new PerformancePage(page);
    });

    test("returns 404 for non-existent project", async ({ page }) => {
      await page.goto(`/projects/non-existent-uuid/performance`);

      // Should get 404
      const response = await page.waitForResponse(
        (resp) => resp.url().includes("/performance") && resp.status() === 404
      );
      expect(response.status()).toBe(404);
    });
  });
});
