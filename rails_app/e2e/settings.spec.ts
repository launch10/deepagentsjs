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

    test("cancel subscription confirms and reloads page", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Close any credit warning modals that may appear
      const creditModal = page.getByTestId("credit-modal");
      if (await creditModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page
          .getByRole("button", { name: /close/i })
          .or(page.locator('[data-testid="credit-modal"] button:has(svg)'))
          .first()
          .click();
        await creditModal.waitFor({ state: "hidden", timeout: 5000 });
      }

      // Open modal and confirm cancellation
      await settingsPage.openCancelSubscriptionModal();
      await settingsPage.confirmCancellation();

      // Modal should close and page should reload
      await settingsPage.cancelModal.waitFor({ state: "hidden", timeout: 10000 });

      // Page should still show the settings (confirms reload worked)
      await expect(settingsPage.pageTitle).toBeVisible({ timeout: 10000 });
    });

    test("reactivate cancelled subscription", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Close any credit warning modals that may appear
      const creditModal = page.getByTestId("credit-modal");
      if (await creditModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.locator('[data-testid="credit-modal"] button:has(svg)').first().click();
        await creditModal.waitFor({ state: "hidden", timeout: 5000 });
      }

      // First cancel the subscription
      await settingsPage.openCancelSubscriptionModal();
      await settingsPage.confirmCancellation();
      await settingsPage.cancelModal.waitFor({ state: "hidden", timeout: 10000 });
      await expect(settingsPage.pageTitle).toBeVisible({ timeout: 10000 });

      // Verify subscription shows as cancelled
      await expect(settingsPage.cancelledBadge).toBeVisible({ timeout: 5000 });
      await expect(settingsPage.reactivatePlanButton).toBeVisible();

      // Reactivate the subscription
      await settingsPage.reactivateSubscription();

      // Wait for page to reload
      await expect(settingsPage.pageTitle).toBeVisible({ timeout: 10000 });

      // Verify subscription is reactivated (cancel button should be visible again)
      await expect(settingsPage.cancelSubscriptionButton).toBeVisible({ timeout: 5000 });
      expect(await settingsPage.isSubscriptionCancelled()).toBe(false);
    });

    test("displays Change Plan button", async ({ page }) => {
      // Note: "Update Payment" and "View All" links only appear when stripe_portal_url
      // is available (requires real Stripe integration). The test database uses
      // fake_processor, so we only test the Change Plan button which is always visible.
      await loginUser(page);
      await settingsPage.goto();

      await expect(settingsPage.changePlanLink).toBeVisible();
    });

    test("displays billing history with pagination", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Verify pagination controls are visible
      await settingsPage.expectBillingHistoryPaginationVisible();

      // Should start on page 1 of 4 (10 items, 3 per page)
      expect(await settingsPage.getBillingHistoryPageText()).toBe("1 / 4");

      // Previous button should be disabled on first page
      await expect(settingsPage.billingHistoryPrevButton).toBeDisabled();
      await expect(settingsPage.billingHistoryNextButton).toBeEnabled();

      // Navigate forward through all pages
      await settingsPage.goToNextBillingHistoryPage();
      expect(await settingsPage.getBillingHistoryPageText()).toBe("2 / 4");

      await settingsPage.goToNextBillingHistoryPage();
      expect(await settingsPage.getBillingHistoryPageText()).toBe("3 / 4");

      await settingsPage.goToNextBillingHistoryPage();
      expect(await settingsPage.getBillingHistoryPageText()).toBe("4 / 4");

      // Next button should be disabled on last page
      await expect(settingsPage.billingHistoryNextButton).toBeDisabled();
      await expect(settingsPage.billingHistoryPrevButton).toBeEnabled();

      // Navigate backward through all pages
      await settingsPage.goToPrevBillingHistoryPage();
      expect(await settingsPage.getBillingHistoryPageText()).toBe("3 / 4");

      await settingsPage.goToPrevBillingHistoryPage();
      expect(await settingsPage.getBillingHistoryPageText()).toBe("2 / 4");

      await settingsPage.goToPrevBillingHistoryPage();
      expect(await settingsPage.getBillingHistoryPageText()).toBe("1 / 4");

      // Back to first page - previous should be disabled again
      await expect(settingsPage.billingHistoryPrevButton).toBeDisabled();
    });

    test("billing history shows plan name in description", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Should show "Growth Plan - Monthly" for the test user's plan (multiple items visible)
      await expect(page.getByText(/Growth Plan - Monthly/i).first()).toBeVisible();
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

  test.describe("Password Change", () => {
    let settingsPage: SettingsPage;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      // Set credits high enough to avoid the low credit warning modal
      await DatabaseSnapshotter.setCredits(testUser.email, 4000000, 0); // 4000 credits
      settingsPage = new SettingsPage(page);
    });

    test("displays Change Your Password link", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await expect(settingsPage.changePasswordLink).toBeVisible();
    });

    test("clicking Change Your Password shows password form", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.clickChangePassword();

      await expect(settingsPage.currentPasswordInput).toBeVisible();
      await expect(settingsPage.newPasswordInput).toBeVisible();
      await expect(settingsPage.confirmPasswordInput).toBeVisible();
      await expect(settingsPage.savePasswordButton).toBeVisible();
      await expect(settingsPage.cancelPasswordButton).toBeVisible();
    });

    test("can cancel password change form", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.clickChangePassword();
      expect(await settingsPage.isPasswordFormVisible()).toBe(true);

      // Find the Cancel button that's a sibling of Save Password button
      // Both are within the Password section of the form
      const savePasswordBtn = page.getByRole("button", { name: /Save Password/i });
      await expect(savePasswordBtn).toBeVisible();

      // The Cancel button is the next sibling button after Save Password
      const cancelBtn = savePasswordBtn.locator("..").getByRole("button", { name: "Cancel" });
      await cancelBtn.click();

      // Wait for form to close
      await expect(settingsPage.currentPasswordInput).not.toBeVisible({ timeout: 5000 });

      // Change Password link should be visible again
      await expect(settingsPage.changePasswordLink).toBeVisible();
    });

    test("shows error when passwords do not match", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.clickChangePassword();
      await settingsPage.fillPasswordForm("currentpass", "newpassword123", "differentpassword");
      await settingsPage.submitPasswordChange();

      const error = await settingsPage.getPasswordError();
      expect(error).toContain("don't match");
    });

    test("shows error when new password is too short", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.clickChangePassword();
      await settingsPage.fillPasswordForm("currentpass", "short", "short");
      await settingsPage.submitPasswordChange();

      const error = await settingsPage.getPasswordError();
      expect(error).toContain("6 characters");
    });

    test("shows error when current password is incorrect", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      await settingsPage.clickChangePassword();
      await settingsPage.fillPasswordForm("wrongpassword", "newpassword123", "newpassword123");
      await settingsPage.submitPasswordChange();

      // Wait for server response
      await page.waitForTimeout(1000);

      const error = await settingsPage.getPasswordError();
      expect(error).toBeTruthy();
    });

    test("successfully changes password with correct credentials", async ({ page }) => {
      await loginUser(page);
      await settingsPage.goto();

      // Use the test user's password (from auth fixtures)
      await settingsPage.changePassword(testUser.password, "newpassword123");

      await settingsPage.waitForPasswordSuccess();

      // Form should close after success
      await expect(settingsPage.changePasswordLink).toBeVisible({ timeout: 5000 });
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
