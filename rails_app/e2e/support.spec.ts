import { test, expect, loginUser, testUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";

test.describe("Support Page", () => {
  test.beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  });

  test("displays Help Center with two tabs", async ({ page }) => {
    await loginUser(page);
    await page.goto("/support");

    await expect(page.getByRole("heading", { name: "Help Center" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Chat with AI/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Contact Support/i })).toBeVisible();
  });

  test("AI chat tab shows greeting message", async ({ page }) => {
    await loginUser(page);
    await page.goto("/support");

    // AI tab should be active by default
    await expect(page.getByText(/I can help answer questions about Launch10/i)).toBeVisible();
  });

  test("can switch to Contact Support tab", async ({ page }) => {
    await loginUser(page);
    await page.goto("/support");

    await page.getByRole("button", { name: /Contact Support/i }).click();

    // Contact form should be visible - use label locators
    await expect(page.locator("label", { hasText: "Category" })).toBeVisible();
    await expect(page.locator("label", { hasText: "Subject" })).toBeVisible();
    await expect(page.locator("label", { hasText: "Description" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit Request/i })).toBeVisible();
  });

  test("contact form shows validation errors for empty fields", async ({ page }) => {
    await loginUser(page);
    await page.goto("/support");

    await page.getByRole("button", { name: /Contact Support/i }).click();

    // Try to submit without filling required fields
    await page.getByRole("button", { name: /Submit Request/i }).click();

    // HTML5 validation should prevent submission (required fields)
    // The form should still be visible
    await expect(page.getByRole("button", { name: /Submit Request/i })).toBeVisible();
  });

  // Skip: requires SUPPORT_SLACK_WEBHOOK_URL and SUPPORT_NOTION_SECRET in test env
  test.skip("contact form submits successfully", async ({ page }) => {
    await loginUser(page);
    await page.goto("/support");

    await page.getByRole("button", { name: /Contact Support/i }).click();

    // Wait for form to be ready
    await expect(page.getByRole("button", { name: /Submit Request/i })).toBeVisible();

    // Fill in the form
    await page.locator("select").selectOption("Report a bug");
    await page.getByPlaceholder(/Brief summary/i).fill("Test issue subject");
    await page
      .getByPlaceholder(/describe your issue/i)
      .fill("This is a test description for the support request.");

    // Submit
    await page.getByRole("button", { name: /Submit Request/i }).click();

    // Should show success message (the component re-renders to success state)
    await expect(page.getByRole("heading", { name: /Request submitted/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: /Submit another request/i })).toBeVisible();
  });

  test("unauthenticated user cannot access support page", async ({ page }) => {
    const response = await page.goto("/support");
    expect(response?.status()).toBe(404);
  });
});
