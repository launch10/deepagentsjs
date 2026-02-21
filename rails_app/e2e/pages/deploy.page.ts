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
  readonly checkingPaymentHeading: Locator;

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

  // Footer (PaginationFooterView)
  readonly previousStepButton: Locator;
  readonly seePerformanceButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sidebar
    this.sidebar = page.locator("aside, [class*='Card']").first();
    this.sidebarTitle = page.locator("h3, [class*='CardTitle']");
    this.taskItems = page.locator(".flex.items-center.justify-between.rounded-lg");

    // Content area
    this.contentArea = page.locator(".border.border-neutral-300.bg-white.rounded-2xl");

    // In-progress screen — "Launching your website" or "Launching your website & campaign"
    this.inProgressHeading = page.getByText(/Launching your website/);

    // Google Connect screen
    this.googleConnectHeading = page.getByText("Connect your Google Account");
    this.signInWithGoogleButton = page.getByText("Sign in with Google");

    // Invite Accept screen
    this.inviteHeading = page.getByText("Finish setting up your new Google Ads account");
    this.openGmailButton = page.getByRole("button", { name: "Open Gmail" });
    this.acceptInviteButton = page.getByRole("button", { name: "I accepted the invite" });
    this.resendInviteLink = page.getByText("Resend Invite");

    // Payment Required screen
    this.paymentHeading = page.getByRole("heading", { name: "Add Payment Method" });
    this.addPaymentButton = page.getByRole("button", { name: "Add Payment Method" });
    this.paymentAddedButton = page.getByRole("button", { name: "Payment Method Added" });
    this.externalActionBadge = page.getByText("External action needed");

    // Checking Payment screen
    this.checkingPaymentHeading = page.getByText("Google Payment Setup");

    // Payment Confirmed screen
    this.paymentConfirmedText = page.getByText("Payment method confirmed");

    // Waiting Google screen
    this.waitingGoogleText = page.getByText("Waiting for Google to confirm");
    this.checkAgainButton = page.getByRole("button", { name: "Check Again" });

    // Deploy Complete screen
    this.deployCompleteHeading = page.getByText(
      /You've just launched|Everything is already up to date/
    );
    this.liveBadge = page.getByText("Live");
    this.adsEnabledBadge = page.getByText("Ads Enabled");
    this.deploymentHistoryTitle = page.getByText("Deployment History");

    // Deploy Error screen
    this.deployFailedHeading = page.getByText(/deployment failed|deployment timed out/i);
    this.retryDeployButton = page.getByRole("button", { name: "Retry Deploy" });

    // Footer (PaginationFooterView — the workflow navigation)
    this.previousStepButton = page.getByRole("button", { name: "Previous Step" });
    this.seePerformanceButton = page.getByRole("button", { name: "See Performance" });
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
    const prevDisabled = await this.previousStepButton.isDisabled();
    const seePerformanceDisabled = await this.seePerformanceButton.isDisabled();
    return prevDisabled && seePerformanceDisabled;
  }

  /**
   * Get a checklist item locator by its label text
   */
  checklistItem(label: string): Locator {
    return this.page.locator(`[data-testid="checklist-item-${label}"]`);
  }

  /**
   * Install a MutationObserver that records every data-status value
   * for every checklist-item element. Call this BEFORE navigating.
   */
  async installStatusObserver(): Promise<void> {
    await this.page.addInitScript(() => {
      (window as any).__checklistStatusHistory = {} as Record<string, string[]>;

      const record = (testId: string, status: string) => {
        const h = (window as any).__checklistStatusHistory;
        if (!h[testId]) h[testId] = [];
        // Only record if different from the last recorded status (dedup renders)
        const arr = h[testId];
        if (arr.length === 0 || arr[arr.length - 1] !== status) {
          arr.push(status);
        }
      };

      const scan = (root: Element | Document) => {
        root.querySelectorAll("[data-testid][data-status]").forEach((el) => {
          record(el.getAttribute("data-testid")!, el.getAttribute("data-status")!);
        });
      };

      const setup = () => {
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === "attributes" && m.attributeName === "data-status") {
              const el = m.target as HTMLElement;
              const testId = el.getAttribute("data-testid");
              const status = el.getAttribute("data-status");
              if (testId && status) record(testId, status);
            }
            if (m.type === "childList") {
              for (const node of m.addedNodes) {
                if (node instanceof HTMLElement) scan(node);
              }
            }
          }
        });
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["data-status"],
        });
      };

      if (document.body) setup();
      else document.addEventListener("DOMContentLoaded", setup);
    });
  }

  /**
   * Retrieve the recorded status history for a checklist item.
   * Returns an array of statuses in order (e.g. ["pending", "in_progress", "completed"]).
   */
  async getStatusHistory(label: string): Promise<string[]> {
    return this.page.evaluate(
      (testId) => (window as any).__checklistStatusHistory?.[testId] ?? [],
      `checklist-item-${label}`
    );
  }
}
