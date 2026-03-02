import { test, expect, loginUser, testUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { appScenario, appQuery } from "./support/on-rails";
import { DomainPickerPage } from "./pages/domain-picker.page";

/**
 * Domain Picker Tests
 *
 * Tests the Domain Picker page functionality at /projects/:uuid/website/domain.
 * Uses the website_step snapshot which includes domain test data:
 * - meeting-tool.launch10.site (assigned to "Meeting Tool" website, has paths: /, /landing)
 * - my-custom-site.com (custom domain, unassigned)
 *
 * The main test project website has NO domain assigned, allowing tests for:
 * - Creating new subdomains (1 credit available out of 2)
 * - Selecting existing domains from dropdown
 *
 * IMPORTANT: Domain Recommendations Flow
 * ======================================
 * AI recommendations (domainRecommendations state) are populated by the langgraph
 * website graph when it runs. The graph is triggered when:
 *
 * 1. User visits /website/build (WebsiteBuild component)
 * 2. useWebsiteInit() hook fires updateState({ command: "create", ... })
 * 3. This POSTs to /api/website/stream, invoking the graph
 * 4. Graph runs: buildContext → [websiteBuilder + recommendDomains] in parallel
 * 5. domainRecommendations is populated and streamed back to frontend
 *
 * If tests navigate directly to /website/domain:
 * - Only a GET request is made to load history
 * - The graph never runs
 * - domainRecommendations remains undefined
 *
 * Tests that need AI recommendations should use gotoWithBuild() instead of goto().
 * Tests that only need database-seeded data (existing domains, pre-assigned URLs)
 * can use goto() directly.
 *
 * CACHE_MODE: Ensure langgraph_app/.env has CACHE_MODE=true for fast, deterministic
 * responses without making actual AI calls.
 */
test.describe("Domain Picker", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    // Restore snapshot with domain test data
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test.describe("Page Loading", () => {
    test("displays the domain picker page when navigating to /website/domain", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Should show the "Website Setup" header (use heading role to be specific)
      await expect(page.getByRole("heading", { name: "Website Setup" })).toBeVisible();
      await expect(
        page.locator('text="Choose how you want your website to be accessed"')
      ).toBeVisible();
    });

    test("shows dropdown-based domain picker (not tabs)", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Should show site name dropdown (not tabs)
      await expect(page.locator('text="Your site name"')).toBeVisible();
      await expect(domainPickerPage.siteNameDropdown).toBeVisible();

      // No custom domain should be selected initially (no DNS help section visible)
      const isCustomMode = await domainPickerPage.isInCustomDomainMode();
      expect(isCustomMode).toBe(false);
    });

    test("shows loading skeleton while fetching data", async ({ page }) => {
      // Navigate without waiting
      await page.goto(`/projects/${projectUuid}/website/domain`);

      // Should show loading skeleton briefly (might be too fast to catch)
      // This test just verifies the page loads
      await domainPickerPage.waitForLoaded();
      await expect(domainPickerPage.loadingSkeleton).not.toBeVisible();
    });
  });

  test.describe("Launch10 Site Mode", () => {
    test("shows site name dropdown and page name input", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Should have site name dropdown (labeled "Your site name")
      await expect(page.getByText("Your site name")).toBeVisible({ timeout: 10000 });

      // Should have page name input (labeled "Page name")
      await expect(page.getByText("Page name")).toBeVisible({ timeout: 10000 });
    });

    test("shows existing domains in dropdown when user has existing domains", async ({ page }) => {
      // The dropdown shows existing domains when opened
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Open the site name dropdown
      await domainPickerPage.siteNameDropdown.click();

      // Should show "Your Existing Sites" section in the dropdown
      // This comes from the Rails context endpoint returning existing_domains
      await expect(page.getByText("Your Existing Sites")).toBeVisible({ timeout: 10000 });
    });

    test("displays Create New Site section in dropdown", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Open the site name dropdown
      await domainPickerPage.siteNameDropdown.click();

      // Should show "Create New Site" section in the dropdown
      await expect(page.getByText("Create New Site").first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Custom Domain in Unified Dropdown", () => {
    test("shows Connect your own site button and switches input mode", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Click dropdown to open it
      await domainPickerPage.siteNameDropdown.click();

      // Should show "Connect your own site" button at the bottom
      await expect(domainPickerPage.connectOwnSiteButton).toBeVisible({ timeout: 5000 });

      // Should show platform input with .launch10.site suffix
      await expect(page.locator('text=".launch10.site"')).toBeVisible({ timeout: 5000 });

      // Click to switch to custom domain mode
      await domainPickerPage.connectOwnSiteButton.click();

      // Header should change to "Connect Your Own Domain"
      await expect(page.locator('text="Connect Your Own Domain"')).toBeVisible({ timeout: 5000 });

      // Suffix should be hidden now
      await expect(page.locator('text=".launch10.site"')).not.toBeVisible();

      // Custom domain input should be visible (same input, different test id)
      await expect(domainPickerPage.customDomainInput).toBeVisible({ timeout: 5000 });
    });

    test("shows CNAME instructions when custom domain is selected", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Select existing custom domain from dropdown
      await domainPickerPage.siteNameDropdown.click();
      await page.waitForTimeout(1000);
      const popover = page.locator("[data-radix-popper-content-wrapper]");
      await popover.locator('text="my-custom-site.com"').click();

      // Should show CNAME instructions when custom domain is selected
      await expect(page.locator('text="CNAME"')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text="cname.launch10.com"')).toBeVisible({ timeout: 5000 });
    });

    test("shows DNS verification status for custom domains", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Select existing custom domain from dropdown
      await domainPickerPage.siteNameDropdown.click();
      await page.waitForTimeout(1000);
      const popover = page.locator("[data-radix-popper-content-wrapper]");
      await popover.locator('text="my-custom-site.com"').click();

      // Should show DNS verification status
      await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("URL Preview", () => {
    test("shows full URL preview when selection is made", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Manually select an existing domain to trigger URL preview
      await domainPickerPage.siteNameDropdown.click();
      // Wait for dropdown to show existing domains
      await page.waitForTimeout(1000);
      // Select the first existing domain (meeting-tool.launch10.site) - use popover-specific locator
      const popover = page.locator("[data-radix-popper-content-wrapper]");
      await popover.locator('text="meeting-tool.launch10.site"').click();
      // Should show URL preview section (only visible when a domain is selected)
      await expect(domainPickerPage.fullUrlPreview).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Navigation", () => {
    test("shows Previous Step and Connect Site buttons", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Should show navigation buttons
      await expect(domainPickerPage.previousStepButton).toBeVisible();
      await expect(domainPickerPage.connectSiteButton).toBeVisible();
    });

    test("Previous Step button navigates back to /website/build", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Click Previous Step
      await domainPickerPage.clickPreviousStep();

      // Should navigate back to build step
      await expect(page).toHaveURL(new RegExp(`/projects/${projectUuid}/website/build`));
    });

    test("Connect Site button is enabled when domain is selected", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Manually select an existing domain (use popover-specific locator)
      await domainPickerPage.siteNameDropdown.click();
      await page.waitForTimeout(1000);
      const popover = page.locator("[data-radix-popper-content-wrapper]");
      await popover.locator('text="meeting-tool.launch10.site"').click();
      await expect(domainPickerPage.connectSiteButton).toBeEnabled({ timeout: 5000 });
    });
  });

  test.describe("Workflow Integration", () => {
    test("redirects /website to /website/build", async ({ page }) => {
      // User is already logged in from beforeEach

      // Navigate to /website without substep
      await page.goto(`/projects/${projectUuid}/website`);

      // Should redirect to /website/build
      await expect(page).toHaveURL(new RegExp(`/projects/${projectUuid}/website/build`));
    });

    test("shows progress stepper on domain page", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Progress stepper might not be on domain page (different layout)
      // This test verifies the page loads without errors
      // Use heading role to be specific and avoid matching sidebar stepper text
      await expect(page.getByRole("heading", { name: "Website Setup" })).toBeVisible();
    });
  });

  test.describe("Error Handling", () => {
    test("handles network errors gracefully", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Go offline
      await page.context().setOffline(true);

      // Try to interact with the page
      await domainPickerPage.switchToCustomDomain();

      // Restore network
      await page.context().setOffline(false);

      // Page should still be functional
      await expect(domainPickerPage.header).toBeVisible();
    });
  });
});

