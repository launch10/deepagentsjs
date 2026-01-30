import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Projects page.
 * Encapsulates all interactions with the projects list interface.
 */
export class ProjectsPage {
  readonly page: Page;

  // Header elements
  readonly pageTitle: Locator;
  readonly totalProjectsText: Locator;
  readonly newProjectButton: Locator;

  // Filter tabs
  readonly filterTabs: Locator;
  readonly allFilter: Locator;
  readonly liveFilter: Locator;
  readonly pausedFilter: Locator;
  readonly draftFilter: Locator;

  // Project cards
  readonly projectCards: Locator;
  readonly projectList: Locator;

  // Empty state
  readonly emptyState: Locator;
  readonly emptyStateButton: Locator;
  readonly noProjectsFoundMessage: Locator;

  // Pagination elements
  readonly pagination: Locator;
  readonly prevButton: Locator;
  readonly prevButtonDisabled: Locator;
  readonly nextButton: Locator;
  readonly nextButtonDisabled: Locator;

  // Delete modal
  readonly deleteModal: Locator;
  readonly deleteModalTitle: Locator;
  readonly deleteModalDescription: Locator;
  readonly deleteButton: Locator;
  readonly keepButton: Locator;
  readonly deleteModalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.pageTitle = page.locator("h1");
    this.totalProjectsText = page.locator('h1 + p');
    this.newProjectButton = page.locator('a:has-text("New Project")');

    // Filter tabs (in the segmented control)
    this.filterTabs = page.locator('.bg-neutral-100.rounded-full');
    this.allFilter = page.locator('button:has-text("All")');
    this.liveFilter = page.locator('button:has-text("Live")');
    this.pausedFilter = page.locator('button:has-text("Paused")');
    this.draftFilter = page.locator('button:has-text("Draft")');

    // Project cards - each card is a div with rounded-2xl border
    this.projectCards = page.locator('.bg-white.rounded-2xl.border');
    this.projectList = page.locator('.flex.flex-col.gap-5');

    // Empty state
    this.emptyState = page.locator('text=No projects yet');
    this.emptyStateButton = page.locator('a:has-text("Create Your First Project")');
    this.noProjectsFoundMessage = page.locator('text=No projects found');

    // Pagination
    this.pagination = page.getByTestId("projects-pagination");
    this.prevButton = page.getByTestId("pagination-prev");
    this.prevButtonDisabled = page.getByTestId("pagination-prev-disabled");
    this.nextButton = page.getByTestId("pagination-next");
    this.nextButtonDisabled = page.getByTestId("pagination-next-disabled");

