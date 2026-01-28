import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Login and Signup pages.
 * Encapsulates all interactions with authentication flows.
 */
export class LoginPage {
  readonly page: Page;

  // Sign In elements
  readonly signInHeading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly googleSignInButton: Locator;
  readonly signUpLink: Locator;

  // Sign Up elements
  readonly signUpHeading: Locator;
  readonly fullNameInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly createAccountButton: Locator;
  readonly googleSignUpButton: Locator;
  readonly signInLink: Locator;

  // Error elements
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sign In elements
    this.signInHeading = page.getByRole("heading", { name: "Welcome back to Launch10" });
    this.emailInput = page.getByPlaceholder("Email");
    this.passwordInput = page.getByPlaceholder("Password", { exact: true });
    this.signInButton = page.getByRole("button", { name: "Sign In", exact: true });
    this.googleSignInButton = page.getByRole("button", { name: "Sign in with Google" });
    this.signUpLink = page.getByRole("link", { name: "Sign Up" });

    // Sign Up elements
    this.signUpHeading = page.getByRole("heading", { name: "Start building with Launch10" });
    this.fullNameInput = page.getByPlaceholder("Full Name");
    this.confirmPasswordInput = page.getByPlaceholder("Confirm Password");
    this.createAccountButton = page.getByRole("button", { name: "Create Account" });
    this.googleSignUpButton = page.getByRole("button", { name: "Sign up with Google" });
    this.signInLink = page.getByRole("link", { name: "Sign In" });

    // Error elements
    this.errorAlert = page.locator('[role="alert"]');
  }

  /**
   * Navigate to the sign in page
   */
  async gotoSignIn(): Promise<void> {
    await this.page.goto("/users/sign_in");
    await this.page.waitForLoadState("domcontentloaded");
    await this.emailInput.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Navigate to the sign up page
   */
  async gotoSignUp(): Promise<void> {
    await this.page.goto("/users/sign_up");
    await this.page.waitForLoadState("domcontentloaded");
    await this.fullNameInput.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Sign in with email and password
   * @param email - User's email
   * @param password - User's password
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  /**
   * Sign in and wait for redirect away from sign in page
   * @param email - User's email
   * @param password - User's password
   */
  async signInAndWaitForRedirect(email: string, password: string): Promise<void> {
    await this.signIn(email, password);
    await this.page.waitForURL((url) => !url.toString().includes("/users/sign_in"), {
      timeout: 10000,
    });
  }

  /**
   * Sign up with full details
   * @param name - User's full name
   * @param email - User's email
   * @param password - User's password
   */
  async signUp(name: string, email: string, password: string): Promise<void> {
    await this.fullNameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.createAccountButton.click();
  }

  /**
   * Sign up and wait for redirect away from sign up page
   * @param name - User's full name
   * @param email - User's email
   * @param password - User's password
   */
  async signUpAndWaitForRedirect(name: string, email: string, password: string): Promise<void> {
    await this.signUp(name, email, password);
    await this.page.waitForURL((url) => !url.toString().includes("/users/sign_up"), {
      timeout: 15000,
    });
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    await this.page.goto("/users/sign_out");
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Sign in via OAuth using the developer provider (test mode only)
   * This simulates Google OAuth login in test environment.
   * The mock email is configured in config/initializers/devise.rb
   */
  async signInViaOAuth(): Promise<void> {
    await this.page.goto("/users/auth/developer/callback");
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Sign in via OAuth and wait for redirect to a specific URL pattern
   * @param urlPattern - RegExp pattern to match the redirect URL
   */
  async signInViaOAuthAndWaitFor(urlPattern: RegExp): Promise<void> {
    await this.signInViaOAuth();
    await expect(this.page).toHaveURL(urlPattern, { timeout: 10000 });
  }

  /**
   * Check if we're on the sign in page
   */
  async isOnSignInPage(): Promise<boolean> {
    return this.page.url().includes("/users/sign_in");
  }

  /**
   * Check if we're on the sign up page
   */
  async isOnSignUpPage(): Promise<boolean> {
    return this.page.url().includes("/users/sign_up");
  }

  /**
   * Check if the Google OAuth button is visible
   */
  async isGoogleOAuthVisible(): Promise<boolean> {
    return await this.googleSignInButton.isVisible();
  }

  /**
   * Assert that the sign in form is ready
   */
  async expectSignInFormReady(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Assert that the sign up form is ready
   */
  async expectSignUpFormReady(): Promise<void> {
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.createAccountButton).toBeVisible();
  }

  /**
   * Assert that an error is displayed
   * @param message - Optional message to check for
   */
  async expectError(message?: string): Promise<void> {
    await expect(this.errorAlert).toBeVisible();
    if (message) {
      await expect(this.errorAlert).toContainText(message);
    }
  }

  /**
   * Wait for redirect to the subscribed user experience (projects/new)
   */
  async waitForSubscribedRedirect(): Promise<void> {
    await expect(this.page).toHaveURL(/\/projects\/new/, { timeout: 10000 });
  }

  /**
   * Wait for redirect to the pricing page (non-subscribed users)
   */
  async waitForPricingRedirect(): Promise<void> {
    await expect(this.page).toHaveURL(/\/pricing/, { timeout: 10000 });
  }
}