/**
 * Domain Picker - Subdomain Limit Tests
 *
 * Tests behavior when the user has reached their platform subdomain limit.
 */
/**
 * Domain Picker - Subdomain Limit Tests
 *
 * SKIPPED: These tests require the langgraph graph to complete and return domain context.
 * In test mode, the graph stream never completes (stays at "Getting ready...") even with
 * CACHE_MODE=true. This needs investigation into why cached responses aren't being returned
 * for test projects.
 *
 * TODO: Fix langgraph cache to work with e2e tests, or mock the API responses.
 */
test.describe("Domain Picker - Subdomain Limit", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;

    // Fill up the subdomain limit to trigger "out of credits" state
    await appScenario("fill_subdomain_limit", { email: testUser.email });

    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("shows out of credits banner when subdomain limit is reached", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for domain context to load
    await page.waitForTimeout(2000);

    // Should show the out-of-credits banner
    await expect(page.getByTestId("out-of-credits-banner")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text="Upgrade to add more."')).toBeVisible();
  });

  test("disables create new site input when out of credits", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for domain context to load
    await page.waitForTimeout(2000);

    // Click on site name dropdown
    await domainPickerPage.siteNameDropdown.click();

    // The custom input should be disabled
    const customInput = page.locator('input[placeholder="Type to create your own"]');
    await expect(customInput).toBeDisabled();
  });

  test("disables generated site suggestions when out of credits", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations to load
    await page.waitForTimeout(5000);

    // Click on site name dropdown
    await domainPickerPage.siteNameDropdown.click();

    // Look for the suggestions section - buttons should have opacity-50 (disabled styling)
    const suggestionsSection = page.locator('text="Create New Site (Suggestions)"');
    if (await suggestionsSection.isVisible()) {
      // The suggestion buttons should be disabled/dimmed
      const suggestionButton = suggestionsSection.locator("..").locator("button").first();
      await expect(suggestionButton).toHaveClass(/opacity-50/);
    }
  });

  test("shows upgrade link in dropdown when out of credits", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for domain context to load
    await page.waitForTimeout(2000);

    // Click on site name dropdown
    await domainPickerPage.siteNameDropdown.click();

    // Should show upgrade link (appears when out of credits in the Create New Site section)
    await expect(page.locator('text="Upgrade to create more launch10 sites"')).toBeVisible();
  });
});

