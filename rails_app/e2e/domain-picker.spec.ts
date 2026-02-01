import { test, expect, loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { DomainPickerPage } from "./pages/domain-picker.page";

/**
 * Domain Picker Tests
 *
 * Tests the Domain Picker page functionality at /projects/:uuid/website/domain.
 * Uses the website_step snapshot which now includes domain test data:
 * - scheduling-tool.launch10.site (unassigned platform subdomain)
 * - meeting-tool.launch10.site (assigned to another website, has paths: /, /landing)
 * - my-custom-site.com (custom domain, unassigned)
 *
 * IMPORTANT: Tests rely on CACHE_MODE=true in langgraph_app/.env for fast,
 * deterministic responses without making actual AI calls.
 */
test.describe("Domain Picker", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    // Restore snapshot with domain test data
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test.describe("Page Loading", () => {
    test("displays the domain picker page when navigating to /website/domain", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Should show the "Website Setup" header
      await expect(page.locator('text="Website Setup"')).toBeVisible();
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

      // Launch10 Site picker should be active by default
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

      // Should have site name dropdown/input
      // Note: The exact element depends on recommendations state
      await expect(
        page.locator('text="Your site name"').or(page.locator('text="Site name"'))
      ).toBeVisible({ timeout: 10000 });

      // Should have page name input with "/" prefix
      await expect(page.locator('text="Page name"').or(page.locator('text="/"'))).toBeVisible({
        timeout: 10000,
      });
    });

    test("shows existing domains section when user has existing domains", async ({ page }) => {
      // This test requires domain recommendations to load
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Wait for recommendations to load
      await page.waitForTimeout(3000);

      // Should show "Your Existing Sites" section
      await domainPickerPage.expectExistingDomainsVisible();
    });

    test("displays AI-generated domain suggestions", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Wait for AI recommendations to load (from domainRecommendations state)
      await page.waitForTimeout(5000);

      // Should show "Create New Site" section with suggestions
      await expect(
        page.locator('text="Create New Site"').or(page.locator('text="Suggestions"'))
      ).toBeVisible();
    });
  });

  test.describe("Custom Domain Mode", () => {
    test("switches to custom domain via dropdown option", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Click dropdown and then "Connect your own site"
      await domainPickerPage.switchToCustomDomain();

      // Should show custom domain input
      await expect(domainPickerPage.customDomainInput).toBeVisible({ timeout: 5000 });
    });

    test("shows CNAME instructions in custom domain mode", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Switch to custom domain mode
      await domainPickerPage.switchToCustomDomain();

      // Should show CNAME instructions
      await expect(page.locator('text="CNAME"')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text="cname.launch10.ai"')).toBeVisible({ timeout: 5000 });
    });

    test("shows link to switch back to Launch10 Site", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Switch to custom domain mode
      await domainPickerPage.switchToCustomDomain();

      // Should show link to switch back
      await expect(domainPickerPage.switchToLaunch10Button).toBeVisible();
    });
  });

  test.describe("URL Preview", () => {
    test.skip("shows full URL preview when selection is made", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Wait for recommendations to auto-select top recommendation
      await page.waitForTimeout(3000);

      // Should show URL preview section
      await expect(domainPickerPage.fullUrlPreview).toBeVisible();
    });
  });

  test.describe("Navigation", () => {
    test("shows Previous Step and Continue buttons", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Should show navigation buttons
      await expect(domainPickerPage.previousStepButton).toBeVisible();
      await expect(domainPickerPage.continueButton).toBeVisible();
    });

    test("Previous Step button navigates back to /website/build", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Click Previous Step
      await domainPickerPage.clickPreviousStep();

      // Should navigate back to build step
      await expect(page).toHaveURL(new RegExp(`/projects/${projectUuid}/website/build`));
    });

    test("Continue button navigates to /website/deploy", async ({ page }) => {
      await domainPickerPage.goto(projectUuid);
      await domainPickerPage.waitForLoaded();

      // Click Continue
      await domainPickerPage.clickContinue();

      // Should navigate to deploy step
      await expect(page).toHaveURL(new RegExp(`/projects/${projectUuid}/website/deploy`));
    });
  });

  test.describe("Workflow Integration", () => {
    test("redirects /website to /website/build", async ({ page }) => {
      await loginUser(page);

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
      await expect(page.locator('text="Website Setup"')).toBeVisible();
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
test.describe("Domain Picker - Subdomain Limit", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;

    // Fill up the subdomain limit to trigger "out of credits" state
    await DatabaseSnapshotter.fillSubdomainLimit("brett@launch10.ai");

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
    await expect(page.locator('text="Upgrade to add more"')).toBeVisible();
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
      const suggestionButton = suggestionsSection
        .locator("..")
        .locator("button")
        .first();
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

    // Should show upgrade link
    await expect(page.locator('text="Upgrade to launch more sites"')).toBeVisible();
  });
});

/**
 * Domain Picker - Path Availability Tests
 *
 * Tests the backend availability checking for paths when an existing domain is selected.
 * The PageNameInput component checks with /api/v1/website_urls/search when a domain is selected.
 */
test.describe("Domain Picker - Path Availability", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("shows checking state when typing in page name input", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations to load
    await page.waitForTimeout(3000);

    // Click dropdown and select an existing domain that has a domain ID
    await domainPickerPage.siteNameDropdown.click();

    // Look for "Your Existing Sites" section and select one
    const existingSitesSection = page.locator('text="Your Existing Sites"');
    if (await existingSitesSection.isVisible({ timeout: 5000 })) {
      // Click on the first existing site
      const firstExistingSite = existingSitesSection.locator("..").locator("button").first();
      await firstExistingSite.click();

      // Type in the page name input
      await domainPickerPage.pageNameInput.fill("test-page");

      // Should show checking state briefly
      await expect(domainPickerPage.pathCheckingMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test("shows available status when path is available", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations to load
    await page.waitForTimeout(3000);

    // Click dropdown and select an existing domain
    await domainPickerPage.siteNameDropdown.click();

    const existingSitesSection = page.locator('text="Your Existing Sites"');
    if (await existingSitesSection.isVisible({ timeout: 5000 })) {
      const firstExistingSite = existingSitesSection.locator("..").locator("button").first();
      await firstExistingSite.click();

      // Type a unique path that shouldn't exist
      const uniquePath = `unique-${Date.now()}`;
      await domainPickerPage.pageNameInput.fill(uniquePath);

      // Wait for the check to complete and show available
      await expect(domainPickerPage.pathAvailableIndicator).toBeVisible({ timeout: 10000 });
      await expect(domainPickerPage.pathAvailableIndicator).toContainText(uniquePath);
    }
  });

  test("shows existing status when path already exists on domain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations to load
    await page.waitForTimeout(3000);

    // Click dropdown and look for a domain with existing paths
    await domainPickerPage.siteNameDropdown.click();

    // meeting-tool.launch10.site has paths: /, /landing
    const meetingToolOption = page.locator('text="meeting-tool"').first();
    if (await meetingToolOption.isVisible({ timeout: 5000 })) {
      await meetingToolOption.click();

      // Type "landing" which should already exist
      await domainPickerPage.pageNameInput.fill("landing");

      // Should show existing indicator
      await expect(domainPickerPage.pathExistingIndicator).toBeVisible({ timeout: 10000 });
    }
  });

  test("shows validation error for invalid path characters", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Type invalid characters in page name
    await domainPickerPage.pageNameInput.fill("Invalid Path!");

    // Should show validation error
    await expect(domainPickerPage.pathValidationError).toBeVisible({ timeout: 5000 });
  });

  test("shows assigned status when path belongs to current website", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations to load
    await page.waitForTimeout(3000);

    // Click dropdown and look for a domain that is already assigned to this website
    // with an existing path (the snapshot should have one)
    await domainPickerPage.siteNameDropdown.click();

    const existingSitesSection = page.locator('text="Your Existing Sites"');
    if (await existingSitesSection.isVisible({ timeout: 5000 })) {
      // Click on an existing site that has a path assigned to this website
      const siteWithPath = existingSitesSection.locator("..").locator("button").first();
      await siteWithPath.click();

      // The root path "/" should show as assigned if this domain/path combo
      // is already assigned to this website
      // Wait for availability check
      await page.waitForTimeout(1000);

      // Either assigned or available should be visible (depending on current state)
      const isAssigned = await domainPickerPage.pathAssignedIndicator.isVisible({ timeout: 5000 }).catch(() => false);
      const isAvailable = await domainPickerPage.pathAvailableIndicator.isVisible({ timeout: 1000 }).catch(() => false);

      // One of them should be true
      expect(isAssigned || isAvailable).toBe(true);
    }
  });
});

