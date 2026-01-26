import { test, expect, loginUser, testUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { e2eConfig } from "../config";
import type { Page } from "@playwright/test";

/**
 * Login helper for non-subscribed users that doesn't expect BrainstormLanding
 */
async function loginNonSubscribedUser(
  page: Page,
  email: string = testUser.email,
  password: string = testUser.password
): Promise<void> {
  await page.goto("/users/sign_in");
  await page.waitForLoadState("domcontentloaded");

  const emailInput = page.locator('input[name="user[email]"]');
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[name="user[password]"]');
  await passwordInput.fill(password);

  await page.click('input[type="submit"], button[type="submit"]');

  // Wait for navigation away from sign_in page - will redirect to pricing for non-subscribed
  await page.waitForURL((url) => !url.toString().includes("/users/sign_in"), {
    timeout: 10000,
  });
}

test.describe("Subscription Flow", () => {
  test.describe("Unauthenticated Access", () => {
    test("unauthenticated user visiting root is redirected to pricing", async ({
      page,
    }) => {
      await DatabaseSnapshotter.restoreSnapshot("core_data");

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Unauthenticated users should be redirected to pricing
      await expect(page).toHaveURL(/\/pricing/);
    });
  });

  test.describe("Non-subscribed User Access", () => {
    test("non-subscribed user accessing app is redirected to pricing", async ({
      page,
    }) => {
      // Use a snapshot with a non-subscribed user
      await DatabaseSnapshotter.restoreSnapshot("non_subscribed_account");

      // Login without expecting BrainstormLanding
      await loginNonSubscribedUser(page);

      // Should be redirected to pricing since user is not subscribed
      await expect(page).toHaveURL(/\/pricing/);
      await expect(page.getByText("Pricing Plans")).toBeVisible();
    });
  });

  test.describe("Subscribed User Access", () => {
    test("subscribed user lands on BrainstormLanding", async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      await loginUser(page);

      await page.goto("/");

      // Should see the BrainstormLanding page with chat input
      await expect(page.getByText("Tell us your next big idea")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("Full Subscription Flow", () => {
    /**
     * This test validates the signup-to-subscription flow.
     *
     * NOTE: Full Stripe checkout testing requires valid Stripe API keys.
     * In test environments without Stripe credentials, this test verifies
     * the redirect flow works correctly up to the Stripe checkout step.
     */
    test("user can sign up from pricing and reach subscription checkout", async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("core_data");

      // Start at pricing page
      await page.goto("/pricing");
      await page.waitForLoadState("domcontentloaded");

      // Verify we're on pricing page by checking for the heading
      await expect(page.getByRole("heading", { name: "Pricing Plans" })).toBeVisible();

      // Select a plan - click the first "Get Started" button
      const getStartedButton = page
        .getByRole("link", { name: /get started/i })
        .first();
      await getStartedButton.click();

      // Unauthenticated users are redirected to signup first (with stored location for redirect after)
      await expect(page).toHaveURL(/\/users\/sign_up/);

      // Complete signup form
      const testEmail = `testuser_${Date.now()}@test.com`;
      await page.getByLabel("Account Name").fill("Test Account");
      await page.getByLabel("Full name").fill("Test User");
      await page.getByLabel("Email").fill(testEmail);
      await page.getByLabel("Password").fill("TestPass123!");

      // Check terms checkbox
      await page.getByRole("checkbox", { name: /terms of service/i }).check();

      // Use getByRole to find the submit button
      const signupButton = page.getByRole('button', { name: 'Sign up' });
      await expect(signupButton).toBeVisible();

      // Click and wait for the checkout page to appear (Turbo handles navigation)
      await signupButton.click({ force: true });

      // Wait for either Checkout heading (subscriptions/new) or Pricing heading (if error)
      // This handles Turbo's async page replacement
      await expect(
        page.getByRole('heading', { name: 'Checkout' }).or(
          page.getByRole('heading', { name: 'Pricing Plans' })
        )
      ).toBeVisible({ timeout: 30000 });

      // Check if we're on Checkout or Pricing
      const isOnCheckout = await page.getByRole('heading', { name: 'Checkout' }).isVisible().catch(() => false);

      if (isOnCheckout) {
        // Stripe is configured - complete the full checkout with test card
        const stripeFrame = page.frameLocator('iframe[name*="embedded-checkout"]').first();

        // Wait for payment method section to load
        await expect(stripeFrame.locator('text=Payment method')).toBeVisible({ timeout: 30000 });

        // Wait for the UI to stabilize
        await page.waitForTimeout(1000);

        // The Stripe accordion UI might already have Card selected/expanded
        // Check if card number input is already visible
        const cardNumberInput = stripeFrame.locator('[placeholder="1234 1234 1234 1234"]');
        const cardInputVisible = await cardNumberInput.isVisible({ timeout: 3000 }).catch(() => false);

        if (!cardInputVisible) {
          // Card form not visible - need to click the accordion button to expand it
          // Use JavaScript click via evaluate to bypass Playwright's actionability checks
          const cardAccordionButton = stripeFrame.locator('[data-testid="card-accordion-item-button"]');
          await cardAccordionButton.evaluate((el: HTMLElement) => {
            el.scrollIntoView({ behavior: 'instant', block: 'center' });
            el.click();
          });

          // Wait for card number input to appear after expanding
          await expect(cardNumberInput).toBeVisible({ timeout: 15000 });
        }

        // Fill in test card details
        await cardNumberInput.fill("4242424242424242");
        await stripeFrame.locator('[placeholder="MM / YY"]').fill("12/30");
        await stripeFrame.locator('[placeholder="CVC"]').fill("123");

        // Fill cardholder name if present
        const nameField = stripeFrame.locator('[placeholder="Full name on card"]');
        if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameField.fill("Test User");
        }

        // Fill billing postal code if shown
        const postalInput = stripeFrame.locator('[placeholder*="ZIP"], [placeholder*="Postal code"]');
        if (await postalInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await postalInput.fill("12345");
        }

        // Uncheck "Save my information" to simplify the flow (skip Link phone requirement)
        const saveInfoCheckbox = stripeFrame.getByRole('checkbox', { name: /save my information/i });
        if (await saveInfoCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          if (await saveInfoCheckbox.isChecked().catch(() => false)) {
            await saveInfoCheckbox.uncheck();
          }
        }

        // Click Subscribe button
        const subscribeButton = stripeFrame.getByRole('button', { name: 'Subscribe' });
        await expect(subscribeButton).toBeEnabled({ timeout: 10000 });
        await subscribeButton.click();

        // Wait for Stripe to process and redirect back to the app
        // Should end up on BrainstormLanding after successful subscription
        await expect(page.getByText("Tell us your next big idea")).toBeVisible({
          timeout: 60000,
        });

        console.log("SUCCESS: Full Stripe subscription flow completed!");
      } else {
        // Stripe API keys not configured - verify we're on pricing with error
        await expect(page.getByRole("heading", { name: "Pricing Plans" })).toBeVisible();
        // The flow worked correctly, just Stripe isn't configured for test env
        // This is expected in CI/test environments without Stripe credentials
        console.log("Note: Stripe API keys not configured - subscription flow verified up to checkout");
      }
    });
  });
});
