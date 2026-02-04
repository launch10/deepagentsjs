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

  test("can send a message and receive AI response", async ({ page }) => {
    test.setTimeout(60000); // AI response may take time

    await loginUser(page);
    await page.goto("/support");

    // Wait for chat input to be ready
    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Initially there should be one AI message (the greeting)
    await expect(page.getByTestId("ai-message")).toHaveCount(1);

    // Type a message
    const userMessage = "How do credits work";
    await chatInput.fill(userMessage);

    // Send the message
    await page.getByTestId("send-button").click();

    // User message should appear in the chat
    await expect(page.getByTestId("user-message").getByText(userMessage)).toBeVisible({
      timeout: 5000,
    });

    // Wait for thinking indicator to appear then disappear (response complete)
    const thinkingIndicator = page.getByTestId("thinking-indicator");
    await thinkingIndicator.waitFor({ state: "visible", timeout: 10000 });
    await thinkingIndicator.waitFor({ state: "hidden", timeout: 30000 });

    // Verify the AI response appeared with actual content
    // The second ai-message should exist and have text content
    const secondAiMessage = page.getByTestId("ai-message").nth(1);
    await expect(secondAiMessage).toBeVisible({ timeout: 5000 });

    // Ensure the response has actual content (not empty)
    await expect(secondAiMessage).not.toBeEmpty();
  });
});
