import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Domain Picker page.
 * Encapsulates all interactions with the domain picker interface.
 *
 * The Domain Picker uses a dropdown-first design (not tabs):
 * - Launch10 Site picker is shown by default
 * - "Connect your own site" in the dropdown opens Custom Domain Picker
 *
 * IMPORTANT: Domain recommendations require the website graph to run first.
 * If navigating directly to /website/domain, use gotoWithBuild() to ensure
 * the graph runs and populates domainRecommendations state.
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

  // Page Name Availability Indicators
  readonly pathCheckingIndicator: Locator;
  readonly pathCheckingMessage: Locator;
  readonly pathAvailableIndicator: Locator;
  readonly pathAssignedIndicator: Locator;
  readonly pathUnavailableIndicator: Locator;
  readonly pathExistingIndicator: Locator;
  readonly pathValidationError: Locator;

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
  readonly connectSiteButton: Locator;

  // Claim Subdomain Modal
  readonly claimSubdomainModal: Locator;
  readonly creditsRemaining: Locator;
  readonly confirmClaimButton: Locator;
  readonly cancelClaimButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Container
    this.container = page
      .locator('[data-testid="domain-picker"]')
      .or(page.locator('text="Website Setup"').locator("..").locator(".."));
    this.loadingSkeleton = page.getByTestId("domain-picker-loading");

    // Header - use h2 heading specifically to avoid matching sidebar text
    // Can be "Website Setup" or "Connect your own site" depending on mode
    this.header = page
      .getByRole("heading", { name: "Website Setup" })
      .or(page.getByRole("heading", { name: "Connect your own site" }));
    this.description = page
      .locator('text="Choose how you want your website to be accessed"')
      .or(page.locator('text="Use a site you already own, like mybusiness.com"'));

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

    // Page Name Availability Indicators
    this.pathCheckingIndicator = page.getByTestId("path-checking-indicator");
    this.pathCheckingMessage = page.getByTestId("path-checking-message");
    this.pathAvailableIndicator = page.getByTestId("path-available-indicator");
    this.pathAssignedIndicator = page.getByTestId("path-assigned-indicator");
    this.pathUnavailableIndicator = page.getByTestId("path-unavailable-indicator");
    this.pathExistingIndicator = page.getByTestId("path-existing-indicator");
    this.pathValidationError = page.getByTestId("path-validation-error");

    // Custom Domain Picker
    this.customDomainInput = page.getByTestId("custom-domain-input");
    this.cnameInstructions = page.locator('text="CNAME"').locator("..");
    this.switchToLaunch10Button = page.locator('text="Use a Launch10 Site"');
    this.dnsVerificationStatus = page.getByTestId("dns-verification-status");

    // Full URL Preview - use the url display element (unique data-testid)
    this.fullUrlPreview = page.getByTestId("full-url-display");
    this.urlPreviewText = page.getByTestId("full-url-display");

    // Navigation buttons
    this.previousStepButton = page.locator('button:has-text("Previous Step")');
    this.previewButton = page.locator('button:has-text("Preview")');
    this.continueButton = page.locator('button:has-text("Continue")');
    this.connectSiteButton = page.locator('button:has-text("Connect Site")');

    // Claim Subdomain Modal
    this.claimSubdomainModal = page.getByTestId("claim-subdomain-modal");
    this.creditsRemaining = page.getByTestId("credits-remaining");
    this.confirmClaimButton = page.getByTestId("confirm-claim-button");
    this.cancelClaimButton = page.getByTestId("cancel-claim-button");
  }

  /**
   * Navigate to a project's domain picker page.
   *
   * NOTE: This navigates directly to /website/domain. If the website graph
   * hasn't run yet (e.g., fresh test), domainRecommendations won't be populated.
   * Use gotoWithBuild() instead if you need AI recommendations.
   */
  async goto(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/website/domain`);
  }

  /**
   * Navigate to domain picker by first going through the build page.
   * This ensures the website graph runs and populates domainRecommendations.
   *
   * Flow:
   * 1. Navigate to /website/build
   * 2. Wait for the graph to start (POST /stream)
   * 3. Wait for streaming to complete (isStreaming becomes false)
   * 4. Navigate to /website/domain
   *
   * @param projectUuid - The project UUID
   * @param options.waitForRecommendations - If true, waits for domainRecommendations to be populated (default: true)
   * @param options.timeout - Max time to wait for graph completion (default: 60000ms)
   */
  async gotoWithBuild(
    projectUuid: string,
    options: { waitForRecommendations?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const { waitForRecommendations = true, timeout = 60000 } = options;

    console.warn(`[DomainPickerPage] gotoWithBuild: Starting for project ${projectUuid}`);

    // Step 1: Navigate to build page to trigger the website graph
    await this.page.goto(`/projects/${projectUuid}/website/build`);
    console.warn(`[DomainPickerPage] gotoWithBuild: Navigated to /website/build`);

    // Step 2: Wait for the POST /stream request to be sent (graph invocation)
    const streamPromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/api/website/stream") && response.request().method() === "POST",
      { timeout }
    );

    // Step 3: Wait for streaming to complete by watching for the loading state to end
    // We poll for the WebsitePreview to become visible (indicates streaming complete)
    if (waitForRecommendations) {
      console.warn(`[DomainPickerPage] gotoWithBuild: Waiting for graph to complete...`);

      // Wait for POST to complete
      await streamPromise.catch(() => {
        console.warn(`[DomainPickerPage] gotoWithBuild: POST /stream may have already happened`);
      });

      // Wait for loading to finish - the WebsitePreview appears when streaming completes
      // or we can wait for the loader to disappear
      await this.page
        .locator('[data-testid="website-preview"]')
        .or(
          this.page
            .locator(".border-\\[\\#D3D2D0\\]")
            .filter({ hasNot: this.page.locator("text=Setting up") })
        )
        .waitFor({ state: "visible", timeout })
        .catch(async () => {
          // Alternative: wait for loading indicator to disappear
          console.warn(`[DomainPickerPage] gotoWithBuild: Waiting for loading to complete...`);
          await this.page.waitForTimeout(5000); // Give graph time to complete
        });

      console.warn(`[DomainPickerPage] gotoWithBuild: Graph appears to have completed`);
    }

    // Step 4: Navigate to domain picker
    console.warn(`[DomainPickerPage] gotoWithBuild: Navigating to /website/domain`);
    await this.page.goto(`/projects/${projectUuid}/website/domain`);
  }

  /**
   * Wait for domain recommendations to be loaded in the chat state.
   * Polls the page to check if domainRecommendations is populated.
   */
  async waitForDomainRecommendations(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500;

    console.warn(`[DomainPickerPage] waitForDomainRecommendations: Starting...`);

    while (Date.now() - startTime < timeout) {
      // Check if domain recommendations are present by looking for selection in dropdown
      const hasSelection = await this.siteNameDropdown
        .locator("text=.launch10.site")
        .isVisible()
        .catch(() => false);

      if (hasSelection) {
        console.warn(`[DomainPickerPage] waitForDomainRecommendations: Found domain selection`);
        return;
      }

      // Also check if we're past the loading state
      const isLoading = await this.loadingSkeleton.isVisible().catch(() => false);
      if (!isLoading) {
        // Check dropdown text - if it shows a domain (not "Select..."), recommendations are loaded
        const dropdownText = await this.siteNameDropdown.textContent();
        if (dropdownText && !dropdownText.includes("Select") && dropdownText.includes(".")) {
          console.warn(
            `[DomainPickerPage] waitForDomainRecommendations: Dropdown shows domain: ${dropdownText}`
          );
          return;
        }
      }

      await this.page.waitForTimeout(pollInterval);
    }

    console.warn(
      `[DomainPickerPage] waitForDomainRecommendations: Timeout - recommendations may not have loaded`
    );
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
   * Wait for the domain picker to fully initialize with recommendations.
   * This waits for:
   * 1. Loading skeleton to disappear
   * 2. Header to be visible
   * 3. Domain recommendations to load (dropdown shows a domain, not "Select a domain...")
   */
  async waitForRecommendationsLoaded(timeout: number = 60000): Promise<void> {
    // First wait for basic loading
    await this.waitForLoaded(timeout);

    // Then wait for recommendations - "Select a domain..." should disappear
    // when AI recommendations pre-select a domain
    await expect(this.page.locator('text="Select a domain..."')).not.toBeVisible({ timeout });
  }

  /**
   * Wait for domain context to be loaded (includes credits info, existing domains).
   * Use this when testing features that depend on context but not AI recommendations.
   */
  async waitForContextLoaded(timeout: number = 30000): Promise<void> {
    await this.waitForLoaded(timeout);
    // Context is loaded when the "Your site name" section is interactive
    await this.siteNameDropdown.waitFor({ state: "visible", timeout });
  }

  /**
   * Check if the domain picker is showing loading state
   */
  async isLoading(): Promise<boolean> {
    return this.loadingSkeleton.isVisible();
  }

  /**
   * Check if a custom domain is currently selected (not a .launch10.site domain)
   * In the unified picker, this checks the dropdown's displayed value
   */
  async isInCustomDomainMode(): Promise<boolean> {
    // Check if the DNS help section is visible (only shows for custom domains)
    return this.dnsVerificationStatus.isVisible();
  }

  /**
   * Opens dropdown and switches to the custom domain input mode.
   * Clicks the "Connect your own site" button to toggle the input mode.
   */
  async switchToCustomDomain(): Promise<void> {
    await this.siteNameDropdown.click();
    // Wait for dropdown to be visible
    await this.page.waitForTimeout(500);
    // Click "Connect your own site" button to switch input mode
    await this.connectOwnSiteButton.click();
    // Wait for mode to switch
    await this.page.waitForTimeout(300);
  }

  /**
   * @deprecated With the unified picker, there's no separate "Launch10 Site mode".
   * Simply select a platform subdomain from the dropdown.
   */
  async switchToLaunch10Site(): Promise<void> {
    // Open dropdown and select first existing platform subdomain
    await this.siteNameDropdown.click();
    await this.page.waitForTimeout(500);
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
   * @deprecated With the unified picker, mode is determined by the selected domain type.
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
   * Enter a custom domain (switches to custom domain mode first if needed)
   */
  async enterCustomDomain(domain: string): Promise<void> {
    // Open dropdown if not already open
    const isDropdownOpen = await this.page
      .locator("[data-radix-popper-content-wrapper]")
      .isVisible();
    if (!isDropdownOpen) {
      await this.siteNameDropdown.click();
      await this.page.waitForTimeout(300);
    }

    // Check if we're in custom domain mode (no suffix visible) or need to switch
    const isCustomMode = await this.customDomainInput.isVisible();
    if (!isCustomMode) {
      await this.connectOwnSiteButton.click();
      await this.page.waitForTimeout(300);
    }

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
   * Click connect site button
   */
  async clickConnectSite(): Promise<void> {
    await this.connectSiteButton.click();
  }

  /**
   * @deprecated Use clickConnectSite instead - button is named "Connect Site"
   */
  async clickContinue(): Promise<void> {
    await this.connectSiteButton.click();
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

  /**
   * Wait for the claim subdomain modal to be visible
   */
  async waitForClaimModal(): Promise<void> {
    await this.claimSubdomainModal.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Get the credits remaining text from the claim modal
   */
  async getCreditsRemaining(): Promise<string> {
    return (await this.creditsRemaining.textContent()) ?? "";
  }

  /**
   * Confirm the subdomain claim in the modal
   */
  async confirmClaim(): Promise<void> {
    await this.confirmClaimButton.click();
  }

  /**
   * Cancel the subdomain claim modal
   */
  async cancelClaim(): Promise<void> {
    await this.cancelClaimButton.click();
  }

  /**
   * Assert that the claim modal shows expected credits
   */
  async expectCreditsRemaining(expected: number): Promise<void> {
    const text = await this.getCreditsRemaining();
    expect(text).toContain(`${expected} remaining`);
  }
}