    // Delete modal
    this.deleteModal = page.locator('[role="dialog"]');
    this.deleteModalTitle = page.locator('[role="dialog"] h2:has-text("Delete this project?")');
    this.deleteModalDescription = page.locator('[role="dialog"] p:has-text("This will permanently delete")');
    this.deleteButton = page.locator('[role="dialog"] button:has-text("Delete Project")');
    this.keepButton = page.locator('[role="dialog"] button:has-text("Keep Project")');
    this.deleteModalCloseButton = page.locator('[role="dialog"] button:has(.sr-only:has-text("Close"))');
  }

  /**
   * Navigate to the projects page
   */
  async goto(): Promise<void> {
    await this.page.goto("/projects");
    await this.pageTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Navigate to projects page with a specific page number
   */
  async gotoPage(pageNum: number): Promise<void> {
    await this.page.goto(`/projects?page=${pageNum}`);
    await this.pageTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Get the count of visible project cards
   */
  async getProjectCount(): Promise<number> {
    return this.projectCards.count();
  }

  /**
   * Get project names from visible cards
   */
  async getProjectNames(): Promise<string[]> {
    const cards = await this.projectCards.all();
    const names: string[] = [];
    for (const card of cards) {
      const name = await card.locator("h3").textContent();
      if (name) names.push(name.trim());
    }
    return names;
  }

  /**
   * Get a specific project card by name
   */
  getProjectCard(name: string): Locator {
    return this.projectCards.filter({ has: this.page.locator(`h3:has-text("${name}")`) });
  }

  /**
   * Get a specific project card by index (0-based)
   */
  getProjectCardByIndex(index: number): Locator {
    return this.projectCards.nth(index);
  }

  /**
   * Get the three-dot menu button for a project card
   */
  getThreeDotsMenu(projectCard: Locator): Locator {
    return projectCard.locator('button:has(svg.w-5.h-5)').last();
  }

  /**
   * Open the three-dot menu for a project by name
   */
  async openThreeDotsMenu(projectName: string): Promise<void> {
    const card = this.getProjectCard(projectName);
    const menu = this.getThreeDotsMenu(card);
    await menu.click();
  }

  /**
   * Get dropdown menu items
   */
  getDropdownMenuItem(text: string): Locator {
    return this.page.locator(`[role="menuitem"]:has-text("${text}")`);
  }

  /**
   * Click a dropdown menu item
   */
  async clickDropdownItem(text: string): Promise<void> {
    await this.getDropdownMenuItem(text).click();
  }

  /**
   * Click delete in the dropdown menu
   */
  async clickDeleteInMenu(): Promise<void> {
    await this.clickDropdownItem("Delete");
  }

  /**
   * Click Edit Campaign in the dropdown menu
   */
  async clickEditCampaign(): Promise<void> {
    await this.clickDropdownItem("Edit Campaign");
  }

  /**
   * Click Edit Page in the dropdown menu
   */
  async clickEditPage(): Promise<void> {
    await this.clickDropdownItem("Edit Page");
  }

  /**
   * Click the Delete Project button in the modal
   */
  async confirmDelete(): Promise<void> {
    await this.deleteButton.click();
  }

  /**
   * Click the Keep Project button in the modal
   */
  async cancelDelete(): Promise<void> {
    await this.keepButton.click();
  }

  /**
   * Close the delete modal via the X button
   */
  async closeDeleteModal(): Promise<void> {
    await this.deleteModalCloseButton.click();
  }

  /**
   * Wait for delete modal to be visible
   */
  async waitForDeleteModal(): Promise<void> {
    await expect(this.deleteModalTitle).toBeVisible({ timeout: 5000 });
  }

  /**
   * Wait for delete modal to be hidden
   */
  async waitForDeleteModalHidden(): Promise<void> {
    await expect(this.deleteModal).toBeHidden({ timeout: 5000 });
  }

  /**
   * Check if delete modal shows project preview
   */
  async expectDeleteModalShowsProject(projectName: string): Promise<void> {
    await expect(this.deleteModal.locator(`text=${projectName}`)).toBeVisible();
  }

  /**
   * Click a filter tab and wait for data to load
   */
  async clickFilter(filter: "all" | "live" | "paused" | "draft"): Promise<void> {
    const filterMap = {
      all: this.allFilter,
      live: this.liveFilter,
      paused: this.pausedFilter,
      draft: this.draftFilter,
    };

    // For "all" filter, no API call is made if we're already showing all
    if (filter === "all") {
      await filterMap[filter].click();
      // Small delay for state update
      await this.page.waitForTimeout(300);
      return;
    }

    // For status filters, wait for the API response
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes("/api/v1/projects") && response.status() === 200,
      { timeout: 10000 }
    );

    await filterMap[filter].click();
    await responsePromise;

    // Wait for the loading state to clear (opacity returns to normal)
    await this.page.waitForFunction(() => {
      const list = document.querySelector('.flex.flex-col.gap-5');
      return list && !list.classList.contains('opacity-60');
    }, { timeout: 5000 });
  }

  /**
   * Get the count shown in a filter tab
   */
  async getFilterCount(filter: "all" | "live" | "paused" | "draft"): Promise<number> {
    const filterMap = {
      all: this.allFilter,
      live: this.liveFilter,
      paused: this.pausedFilter,
      draft: this.draftFilter,
    };
    const text = await filterMap[filter].textContent();
    // Extract number from "All (5)" or "Live (2)"
    const match = text?.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Check if a filter is active
   */
  async isFilterActive(filter: "all" | "live" | "paused" | "draft"): Promise<boolean> {
    const filterMap = {
      all: this.allFilter,
      live: this.liveFilter,
      paused: this.pausedFilter,
      draft: this.draftFilter,
    };
    const classes = await filterMap[filter].getAttribute("class");
    return classes?.includes("bg-white") || false;
  }

  /**
   * Navigate to a specific page number via pagination
   */
  async goToPage(pageNum: number): Promise<void> {
    const pageButton = this.page.getByTestId(`pagination-page-${pageNum}`);
    await pageButton.click();
    // Wait for URL to update
    if (pageNum === 1) {
      // Page 1 removes the param
      await this.page.waitForFunction(() => !window.location.search.includes('page='));
    } else {
      await this.page.waitForFunction(
        (expectedPage) => window.location.search.includes(`page=${expectedPage}`),
        pageNum
      );
    }
  }

  /**
   * Click Previous button
   */
  async clickPrevious(): Promise<void> {
    await this.prevButton.click();
    // Wait for content to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Click Next button
   */
  async clickNext(): Promise<void> {
    await this.nextButton.click();
    // Wait for content to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Get current page from URL
   */
  async getCurrentPageFromUrl(): Promise<number> {
    const url = new URL(this.page.url());
    return parseInt(url.searchParams.get("page") || "1", 10);
  }

  /**
   * Get current page from active pagination button
   */
  async getCurrentPage(): Promise<number> {
    const activeButton = this.pagination.locator('[class*="bg-base-500"]');
    const count = await activeButton.count();
    if (count === 0) return 1;
    const text = await activeButton.textContent();
    return parseInt(text || "1", 10);
  }

  /**
   * Check if pagination is visible
   */
  async expectPaginationVisible(): Promise<void> {
    await expect(this.pagination).toBeVisible();
  }

  /**
   * Check if pagination is hidden
   */
  async expectPaginationHidden(): Promise<void> {
    await expect(this.pagination).toBeHidden();
  }

  /**
   * Check if Previous button is disabled
   */
  async expectPreviousDisabled(): Promise<void> {
    await expect(this.prevButtonDisabled).toBeVisible();
  }

  /**
   * Check if Previous button is enabled
   */
  async expectPreviousEnabled(): Promise<void> {
    await expect(this.prevButton).toBeVisible();
  }

  /**
   * Check if Next button is disabled
   */
  async expectNextDisabled(): Promise<void> {
    await expect(this.nextButtonDisabled).toBeVisible();
  }

  /**
   * Check if Next button is enabled
   */
  async expectNextEnabled(): Promise<void> {
    await expect(this.nextButton).toBeVisible();
  }

  /**
   * Check if empty state is visible
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
    await expect(this.emptyStateButton).toBeVisible();
  }

  /**
   * Check if "no projects found" message is visible (for filtered results)
   */
  async expectNoProjectsFound(): Promise<void> {
    await expect(this.noProjectsFoundMessage).toBeVisible();
  }

  /**
   * Click the New Project button
   */
  async clickNewProject(): Promise<void> {
    await this.newProjectButton.click();
  }

  /**
   * Click Customer Leads button on a project card
   */
  async clickCustomerLeads(projectName: string): Promise<void> {
    const card = this.getProjectCard(projectName);
    await card.locator('a:has-text("Customer Leads")').click();
  }

  /**
   * Check if Customer Leads is enabled for a project
   */
  async isCustomerLeadsEnabled(projectName: string): Promise<boolean> {
    const card = this.getProjectCard(projectName);
    const button = card.locator('button:has-text("Customer Leads"), a:has-text("Customer Leads")');
    const tagName = await button.evaluate(el => el.tagName.toLowerCase());
    return tagName === 'a'; // Link means enabled, button means disabled
  }

  /**
   * Get the status of a project from its card
   */
  async getProjectStatus(projectName: string): Promise<string> {
    const card = this.getProjectCard(projectName);
    // Status badge is a span with rounded-full px-3 py-1
    const statusBadge = card.locator('.rounded-full.px-3.py-1');
    const text = await statusBadge.textContent();
    return text?.toLowerCase().trim() || "";
  }

  /**
   * Get the domain link for a project
   */
  async getProjectDomain(projectName: string): Promise<string | null> {
    const card = this.getProjectCard(projectName);
    const link = card.locator('a[href^="https://"]');
    const count = await link.count();
    if (count === 0) return null;
    return await link.getAttribute("href");
  }

  /**
   * Check if domain link opens in new tab
   */
  async domainOpensInNewTab(projectName: string): Promise<boolean> {
    const card = this.getProjectCard(projectName);
    const link = card.locator('a[href^="https://"]');
    const target = await link.getAttribute("target");
    return target === "_blank";
  }

  /**
   * Wait for project list to finish loading (opacity returns to normal)
   */
  async waitForLoadComplete(): Promise<void> {
    // Wait for opacity class to be removed (loading state)
    await this.page.waitForFunction(() => {
      const list = document.querySelector('.flex.flex-col.gap-5');
      return list && !list.classList.contains('opacity-60');
    }, { timeout: 10000 });
  }

  /**
   * Check total projects count text
   */
  async getTotalProjectsCount(): Promise<number> {
    const text = await this.totalProjectsText.textContent();
    const match = text?.match(/(\d+)\s+total/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