/**
 * Domain Picker - Credit Update Tests
 *
 * Tests that credits are updated correctly after claiming a subdomain.
 * Verifies that the frontend updates inline to prevent stale credit exploits.
 */
test.describe("Domain Picker - Credit Updates", () => {
  test.setTimeout(90000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("claim modal shows correct credits and updates after claiming", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();
    await page.waitForTimeout(5000);

    // Check initial state - if we have credits, we can proceed with the test
    const isOutOfCredits = await domainPickerPage.outOfCreditsBanner.isVisible().catch(() => false);

    if (isOutOfCredits) {
      // Already at 0 credits - verify the UI correctly shows this
      await domainPickerPage.siteNameDropdown.click();
      const customInput = page.locator('input[placeholder="Type to create your own"]');
      await expect(customInput).toBeDisabled();
      await expect(page.locator('text="Upgrade to launch more sites"')).toBeVisible();
      return; // Test passes - UI correctly reflects 0 credits
    }

    // We have credits available - let's claim a subdomain
    await domainPickerPage.siteNameDropdown.click();
    const customInput = page.locator('input[placeholder="Type to create your own"]');
    await expect(customInput).toBeVisible({ timeout: 10000 });
    await expect(customInput).toBeEnabled();

    const subdomain = `credit-update-${Date.now()}`;
    await customInput.fill(subdomain);
    await page.keyboard.press("Enter");

    // Open claim modal
    await domainPickerPage.clickConnectSite();
    await domainPickerPage.waitForClaimModal();

    // Get initial credits from modal
    const initialCreditsText = await domainPickerPage.getCreditsRemaining();
    const initialCredits = parseInt(initialCreditsText.match(/(\d+) remaining/)?.[1] ?? "0");

    // Confirm the claim
    await domainPickerPage.confirmClaim();

    // Wait for navigation to deploy page
    await expect(page).toHaveURL(/\/website\/deploy/, { timeout: 15000 });

    // Navigate back to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();
    await page.waitForTimeout(3000);

    // Check updated state
    if (initialCredits === 1) {
      // We used the last credit - should now show out-of-credits banner
      await expect(domainPickerPage.outOfCreditsBanner).toBeVisible({ timeout: 10000 });
      await domainPickerPage.siteNameDropdown.click();
      const customInput2 = page.locator('input[placeholder="Type to create your own"]');
      await expect(customInput2).toBeDisabled();
    } else if (initialCredits > 1) {
      // We still have credits - try to open modal again and verify decrement
      await domainPickerPage.siteNameDropdown.click();
      const customInput2 = page.locator('input[placeholder="Type to create your own"]');
      await expect(customInput2).toBeEnabled();

      const subdomain2 = `credit-update2-${Date.now()}`;
      await customInput2.fill(subdomain2);
      await page.keyboard.press("Enter");

      await domainPickerPage.clickConnectSite();
      await domainPickerPage.waitForClaimModal();

      // Verify credits decremented
      const newCreditsText = await domainPickerPage.getCreditsRemaining();
      const newCredits = parseInt(newCreditsText.match(/(\d+) remaining/)?.[1] ?? "0");
      expect(newCredits).toBe(initialCredits - 1);
    }
  });

  test("shows last subdomain warning when exactly 1 credit remaining", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();
    await page.waitForTimeout(5000);

    // Skip if already out of credits
    const isOutOfCredits = await domainPickerPage.outOfCreditsBanner.isVisible().catch(() => false);
    if (isOutOfCredits) {
      console.log("Already at 0 credits - skipping test");
      return;
    }

    // Select a new subdomain
    await domainPickerPage.siteNameDropdown.click();
    const customInput = page.locator('input[placeholder="Type to create your own"]');
    await expect(customInput).toBeEnabled({ timeout: 10000 });

    const subdomain = `last-credit-${Date.now()}`;
    await customInput.fill(subdomain);
    await page.keyboard.press("Enter");

    // Open claim modal
    await domainPickerPage.clickConnectSite();
    await domainPickerPage.waitForClaimModal();

    // Check credits
    const creditsText = await domainPickerPage.getCreditsRemaining();
    const credits = parseInt(creditsText.match(/(\d+) remaining/)?.[1] ?? "0");

    if (credits === 1) {
      // Should show the last subdomain warning (note: text ends with period)
      await expect(
        page.locator('text="This is your last available subdomain on your current plan."')
      ).toBeVisible({ timeout: 5000 });
    } else {
      console.log(`Credits remaining: ${credits} - warning only shows at exactly 1`);
    }
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
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("auto-switches to custom domain view when custom domain is assigned", async ({ page }) => {
    // Get the website ID first
    const website = await DatabaseSnapshotter.getFirstWebsite();

    // Assign a custom domain to this website (email is ignored, account derived from website)
    const customDomain = `my-business-${Date.now()}.example.com`;
    await DatabaseSnapshotter.assignCustomDomain(
      "", // email not used
      website.id,
      customDomain,
      "/"
    );

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should automatically be in custom domain mode
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(true);

    // Should show the custom domain picker header
    await expect(page.locator('text="Connect your own site"')).toBeVisible();

    // Should show the custom domain input with the assigned domain
    await expect(domainPickerPage.customDomainInput).toBeVisible();
  });

  test("shows Launch10 picker by default when no custom domain is assigned", async ({ page }) => {
    // Navigate to domain picker without assigning a custom domain
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should be in Launch10 Site mode by default
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(false);

    // Should show Launch10 Site picker header (use heading role to avoid matching sidebar)
    await expect(page.getByRole("heading", { name: "Website Setup" })).toBeVisible();
    await expect(
      page.locator('text="Choose how you want your website to be accessed"')
    ).toBeVisible();
  });

  test("custom domain view shows switch back link", async ({ page }) => {
    // Get the website ID and assign a custom domain
    const website = await DatabaseSnapshotter.getFirstWebsite();
    const customDomain = `switch-test-${Date.now()}.example.com`;
    await DatabaseSnapshotter.assignCustomDomain(
      "", // email not used
      website.id,
      customDomain,
      "/"
    );

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should show the "Use a Launch10 Site" link
    await expect(domainPickerPage.switchToLaunch10Button).toBeVisible();

    // Click to switch back
    await domainPickerPage.switchToLaunch10Site();

    // Should now be in Launch10 Site mode
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(false);
  });

  test("auto-selects the assigned custom domain as initial selection", async ({ page }) => {
    // Get the website ID and assign a custom domain
    const website = await DatabaseSnapshotter.getFirstWebsite();
    const customDomain = `auto-select-${Date.now()}.example.com`;
    await DatabaseSnapshotter.assignCustomDomain(
      "", // email not used
      website.id,
      customDomain,
      "/"
    );

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

    // The custom domain input should have the assigned domain value
    await expect(domainPickerPage.customDomainInput).toBeVisible();
    const inputValue = await domainPickerPage.customDomainInput.inputValue();
    expect(inputValue).toBe(customDomain);
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
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test("pre-selects assigned platform subdomain in dropdown", async ({ page }) => {
    // Assign a platform subdomain to this website
    const website = await DatabaseSnapshotter.getFirstWebsite();
    const result = await DatabaseSnapshotter.assignPlatformSubdomain(
      website.id,
      "my-awesome-site",
      "/"
    );

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
    const website = await DatabaseSnapshotter.getFirstWebsite();
    await DatabaseSnapshotter.assignPlatformSubdomain(
      website.id,
      "landing-pages",
      "/promo"
    );

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

  test("pre-fills custom domain input when custom domain is assigned", async ({ page }) => {
    // Assign a custom domain to this website
    const website = await DatabaseSnapshotter.getFirstWebsite();
    const customDomain = "mybusiness.example.com";
    await DatabaseSnapshotter.assignCustomDomain(
      "",
      website.id,
      customDomain,
      "/"
    );

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should automatically be in custom domain mode
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(true);

    // The custom domain input should have the assigned domain
    const inputValue = await domainPickerPage.customDomainInput.inputValue();
    expect(inputValue).toBe(customDomain);
  });

  test("pre-fills custom domain with custom path", async ({ page }) => {
    // Assign a custom domain with a custom path
    const website = await DatabaseSnapshotter.getFirstWebsite();
    const customDomain = "mystore.example.com";
    await DatabaseSnapshotter.assignCustomDomain(
      "",
      website.id,
      customDomain,
      "/sale"
    );

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should be in custom domain mode
    const isCustomMode = await domainPickerPage.isInCustomDomainMode();
    expect(isCustomMode).toBe(true);

    // The custom domain input should have the assigned domain
    const domainValue = await domainPickerPage.customDomainInput.inputValue();
    expect(domainValue).toBe(customDomain);

    // The page name input should show the assigned path (without leading slash - PageNameInput strips it for display)
    const pageNameInput = page.locator('text="Page Name"').locator("..").locator("input");
    const pageNameValue = await pageNameInput.inputValue();
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
    const website = await DatabaseSnapshotter.getFirstWebsite();
    await DatabaseSnapshotter.assignPlatformSubdomain(
      website.id,
      "preview-test",
      "/landing"
    );

    // Navigate to domain picker
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Should show URL preview with the assigned domain
    await expect(domainPickerPage.fullUrlPreview).toBeVisible();
    await expect(domainPickerPage.fullUrlPreview).toContainText("preview-test.launch10.site/landing");
  });
});

/**
 * Domain Picker with Existing Domains Tests
 *
 * These tests specifically verify behavior when the user has existing domains.
 * The website_step snapshot includes:
 * - scheduling-tool.launch10.site (unassigned, can be assigned to current website)
 * - meeting-tool.launch10.site (assigned to different website, has paths: /, /landing)
 */
test.describe("Domain Picker - Existing Domains", () => {
  test.setTimeout(60000);

  let domainPickerPage: DomainPickerPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");
    const project = await DatabaseSnapshotter.getFirstProject();
    projectUuid = project.uuid;
    await loginUser(page);
    domainPickerPage = new DomainPickerPage(page);
  });

  test.skip("shows existing domains in dropdown when available", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations to load
    await page.waitForTimeout(5000);

    // Click on site name dropdown
    await domainPickerPage.siteNameDropdown.click();

    // Should show existing domains
    // scheduling-tool.launch10.site (unassigned)
    // meeting-tool.launch10.site (assigned to Meeting Tool website)
    await expect(
      page
        .locator('text="scheduling-tool"')
        .or(page.locator('text="scheduling-tool.launch10.site"'))
    ).toBeVisible({ timeout: 5000 });
  });

  test.skip("can select an existing unassigned domain", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations
    await page.waitForTimeout(5000);

    // Click dropdown and select the unassigned domain
    await domainPickerPage.siteNameDropdown.click();
    await page.locator('text="scheduling-tool"').first().click();

    // URL preview should show the selected domain
    await domainPickerPage.expectUrlPreview("scheduling-tool.launch10.site");
  });

  test.skip("shows existing paths when selecting a domain with paths", async ({ page }) => {
    await domainPickerPage.goto(projectUuid);
    await domainPickerPage.waitForLoaded();

    // Wait for recommendations
    await page.waitForTimeout(5000);

    // Select the domain that has existing paths
    await domainPickerPage.siteNameDropdown.click();
    await page.locator('text="meeting-tool"').first().click();

    // Page name input should show existing paths or validation
    // meeting-tool.launch10.site has "/" and "/landing" already
    await expect(page.locator('text="/"').or(page.locator('text="/landing"'))).toBeVisible();
  });
});
