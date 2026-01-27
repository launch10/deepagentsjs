import { test, expect, loginUser, testUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";

test.describe("Settings Page", () => {
  test.describe("Subscribed User", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
    });

    test("displays profile information correctly", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Profile section
      await expect(page.getByText("Account Settings")).toBeVisible();
      await expect(page.getByText(testUser.email)).toBeVisible();
    });

    test("displays credit balance correctly", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Credit section shows plan credits
      await expect(page.getByText(/Credit Usage/i)).toBeVisible();
      // Should show credits in "X / Y" format
      await expect(page.getByText(/\d+[\d,]* \/ [\d,]+/)).toBeVisible();
    });

    test("displays subscription information", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Subscription section
      await expect(page.getByText(/Current Plan/i)).toBeVisible();
      // Should show the plan name (Growth)
      await expect(page.getByText(/Growth/i)).toBeVisible();
    });

    test("displays subscription features", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // What's included section with features
      await expect(page.getByText(/What's included/i)).toBeVisible();
    });

    test("can edit profile name", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Click edit button
      await page.getByRole("button", { name: /Edit/i }).click();

      // Fill in new name
      const firstNameInput = page
        .locator('input[name="user[first_name]"]')
        .or(page.getByPlaceholder(/first/i));
      await firstNameInput.fill("Updated");

      const lastNameInput = page
        .locator('input[name="user[last_name]"]')
        .or(page.getByPlaceholder(/last/i));
      await lastNameInput.fill("Name");

      // Save
      await page.getByRole("button", { name: /Save/i }).click();

      // Should show updated name
      await expect(page.getByText("Updated Name")).toBeVisible({ timeout: 5000 });
    });

    test("cancel subscription modal shows billing period end", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Click cancel subscription
      await page.getByText(/Cancel Subscription/i).click();

      // Modal should show billing period end date
      await expect(page.getByText(/remain live until/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Keep Subscription/i })).toBeVisible();
      await expect(page.getByText(/Confirm Cancellation/i)).toBeVisible();
    });

    test("cancel subscription modal closes on Keep Subscription", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Open modal
      await page.getByText(/Cancel Subscription/i).click();
      await expect(page.getByText(/remain live until/i)).toBeVisible();

      // Click keep subscription
      await page.getByRole("button", { name: /Keep Subscription/i }).click();

      // Modal should close
      await expect(page.getByText(/remain live until/i)).not.toBeVisible();
    });

    test("displays Stripe portal links", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Should have payment method and billing history links
      await expect(page.getByText(/Update Payment Method/i)).toBeVisible();
      await expect(page.getByText(/View Billing History/i)).toBeVisible();
      await expect(page.getByText(/Change Plan/i)).toBeVisible();
    });
  });

  test.describe("Page Layout", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
    });

    test("displays three main sections", async ({ page }) => {
      await loginUser(page);
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      // Three sections: Profile, Billing & Credits, Subscription
      await expect(page.getByText(/Profile/i).first()).toBeVisible();
      await expect(page.getByText(/Billing & Credits/i)).toBeVisible();
      await expect(page.getByText(/Subscription/i).first()).toBeVisible();
    });
  });
});
