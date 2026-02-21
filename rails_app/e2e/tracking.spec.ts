import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "./fixtures/database";
import { TrackingHelper } from "./fixtures/tracking";

/**
 * Tests using the REAL built tracking page (real tracking.ts + Buildable pipeline).
 * These tests exercise the actual production code path.
 */
test.describe("Real Tracking Library E2E", () => {
  test.beforeAll(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
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
      localStorage.removeItem("l10_click_ids");
      localStorage.removeItem("l10_click_ids_ts");
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
      (entry: Record<string, unknown>) => entry["0"] === "event" && entry["1"] === "conversion"
    );
    expect(conversionCall).toBeDefined();
    expect(conversionCall?.["2"]).toMatchObject({
      send_to: expect.stringContaining("AW-TEST123"),
    });
  });

  test("lead is created in the backend database", async ({ page }) => {
    const { websiteId } = await TrackingHelper.getTestPageInfo();

    // Navigate to the built page
    await page.goto(TrackingHelper.getTestPageUrl());
    await page.waitForTimeout(1500);

    // Fill out the lead form with a unique email
    const testEmail = `lead-test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for the lead to be created in the backend
    const lead = await TrackingHelper.waitForLead(websiteId, testEmail);

    // Verify the lead was created
    expect(lead.email).toBe(testEmail.toLowerCase());
    expect(lead.created_at).toBeDefined();
  });

  test("conversion event includes value and currency", async ({ page }) => {
    const { websiteId } = await TrackingHelper.getTestPageInfo();

    // Navigate to the built page
    await page.goto(TrackingHelper.getTestPageUrl());
    await page.waitForTimeout(1500);

    // Fill out the lead form with a unique email
    const testEmail = `conversion-value-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for the conversion event to be recorded
    const conversion = await TrackingHelper.waitForConversion(websiteId, testEmail);

    // Verify the conversion includes value and currency
    // The test App.tsx sends value: 99.00, currency: 'USD'
    expect(conversion.email).toBe(testEmail.toLowerCase());
    expect(conversion.value).toBe(99.0);
    expect(conversion.currency).toBe("USD");
  });

  test("UTM parameters are captured and stored with lead", async ({ page }) => {
    const { websiteId } = await TrackingHelper.getTestPageInfo();

    // Navigate with UTM parameters in the URL
    const utmParams = new URLSearchParams({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring_sale_2026",
      utm_content: "hero_banner",
      utm_term: "best running shoes",
    });

    await page.goto(`${TrackingHelper.getTestPageUrl()}?${utmParams.toString()}`);
    await page.waitForTimeout(1500);

    // Fill out the lead form with a unique email
    const testEmail = `utm-test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for the lead to be created
    const lead = await TrackingHelper.waitForLead(websiteId, testEmail);

    // Verify UTM parameters were captured on the lead
    expect(lead.email).toBe(testEmail.toLowerCase());
    expect(lead.utm_source).toBe("google");
    expect(lead.utm_medium).toBe("cpc");
    expect(lead.utm_campaign).toBe("spring_sale_2026");
    expect(lead.utm_content).toBe("hero_banner");
    expect(lead.utm_term).toBe("best running shoes");
  });

  test("gclid is captured and stored with lead", async ({ page }) => {
    const { websiteId } = await TrackingHelper.getTestPageInfo();

    // Navigate with gclid in the URL (simulating a Google Ads click)
    const testGclid = `test-gclid-${Date.now()}`;
    await page.goto(`${TrackingHelper.getTestPageUrl()}?gclid=${testGclid}`);
    await page.waitForTimeout(1500);

    // Fill out the lead form with a unique email
    const testEmail = `gclid-test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for the lead to be created
    const lead = await TrackingHelper.waitForLead(websiteId, testEmail);

    // Verify gclid was captured on the lead
    expect(lead.email).toBe(testEmail.toLowerCase());
    expect(lead.gclid).toBe(testGclid);
  });

  test("UTM params and gclid are captured together", async ({ page }) => {
    const { websiteId } = await TrackingHelper.getTestPageInfo();

    // Navigate with both UTM params and gclid (realistic ad click scenario)
    const testGclid = `combo-gclid-${Date.now()}`;
    const params = new URLSearchParams({
      gclid: testGclid,
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "combo_test",
    });

    await page.goto(`${TrackingHelper.getTestPageUrl()}?${params.toString()}`);
    await page.waitForTimeout(1500);

    // Fill out the lead form with a unique email
    const testEmail = `combo-test-${Date.now()}@example.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // Wait for the lead to be created
    const lead = await TrackingHelper.waitForLead(websiteId, testEmail);

    // Verify both gclid and UTM params were captured
    expect(lead.email).toBe(testEmail.toLowerCase());
    expect(lead.gclid).toBe(testGclid);
    expect(lead.utm_source).toBe("google");
    expect(lead.utm_medium).toBe("cpc");
    expect(lead.utm_campaign).toBe("combo_test");
  });

  test("new tab creates new visit but preserves visitor identity", async ({ context }) => {
    // First tab - establish visitor and visit tokens
    const page1 = await context.newPage();
    await page1.goto(TrackingHelper.getTestPageUrl());
    await page1.waitForTimeout(1500);

    const visitor1 = await page1.evaluate(() => localStorage.getItem("l10_visitor"));
    const visit1 = await page1.evaluate(() => sessionStorage.getItem("l10_visit"));

    // Second tab - simulates user opening new tab (same browser session)
    // sessionStorage is per-tab, localStorage is shared across tabs
    const page2 = await context.newPage();
    await page2.goto(TrackingHelper.getTestPageUrl());
    await page2.waitForTimeout(1500);

    const visitor2 = await page2.evaluate(() => localStorage.getItem("l10_visitor"));
    const visit2 = await page2.evaluate(() => sessionStorage.getItem("l10_visit"));

    // Same visitor (localStorage shared), different visit (sessionStorage per-tab)
    expect(visitor2).toBe(visitor1);
    expect(visit2).not.toBe(visit1);

    await page1.close();
    await page2.close();
  });
});
