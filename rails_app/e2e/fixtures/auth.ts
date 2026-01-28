import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Authentication fixtures for E2E tests.
 * Provides authenticated user context for testing protected routes.
 */

export interface AuthState {
  email: string;
  password: string;
  cookies: { name: string; value: string }[];
}

/**
 * Test user credentials for E2E testing.
 * Database setup is handled automatically by DatabaseSnapshotter in beforeEach hooks.
 */
export const testUser = {
  email: "test_user@launch10.ai",
  password: "Launch10TestPass!",
};

/**
 * Login a user via the login form
 */
export async function loginUser(
  page: Page,
  email: string = testUser.email,
  password: string = testUser.password
): Promise<void> {
  await page.goto("/users/sign_in");
  // Don't use networkidle - Vite HMR keeps websocket active
  await page.waitForLoadState("domcontentloaded");

  // Click "Continue with Email" to reveal the sign-in form
  const continueWithEmail = page.getByRole("button", { name: "Continue with Email" });
  await continueWithEmail.waitFor({ state: "visible", timeout: 10000 });
  await continueWithEmail.click();

  // Wait for and fill in login form
  const emailInput = page.locator('input[name="user[email]"]');
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[name="user[password]"]');
  await passwordInput.fill(password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation away from sign_in page
  await page.waitForURL((url) => !url.toString().includes("/users/sign_in"), {
    timeout: 10000,
  });

  // Wait for the authenticated page to have loaded key elements
  // instead of networkidle (which hangs due to Vite HMR websocket)
  await page
    .getByTestId("chat-input")
    .or(page.getByText("Tell us your next"))
    .first()
    .waitFor({ state: "visible", timeout: 10000 });
}

/**
 * Logout the current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Find and click logout button/link
  const logoutButton = page.locator(
    '[data-testid="logout-button"], a[href*="sign_out"]'
  );
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL("**/users/sign_in**");
  }
}

/**
 * Extended test with authenticated user fixture
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await loginUser(page);
    await use(page);
  },
});

export { expect };