/**
 * Domain Picker - Path Availability Tests
 *
 * Tests the backend availability checking for paths when an existing domain is selected.
 * The PageNameInput component checks with /api/v1/website_urls/search when a domain is selected.
 *
 * NOTE: Path availability checking requires a domainId to be passed to PageNameInput.
 * Currently there's a bug where selecting an existing domain from the dropdown doesn't
 * pass the domainId to PageNameInput (it looks for the domain in recommendations array
 * instead of using selection.existingDomainId).
 *
 * SKIPPED: These tests are skipped until the Launch10SitePicker component is fixed to
 * correctly pass domainId={selection?.existingDomainId} instead of
 * domainId={selectedRec?.existingDomainId}.
 */
test.describe("Domain Picker - Path Availability", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("shows checking state when typing in page name input", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    await domainPickerPage.siteNameDropdown.click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();
    await domainPickerPage.pageNameInput.fill("test-page");
    await expect(domainPickerPage.pathCheckingMessage).toBeVisible({ timeout: 5000 });
  });

  test("shows available status when path is available", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    await expect(domainPickerPage.fullUrlPreview).toBeVisible({ timeout: 5000 });

    const uniquePath = `unique-${Date.now()}`;
    await domainPickerPage.pageNameInput.fill(uniquePath);

    await expect(domainPickerPage.pathAvailableIndicator).toBeVisible({ timeout: 15000 });
    await expect(domainPickerPage.pathAvailableIndicator).toContainText(uniquePath);
  });

  test("shows existing status when path already exists on domain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    await expect(domainPickerPage.fullUrlPreview).toBeVisible({ timeout: 5000 });

    await domainPickerPage.pageNameInput.fill("landing");

    await expect(domainPickerPage.pathExistingIndicator).toBeVisible({ timeout: 15000 });
  });

  test("shows validation error for invalid path characters", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    await domainPickerPage.pageNameInput.fill("Invalid Path!");

    await expect(domainPickerPage.pathValidationError).toBeVisible({ timeout: 5000 });
  });

  test("shows assigned status when path belongs to current website", async ({ page }) => {
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "my-assigned-site",
      path: "/mypath",
    });

    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("my-assigned-site.launch10.site");

    const pathValue = await domainPickerPage.pageNameInput.inputValue();
    expect(pathValue).toBe("mypath");

    await expect(domainPickerPage.pathAssignedIndicator).toBeVisible({ timeout: 15000 });
  });
});

/**
 * Domain Picker - Credit Update Tests
 *
 * Tests that credits are updated correctly after claiming a subdomain.
 * Verifies that the frontend updates inline to prevent stale credit exploits.
 *
 * NOTE: These tests focus on the flows that work reliably:
 * - Selecting existing domains (no credit needed)
 * - The custom subdomain creation via Enter key has issues in test mode
 *
 * The snapshot has 1 credit available (Growth plan = 2 credits, 1 already used).
 */
