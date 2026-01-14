import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "./fixtures/database";
import { TrackingHelper } from "./fixtures/tracking";

/**
 * Tests using the REAL built tracking page (real tracking.ts + Buildable pipeline).
 * These tests exercise the actual production code path.
 */
test.describe("Real Tracking Library E2E", () => {
  test.beforeAll(async () => {
    await TrackingHelper.cleanup();
    await TrackingHelper.buildTestPage();
  });

  test.afterAll(async () => {
    await TrackingHelper.cleanup();
  });

  test("tracks visit using real tracking.ts library", async ({ page }) => {
    // Get info about the built tracking test website
    const { websiteId } = await TrackingHelper.getTestPageInfo();

    // Clear any existing localStorage/sessionStorage
    await page.addInitScript(() => {
      localStorage.removeItem("l10_visitor");
      sessionStorage.removeItem("l10_visit");
    });

    // Intercept tracking calls to verify they're made
    const trackingCalls: Array<{ url: string; data: Record<string, unknown> }> = [];
    await page.route("**/api/v1/tracking/**", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      trackingCalls.push({ url: request.url(), data: postData });
      await route.continue();
    });

    // Navigate to the REAL built tracking page
    await page.goto(TrackingHelper.getTestPageUrl());

    // Wait for tracking calls to complete
    await page.waitForTimeout(2000);

    // Verify tracking calls were made
    const visitCall = trackingCalls.find((c) => c.url.includes("/visit"));
    const eventCall = trackingCalls.find((c) => c.url.includes("/event"));

    expect(visitCall).toBeDefined();
    expect(visitCall?.data.token).toBeDefined();
    expect(visitCall?.data.visitor_token).toBeDefined();
    expect(visitCall?.data.visit_token).toBeDefined();

    expect(eventCall).toBeDefined();
    expect(eventCall?.data.name).toBe("page_view");

    // Verify data landed in database
    // Note: visit_count may be > 1 if test ran previously without database reset
    const stats = await TrackingHelper.waitForVisits(websiteId, 1);
    expect(stats.visit_count).toBeGreaterThanOrEqual(1);
  });

  test("built page includes gtag from Buildable pipeline", async ({ page }) => {
    // Verify the gtag script was injected by the real Buildable concern
    await page.goto(TrackingHelper.getTestPageUrl());

    // Check that gtag.js is loaded
    const gtagScript = await page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(gtagScript).toHaveCount(1);

    // Verify the gtag config script exists
    const pageContent = await page.content();
    expect(pageContent).toContain("gtag('config'");
  });

  test("real tracking library fires gtag conversion on lead submission", async ({ page }) => {
    // Navigate to the built page (real gtag is injected by Buildable)
    await page.goto(TrackingHelper.getTestPageUrl());
    await page.waitForTimeout(1500);

    // Fill out the lead form (the real App.tsx has a form)
    const testEmail = `real-tracking-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for form submission to complete
    await page.waitForTimeout(2000);

    // Get gtag calls from dataLayer (the real gtag pushes all calls there)
    // The page's inline script defines: function gtag(){dataLayer.push(arguments);}
    const dataLayerCalls = await page.evaluate(() => {
      // @ts-expect-error - accessing dataLayer
      return window.dataLayer || [];
    });

    // Verify conversion event was fired
    // dataLayer entries are Arguments objects, converted to arrays for easier checking
    const conversionCall = dataLayerCalls.find(
      (entry: Record<string, unknown>) =>
        entry["0"] === "event" && entry["1"] === "conversion"
    );
    expect(conversionCall).toBeDefined();
    expect(conversionCall?.["2"]).toMatchObject({
      send_to: expect.stringContaining("AW-TEST123"),
    });
  });
});