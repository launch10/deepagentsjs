import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Project Performance page.
 * Encapsulates interactions with the project-level analytics view.
 */
export class PerformancePage {
  readonly page: Page;

  // Header elements
  readonly backLink: Locator;
  readonly pageTitle: Locator;
  readonly projectName: Locator;
  readonly dateRangeFilter: Locator;

  // No data banner
  readonly noDataBanner: Locator;

  // Summary cards
  readonly adSpendCard: Locator;
  readonly leadsCard: Locator;
  readonly cplCard: Locator;
  readonly roasCard: Locator;
  readonly viewLeadsLink: Locator;

  // Charts section
  readonly chartsSection: Locator;
  readonly impressionsChart: Locator;
  readonly clicksChart: Locator;
  readonly ctrChart: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.backLink = page.locator('a:has-text("Projects")');
    this.pageTitle = page.locator("h1");
    this.projectName = page.locator("h1 + p");
    this.dateRangeFilter = page.locator("select").first();

    // No data banner
    this.noDataBanner = page.getByTestId("no-data-banner");

    // Summary cards - locate by title text within the card (use .first() for nested matches)
    this.adSpendCard = page.locator('div.rounded-2xl:has(h3:text("Ad Spend"))').first();
    this.leadsCard = page.locator('div.rounded-2xl:has(h3:text("Leads"))').first();
    this.cplCard = page.locator('div.rounded-2xl:has(h3:text("Avg Cost per Lead"))').first();
    this.roasCard = page.locator('div.rounded-2xl:has(h3:text("Return on Ad Spend"))').first();
    this.viewLeadsLink = page.locator('a:has-text("View Leads")');

    // Charts section
    this.chartsSection = page.locator("section").filter({ hasText: "Engagement Metrics" });
    this.impressionsChart = page.locator('div.rounded-2xl:has(h3:text("Impressions"))').first();
    this.clicksChart = page.locator('div.rounded-2xl:has(h3:text("Ad Clicks"))').first();
    this.ctrChart = page.locator('div.rounded-2xl:has(h3:text("Click-Through Rate"))').first();
  }

  /**
   * Navigate to a project's performance page
   */
  async goto(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/performance`);
    await this.pageTitle.waitFor({ state: "visible", timeout: 15000 });
  }

  /**
   * Get the current date range value
   */
  async getDateRange(): Promise<string> {
    return this.dateRangeFilter.inputValue();
  }

  /**
   * Change date range filter
   */
  async selectDateRange(days: 7 | 30 | 90 | 0): Promise<void> {
    await this.dateRangeFilter.selectOption(String(days));
  }

  /**
   * Get the ad spend value from the summary card
   */
  async getAdSpendValue(): Promise<string> {
    const valueElement = this.adSpendCard.locator("p.text-2xl");
    return (await valueElement.textContent()) || "";
  }

  /**
   * Get the leads count from the summary card
   */
  async getLeadsValue(): Promise<string> {
    const valueElement = this.leadsCard.locator("p.text-2xl");
    return (await valueElement.textContent()) || "";
  }

  /**
   * Get the CPL value from the summary card
   */
  async getCplValue(): Promise<string> {
    const valueElement = this.cplCard.locator("p.text-2xl");
    return (await valueElement.textContent()) || "";
  }

  /**
   * Get the ROAS value from the summary card
   */
  async getRoasValue(): Promise<string> {
    const valueElement = this.roasCard.locator("p.text-2xl");
    return (await valueElement.textContent()) || "";
  }

  /**
   * Check if charts are visible
   */
  async expectChartsVisible(): Promise<void> {
    await expect(this.impressionsChart).toBeVisible();
    await expect(this.clicksChart).toBeVisible();
    await expect(this.ctrChart).toBeVisible();
  }

  /**
   * Check if summary cards are visible
   */
  async expectSummaryCardsVisible(): Promise<void> {
    await expect(this.adSpendCard).toBeVisible();
    await expect(this.leadsCard).toBeVisible();
    await expect(this.cplCard).toBeVisible();
    await expect(this.roasCard).toBeVisible();
  }

  /**
   * Check if the page displays the empty state (no data banner visible)
   */
  async expectEmptyState(): Promise<void> {
    // Banner should be visible
    await expect(this.noDataBanner).toBeVisible();
    await expect(this.noDataBanner.getByText("Not enough data yet")).toBeVisible();
    await expect(this.noDataBanner.getByText(/Check back in 24–48 hours/)).toBeVisible();

    // Summary cards should show "No data available yet"
    const noDataTexts = this.page.getByText("No data available yet");
    // Should have 7 instances: 4 summary cards + 3 charts
    await expect(noDataTexts).toHaveCount(7);

    // View Leads link should not be visible in empty state
    await expect(this.viewLeadsLink).not.toBeVisible();
  }

  /**
   * Check if the page displays correctly with no data (legacy - use expectEmptyState instead)
   */
  async expectEmptyStateCharts(): Promise<void> {
    // Charts should show "No data available yet" when empty
    const emptyStates = this.chartsSection.getByText("No data available yet");
    await expect(emptyStates.first()).toBeVisible();
  }

  /**
   * Check that the page has data (no empty state banner)
   */
  async expectHasData(): Promise<void> {
    await expect(this.noDataBanner).not.toBeVisible();
    // Should have actual values, not empty state text in summary cards
    await expect(this.adSpendCard.locator("p.text-2xl")).toBeVisible();
  }

  /**
   * Navigate to leads page via the View Leads link
   */
  async clickViewLeads(): Promise<void> {
    await this.viewLeadsLink.click();
    await this.page.waitForURL(/\/leads/);
  }

  /**
   * Navigate back to dashboard via the back link
   */
  async clickBackToProjects(): Promise<void> {
    await this.backLink.click();
    await this.page.waitForURL(/\/dashboard/);
  }

  /**
   * Check if charts have SVG elements (indicates Recharts rendered)
   */
  async expectChartsHaveData(): Promise<void> {
    const charts = this.chartsSection.locator(".recharts-surface");
    await expect(charts.first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * Get the total displayed for impressions chart
   */
  async getImpressionsTotal(): Promise<string> {
    const totalElement = this.impressionsChart.locator("span.text-2xl");
    return (await totalElement.textContent()) || "0";
  }

  /**
   * Get the total displayed for clicks chart
   */
  async getClicksTotal(): Promise<string> {
    const totalElement = this.clicksChart.locator("span.text-2xl");
    return (await totalElement.textContent()) || "0";
  }

  /**
   * Get the CTR value displayed
   */
  async getCtrValue(): Promise<string> {
    const valueElement = this.ctrChart.locator("span.text-2xl");
    return (await valueElement.textContent()) || "0%";
  }
}
