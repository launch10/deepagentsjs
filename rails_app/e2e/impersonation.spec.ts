import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { BrainstormPage } from "./pages/brainstorm.page";

const adminUser = {
  email: "brett@launch10.ai",
  password: "Launch10TestPass!",
};

const testUser = {
  email: "test_user@launch10.ai",
  password: "Launch10TestPass!",
};

test.describe("Admin Impersonation", () => {
  test.setTimeout(120000); // Brainstorm flow takes time

  test("impersonation banner appears and allows stopping impersonation", async ({ page }) => {
    // 1. Restore snapshot with admin + test user
    await DatabaseSnapshotter.restoreSnapshot("basic_account");

    // 2. Login as admin
    await loginUser(page, adminUser.email, adminUser.password);

    // 3. Navigate to admin panel and find the test user
    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");

    // Find the test user row and click View
    const userRow = page.locator("tr", { hasText: testUser.email });
    await userRow.getByRole("link", { name: "View" }).click();

    // Wait for user show page
    await page.waitForURL("**/admin/users/**");

    // 4. Click Impersonate button
    await page.getByRole("button", { name: "Impersonate" }).click();

    // Should redirect to root
    await page.waitForURL("**/");

    // 5. Verify impersonation banner is visible
    await expect(page.getByText("Impersonating", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop Impersonating" })).toBeVisible();

    // 6. Stop impersonating (click button in banner)
    await page.getByRole("button", { name: "Stop Impersonating" }).click();

    // Should redirect to admin panel
    await page.waitForURL("**/admin/users/**");

    // Banner should no longer be visible
    await expect(page.getByRole("button", { name: "Stop Impersonating" })).not.toBeVisible();
  });

  test("impersonated brainstorm is visible to real user", async ({ page }) => {
    // 1. Restore snapshot with admin + test user
    await DatabaseSnapshotter.restoreSnapshot("basic_account");

    // 2. Login as admin
    await loginUser(page, adminUser.email, adminUser.password);

    // 3. Navigate to admin panel and impersonate test user
    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");

    // Find the test user row and click View
    const userRow = page.locator("tr", { hasText: testUser.email });
    await userRow.getByRole("link", { name: "View" }).click();

    // Wait for user show page and click Impersonate
    await page.waitForURL("**/admin/users/**");
    await page.getByRole("button", { name: "Impersonate" }).click();

    // Should redirect to root
    await page.waitForURL("**/");

    // 4. Verify impersonation banner is visible
    await expect(page.getByText("Impersonating", { exact: false }).first()).toBeVisible();

    // Reload to ensure fresh JWT is in Inertia props
    await page.reload();
    await expect(page.getByText("Impersonating", { exact: false }).first()).toBeVisible();

    // 5. Start a brainstorm (creates project scoped to impersonated user)
    const brainstormPage = new BrainstormPage(page);
    await brainstormPage.sendMessage("I want to start a pet grooming business for cats");

    // Wait for URL to update with project ID
    await page.waitForFunction(
      () => window.location.href.includes("/projects/"),
      { timeout: 10000 }
    );

    // Wait for AI response (ensures project is persisted)
    await brainstormPage.waitForResponse();

    // Get the project URL for later
    const projectUrl = page.url();
    const projectUuid = brainstormPage.getThreadIdFromUrl();
    expect(projectUuid).not.toBeNull();

    // 6. Stop impersonating (click button in banner)
    await page.getByRole("button", { name: "Stop Impersonating" }).click();

    // Should redirect to admin panel
    await page.waitForURL("**/admin/users/**");

    // 7. Logout admin
    await page.goto("/users/sign_out", { waitUntil: "domcontentloaded" });

    // 8. Login as the real test user
    await loginUser(page, testUser.email, testUser.password);

    // 9. Navigate directly to the project URL
    await page.goto(projectUrl);
    await brainstormPage.chatInput.waitFor({ state: "visible", timeout: 10000 });

    // 10. Verify the project and brainstorm messages are visible
    const messageCount = await brainstormPage.getUserMessageCount();
    expect(messageCount).toBeGreaterThan(0);

    // Verify the original message is there (use data-testid to target user message specifically)
    await expect(
      page.locator('[data-testid="user-message"]').filter({ hasText: "pet grooming business for cats" })
    ).toBeVisible();
  });
});
