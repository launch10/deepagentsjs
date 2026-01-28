import { test, expect, loginUser, testUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { SettingsPage } from "../pages/settings.page";

/**
 * Helper to dismiss the low credit warning modal if it appears
 */
async function dismissLowCreditModalIfPresent(page: import("@playwright/test").Page) {
  const modal = page.getByTestId("credit-modal");
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByTestId("credit-modal-close").click();
    await expect(modal).not.toBeVisible();
  }
}

test.describe("Credit Pack Purchase", () => {
  let settingsPage: SettingsPage;

  test.describe("Buy Credits Modal", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      // Set credits high enough to avoid the low credit warning modal
      await DatabaseSnapshotter.setCredits(testUser.email, 4000000, 0); // 4000 credits
      settingsPage = new SettingsPage(page);
    });

    test("displays Purchase Credits button on settings page", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await expect(settingsPage.purchaseCreditsButton).toBeVisible();
    });

    test("opens Buy Credits modal when clicking Purchase Credits", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();

      await expect(settingsPage.buyCreditsModalTitle).toBeVisible();
      await expect(
        page.getByText("Select a credit pack to continue using AI features")
      ).toBeVisible();
    });

    test("displays all credit pack options", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();

      // Should show all three packs
      await expect(page.getByText("Small")).toBeVisible();
      await expect(page.getByText("Medium")).toBeVisible();
      await expect(page.getByText("Large")).toBeVisible();

      // Should show credit amounts
      await expect(page.getByText("500 credits")).toBeVisible();
      await expect(page.getByText("1,250 credits")).toBeVisible();
      await expect(page.getByText("3,000 credits")).toBeVisible();

      // Should show prices
      await expect(page.getByText("$25")).toBeVisible();
      await expect(page.getByText("$50")).toBeVisible();
      await expect(page.getByText("$100")).toBeVisible();
    });

    test("displays pack tags (Most Popular, Best Value)", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();

      await expect(page.getByText("Most Popular")).toBeVisible();
      await expect(page.getByText("Best Value")).toBeVisible();
    });

    test("can select different credit packs", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();

      // Medium should be selected by default
      const mediumPack = page.locator("button").filter({ hasText: /^Medium/ });
      await expect(mediumPack).toHaveClass(/border-\[#0F1113\]/);

      // Select Small pack
      await settingsPage.selectCreditPack("small");
      const smallPack = page.locator("button").filter({ hasText: /^Small/ });
      await expect(smallPack).toHaveClass(/border-\[#0F1113\]/);

      // Select Large pack
      await settingsPage.selectCreditPack("big");
      const largePack = page.locator("button").filter({ hasText: /^Large/ });
      await expect(largePack).toHaveClass(/border-\[#0F1113\]/);
    });

    test("Continue to Payment button is enabled when pack is selected", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();

      await expect(settingsPage.continueToPaymentButton).toBeEnabled();
    });

    test("can close modal by clicking X button", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await expect(settingsPage.buyCreditsModal).toBeVisible();

      // Click the X close button
      const closeButton = page
        .locator('[role="dialog"]')
        .locator("button")
        .filter({ has: page.locator(".sr-only") })
        .first();
      await closeButton.click();

      await expect(settingsPage.buyCreditsModal).not.toBeVisible();
    });
  });

  test.describe("Checkout Flow (Mocked)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      // Set credits high enough to avoid the low credit warning modal
      await DatabaseSnapshotter.setCredits(testUser.email, 4000000, 0); // 4000 credits
      settingsPage = new SettingsPage(page);
    });

    test("shows error when credit pack has no stripe_price_id", async ({ page }) => {
      // Clear the stripe_price_id to test the error case
      await DatabaseSnapshotter.setCreditPackStripePrice(1, "");

      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");

      // Listen for alert dialog
      page.on("dialog", async (dialog) => {
        expect(dialog.message()).toContain("Credit pack does not have a Stripe price configured");
        await dialog.accept();
      });

      await settingsPage.clickContinueToPayment();

      // Modal should still be open since checkout failed
      await expect(settingsPage.buyCreditsModal).toBeVisible();
    });

    test("shows loading state while creating checkout session", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");

      // Slow down the checkout API response
      await page.route("**/credit_packs/1/checkout", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      // Click continue and immediately check for loading state
      await settingsPage.clickContinueToPayment();

      // Button should show loading state
      await expect(page.getByRole("button", { name: /Loading/i })).toBeVisible();
    });
  });

  test.describe("Real Stripe Checkout", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      // Set credits high enough to avoid the low credit warning modal
      await DatabaseSnapshotter.setCredits(testUser.email, 4000000, 0); // 4000 credits
      settingsPage = new SettingsPage(page);
    });

    test("navigates to Stripe embedded checkout page", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");
      await settingsPage.clickContinueToPayment();

      // Should redirect to checkout page with real client_secret
      await page.waitForURL(/\/credit_packs\/1\/checkout\?client_secret=/, { timeout: 15000 });

      // Verify we're on the checkout page with the title
      await expect(page.getByText("Purchase 500 Credits")).toBeVisible();
      await expect(page.getByText("$25.00")).toBeVisible();
    });

    test("displays Stripe embedded checkout form", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");
      await settingsPage.clickContinueToPayment();

      // Wait for checkout page
      await page.waitForURL(/\/credit_packs\/1\/checkout\?client_secret=/, { timeout: 15000 });

      // Wait for Stripe iframe to load (it takes a moment)
      const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

      // The Stripe checkout should eventually show payment form elements
      // Note: Stripe's embedded checkout loads asynchronously
      await expect(page.locator('[data-controller="stripe--embedded-checkout"]')).toBeVisible({
        timeout: 10000,
      });
    });

    test("Stripe checkout loads with iframe", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");
      await settingsPage.clickContinueToPayment();

      // Wait for checkout page
      await page.waitForURL(/\/credit_packs\/1\/checkout\?client_secret=/, { timeout: 15000 });

      // Wait for Stripe embedded checkout to load
      await expect(page.locator('[data-controller="stripe--embedded-checkout"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify our page shows the correct credit pack info
      await expect(page.getByText("Purchase 500 Credits")).toBeVisible();
      await expect(page.getByText("$25.00")).toBeVisible();

      // Verify Stripe iframe loads (embedded checkout creates an iframe)
      await expect(
        page.locator('[data-controller="stripe--embedded-checkout"] iframe')
      ).toBeVisible({ timeout: 15000 });
    });
  });
});
