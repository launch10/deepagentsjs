import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Leads page.
 * Encapsulates all interactions with the leads list interface.
 */
export class LeadsPage {
  readonly page: Page;

  // Header elements
  readonly backLink: Locator;
  readonly pageTitle: Locator;
  readonly projectName: Locator;
  readonly exportButton: Locator;

  // Table elements
  readonly table: Locator;
  readonly tableHeaders: Locator;
  readonly tableRows: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Pagination elements
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.backLink = page.locator('a:has-text("Projects")');
    this.pageTitle = page.locator("h1");
    this.projectName = page.locator("h1 + p");
    this.exportButton = page.locator('button:has-text("Export CSV")');

    // Table
    this.table = page.getByTestId("leads-table");
    this.tableHeaders = this.table.locator("th");
    this.tableRows = page.getByTestId("lead-row");

    // Empty state
    this.emptyState = page.getByTestId("empty-leads");

    // Pagination
    this.pagination = page.getByTestId("leads-pagination");
    this.prevButton = page.getByTestId("pagination-prev");
    this.nextButton = page.getByTestId("pagination-next");
  }

  /**
   * Navigate to a project's leads page
   */
  async goto(projectUuid: string): Promise<void> {
    await this.page.goto(`/projects/${projectUuid}/leads`);
    await this.pageTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Check if the page is showing leads
   */
  async hasLeads(): Promise<boolean> {
    return this.tableRows.count().then((count) => count > 0);
  }

  /**
   * Get the count of visible lead rows
   */
  async getLeadCount(): Promise<number> {
    return this.tableRows.count();
  }

  /**
   * Get all emails from the visible leads
   */
  async getLeadEmails(): Promise<string[]> {
    const rows = await this.tableRows.all();
    const emails: string[] = [];
    for (const row of rows) {
      const email = await row.locator("td:nth-child(2)").textContent();
      if (email) emails.push(email.trim());
    }
    return emails;
  }

  /**
   * Check if a lead with null name shows the dash
   */
  async hasNullNameDisplay(): Promise<boolean> {
    const cells = await this.tableRows.locator("td:first-child").all();
    for (const cell of cells) {
      const text = await cell.textContent();
      if (text?.includes("—")) return true;
    }
    return false;
  }

  /**
   * Click the Export CSV button
   */
  async clickExport(): Promise<void> {
    await this.exportButton.click();
  }

  /**
   * Navigate to a specific page number
   */
  async goToPage(pageNum: number): Promise<void> {
    const pageButton = this.page.getByTestId(`pagination-page-${pageNum}`);
    await pageButton.click();
    // Wait for URL to update with page param
    await this.page.waitForURL(`**?page=${pageNum}`, { timeout: 10000 });
  }

  /**
   * Click Previous button
   */
  async clickPrevious(): Promise<void> {
    const currentPage = await this.getCurrentPage();
    await this.prevButton.click();
    // Wait for URL to update with new page param
    await this.page.waitForURL(`**?page=${currentPage - 1}`, { timeout: 10000 });
  }

  /**
   * Click Next button
   */
  async clickNext(): Promise<void> {
    const currentPage = await this.getCurrentPage();
    await this.nextButton.click();
    // Wait for URL to update with new page param
    await this.page.waitForURL(`**?page=${currentPage + 1}`, { timeout: 10000 });
  }

  /**
   * Check if empty state is visible
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
    await expect(this.page.getByText("No leads yet")).toBeVisible();
  }

  /**
   * Check if export button is disabled
   */
  async expectExportDisabled(): Promise<void> {
    await expect(this.exportButton).toBeDisabled();
  }

  /**
   * Check if export button is enabled
   */
  async expectExportEnabled(): Promise<void> {
    await expect(this.exportButton).toBeEnabled();
  }

  /**
   * Check if pagination controls are visible
   */
  async expectPaginationVisible(): Promise<void> {
    await expect(this.pagination).toBeVisible();
  }

  /**
   * Check if Previous button is disabled
   */
  async expectPreviousDisabled(): Promise<void> {
    await expect(this.page.getByTestId("pagination-prev-disabled")).toBeVisible();
  }

  /**
   * Check if Next button is disabled
   */
  async expectNextDisabled(): Promise<void> {
    await expect(this.page.getByTestId("pagination-next-disabled")).toBeVisible();
  }

  /**
   * Check that table headers are correct
   */
  async expectCorrectHeaders(): Promise<void> {
    const headers = await this.tableHeaders.allTextContents();
    expect(headers).toEqual(["Name", "Email", "Date"]);
  }

  /**
   * Get current page number from active pagination button
   */
  async getCurrentPage(): Promise<number> {
    // Find the active page button (has bg-base-500 class)
    const activePage = this.pagination.locator('[class*="bg-base-500"]');
    const text = await activePage.textContent();
    return parseInt(text || "1", 10);
  }
}