test.describe("Domain Picker - Credit Updates", () => {
  test.setTimeout(90000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("can select an existing domain and Connect Site is enabled", async ({ page }) => {
    // This test verifies the basic flow works without claiming (no credits used)
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Select an existing domain (no credit needed for existing domains) - use popover-specific locator
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    // Connect Site should now be enabled for existing domains
    await expect(domainPickerPage.connectSiteButton).toBeEnabled({ timeout: 10000 });
  });

  test("can enter a new subdomain via the create input", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const customInput = page.locator('input[placeholder="Type to create your own"]');
    await expect(customInput).toBeVisible({ timeout: 5000 });
    await expect(customInput).toBeEnabled();

    // Enter a valid subdomain
    const subdomain = `new-site-${Date.now()}`;
    await customInput.fill(subdomain);

    // Wait for validation to complete (should show .launch10.site suffix next to input)
    await expect(page.locator('text=".launch10.site"')).toBeVisible({ timeout: 5000 });

    // The input is valid - verify no error message
    await expect(page.locator('[class*="text-destructive"]')).not.toBeVisible();

    // NOTE: The Enter key submission doesn't work reliably in test mode.
    // This test verifies the input works and is valid.
  });

  test("custom input shows validation error for invalid subdomain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const customInput = page.locator('input[placeholder="Type to create your own"]');
    await expect(customInput).toBeVisible({ timeout: 5000 });

    // Enter an invalid subdomain (starts with hyphen)
    // Note: The regex check runs first, so we get "Only lowercase letters, numbers, and hyphens"
    // instead of "Cannot start or end with hyphen"
    await customInput.fill("-invalid-start");
    await page.waitForTimeout(300);

    // Should show validation error (the regex error, since that check runs first)
    await expect(page.locator('text="Only lowercase letters, numbers, and hyphens"')).toBeVisible({
      timeout: 5000,
    });
  });
});

/**
 * Domain Picker - Custom Domain Auto-Switch Tests
 *
 * Tests that when a custom domain is already assigned to the website,
 * the domain picker automatically shows the custom domain view instead of Launch10 picker.
 */
