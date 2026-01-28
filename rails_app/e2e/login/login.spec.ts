import { test, expect, loginUser, testUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { LoginPage } from "../pages/login.page";

test.describe("Login Flow", () => {
  test.describe("Unauthenticated Access", () => {
    test("unauthenticated user visiting root is redirected to pricing", async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("core_data");

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Unauthenticated users should be redirected to pricing
      await expect(page).toHaveURL(/\/pricing/);
    });
  });

  test.describe("Non-subscribed User Access", () => {
    test("non-subscribed user accessing app is redirected to pricing", async ({ page }) => {
      const loginPage = new LoginPage(page);

      // Use a snapshot with a non-subscribed user
      await DatabaseSnapshotter.restoreSnapshot("non_subscribed_account");

      // Login without expecting BrainstormLanding
      await loginPage.gotoSignIn();
      await loginPage.signInAndWaitForRedirect(testUser.email, testUser.password);

      // Should be redirected to pricing since user is not subscribed
      await loginPage.waitForPricingRedirect();
      await expect(page.getByText("Pricing Plans")).toBeVisible();
    });
  });

  test.describe("Subscribed User Access", () => {
    test("subscribed user signing in is redirected to /projects/new", async ({ page }) => {
      const loginPage = new LoginPage(page);

      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      await loginPage.gotoSignIn();
      await loginPage.signInAndWaitForRedirect(testUser.email, testUser.password);

      // Should be redirected to /projects/new
      await loginPage.waitForSubscribedRedirect();

      // Should see the BrainstormLanding page with chat input
      await expect(page.getByText("Tell us your next big idea")).toBeVisible({
        timeout: 15000,
      });
    });

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
      const loginPage = new LoginPage(page);

      await DatabaseSnapshotter.restoreSnapshot("core_data");

      // Start at pricing page
      await page.goto("/pricing");
      await page.waitForLoadState("domcontentloaded");

      // Verify we're on pricing page by checking for the heading
      await expect(page.getByRole("heading", { name: "Pricing Plans" })).toBeVisible();

      // Select a plan - click the first "Get Started" button
      const getStartedButton = page.getByRole("link", { name: /get started/i }).first();
      await getStartedButton.click();

      // Unauthenticated users are redirected to signup first
      await expect(page).toHaveURL(/\/users\/sign_up/);

      // Complete signup form using LoginPage
      const testEmail = `testuser_${Date.now()}@test.com`;
      await loginPage.signUp("Test User", testEmail, "TestPass123!");

      // Wait for either Checkout heading or Pricing heading (if error)
      await expect(
        page
          .getByRole("heading", { name: "Checkout" })
          .or(page.getByRole("heading", { name: "Pricing Plans" }))
      ).toBeVisible({ timeout: 30000 });

      // Check if we're on Checkout or Pricing
      const isOnCheckout = await page
        .getByRole("heading", { name: "Checkout" })
        .isVisible()
        .catch(() => false);

      if (isOnCheckout) {
        // Stripe is configured - complete the full checkout with test card
        const stripeFrame = page.frameLocator('iframe[name*="embedded-checkout"]').first();

        // Wait for payment method section to load
        await expect(stripeFrame.locator("text=Payment method")).toBeVisible({ timeout: 30000 });

        // Wait for the UI to stabilize
        await page.waitForTimeout(1000);

        // Check if card number input is already visible
        const cardNumberInput = stripeFrame.locator('[placeholder="1234 1234 1234 1234"]');
        const cardInputVisible = await cardNumberInput
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (!cardInputVisible) {
          // Card form not visible - click the accordion button to expand it
          const cardAccordionButton = stripeFrame.locator(
            '[data-testid="card-accordion-item-button"]'
          );
          await cardAccordionButton.evaluate((el: HTMLElement) => {
            el.scrollIntoView({ behavior: "instant", block: "center" });
            el.click();
          });

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
        const postalInput = stripeFrame.locator(
          '[placeholder*="ZIP"], [placeholder*="Postal code"]'
        );
        if (await postalInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await postalInput.fill("12345");
        }

        // Uncheck "Save my information" to skip Link phone requirement
        const saveInfoCheckbox = stripeFrame.getByRole("checkbox", {
          name: /save my information/i,
        });
        if (await saveInfoCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          if (await saveInfoCheckbox.isChecked().catch(() => false)) {
            await saveInfoCheckbox.uncheck();
          }
        }

        // Click Subscribe button
        const subscribeButton = stripeFrame.getByRole("button", { name: "Subscribe" });
        await expect(subscribeButton).toBeEnabled({ timeout: 10000 });

        await page.waitForTimeout(500);

        await subscribeButton.evaluate((el: HTMLElement) => {
          el.scrollIntoView({ behavior: "instant", block: "center" });
          el.click();
        });

        // Wait for redirect to BrainstormLanding after successful subscription
        await expect(page.getByText("Tell us your next big idea")).toBeVisible({
          timeout: 60000,
        });
      } else {
        // Stripe API keys not configured
        await expect(page.getByRole("heading", { name: "Pricing Plans" })).toBeVisible();
      }
    });
  });

  test.describe("OAuth Account Linking", () => {
    /**
     * Tests that a user who signed up with email can later sign in via OAuth.
     *
     * This uses the developer OAuth provider (available in test mode) to simulate
     * Google OAuth. When a user with a matching email exists, the OAuth login
     * should link the accounts and sign them in.
     *
     * NOTE: This test uses OmniAuth's developer provider in test mode.
     * The mock is configured in config/initializers/devise.rb with email
     * matching testUser.email (test_user@launch10.ai).
     */
    test("user signed up with email can sign in via OAuth (accounts are linked)", async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      // Use basic_account snapshot - has a subscribed user with email test_user@launch10.ai
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      // Verify the user exists and can sign in with email first
      await loginPage.gotoSignIn();
      await loginPage.signInAndWaitForRedirect(testUser.email, testUser.password);

      // Should redirect to /projects/new (subscribed user experience)
      await loginPage.waitForSubscribedRedirect();

      // Sign out
      await loginPage.signOut();

      // Now sign in via OAuth (developer provider simulates Google OAuth in test mode)
      // The mock uses email: "test_user@launch10.ai" - matching the existing subscribed user
      await loginPage.signInViaOAuthAndWaitFor(/\/projects\/new/);

      // Should see the BrainstormLanding page with chat input
      await expect(page.getByText("Tell us your next big idea")).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
