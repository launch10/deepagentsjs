import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Domain Picker page.
 * Encapsulates all interactions with the domain picker interface.
 *
 * The Domain Picker uses a dropdown-first design (not tabs):
 * - Launch10 Site picker is shown by default
 * - "Connect your own site" in the dropdown opens Custom Domain Picker
 */
export class DomainPickerPage {
  readonly page: Page;

  // Container
  readonly container: Locator;
  readonly loadingSkeleton: Locator;

  // Header
  readonly header: Locator;
  readonly description: Locator;

  // Launch10 Site Picker
  readonly siteNameDropdown: Locator;
  readonly pageNameInput: Locator;
  readonly existingSitesSection: Locator;
  readonly createNewSiteSection: Locator;
  readonly connectOwnSiteButton: Locator;
  readonly outOfCreditsBanner: Locator;
  readonly availabilityStatus: Locator;

  // Custom Domain Picker
  readonly customDomainInput: Locator;
  readonly cnameInstructions: Locator;
  readonly switchToLaunch10Button: Locator;
  readonly dnsVerificationStatus: Locator;

  // Full URL Preview
  readonly fullUrlPreview: Locator;
  readonly urlPreviewText: Locator;

  // Navigation
  readonly previousStepButton: Locator;
  readonly previewButton: Locator;
  readonly continueButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Container
    this.container = page
      .locator('[data-testid="domain-picker"]')
      .or(page.locator('text="Website Setup"').locator("..").locator(".."));
    this.loadingSkeleton = page.getByTestId("domain-picker-loading");

    // Header
    this.header = page.locator('text="Website Setup"');
    this.description = page
      .locator('text="Choose how you want your website to be accessed"')
      .or(page.locator('text="Connect your own domain to your landing page"'));

    // Launch10 Site Picker components
    this.siteNameDropdown = page
      .locator('[data-testid="site-name-dropdown"]')
      .or(page.locator('text="Your site name"').locator("..").locator("button").first());
    this.pageNameInput = page
      .locator('[data-testid="page-name-input"]')
      .or(page.locator('text="Page name"').locator("..").locator("input"));
    this.existingSitesSection = page.locator('text="Your Existing Sites"');
    this.createNewSiteSection = page.locator('text="Create New Site"');
    this.connectOwnSiteButton = page.getByTestId("connect-own-site-button");
    this.outOfCreditsBanner = page.getByTestId("out-of-credits-banner");
    this.availabilityStatus = page.getByTestId("availability-status");

    // Custom Domain Picker
    this.customDomainInput = page.getByTestId("custom-domain-input");
    this.cnameInstructions = page.locator('text="CNAME"').locator("..");
    this.switchToLaunch10Button = page.locator('text="Use a free Launch10 Site instead"');
    this.dnsVerificationStatus = page.getByTestId("dns-verification-status");

    // Full URL Preview
    this.fullUrlPreview = page
      .locator('[data-testid="full-url-preview"]')
      .or(page.locator('text="Your URL will be"').locator(".."));
    this.urlPreviewText = page.locator('[data-testid="url-preview-text"]');

    // Navigation buttons
    this.previousStepButton = page.locator('button:has-text("Previous Step")');
    this.previewButton = page.locator('button:has-text("Preview")');
    this.continueButton = page.locator('button:has-text("Continue")');
  }

  /**
   * Navigate to a project's domain picker page
   */
  async goto(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/website/domain`);
  }

  /**
   * Wait for the domain picker to finish loading
   */
  async waitForLoaded(timeout: number = 30000): Promise<void> {
    // Wait for loading skeleton to disappear
    await this.loadingSkeleton.waitFor({ state: "hidden", timeout }).catch(() => {
      // Loading skeleton might not appear if data loads fast
    });
    // Wait for header to be visible
    await this.header.waitFor({ state: "visible", timeout });
  }

  /**
   * Check if the domain picker is showing loading state
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSkeleton.isVisible();
  }

  /**
   * Check if we're in Custom Domain mode
   */
  async isInCustomDomainMode(): Promise<boolean> {
    return this.customDomainInput.isVisible();
  }

  /**
   * Switch to Custom Domain mode via dropdown
   */
  async switchToCustomDomain(): Promise<void> {
    await this.siteNameDropdown.click();
    await this.connectOwnSiteButton.click();
  }

  /**
   * Switch back to Launch10 Site mode
   */
  async switchToLaunch10Site(): Promise<void> {
    await this.switchToLaunch10Button.click();
  }

  /**
   * @deprecated Use switchToCustomDomain instead - tabs have been removed
   */
  async selectCustomDomainTab(): Promise<void> {
    await this.switchToCustomDomain();
  }

  /**
   * @deprecated Use switchToLaunch10Site instead - tabs have been removed
   */
  async selectLaunch10Tab(): Promise<void> {
    await this.switchToLaunch10Site();
  }

  /**
   * @deprecated Tabs have been removed - returns based on which picker is visible
   */
  async getActiveTab(): Promise<"launch10" | "custom"> {
    const isCustom = await this.isInCustomDomainMode();
    return isCustom ? "custom" : "launch10";
  }

  /**
   * Select an existing domain from the dropdown
   */
  async selectExistingDomain(domainName: string): Promise<void> {
    await this.siteNameDropdown.click();
    await this.page.locator(`text="${domainName}"`).click();
  }

  /**
   * Enter a custom subdomain in the site name input
   */
  async enterSubdomain(subdomain: string): Promise<void> {
    await this.siteNameDropdown.click();
    // Look for a "type your own" option or input field
    const typeOwnInput = this.page
      .locator('[placeholder*="type"]')
      .or(this.page.locator('input[type="text"]').first());
    await typeOwnInput.fill(subdomain);
  }

  /**
   * Enter a path in the page name input
   */
  async enterPageName(path: string): Promise<void> {
    await this.pageNameInput.fill(path);
  }

  /**
   * Enter a custom domain
   */
  async enterCustomDomain(domain: string): Promise<void> {
    await this.customDomainInput.fill(domain);
  }

  /**
   * Get the full URL preview text
   */
  async getFullUrlPreview(): Promise<string | null> {
    if (await this.fullUrlPreview.isVisible()) {
      return this.urlPreviewText.textContent();
    }
    return null;
  }

  /**
   * Click continue button
   */
  async clickContinue(): Promise<void> {
    await this.continueButton.click();
  }

  /**
   * Click previous step button
   */
  async clickPreviousStep(): Promise<void> {
    await this.previousStepButton.click();
  }

  /**
   * Assert that the domain picker loaded successfully
   */
  async expectLoaded(): Promise<void> {
    await expect(this.header).toBeVisible({ timeout: 30000 });
    await expect(this.loadingSkeleton).not.toBeVisible();
  }

  /**
   * Assert that existing domains are displayed
   */
  async expectExistingDomainsVisible(): Promise<void> {
    await expect(this.existingSitesSection).toBeVisible({ timeout: 10000 });
  }

  /**
   * Assert that the URL preview is showing the expected URL
   */
  async expectUrlPreview(expectedUrl: string): Promise<void> {
    await expect(this.fullUrlPreview).toBeVisible();
    await expect(this.fullUrlPreview).toContainText(expectedUrl);
  }

  /**
   * Assert that CNAME instructions are visible (custom domain mode)
   */
  async expectCnameInstructionsVisible(): Promise<void> {
    await expect(this.cnameInstructions).toBeVisible({ timeout: 5000 });
  }
}