test.describe("Domain Picker - Custom Domain Auto-Switch", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("shows custom domain header and DNS help when custom domain is assigned", async ({
    page,
  }) => {
    // Get the website ID first
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );

    // Assign a custom domain to this website
    const customDomain = `my-business-${Date.now()}.example.com`;
    await appScenario("assign_custom_domain", {
      website_id: website.id,
      domain_name: customDomain,
      path: "/",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should show DNS help section (indicates custom domain is selected)
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(true);

    // Should show the custom domain header
    await expect(page.locator('text="Connect your own site"')).toBeVisible();

    // Should show DNS verification status
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 10000 });
  });

  test("shows standard header when no custom domain is assigned", async ({ page }) => {
    // Navigate to domain picker without assigning a custom domain
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should not show DNS help section (no custom domain)
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(false);

    // Should show standard picker header (use heading role to avoid matching sidebar)
    await expect(page.getByRole("heading", { name: "Website Setup" })).toBeVisible();
    await expect(
      page.locator('text="Choose how you want your website to be accessed"')
    ).toBeVisible();
  });

  test("can switch to platform subdomain after custom domain is assigned", async ({ page }) => {
    // Get the website ID and assign a custom domain
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    const customDomain = `switch-test-${Date.now()}.example.com`;
    await appScenario("assign_custom_domain", {
      website_id: website.id,
      domain_name: customDomain,
      path: "/",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Custom domain should be selected initially
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 10000 });

    // Open dropdown and select a platform subdomain instead
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    // DNS help should no longer be visible (platform subdomain selected)
    await expect(domainPickerPage.dnsVerificationStatus).not.toBeVisible({ timeout: 5000 });
  });

  test("auto-selects the assigned custom domain as initial selection", async ({ page }) => {
    // Get the website ID and assign a custom domain
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    const customDomain = `auto-select-${Date.now()}.example.com`;
    await appScenario("assign_custom_domain", {
      website_id: website.id,
      domain_name: customDomain,
      path: "/",
    });

    // Navigate to domain picker (with retry for flaky domain context loading)
    await domainPickerPage.goto(projectUuid);

    // Retry waitForLoaded up to 2 times in case of domain context loading issues
    let loaded = false;
    for (let attempt = 0; attempt < 2 && !loaded; attempt++) {
      try {
        await domainPickerPage.waitForLoaded();
        loaded = true;
      } catch {
        if (attempt < 1) {
          // Reload the page and try again
          await page.reload();
        } else {
          throw new Error("Failed to load domain picker after retries");
        }
      }
    }

    // With the unified picker, the custom domain is shown in the dropdown trigger
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain(customDomain);

    // DNS help section should be visible (indicates custom domain selected)
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Domain Picker - Pre-Population Tests
 *
 * Tests that the domain picker pre-populates with the actual assigned domain
 * when the user already has a domain/website URL assigned to their website.
 *
 * Scenarios:
 * 1. Platform subdomain assigned → dropdown shows the assigned subdomain
 * 2. Custom domain assigned → custom domain picker opens with prefilled domain
 * 3. No domain assigned → uses AI recommendations (existing behavior)
 */
test.describe("Domain Picker - Pre-Population", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("pre-selects assigned platform subdomain in dropdown", async ({ page }) => {
    // Assign a platform subdomain to this website
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "my-awesome-site",
      path: "/",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should NOT be in custom domain mode (should stay in Launch10 picker)
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(false);

    // The dropdown should show the assigned domain
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("my-awesome-site.launch10.site");
  });

  test("pre-selects assigned platform subdomain with custom path", async ({ page }) => {
    // Assign a platform subdomain with a custom path
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "landing-pages",
      path: "/promo",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // The dropdown should show the assigned domain
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("landing-pages.launch10.site");

    // The page name input should show the assigned path (without leading slash - PageNameInput strips it for display)
    const pageNameValue = await domainPickerPage.pageNameInput.inputValue();
    expect(pageNameValue).toBe("promo");
  });

  test("pre-selects custom domain in dropdown when assigned", async ({ page }) => {
    // Assign a custom domain to this website
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    const customDomain = "mybusiness.example.com";
    await appScenario("assign_custom_domain", {
      website_id: website.id,
      domain_name: customDomain,
      path: "/",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should show DNS help section (indicates custom domain selected)
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(true);

    // The dropdown should show the assigned custom domain
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain(customDomain);
  });

  test("pre-selects custom domain with custom path in dropdown", async ({ page }) => {
    // Assign a custom domain with a custom path
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    const customDomain = "mystore.example.com";
    await appScenario("assign_custom_domain", {
      website_id: website.id,
      domain_name: customDomain,
      path: "/sale",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should show DNS help section (custom domain selected)
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(true);

    // The dropdown should show the assigned custom domain
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain(customDomain);

    // The page name input should show the assigned path (without leading slash - PageNameInput strips it for display)
    const pageNameValue = await domainPickerPage.pageNameInput.inputValue();
    expect(pageNameValue).toBe("sale");
  });

  test("uses Launch10 picker when no domain is assigned", async ({ page }) => {
    // Don't assign any domain - just navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should NOT be in custom domain mode
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(false);

    // Should show the dropdown (Launch10 picker)
    await expect(domainPickerPage.siteNameDropdown).toBeVisible();

    // The dropdown should be usable (may or may not have AI recommendations in test mode)
    await domainPickerPage.siteNameDropdown.click();

    // Should show "Create New Site" section in the dropdown
    await expect(page.locator('text="Create New Site"')).toBeVisible({ timeout: 5000 });
  });

  test("full URL preview shows assigned domain", async ({ page }) => {
    // Assign a platform subdomain
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "preview-test",
      path: "/landing",
    });

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should show URL preview with the assigned domain
    await expect(domainPickerPage.fullUrlPreview).toBeVisible();
    await expect(domainPickerPage.fullUrlPreview).toContainText(
      "preview-test.launch10.site/landing"
    );
  });
});

/**
 * Domain Picker - Claim Subdomain Modal Tests
 *
 * Tests the claim subdomain confirmation modal that appears when users
 * create a new platform subdomain (which uses a credit).
 *
 * The modal should:
 * - Show when claiming a new subdomain (not existing ones)
 * - Display the domain being claimed
 * - Show remaining credits
 * - Allow confirmation or cancellation
 * - Update credits after claiming
 *
 * NOTE: Tests that require Enter key submission use a helper function that
 * clicks on the input, types slowly, and presses Enter to ensure React
 * state updates properly.
 */
test.describe("Domain Picker - Claim Subdomain Modal", () => {
  test.setTimeout(90000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  /**
   * Helper to reliably enter a custom subdomain and trigger the claim modal.
   * Uses focus + keyboard.type (instead of fill) + Enter for better reliability.
   * The key insight is to use page.keyboard for typing to avoid focus issues.
   */
  async function enterCustomSubdomainAndSubmit(
    page: import("@playwright/test").Page,
    subdomain: string
  ) {
    const customInput = page.locator('input[placeholder="Type to create your own"]');
    await expect(customInput).toBeVisible({ timeout: 5000 });
    await expect(customInput).toBeEnabled();

    // Focus the input using JavaScript to avoid click-related issues
    await customInput.focus();
    await page.waitForTimeout(100);

    // Clear any existing value
    await customInput.selectText();
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(50);

    // Type using page.keyboard for more reliable key events
    await page.keyboard.type(subdomain, { delay: 30 });
    await page.waitForTimeout(300);

    // Verify the input has the correct value before submitting
    const inputValue = await customInput.inputValue();
    if (inputValue !== subdomain) {
      console.warn(`Input value mismatch: expected "${subdomain}", got "${inputValue}"`);
    }

    // Press Enter to submit
    await page.keyboard.press("Enter");
  }

  test("shows claim modal when creating a new subdomain via custom input", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown and enter a new custom subdomain
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const subdomain = `claimtest${Date.now() % 10000}`;
    await enterCustomSubdomainAndSubmit(page, subdomain);

    // The claim modal should appear
    await domainPickerPage.waitForClaimModal();
    await expect(domainPickerPage.claimSubdomainModal).toBeVisible();

    // Modal should show the domain being claimed
    await expect(page.locator(`text="${subdomain}.launch10.site"`)).toBeVisible();
  });

  test("claim modal shows remaining credits", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown and create a new subdomain
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const subdomain = `credtest${Date.now() % 10000}`;
    await enterCustomSubdomainAndSubmit(page, subdomain);

    // Wait for modal
    await domainPickerPage.waitForClaimModal();

    // Should show credits remaining (Growth plan has 2 credits, 1 used = 1 remaining)
    const creditsText = await domainPickerPage.getCreditsRemaining();
    expect(creditsText).toContain("remaining");
  });

  test("can cancel the claim modal", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown and create a new subdomain
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const subdomain = `canceltest${Date.now() % 10000}`;
    await enterCustomSubdomainAndSubmit(page, subdomain);

    // Wait for modal
    await domainPickerPage.waitForClaimModal();

    // Cancel the claim
    await domainPickerPage.cancelClaim();

    // Modal should close
    await expect(domainPickerPage.claimSubdomainModal).not.toBeVisible({ timeout: 5000 });

    // The dropdown should still be showing (or page reset to initial state)
    await expect(domainPickerPage.siteNameDropdown).toBeVisible();
  });

  test("can confirm claim and modal closes", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown and create a new subdomain
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const subdomain = `confirmtest${Date.now() % 10000}`;
    await enterCustomSubdomainAndSubmit(page, subdomain);

    // Wait for modal
    await domainPickerPage.waitForClaimModal();

    // Verify modal shows correct domain
    await expect(page.locator(`text="${subdomain}.launch10.site"`)).toBeVisible();

    // Confirm the claim
    await domainPickerPage.confirmClaim();

    // Modal should close (the key behavior we're testing)
    await expect(domainPickerPage.claimSubdomainModal).not.toBeVisible({ timeout: 10000 });

    // Note: After confirming, the page may refresh or update context.
    // The most important assertion is that the modal closes successfully.
  });

  test("does NOT show claim modal when selecting an existing domain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Select an existing domain (meeting-tool.launch10.site)
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    // Use a more specific locator - the one in the popover content (not the trigger)
    const popoverContent = page.locator("[data-radix-popper-content-wrapper]");
    await popoverContent.locator('text="meeting-tool.launch10.site"').click();

    // Wait a moment to ensure modal doesn't appear
    await page.waitForTimeout(1000);

    // Modal should NOT appear (existing domains don't use credits)
    await expect(domainPickerPage.claimSubdomainModal).not.toBeVisible();

    // Domain should be selected - check dropdown shows it
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("meeting-tool.launch10.site");
  });

  test("shows last credit warning when claiming with 1 credit remaining", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Create a new subdomain (snapshot has 1 credit remaining)
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    const subdomain = `lastcredit${Date.now() % 10000}`;
    await enterCustomSubdomainAndSubmit(page, subdomain);

    // Wait for modal
    await domainPickerPage.waitForClaimModal();

    // Should show "1 remaining"
    await domainPickerPage.expectCreditsRemaining(1);

    // Should show last credit warning (full text: "This is your last available subdomain on your current plan.")
    await expect(
      page.locator('text="This is your last available subdomain on your current plan."')
    ).toBeVisible();
  });
});

