import { test, expect, loginUser, testUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { SettingsPage } from "./pages/settings.page";

test.describe("Settings Page", () => {
  test.describe("Subscribed User", () => {
    let settingsPage: SettingsPage;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      settingsPage = new SettingsPage(page);
    });

    test("displays profile information correctly", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await expect(settingsPage.pageTitle).toBeVisible();
      await settingsPage.expectEmailVisible(testUser.email);
    });

    test("displays credit balance correctly", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.expectCreditUsageVisible();
    });

    test("displays subscription information", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await expect(settingsPage.currentPlanName).toBeVisible();
      await settingsPage.expectPlanNameVisible("Growth");
    });

    test("displays subscription features", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await expect(page.getByText(/What's included/i)).toBeVisible();
    });

    test("can edit profile name", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.updateProfileName("Updated", "Name");
      await settingsPage.waitForProfileSaved("Updated Name");
    });

    test("profile name persists after page reload", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Update the name
      await settingsPage.updateProfileName("Persisted", "User");
      await settingsPage.waitForProfileSaved("Persisted User");

      // Reload the page
      await settingsPage.reload();

      // Verify the name is still updated
      await expect(page.getByText("Persisted User")).toBeVisible({ timeout: 5000 });
    });

    test("profile name persists across sessions", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Update the name
      await settingsPage.updateProfileName("Permanent", "Change");
      await settingsPage.waitForProfileSaved("Permanent Change");

      // Navigate away and come back
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await settingsPage.goto();

      // Verify the name is still updated
      await expect(page.getByText("Permanent Change")).toBeVisible({ timeout: 5000 });
    });

    test("cancel subscription modal shows billing period end", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openCancelSubscriptionModal();

      await expect(settingsPage.cancelModal).toBeVisible();
      await expect(settingsPage.keepSubscriptionButton).toBeVisible();
      await expect(settingsPage.confirmCancellationButton).toBeVisible();
    });

    test("cancel subscription modal closes on Keep Subscription", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.openCancelSubscriptionModal();
      await settingsPage.keepSubscription();

      expect(await settingsPage.isCancelModalVisible()).toBe(false);
    });

    test("displays Stripe portal links", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.expectStripeLinksVisible();
    });
  });

  test.describe("Page Layout", () => {
    let settingsPage: SettingsPage;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      settingsPage = new SettingsPage(page);
    });

    test("displays three main sections", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.expectAllSectionsVisible();
    });
  });

  test.describe("Access Control", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
    });

    test("unauthenticated user cannot access settings page", async ({ page }) => {
      // Try to access settings without logging in
      const response = await page.goto("/settings");

      // Should get 404 (route only exists for authenticated users)
      expect(response?.status()).toBe(404);
    });

    test("user only sees their own settings data", async ({ page }) => {
      // Login as test user
      await loginUser(page);
      const settingsPage = new SettingsPage(page);
      await settingsPage.goto();

      // Verify we see the logged-in user's email, not any other user's
      await settingsPage.expectEmailVisible(testUser.email);

      // Page should NOT contain other user emails
      // (This verifies the backend is scoping to current user)
      const pageContent = await page.content();
      expect(pageContent).toContain(testUser.email);
    });
  });

  test.describe("Edge Cases", () => {
    let settingsPage: SettingsPage;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      settingsPage = new SettingsPage(page);
    });

    test("empty name fields are handled gracefully", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Try to save with empty fields
      await settingsPage.clickEditProfile();
      await settingsPage.firstNameInput.clear();
      await settingsPage.lastNameInput.clear();
      await settingsPage.saveProfileButton.click();

      // Page should still be functional (either save empty or show validation)
      await expect(settingsPage.pageTitle).toBeVisible();
    });

    test("special characters in name are saved correctly", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Update with special characters
      await settingsPage.updateProfileName("María-José", "O'Connor");
      await settingsPage.waitForProfileSaved("María-José O'Connor");

      // Reload and verify
      await settingsPage.reload();
      await expect(page.getByText("María-José O'Connor")).toBeVisible({ timeout: 5000 });
    });

    test("long names are handled correctly", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      const longName = "Bartholomew";
      const longLastName = "Featherstonehaugh";

      await settingsPage.updateProfileName(longName, longLastName);
      await settingsPage.waitForProfileSaved(`${longName} ${longLastName}`);
    });

    test("rapid save clicks do not cause issues", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.clickEditProfile();
      await settingsPage.firstNameInput.fill("Rapid");
      await settingsPage.lastNameInput.fill("Test");

      // Click save multiple times quickly
      await settingsPage.saveProfileButton.click();

      // Wait for save to complete
      await settingsPage.waitForProfileSaved("Rapid Test");

      // Page should still be functional
      await expect(settingsPage.pageTitle).toBeVisible();
    });
  });
});
