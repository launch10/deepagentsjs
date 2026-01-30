import { test, expect, loginUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { ProjectsPage } from "../pages/projects.page";

/**
 * Projects Page Tests
 *
 * Tests the projects listing page functionality including:
 * - Pagination (next, previous, page numbers)
 * - Status filtering (All, Live, Paused, Draft)
 * - Empty state display
 * - Project card display
 * - Three-dot menu navigation
 * - Project deletion
 * - Customer Leads button behavior
 * - Domain link behavior
 *
 * Snapshots used:
 * - analytics/empty_account: 0 projects (empty state)
 * - website_deployed: 1 live project (single project edge case)
 * - projects/mixed_statuses: 4 projects (2 live, 1 paused, 1 draft)
 * - projects/multiple_pages: 8 projects (pagination testing)
 */
test.describe("Projects Page", () => {
  let projectsPage: ProjectsPage;

  test.describe("With Multiple Pages (projects/multiple_pages)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("projects/multiple_pages");
      await loginUser(page);
      projectsPage = new ProjectsPage(page);
    });

    test("displays projects page structure correctly", async ({ page }) => {
      await projectsPage.goto();

      await expect(projectsPage.pageTitle).toContainText("Your Projects");
      await expect(projectsPage.newProjectButton).toBeVisible();
      await expect(projectsPage.allFilter).toBeVisible();
      await expect(projectsPage.liveFilter).toBeVisible();
      await expect(projectsPage.pausedFilter).toBeVisible();
      await expect(projectsPage.draftFilter).toBeVisible();
    });

    test("shows correct total project count", async () => {
      await projectsPage.goto();

      const count = await projectsPage.getTotalProjectsCount();
      expect(count).toBe(8);
    });

    test("displays 5 projects per page (first page)", async () => {
      await projectsPage.goto();

      const count = await projectsPage.getProjectCount();
      expect(count).toBe(5);
    });

    test.describe("Pagination", () => {
      test("shows pagination controls when more than 5 projects", async () => {
        await projectsPage.goto();

        await projectsPage.expectPaginationVisible();
      });

      test("Previous is disabled on first page", async () => {
        await projectsPage.goto();

        await projectsPage.expectPreviousDisabled();
      });

      test("Next button is enabled on first page", async () => {
        await projectsPage.goto();

        await projectsPage.expectNextEnabled();
      });

      test("Next button navigates to page 2", async () => {
        await projectsPage.goto();

        await projectsPage.clickNext();
        const currentPage = await projectsPage.getCurrentPage();
        expect(currentPage).toBe(2);
      });

      test("page 2 shows remaining projects", async () => {
        await projectsPage.goto();
        await projectsPage.clickNext();

        const count = await projectsPage.getProjectCount();
        expect(count).toBe(3); // 8 total - 5 on page 1 = 3 on page 2
      });

      test("Next is disabled on last page", async () => {
        await projectsPage.goto();
        await projectsPage.clickNext();

        await projectsPage.expectNextDisabled();
      });

      test("Previous works on page 2", async () => {
        await projectsPage.goto();
        await projectsPage.clickNext();
        await projectsPage.clickPrevious();

        const currentPage = await projectsPage.getCurrentPage();
        expect(currentPage).toBe(1);
      });

      test("clicking page number navigates directly", async () => {
        await projectsPage.goto();

        await projectsPage.goToPage(2);
        const currentPage = await projectsPage.getCurrentPage();
        expect(currentPage).toBe(2);
      });

      test("URL updates with page parameter", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.clickNext();

        expect(page.url()).toContain("page=2");
      });

      test("URL removes page parameter on page 1", async ({ page }) => {
        await projectsPage.gotoPage(2);
        await projectsPage.goToPage(1);

        expect(page.url()).not.toContain("page=");
      });

      test("browser back/forward maintains page", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.clickNext();

        await page.goBack();
        await page.waitForLoadState("domcontentloaded");

        const currentPage = await projectsPage.getCurrentPage();
        expect(currentPage).toBe(1);
      });
    });

    test.describe("Status Filtering", () => {
      test("filter tabs show correct counts", async () => {
        await projectsPage.goto();

        // Multiple pages snapshot has: 4 live, 2 paused, 2 draft
        const allCount = await projectsPage.getFilterCount("all");
        const liveCount = await projectsPage.getFilterCount("live");
        const pausedCount = await projectsPage.getFilterCount("paused");
        const draftCount = await projectsPage.getFilterCount("draft");

        expect(allCount).toBe(8);
        expect(liveCount).toBe(4);
        expect(pausedCount).toBe(2);
        expect(draftCount).toBe(2);
      });

      test("All filter is active by default", async () => {
        await projectsPage.goto();

        const isActive = await projectsPage.isFilterActive("all");
        expect(isActive).toBe(true);
      });

      test("clicking Live filter shows only live projects", async () => {
        await projectsPage.goto();
        await projectsPage.clickFilter("live");

        const count = await projectsPage.getProjectCount();
        expect(count).toBe(4);
      });

      test("clicking Paused filter shows only paused projects", async () => {
        await projectsPage.goto();
        await projectsPage.clickFilter("paused");

        const count = await projectsPage.getProjectCount();
        expect(count).toBe(2);
      });

      test("clicking Draft filter shows only draft projects", async () => {
        await projectsPage.goto();
        await projectsPage.clickFilter("draft");

        const count = await projectsPage.getProjectCount();
        expect(count).toBe(2);
      });

      test("filter resets pagination to page 1", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.clickNext(); // Go to page 2

        await projectsPage.clickFilter("live");

        const currentPage = await projectsPage.getCurrentPage();
        expect(currentPage).toBe(1);
        expect(page.url()).not.toContain("page=");
      });

      test("pagination hidden when filtered results fit on one page", async () => {
        await projectsPage.goto();
        await projectsPage.clickFilter("paused");

        // 2 paused projects fit on one page, no pagination needed
        await projectsPage.expectPaginationHidden();
      });
    });

    test.describe("Deletion with Pagination", () => {
      test("deleting project updates pagination correctly", async () => {
        await projectsPage.goto();

        const totalBefore = await projectsPage.getTotalProjectsCount();
        expect(totalBefore).toBe(8);

        const names = await projectsPage.getProjectNames();
        const projectToDelete = names[0];

        await projectsPage.openThreeDotsMenu(projectToDelete);
        await projectsPage.clickDeleteInMenu();
        await projectsPage.waitForDeleteModal();

        await projectsPage.confirmDelete();
        await projectsPage.waitForDeleteModalHidden();

        await projectsPage.page.waitForTimeout(1000);

        const totalAfter = await projectsPage.getTotalProjectsCount();
        expect(totalAfter).toBe(7);
      });
    });
  });

  test.describe("With Mixed Statuses (projects/mixed_statuses)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("projects/mixed_statuses");
      await loginUser(page);
      projectsPage = new ProjectsPage(page);
    });

    test("displays all 4 projects on one page", async () => {
      await projectsPage.goto();

      const count = await projectsPage.getProjectCount();
      expect(count).toBe(4);
    });

    test("pagination hidden with 4 or fewer projects", async () => {
      await projectsPage.goto();

      await projectsPage.expectPaginationHidden();
    });

    test("filter counts match project statuses", async () => {
      await projectsPage.goto();

      // Mixed statuses: 2 live, 1 paused, 1 draft
      const liveCount = await projectsPage.getFilterCount("live");
      const pausedCount = await projectsPage.getFilterCount("paused");
      const draftCount = await projectsPage.getFilterCount("draft");

      expect(liveCount).toBe(2);
      expect(pausedCount).toBe(1);
      expect(draftCount).toBe(1);
    });

    test.describe("Three-Dot Menu", () => {
      test("opens dropdown with menu items", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");

        await expect(projectsPage.getDropdownMenuItem("Edit Campaign")).toBeVisible();
        await expect(projectsPage.getDropdownMenuItem("Edit Page")).toBeVisible();
        await expect(projectsPage.getDropdownMenuItem("Delete")).toBeVisible();
      });

      test("Edit Campaign navigates to campaign editor", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickEditCampaign();

        await page.waitForURL(/\/projects\/[\w-]+\/campaigns/);
      });

      test("Edit Page navigates to website editor", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickEditPage();

        await page.waitForURL(/\/projects\/[\w-]+\/website/);
      });

      test("dropdown closes on Escape", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");

        await page.keyboard.press("Escape");

        await expect(projectsPage.getDropdownMenuItem("Edit Campaign")).toBeHidden();
      });
    });

    test.describe("Delete Modal", () => {
      test("clicking Delete opens confirmation modal", async () => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();

        await projectsPage.waitForDeleteModal();
        await expect(projectsPage.deleteModalTitle).toBeVisible();
      });

      test("modal shows project preview with name", async () => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();

        await projectsPage.waitForDeleteModal();
        await projectsPage.expectDeleteModalShowsProject("Active Marketing Site");
      });

      test("modal shows warning message about permanent deletion", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();

        await projectsPage.waitForDeleteModal();
        await expect(
          page.getByText(/permanently delete your landing page, ad campaign data/i)
        ).toBeVisible();
        await expect(page.getByText(/cannot be undone/i)).toBeVisible();
      });

      test("modal has Delete Project and Keep Project buttons", async () => {
        await projectsPage.goto();
        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();

        await projectsPage.waitForDeleteModal();
        await expect(projectsPage.deleteButton).toBeVisible();
        await expect(projectsPage.keepButton).toBeVisible();
      });

      test("Keep Project closes modal without deleting", async () => {
        await projectsPage.goto();
        const initialCount = await projectsPage.getProjectCount();

        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();
        await projectsPage.waitForDeleteModal();

        await projectsPage.cancelDelete();
        await projectsPage.waitForDeleteModalHidden();

        const finalCount = await projectsPage.getProjectCount();
        expect(finalCount).toBe(initialCount);
      });

      test("Delete Project removes project from list", async () => {
        await projectsPage.goto();
        const initialCount = await projectsPage.getProjectCount();

        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();
        await projectsPage.waitForDeleteModal();

        await projectsPage.confirmDelete();
        await projectsPage.waitForDeleteModalHidden();

        await projectsPage.page.waitForTimeout(1000);

        const finalCount = await projectsPage.getProjectCount();
        expect(finalCount).toBe(initialCount - 1);
      });

      test("deleted project no longer appears in list", async () => {
        await projectsPage.goto();

        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();
        await projectsPage.waitForDeleteModal();

        await projectsPage.confirmDelete();
        await projectsPage.waitForDeleteModalHidden();

        await projectsPage.page.waitForTimeout(1000);

        const names = await projectsPage.getProjectNames();
        expect(names).not.toContain("Active Marketing Site");
      });

      test("close button (X) closes modal without deleting", async () => {
        await projectsPage.goto();
        const initialCount = await projectsPage.getProjectCount();

        await projectsPage.openThreeDotsMenu("Active Marketing Site");
        await projectsPage.clickDeleteInMenu();
        await projectsPage.waitForDeleteModal();

        await projectsPage.closeDeleteModal();
        await projectsPage.waitForDeleteModalHidden();

        const finalCount = await projectsPage.getProjectCount();
        expect(finalCount).toBe(initialCount);
      });
    });

    test.describe("Customer Leads Button", () => {
      test("enabled for live projects", async () => {
        await projectsPage.goto();

        const isEnabled = await projectsPage.isCustomerLeadsEnabled("Active Marketing Site");
        expect(isEnabled).toBe(true);
      });

      test("disabled for draft projects", async () => {
        await projectsPage.goto();

        const isEnabled = await projectsPage.isCustomerLeadsEnabled("New Project Idea");
        expect(isEnabled).toBe(false);
      });

      test("disabled for paused projects", async () => {
        await projectsPage.goto();

        const isEnabled = await projectsPage.isCustomerLeadsEnabled("Seasonal Campaign");
        expect(isEnabled).toBe(false);
      });

      test("navigates to leads page for live project", async ({ page }) => {
        await projectsPage.goto();
        await projectsPage.clickCustomerLeads("Active Marketing Site");

        await page.waitForURL(/\/projects\/[\w-]+\/leads/);
      });
    });

    test.describe("Domain Links", () => {
      test("live project shows domain link", async () => {
        await projectsPage.goto();

        const domain = await projectsPage.getProjectDomain("Active Marketing Site");
        expect(domain).not.toBeNull();
        expect(domain).toContain("https://");
      });

      test("domain link opens in new tab", async () => {
        await projectsPage.goto();

        const opensInNewTab = await projectsPage.domainOpensInNewTab("Active Marketing Site");
        expect(opensInNewTab).toBe(true);
      });

      test("draft project shows 'No site connected'", async ({ page }) => {
        await projectsPage.goto();

        const card = projectsPage.getProjectCard("New Project Idea");
        await expect(card.getByText("No site connected")).toBeVisible();
      });
    });

    test.describe("Project Card Information", () => {
      test("cards show status badges", async ({ page }) => {
        await projectsPage.goto();

        const liveCard = projectsPage.getProjectCard("Active Marketing Site");
        await expect(liveCard.getByText("Live")).toBeVisible();

        const pausedCard = projectsPage.getProjectCard("Seasonal Campaign");
        await expect(pausedCard.getByText("Paused")).toBeVisible();

        const draftCard = projectsPage.getProjectCard("New Project Idea");
        await expect(draftCard.getByText("Draft")).toBeVisible();
      });

      test("cards show timestamps", async ({ page }) => {
        await projectsPage.goto();

        const card = projectsPage.getProjectCard("Active Marketing Site");
        await expect(card.getByText(/Edited/i)).toBeVisible();
        await expect(card.getByText(/Created/i)).toBeVisible();
      });

      test("Performance button is disabled", async ({ page }) => {
        await projectsPage.goto();

        const card = projectsPage.getProjectCard("Active Marketing Site");
        const performanceButton = card.locator('button:has-text("Performance")');
        await expect(performanceButton).toBeVisible();
        await expect(performanceButton).toBeDisabled();
      });
    });

    test.describe("Status Badge Colors", () => {
      test("Live badge has success styling", async ({ page }) => {
        await projectsPage.goto();

        const card = projectsPage.getProjectCard("Active Marketing Site");
        const badge = card.locator(".rounded-full.px-3.py-1");
        const classes = await badge.getAttribute("class");
        expect(classes).toContain("bg-success");
      });

      test("Paused badge has warning styling", async ({ page }) => {
        await projectsPage.goto();

        const card = projectsPage.getProjectCard("Seasonal Campaign");
        const badge = card.locator(".rounded-full.px-3.py-1");
        const classes = await badge.getAttribute("class");
        expect(classes).toContain("bg-accent-yellow");
      });

      test("Draft badge has neutral styling", async ({ page }) => {
        await projectsPage.goto();

        const card = projectsPage.getProjectCard("New Project Idea");
        const badge = card.locator(".rounded-full.px-3.py-1");
        const classes = await badge.getAttribute("class");
        expect(classes).toContain("bg-neutral");
      });
    });
  });

  test.describe("With Single Project (website_deployed)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_deployed");
      await loginUser(page);
      projectsPage = new ProjectsPage(page);
    });

    test("displays single project", async () => {
      await projectsPage.goto();

      const count = await projectsPage.getProjectCount();
      expect(count).toBe(1);
    });

    test("pagination not shown with single project", async () => {
      await projectsPage.goto();

      await projectsPage.expectPaginationHidden();
    });

    test("project name is visible", async () => {
      await projectsPage.goto();

      const names = await projectsPage.getProjectNames();
      expect(names).toContain("Test Project");
    });

    test("project has live status badge", async () => {
      await projectsPage.goto();

      const status = await projectsPage.getProjectStatus("Test Project");
      expect(status).toBe("live");
    });

    test("deleting last project shows empty state", async () => {
      await projectsPage.goto();

      expect(await projectsPage.getProjectCount()).toBe(1);

      await projectsPage.openThreeDotsMenu("Test Project");
      await projectsPage.clickDeleteInMenu();
      await projectsPage.waitForDeleteModal();

      await projectsPage.confirmDelete();
      await projectsPage.waitForDeleteModalHidden();

      await projectsPage.page.waitForTimeout(1000);

      await projectsPage.expectEmptyState();
    });
  });

  test.describe("Empty State (analytics/empty_account)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("analytics/empty_account");
      await loginUser(page);
      projectsPage = new ProjectsPage(page);
    });

    test("shows empty state when no projects", async () => {
      await projectsPage.goto();

      await projectsPage.expectEmptyState();
    });

    test("shows helpful empty state message", async ({ page }) => {
      await projectsPage.goto();

      await expect(page.getByText("No projects yet")).toBeVisible();
      await expect(
        page.getByText(/Create your first landing page and ad campaign/i)
      ).toBeVisible();
    });

    test("shows Create Your First Project button", async () => {
      await projectsPage.goto();

      await expect(projectsPage.emptyStateButton).toBeVisible();
    });

    test("Create Your First Project navigates to new project page", async ({ page }) => {
      await projectsPage.goto();
      await projectsPage.emptyStateButton.click();

      await page.waitForURL("**/projects/new");
    });

    test("pagination not shown in empty state", async () => {
      await projectsPage.goto();

      await projectsPage.expectPaginationHidden();
    });

    test("project count is zero", async () => {
      await projectsPage.goto();

      const count = await projectsPage.getProjectCount();
      expect(count).toBe(0);
    });
  });

  test.describe("New Project Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_deployed");
      await loginUser(page);
      projectsPage = new ProjectsPage(page);
    });

    test("New Project button is visible", async () => {
      await projectsPage.goto();

      await expect(projectsPage.newProjectButton).toBeVisible();
    });

    test("New Project button navigates to /projects/new", async ({ page }) => {
      await projectsPage.goto();
      await projectsPage.clickNewProject();

      await page.waitForURL("**/projects/new");
    });
  });
});