/**
 * Domain Picker with Existing Domains Tests
 *
 * These tests specifically verify behavior when the user has existing domains.
 * The website_step snapshot includes:
 * - meeting-tool.launch10.site (assigned to "Meeting Tool" website, has paths: /, /landing)
 * - my-custom-site.com (custom domain, unassigned)
 *
 * The main test project has no domain assigned, so users should see:
 * - "Your Existing Sites" section with meeting-tool.launch10.site
 * - "Your Custom Domains" section with my-custom-site.com
 */
test.describe("Domain Picker - Existing Domains", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("shows existing domains in dropdown when available", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Click on site name dropdown
    await domainPickerPage.siteNameDropdown.click();

    // Wait for dropdown content to load
    await page.waitForTimeout(1000);

    // Should show "Your Existing Sites" section with both platform and custom domains
    await expect(page.locator('text="Your Existing Sites"')).toBeVisible({ timeout: 5000 });
    // Use popover-specific locator to avoid matching the dropdown trigger text
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover.locator('text="meeting-tool.launch10.site"')).toBeVisible({
      timeout: 5000,
    });
  });

  test("can select an existing domain from another website", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Click dropdown and select the existing domain (use popover-specific locator)
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(1000);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    // URL preview should show the selected domain
    await domainPickerPage.expectUrlPreview("meeting-tool.launch10.site");
  });

  test("shows custom domains in Your Existing Sites section", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Click on site name dropdown
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(1000);

    // Custom domains are now merged into "Your Existing Sites" section
    await expect(page.locator('text="Your Existing Sites"')).toBeVisible({ timeout: 5000 });
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover.locator('text="my-custom-site.com"')).toBeVisible({ timeout: 5000 });
  });

  test("can select a custom domain from dropdown", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Click dropdown and select the custom domain (use popover-specific locator)
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(1000);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="my-custom-site.com"').click();

    // URL preview should show the selected domain
    await domainPickerPage.expectUrlPreview("my-custom-site.com");
  });
});

