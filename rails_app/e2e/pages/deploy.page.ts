import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object Model for the Deploy page.
 * Covers both website deploy and campaign deploy flows.
 */
export class DeployPage {
  readonly page: Page;

  // Sidebar
  readonly sidebar: Locator;
  readonly sidebarTitle: Locator;
  readonly taskItems: Locator;

  // Content area
  readonly contentArea: Locator;

  // In-progress screen
  readonly inProgressHeading: Locator;

  // Google Connect screen
  readonly googleConnectHeading: Locator;
  readonly signInWithGoogleButton: Locator;

  // Invite Accept screen
  readonly inviteHeading: Locator;
  readonly openGmailButton: Locator;
  readonly acceptInviteButton: Locator;
  readonly resendInviteLink: Locator;

  // Payment Required screen
  readonly paymentHeading: Locator;
  readonly addPaymentButton: Locator;
  readonly paymentAddedButton: Locator;
  readonly externalActionBadge: Locator;

  // Checking Payment screen
  readonly checkingPaymentText: Locator;

  // Payment Confirmed screen
  readonly paymentConfirmedText: Locator;

  // Waiting Google screen
  readonly waitingGoogleText: Locator;
  readonly checkAgainButton: Locator;

  // Deploy Complete screen
  readonly deployCompleteHeading: Locator;
  readonly liveBadge: Locator;
  readonly adsEnabledBadge: Locator;
  readonly deploymentHistoryTitle: Locator;

  // Deploy Error screen
  readonly deployFailedHeading: Locator;
  readonly retryDeployButton: Locator;

  // Footer
  readonly viewDashboardButton: Locator;
  readonly reviewPerformanceButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sidebar
    this.sidebar = page.locator("aside, [class*='Card']").first();
    this.sidebarTitle = page.locator("h3, [class*='CardTitle']");
    this.taskItems = page.locator(".flex.items-center.justify-between.rounded-lg");

    // Content area
    this.contentArea = page.locator(".border.border-neutral-300.bg-white.rounded-2xl");

    // In-progress screen
    this.inProgressHeading = page.getByText(/Launching your (campaign|website)/);

    // Google Connect screen
    this.googleConnectHeading = page.getByText("Connect Your Google Account");
    this.signInWithGoogleButton = page.getByText("Sign in with Google");

    // Invite Accept screen
    this.inviteHeading = page.getByText("Accept Google Ads Invitation");
    this.openGmailButton = page.getByRole("button", { name: "Open Gmail" });
    this.acceptInviteButton = page.getByRole("button", { name: "I accepted the invite" });
    this.resendInviteLink = page.getByText("Resend Invite");

    // Payment Required screen
    this.paymentHeading = page.getByRole("heading", { name: "Add Payment Method" });
    this.addPaymentButton = page.getByRole("button", { name: "Add Payment Method" });
    this.paymentAddedButton = page.getByRole("button", { name: "Payment Method Added" });
    this.externalActionBadge = page.getByText("External action needed");

    // Checking Payment screen
    this.checkingPaymentText = page.getByText("Verifying your payment method");

    // Payment Confirmed screen
    this.paymentConfirmedText = page.getByText("Payment method confirmed");

    // Waiting Google screen
    this.waitingGoogleText = page.getByText("Waiting for Google to confirm");
    this.checkAgainButton = page.getByRole("button", { name: "Check Again" });

    // Deploy Complete screen
    this.deployCompleteHeading = page.getByText(/(?:Campaign|Website) Launched!/);
    this.liveBadge = page.getByText("Live");
    this.adsEnabledBadge = page.getByText("Ads Enabled");
    this.deploymentHistoryTitle = page.getByText("Deployment History");

    // Deploy Error screen
    this.deployFailedHeading = page.getByText(/deployment failed|deployment timed out/i);
    this.retryDeployButton = page.getByRole("button", { name: "Retry Deploy" });

    // Footer
    this.viewDashboardButton = page.getByRole("button", { name: "View Dashboard" });
    this.reviewPerformanceButton = page.getByRole("button", { name: "Review Performance" });
  }

  /**
   * Navigate to a project's website deploy page
   */
  async gotoWebsiteDeploy(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/website/deploy`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Navigate to a project's campaign deploy page
   */
  async gotoCampaignDeploy(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/deploy`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Get sidebar title text
   */
  async getSidebarTitle(): Promise<string | null> {
    return this.sidebarTitle.first().textContent();
  }

  /**
   * Get all visible task item labels
   */
  async getTaskLabels(): Promise<string[]> {
    const items = await this.taskItems.all();
    const labels: string[] = [];
    for (const item of items) {
      const text = await item.textContent();
      if (text) labels.push(text.trim());
    }
    return labels;
  }

  /**
   * Check if footer buttons are disabled
   */
  async areFooterButtonsDisabled(): Promise<boolean> {
    const dashboardDisabled = await this.viewDashboardButton.isDisabled();
    const performanceDisabled = await this.reviewPerformanceButton.isDisabled();
    return dashboardDisabled && performanceDisabled;
  }
}
