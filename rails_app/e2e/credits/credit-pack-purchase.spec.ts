import { test, expect, loginUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { SettingsPage } from "../pages/settings.page";

test.describe("Credit Pack Purchase", () => {
  let settingsPage: SettingsPage;

  test.describe("Buy Credits Modal", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
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
      settingsPage = new SettingsPage(page);
    });

    test("shows error when credit pack has no stripe_price_id", async ({ page }) => {
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

    test("redirects to checkout page when stripe_price_id is set", async ({ page }) => {
      // Set up a mock stripe price ID on the credit pack
      await DatabaseSnapshotter.setCreditPackStripePrice(1, "price_test_mock_123");

      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");

      // Mock the checkout API to return a fake client_secret
      await page.route("**/credit_packs/1/checkout", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              client_secret: "cs_test_mock_client_secret_12345",
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Click continue to payment
      await settingsPage.clickContinueToPayment();

      // Should redirect to checkout page with client_secret
      await page.waitForURL(/\/credit_packs\/1\/checkout\?client_secret=/);

      // Verify we're on the checkout page
      await expect(page.getByText("Purchase 500 Credits")).toBeVisible();
    });

    test("shows loading state while creating checkout session", async ({ page }) => {
      await DatabaseSnapshotter.setCreditPackStripePrice(1, "price_test_mock_123");

      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openBuyCreditsModal();
      await settingsPage.selectCreditPack("small");

      // Slow down the checkout API response
      await page.route("**/credit_packs/1/checkout", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            client_secret: "cs_test_mock_client_secret_12345",
          }),
        });
      });

      // Click continue and immediately check for loading state
      await settingsPage.clickContinueToPayment();

      // Button should show loading state
      await expect(page.getByRole("button", { name: /Loading/i })).toBeVisible();
    });
  });
});
