import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { LeadsPage } from "./pages/leads.page";

/**
 * Leads Page Tests
 *
 * These tests verify the Customer Leads page functionality.
 * Uses database snapshots for different test scenarios.
 */
test.describe("Leads Page", () => {
  let leadsPage: LeadsPage;
  let projectUuid: string;

  test.describe("With Leads (website_deployed snapshot)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_deployed");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      await loginUser(page);
      leadsPage = new LeadsPage(page);
    });

    test("displays table with correct headers", async () => {
      await leadsPage.goto(projectUuid);

      await expect(leadsPage.table).toBeVisible();
      await leadsPage.expectCorrectHeaders();
    });

    test("displays Customer Leads title and project name", async () => {
      await leadsPage.goto(projectUuid);

      await expect(leadsPage.pageTitle).toHaveText("Customer Leads");
    });

    test("shows leads in the table", async ({ page }) => {
      await leadsPage.goto(projectUuid);

      const leadCount = await leadsPage.getLeadCount();
      expect(leadCount).toBe(20); // First page should have 20 leads
    });

    test("displays dash for leads without names", async () => {
      await leadsPage.goto(projectUuid);

      const hasNullDisplay = await leadsPage.hasNullNameDisplay();
      expect(hasNullDisplay).toBe(true);
    });

    test("shows enabled Export CSV button", async () => {
      await leadsPage.goto(projectUuid);

      await leadsPage.expectExportEnabled();
    });

    test("downloads CSV with correct data", async ({ page }) => {
      await leadsPage.goto(projectUuid);

      // Set up download handler before clicking
      const downloadPromise = page.waitForEvent("download");
      await leadsPage.clickExport();
      const download = await downloadPromise;

      // Verify the filename format (e.g., "test-project-leads-2026-01-27.csv")
      expect(download.suggestedFilename()).toMatch(/.*-leads-\d{4}-\d{2}-\d{2}\.csv$/);

      // Read and verify contents
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString("utf-8");

      // Verify CSV structure
      const lines = content.trim().split("\n");
      expect(lines[0]).toBe("Name,Email,Date");
      expect(lines.length).toBe(26); // Header + 25 leads

      // Verify data row format (CSV may have quoted fields)
      const dataRow = lines[1];
      expect(dataRow).toMatch(/@/); // Contains email
      expect(dataRow).toMatch(/\w{3} \d{1,2}/); // Date like "Jan 26"
    });

    test.describe("Pagination", () => {
      test("shows pagination controls", async () => {
        await leadsPage.goto(projectUuid);

        await leadsPage.expectPaginationVisible();
      });

      test("Previous is disabled on first page", async () => {
        await leadsPage.goto(projectUuid);

        await leadsPage.expectPreviousDisabled();
      });

      test("Next button navigates to page 2", async () => {
        await leadsPage.goto(projectUuid);

        await leadsPage.clickNext();
        const currentPage = await leadsPage.getCurrentPage();
        expect(currentPage).toBe(2);
      });

      test("page 2 shows remaining leads", async ({ page }) => {
        await leadsPage.goto(projectUuid);
        await leadsPage.clickNext();

        const leadCount = await leadsPage.getLeadCount();
        expect(leadCount).toBe(5); // 25 total - 20 on page 1 = 5 on page 2
      });

      test("Next is disabled on last page", async () => {
        await leadsPage.goto(projectUuid);
        await leadsPage.clickNext();

        await leadsPage.expectNextDisabled();
      });

      test("Previous works on page 2", async () => {
        await leadsPage.goto(projectUuid);
        await leadsPage.clickNext();
        await leadsPage.clickPrevious();

        const currentPage = await leadsPage.getCurrentPage();
        expect(currentPage).toBe(1);
      });

      test("clicking page number navigates directly", async ({ page }) => {
        await leadsPage.goto(projectUuid);

        await leadsPage.goToPage(2);
        const currentPage = await leadsPage.getCurrentPage();
        expect(currentPage).toBe(2);
      });
    });
  });

  test.describe("Empty State (website_step snapshot)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;
      await loginUser(page);
      leadsPage = new LeadsPage(page);
    });

    test("shows empty state when no leads", async () => {
      await leadsPage.goto(projectUuid);

      await leadsPage.expectEmptyState();
    });

    test("shows table headers even with no leads", async () => {
      await leadsPage.goto(projectUuid);

      await expect(leadsPage.table).toBeVisible();
      await leadsPage.expectCorrectHeaders();
    });

    test("Export CSV button is disabled with no leads", async () => {
      await leadsPage.goto(projectUuid);

      await leadsPage.expectExportDisabled();
    });

    test("pagination controls are disabled with no leads", async () => {
      await leadsPage.goto(projectUuid);

      await leadsPage.expectPreviousDisabled();
      await leadsPage.expectNextDisabled();
    });

    test("shows helpful message in empty state", async ({ page }) => {
      await leadsPage.goto(projectUuid);

      await expect(page.getByText("No leads yet")).toBeVisible();
      await expect(page.getByText(/recently launched.*not received any leads/i)).toBeVisible();
    });
  });

  // TODO: Once we have the projects page
  // test.describe("Navigation", () => {
  //   test.beforeEach(async ({ page }) => {
  //     await DatabaseSnapshotter.restoreSnapshot("website_step");
  //     const project = await DatabaseSnapshotter.getFirstProject();
  //     projectUuid = project.uuid;
  //     await loginUser(page);
  //     leadsPage = new LeadsPage(page);
  //   });

  //   test("back link navigates to projects", async ({ page }) => {
  //     await leadsPage.goto(projectUuid);

  //     await leadsPage.backLink.click();
  //     await page.waitForURL(`**/projects/${projectUuid}/website`);
  //   });
  // });
});