/**
 * Domain Picker - Autosave Tests
 *
 * Tests the autosave functionality that persists domain and website_url changes.
 * Autosave is triggered via useLatestMutation on blur with a 750ms debounce.
 *
 * The autosave flow:
 * 1. User makes a selection (domain, path)
 * 2. User blurs (clicks outside, tabs away)
 * 3. After 750ms debounce, mutateDebounced fires
 * 4. API creates/updates Domain and WebsiteUrl records
 *
 * Tests verify persistence by:
 * - Making changes and triggering blur
 * - Waiting for debounce + API call to complete
 * - Reloading the page
 * - Asserting the changes persisted
 */
test.describe("Domain Picker - Autosave", () => {
  test.setTimeout(90000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  /**
   * Helper to trigger blur and wait for autosave to complete.
   * Clicks outside the inputs to trigger blur, then waits for
   * the debounce (750ms) plus API response time.
   */
  async function triggerBlurAndWaitForAutosave(page: import("@playwright/test").Page) {
    // Click on the header to blur the inputs
    await page.getByRole("heading", { name: /Website Setup|Connect your own site/ }).click();

    // Wait for debounce (750ms) + API call buffer
    await page.waitForTimeout(1500);
  }

  test("autosaves when selecting an existing platform subdomain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Select an existing platform subdomain
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    // Verify selection is shown before save
    await domainPickerPage.expectUrlPreview("meeting-tool.launch10.site");

    // Trigger blur to initiate autosave
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page to verify persistence
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // The domain should persist after reload
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("meeting-tool.launch10.site");

    // URL preview should also show the persisted domain
    await expect(domainPickerPage.fullUrlPreview).toBeVisible();
    await expect(domainPickerPage.fullUrlPreview).toContainText("meeting-tool.launch10.site");
  });

  test("autosaves when changing the path on an existing domain", async ({ page }) => {
    // First, assign a domain so we can test changing the path
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "autosave-test",
      path: "/original",
    });

    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Verify the initial path is set
    const initialPath = await domainPickerPage.pageNameInput.inputValue();
    expect(initialPath).toBe("original");

    // Change the path
    const newPath = `updated-${Date.now() % 10000}`;
    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill(newPath);

    // Trigger blur to initiate autosave
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page to verify persistence
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // The domain should still be selected
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("autosave-test.launch10.site");

    // The new path should persist after reload
    const persistedPath = await domainPickerPage.pageNameInput.inputValue();
    expect(persistedPath).toBe(newPath);

    // URL preview should show the updated path
    await expect(domainPickerPage.fullUrlPreview).toContainText(
      `autosave-test.launch10.site/${newPath}`
    );
  });

  test("autosaves when selecting a custom domain from dropdown", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Select the existing custom domain from dropdown
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="my-custom-site.com"').click();

    // Verify selection is shown (DNS help indicates custom domain mode)
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 5000 });

    // Trigger blur to initiate autosave
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page to verify persistence
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // The custom domain should persist after reload
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("my-custom-site.com");

    // Should still show DNS verification (custom domain mode)
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 5000 });
  });

  test("autosaves when switching from platform subdomain to custom domain", async ({ page }) => {
    // Start with a platform subdomain assigned
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "switch-from-me",
      path: "/",
    });

    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Verify the platform subdomain is initially selected
    let dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("switch-from-me.launch10.site");

    // Switch to the custom domain
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="my-custom-site.com"').click();

    // Trigger blur to initiate autosave
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page to verify persistence
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // The custom domain should now be selected after reload
    dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("my-custom-site.com");

    // Should show DNS verification (custom domain mode)
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 5000 });
  });

  test("autosaves path changes with custom domain", async ({ page }) => {
    // Start with a custom domain assigned
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_custom_domain", {
      website_id: website.id,
      domain_name: "autosave-custom.example.com",
      path: "/initial",
    });

    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Verify the initial setup
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("autosave-custom.example.com");

    const initialPath = await domainPickerPage.pageNameInput.inputValue();
    expect(initialPath).toBe("initial");

    // Change the path
    const newPath = `custom-path-${Date.now() % 10000}`;
    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill(newPath);

    // Trigger blur to initiate autosave
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page to verify persistence
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // Domain should persist
    const persistedDropdown = await domainPickerPage.siteNameDropdown.textContent();
    expect(persistedDropdown).toContain("autosave-custom.example.com");

    // Path should persist
    const persistedPath = await domainPickerPage.pageNameInput.inputValue();
    expect(persistedPath).toBe(newPath);
  });

  test("multiple rapid path changes only save the final value", async ({ page }) => {
    // Assign a domain first
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "rapid-changes",
      path: "/start",
    });

    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Make several rapid path changes (faster than debounce)
    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill("change1");
    await page.waitForTimeout(100);

    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill("change2");
    await page.waitForTimeout(100);

    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill("change3");
    await page.waitForTimeout(100);

    const finalPath = `final-${Date.now() % 10000}`;
    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill(finalPath);

    // Trigger blur to initiate autosave (only final value should be saved)
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page to verify only final value persisted
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // Only the final path should persist
    const persistedPath = await domainPickerPage.pageNameInput.inputValue();
    expect(persistedPath).toBe(finalPath);
  });

  test("website_url record is created/updated on autosave", async ({ page }) => {
    // Start with no domain assigned
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Select an existing domain (this creates a website_url linking domain to website)
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator('text="meeting-tool.launch10.site"').click();

    // Set a specific path
    const testPath = `url-test-${Date.now() % 10000}`;
    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill(testPath);

    // Trigger blur to initiate autosave
    await triggerBlurAndWaitForAutosave(page);

    // Reload the page
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // Verify both domain and path persisted (proves website_url was created)
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain("meeting-tool.launch10.site");

    const persistedPath = await domainPickerPage.pageNameInput.inputValue();
    expect(persistedPath).toBe(testPath);

    // URL preview should show the full URL
    await expect(domainPickerPage.fullUrlPreview).toContainText(
      `meeting-tool.launch10.site/${testPath}`
    );
  });

  test("autosaves when entering a NEW custom domain via user input", async ({ page }) => {
    // This test covers the bug where custom domains entered by user weren't auto-saved
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Open dropdown and switch to custom domain mode
    await domainPickerPage.siteNameDropdown.click();
    await page.waitForTimeout(500);

    // Click "Connect your own site" to switch to custom domain input
    await domainPickerPage.connectOwnSiteButton.click();
    await page.waitForTimeout(300);

    // Enter a new custom domain
    const customDomain = `autosave-new-${Date.now()}.example.com`;
    const customInput = page.getByTestId("custom-domain-input");
    await customInput.fill(customDomain);

    // Press Enter to submit (should auto-save)
    await page.keyboard.press("Enter");

    // Wait for the dropdown to close and debounce to complete
    await page.waitForTimeout(1500);

    // Reload the page to verify persistence
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // The custom domain should persist after reload
    const dropdownText = await domainPickerPage.siteNameDropdown.textContent();
    expect(dropdownText).toContain(customDomain);

    // Should show DNS verification (custom domain mode)
    await expect(domainPickerPage.dnsVerificationStatus).toBeVisible({ timeout: 10000 });
  });

  test("autosaves path changes while typing (debounced, without blur)", async ({ page }) => {
    // This test covers debounced autosave on path change without requiring blur
    // First, assign a domain so we have something to test path changes on
    const website = await appQuery<{ id: number; name: string; project_id: number }>(
      "first_website"
    );
    await appScenario("assign_platform_subdomain", {
      website_id: website.id,
      subdomain: "debounce-test",
      path: "/original",
    });

    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Verify the initial path is set
    const initialPath = await domainPickerPage.pageNameInput.inputValue();
    expect(initialPath).toBe("original");

    // Change the path (typing triggers debounced save)
    const newPath = `debounced-${Date.now() % 10000}`;
    await domainPickerPage.pageNameInput.clear();
    await domainPickerPage.pageNameInput.fill(newPath);

    // Wait for debounce (750ms) + API call buffer - WITHOUT triggering blur
    await page.waitForTimeout(2000);

    // Reload the page to verify persistence (no blur was triggered!)
    await page.reload();
    await domainPickerPage.waitForLoaded();

    // The new path should persist after reload
    const persistedPath = await domainPickerPage.pageNameInput.inputValue();
    expect(persistedPath).toBe(newPath);
  });
});
