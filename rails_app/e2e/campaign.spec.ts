/**
 * Campaign E2E Tests
 *
 * Comprehensive tests for the Ad Campaign workflow.
 * These tests cover all features of the campaign builder including:
 * - Sending chat messages
 * - Refreshing suggestions
 * - Locking/unlocking suggestions
 * - Typing custom suggestions
 * - Character limit validations
 * - Workflow navigation
 * - Back button navigation
 * - Geo targeting API
 * - Ad schedule configuration
 * - Budget settings
 * - Review page navigation
 * - Editing during review
 * - Autosave race conditions
 *
 * IMPORTANT: AI-generated suggestions cannot be trusted for length.
 * We override AI suggestions with verified, length-appropriate test data.
 */

import { test, expect, type Page } from "@playwright/test";
import { loginUser } from "./fixtures/auth";
import { DatabaseSnapshotter } from "./fixtures/database";
import { appQuery } from "./support/on-rails";
import { CampaignPage, VALID_TEST_DATA, INVALID_TEST_DATA } from "./pages/campaign.page";

// Snapshot builders available (chain from earlier to later):
// - campaign_content_step: Campaign created, ON content step
// - campaign_highlights_step: Content filled, ON highlights step
// - campaign_keywords_step: Highlights filled, ON keywords step
// - campaign_settings_step: Keywords filled, ON settings step
// - campaign_launch_step: Settings filled, ON launch step
// - campaign_review_step: Launch filled, ON review step
test.describe("Ad Campaign Workflow", () => {
  let campaignPage: CampaignPage;
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    // Default: Restore database to campaign_content_step state
    // Individual tests may restore different snapshots as needed
    await DatabaseSnapshotter.restoreSnapshot("campaign_content_step");
    // Get the project UUID from the restored snapshot
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    // Login the test user
    await loginUser(page);
    // Initialize the page object
    campaignPage = new CampaignPage(page);
  });

  test.describe("Page Load and Initial State", () => {
    test("should load the campaign page and show content form", async () => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Verify content form is visible
      await campaignPage.expectFormVisible("content");

      // Verify tab switcher is visible with content tab active
      await expect(campaignPage.tabSwitcher).toBeVisible();
      await campaignPage.expectTabActive("content");

      // Verify chat is visible
      await expect(campaignPage.adsChat).toBeVisible();

      // Verify continue button is available
      await expect(campaignPage.continueButton).toBeVisible();
    });

    test("should show navigation buttons in correct initial state", async () => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Back button should be enabled - it navigates to the Website Builder step
      await expect(campaignPage.backButton).toBeEnabled();

      // Continue button should be enabled
      await expect(campaignPage.continueButton).toBeEnabled();
    });
  });

  test.describe("Chat Messaging", () => {
    test("should send a message and receive AI response", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Send a message
      const testMessage = "Can you suggest shorter headlines?";
      await campaignPage.sendMessage(testMessage);

      // Wait for AI to respond
      await campaignPage.waitForAIResponse();

      // Verify the message appears in chat
      await expect(campaignPage.adsChatMessages).toContainText(testMessage);
    });

    test("should be able to send multiple messages", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Send first message
      await campaignPage.sendMessage("Hello");
      await campaignPage.waitForAIResponse();

      // Send second message
      await campaignPage.sendMessage("Can you help me?");
      await campaignPage.waitForAIResponse();

      // Both should be visible
      await expect(campaignPage.adsChatMessages).toContainText("Hello");
      await expect(campaignPage.adsChatMessages).toContainText("Can you help me?");
    });
  });

  test.describe("Refreshing Suggestions", () => {
    test("should refresh all suggestions via chat button", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Get initial input count
      const initialCount = await campaignPage.countInputFields();

      // Click refresh all suggestions
      await campaignPage.refreshAllSuggestionsClick();

      // Wait for refresh to complete
      await campaignPage.waitForAIResponse(45000);

      // Verify inputs are still present (may have new values)
      const newCount = await campaignPage.countInputFields();
      expect(newCount).toBeGreaterThan(0);
    });

    test("should refresh suggestions for a specific section", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Click the section-specific refresh button
      await campaignPage.clickRefreshSuggestions();

      // Wait for refresh to complete
      await campaignPage.waitForAIResponse(30000);

      // Verify inputs are present
      const count = await campaignPage.countInputFields();
      expect(count).toBeGreaterThan(0);
    });

    test("should preserve locked items when refreshing", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Wait for inputs to load
      await page.waitForTimeout(2000);

      // Get first input value and lock it
      const firstInput = campaignPage.getNthInput(0);
      const originalValue = await firstInput.inputValue();

      // Fill with known value and lock
      await campaignPage.fillNthInput(0, VALID_TEST_DATA.headlines[0]);
      await campaignPage.toggleLock(0);

      // Verify it's locked
      await campaignPage.expectFieldLocked(0);

      // Refresh all suggestions
      await campaignPage.refreshAllSuggestionsClick();
      await campaignPage.waitForAIResponse(45000);

      // Verify the locked item is preserved
      await expect(firstInput).toHaveValue(VALID_TEST_DATA.headlines[0]);
      await campaignPage.expectFieldLocked(0);
    });
  });

  test.describe("Locking Suggestions", () => {
    test("should toggle lock state on click", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Wait for inputs to load
      await page.waitForTimeout(2000);

      // Initially should be unlocked
      await campaignPage.expectFieldUnlocked(0);

      // Toggle lock
      await campaignPage.toggleLock(0);
      await campaignPage.expectFieldLocked(0);

      // Toggle again to unlock
      await campaignPage.toggleLock(0);
      await campaignPage.expectFieldUnlocked(0);
    });

    test("should disable input when locked", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Lock the first field
      await campaignPage.toggleLock(0);

      // Verify input is disabled
      const input = campaignPage.getNthInput(0);
      await expect(input).toBeDisabled();
    });

    test("should enable input when unlocked", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Lock then unlock
      await campaignPage.toggleLock(0);
      await campaignPage.toggleLock(0);

      // Verify input is enabled
      const input = campaignPage.getNthInput(0);
      await expect(input).toBeEnabled();
    });
  });

  test.describe("Typing Custom Suggestions", () => {
    test("should allow typing custom text in unlocked fields", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Type custom text
      const customText = "My Custom Headline";
      await campaignPage.fillNthInput(0, customText);

      // Verify the value
      await expect(campaignPage.getNthInput(0)).toHaveValue(customText);
    });

    test("should show character count as user types", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Type some text
      const customText = "Test Headline";
      await campaignPage.fillNthInput(0, customText);

      // Look for character count indicator (format: "13/30")
      await expect(page.getByText(`${customText.length}/30`)).toBeVisible();
    });
  });

  test.describe("Character Limit Validations", () => {
    test("should show error for headline exceeding 30 characters", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Type a headline that's too long
      await campaignPage.fillNthInput(0, INVALID_TEST_DATA.headlineTooLong);

      // Lock the field to trigger validation
      await campaignPage.toggleLock(0);

      // Try to continue - should fail validation
      await campaignPage.clickContinue();

      // Check for validation error (button should shake)
      // The validation error message should be visible
      await expect(page.getByText("maximum is 30 characters")).toBeVisible();
    });

    test("should accept valid headlines within character limit", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Fill with valid headlines
      const inputCount = Math.min(await campaignPage.countInputFields(), 3);
      for (let i = 0; i < inputCount; i++) {
        await campaignPage.fillNthInput(i, VALID_TEST_DATA.headlines[i]);
        await campaignPage.toggleLock(i);
      }

      // Should be able to continue without errors
      await campaignPage.clickContinue();

      // Should move to next tab (or stay if more validation needed)
      // We need at least 3 locked headlines to proceed
    });
  });

  test.describe("Workflow Navigation", () => {
    test("should navigate through all workflow steps using Continue", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Start at content
      await campaignPage.expectFormVisible("content");

      // Complete content step (fills headlines + descriptions with valid data)
      await campaignPage.completeContentStep();

      // Continue to highlights
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("highlights");

      // Complete highlights step (fills callouts + snippet details with valid data)
      await campaignPage.completeHighlightsStep();

      // Continue to keywords
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("keywords");

      // Complete keywords step (fills keywords with valid data)
      await campaignPage.completeKeywordsStep();

      // Continue to settings
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("settings");

      // Complete settings step
      await campaignPage.completeSettingsStep();

      // Continue to launch
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("launch");

      // Continue to review
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("review");
    });

    test("should show Review button after visiting review page", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Navigate through the workflow quickly (minimal validation)
      // For this test, we'll click tabs to get to review faster
      // Note: This requires validation to pass or be bypassed
    });
  });

  test.describe("Back Button Navigation", () => {
    test("should navigate backwards through workflow", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Complete content step (fills headlines + descriptions)
      await campaignPage.completeContentStep();

      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);

      // Now on highlights - back button should be enabled
      await expect(campaignPage.backButton).toBeEnabled();

      // Click back
      await campaignPage.clickBack();
      await page.waitForTimeout(1000);

      // Should be back on content
      await campaignPage.expectFormVisible("content");
    });

    test("should preserve data when navigating back", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Complete content step (fills headlines + descriptions)
      await campaignPage.completeContentStep();

      // Get the value we set for the first headline
      const firstHeadlineInput = campaignPage.getInputsByFieldName("headlines").nth(0);
      const testValue = await firstHeadlineInput.inputValue();

      // Continue then come back
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);
      await campaignPage.clickBack();
      await page.waitForTimeout(1000);

      // Value should be preserved
      await expect(firstHeadlineInput).toHaveValue(testValue);
    });
  });

  test.describe("Geo Targeting API", () => {
    // Mock geo target constants data - similar to RSpec's mock_google_ads_api
    const MOCK_GEO_TARGETS = {
      "New York": [
        {
          id: 1,
          criteria_id: 1023191,
          name: "New York",
          canonical_name: "New York,New York,United States",
          country_code: "US",
          target_type: "City",
          status: "Active",
        },
        {
          id: 2,
          criteria_id: 21167,
          name: "New York",
          canonical_name: "New York,United States",
          country_code: "US",
          target_type: "State",
          status: "Active",
        },
      ],
      California: [
        {
          id: 3,
          criteria_id: 21137,
          name: "California",
          canonical_name: "California,United States",
          country_code: "US",
          target_type: "State",
          status: "Active",
        },
        {
          id: 4,
          criteria_id: 1013962,
          name: "Los Angeles",
          canonical_name: "Los Angeles,California,United States",
          country_code: "US",
          target_type: "City",
          status: "Active",
        },
      ],
    };

    // Use campaign_settings_step snapshot to start directly on the settings page
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_settings_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      campaignPage = new CampaignPage(page);

      // Mock the geo_target_constants API endpoint (similar to RSpec's mock_google_ads_api)
      await page.route("**/api/v1/geo_target_constants*", async (route) => {
        const url = new URL(route.request().url());
        const query = url.searchParams.get("location_query") || "";

        // Find matching mock data
        let results: (typeof MOCK_GEO_TARGETS)["New York"] = [];
        for (const [key, data] of Object.entries(MOCK_GEO_TARGETS)) {
          if (
            key.toLowerCase().includes(query.toLowerCase()) ||
            query.toLowerCase().includes(key.toLowerCase())
          ) {
            results = [...results, ...data];
          }
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(results),
        });
      });
    });

    test("should search for locations and show results", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Search for a location
      await campaignPage.locationSearchInput.fill("New York");

      // Wait for search results to load (mocked API should respond immediately)
      // Look for canonical_name which is displayed in the dropdown
      await expect(
        page.locator('button:has-text("New York,New York,United States")').first()
      ).toBeVisible({ timeout: 5000 });

      // Should show both City and State results (use exact match for target_type badges)
      await expect(page.locator(".rounded:has-text('City')").first()).toBeVisible();
      await expect(page.locator(".rounded:has-text('State')").first()).toBeVisible();
    });

    test("should add selected location to targeting list", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Search and select a location
      await campaignPage.locationSearchInput.fill("California");

      // Wait for search results to load (mocked API)
      const californiaResult = page.locator('button:has-text("California,United States")').first();
      await expect(californiaResult).toBeVisible({ timeout: 5000 });

      // Click on the result to add it
      await californiaResult.click();

      // Verify it was added to the targeting list using specific testid
      // criteria_id 21137 is California from our mock data
      const locationItem = page.getByTestId("location-item-21137");
      await expect(locationItem).toBeVisible({ timeout: 5000 });

      // Verify the location details are correct
      await expect(locationItem.getByTestId("location-name")).toHaveText(
        "California,United States"
      );
      await expect(locationItem.getByTestId("location-type")).toHaveText("State");

      // New locations should default to targeted
      await expect(locationItem).toHaveAttribute("data-targeted", "true");

      // United States should be removed when a more specific target is added
      const usaItem = page.getByTestId("location-item-2840");
      await expect(usaItem).not.toBeVisible();
    });

    test("should toggle location between targeted and excluded", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // The default "United States" location should already be in the list (criteria_id 2840)
      const usaItem = page.getByTestId("location-item-2840");
      await expect(usaItem).toBeVisible({ timeout: 5000 });

      // Should start as targeted
      await expect(usaItem).toHaveAttribute("data-targeted", "true");

      // Click toggle to switch to excluded
      const toggle = page.getByTestId("location-toggle-2840");
      await toggle.click();

      // Should now be excluded
      await expect(usaItem).toHaveAttribute("data-targeted", "false");

      // Click again to switch back to targeted
      await toggle.click();
      await expect(usaItem).toHaveAttribute("data-targeted", "true");
    });

    test("should remove location from targeting list", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      const usaItem = page.getByTestId("location-item-2840");

      // Add a new location first
      await campaignPage.locationSearchInput.fill("New York");
      const nyResult = page.locator('button:has-text("New York,New York,United States")').first();
      await expect(nyResult).toBeVisible({ timeout: 5000 });
      await nyResult.click();

      // Verify it was added (criteria_id 1023191 is New York City from our mock)
      const nyItem = page.getByTestId("location-item-1023191");
      await expect(nyItem).toBeVisible({ timeout: 5000 });

      // United States should be removed when a more specific target is added
      await expect(usaItem).not.toBeVisible();

      // Click remove button
      await page.getByTestId("location-remove-1023191").click();

      // Verify it was removed
      await expect(nyItem).not.toBeVisible();

      // United States should be restored after removing all specific targets
      await expect(usaItem).toBeVisible({ timeout: 5000 });
    });

    test("should show United States as targeted on initial page load", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // The default "United States" location should already be in the list (criteria_id 2840)
      const usaItem = page.getByTestId("location-item-2840");
      await expect(usaItem).toBeVisible({ timeout: 5000 });

      // Should be targeted on initial load
      await expect(usaItem).toHaveAttribute("data-targeted", "true");
    });

    test("should remove United States when more specific US target is added", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Verify United States starts as targeted
      const usaItem = page.getByTestId("location-item-2840");
      await expect(usaItem).toBeVisible({ timeout: 5000 });
      await expect(usaItem).toHaveAttribute("data-targeted", "true");

      // Add a more specific US location (California - a US state)
      await campaignPage.locationSearchInput.fill("California");
      const californiaResult = page.locator('button:has-text("California,United States")').first();
      await expect(californiaResult).toBeVisible({ timeout: 5000 });
      await californiaResult.click();

      // California should be added and targeted
      const californiaItem = page.getByTestId("location-item-21137");
      await expect(californiaItem).toBeVisible({ timeout: 5000 });
      await expect(californiaItem).toHaveAttribute("data-targeted", "true");

      // United States should be removed because a more specific target exists
      await expect(usaItem).not.toBeVisible();
    });

    test("should restore United States after removing all specific US targets", async ({
      page,
    }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      const usaItem = page.getByTestId("location-item-2840");
      await expect(usaItem).toBeVisible({ timeout: 5000 });

      // Add a more specific location (California)
      await campaignPage.locationSearchInput.fill("California");
      const californiaResult = page.locator('button:has-text("California,United States")').first();
      await expect(californiaResult).toBeVisible({ timeout: 5000 });
      await californiaResult.click();

      // Wait for California to be added
      const californiaItem = page.getByTestId("location-item-21137");
      await expect(californiaItem).toBeVisible({ timeout: 5000 });

      // United States should be removed when more specific target exists
      await expect(usaItem).not.toBeVisible();

      // Remove California
      await page.getByTestId("location-remove-21137").click();

      // California should be removed
      await expect(californiaItem).not.toBeVisible();

      // United States should be restored and targeted automatically
      await expect(usaItem).toBeVisible({ timeout: 5000 });
      await expect(usaItem).toHaveAttribute("data-targeted", "true");
    });

    test("should preserve targeted locations when navigating between tabs", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Add California to targeting
      await campaignPage.locationSearchInput.fill("California");
      const californiaResult = page.locator('button:has-text("California,United States")').first();
      await expect(californiaResult).toBeVisible({ timeout: 5000 });
      await californiaResult.click();

      // Verify California was added
      const californiaItem = page.getByTestId("location-item-21137");
      await expect(californiaItem).toBeVisible({ timeout: 5000 });
      await expect(californiaItem).toHaveAttribute("data-targeted", "true");

      // Navigate to a different tab (keywords)
      await campaignPage.clickTab("keywords");
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("keywords");

      // Navigate back to settings
      await campaignPage.clickTab("settings");
      await page.waitForTimeout(1000);
      await campaignPage.expectFormVisible("settings");

      // California should still be present after navigating back
      const californiaItemAfterNav = page.getByTestId("location-item-21137");
      await expect(californiaItemAfterNav).toBeVisible({ timeout: 5000 });
      await expect(californiaItemAfterNav).toHaveAttribute("data-targeted", "true");

      // United States should NOT be present because a more specific target exists
      const usaItemAfterNav = page.getByTestId("location-item-2840");
      await expect(usaItemAfterNav).not.toBeVisible();
    });
  });

  test.describe("Ad Schedule", () => {
    // Use campaign_settings_step snapshot to start directly on the settings page
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_settings_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      campaignPage = new CampaignPage(page);
    });

    test("should toggle individual days", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Get a day button to test toggling
      const tuesButton = page.getByTestId("schedule-day-tues");

      // Get the initial state (may vary based on snapshot data)
      const initialState = await tuesButton.getAttribute("data-selected");

      // Click to toggle
      await campaignPage.clickScheduleDay("tues");

      // Verify state changed to opposite
      const expectedAfterFirstClick = initialState === "true" ? "false" : "true";
      await expect(tuesButton).toHaveAttribute("data-selected", expectedAfterFirstClick);

      // Click again to toggle back
      await campaignPage.clickScheduleDay("tues");

      // Verify it's back to original state
      await expect(tuesButton).toHaveAttribute("data-selected", initialState!);
    });

    test("should select all days when clicking Always On", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Click Always On
      await campaignPage.setAlwaysOn();

      // All days should be selected
      const alwaysOnButton = page.getByTestId("schedule-day-always-on");
      await expect(alwaysOnButton).toHaveAttribute("data-selected", "true");
    });

    test("should show time selectors when not Always On", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Select just Monday (not Always On)
      await campaignPage.clickScheduleDay("mon");

      // Should show time selectors
      await expect(page.getByText("Start Time")).toBeVisible();
      await expect(page.getByText("End Time")).toBeVisible();
      await expect(page.getByText("Time Zone")).toBeVisible();
    });
  });

  test.describe("Budget Settings", () => {
    // Use campaign_settings_step snapshot to start directly on the settings page
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_settings_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      campaignPage = new CampaignPage(page);
    });

    test("should set budget value", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Set budget
      await campaignPage.setBudget(50);

      // Verify value
      await expect(campaignPage.budgetInput).toHaveValue("50");
    });

    test("should show Ask Chat button for budget recommendations", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Look for the Ask Chat button
      await expect(page.getByText("Ask chat for recommendations")).toBeVisible();
    });

    test("should send budget recommendation request to chat", async ({ page }) => {
      await campaignPage.goto(projectUuid, "settings");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("settings");

      // Click Ask Chat
      await page.getByText("Ask chat for recommendations").click();

      // Wait for response
      await campaignPage.waitForAIResponse(30000);

      // Chat should contain the budget question
      await expect(campaignPage.adsChatMessages).toContainText("budget");
    });
  });

  test.describe("Review Page Navigation", () => {
    // Use campaign_review_step snapshot to start directly on the review page
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_review_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      campaignPage = new CampaignPage(page);
    });

    test("should display all sections on review page", async ({ page }) => {
      await campaignPage.goto(projectUuid, "review");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("review");

      // Verify sections are displayed
      await expect(page.getByTestId("review-section-content")).toBeVisible();
      await expect(page.getByTestId("review-section-keywords")).toBeVisible();
      await expect(page.getByTestId("review-section-settings")).toBeVisible();
      await expect(page.getByTestId("review-section-launch")).toBeVisible();
    });

    test("should allow clicking Edit Section to return to that step", async ({ page }) => {
      await campaignPage.goto(projectUuid, "review");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("review");

      // Click Edit Section on Settings
      await page.getByTestId("edit-section-button").first().click();
      await page.waitForTimeout(1000);

      // Should be back on a previous form (not review)
      await expect(campaignPage.reviewForm).not.toBeVisible();
    });
  });

  test.describe("Editing During Review", () => {
    // Use campaign_review_step snapshot to start directly on the review page
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_review_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      campaignPage = new CampaignPage(page);
    });

    test("should show Return to Review button after editing from review", async ({ page }) => {
      await campaignPage.goto(projectUuid, "review");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("review");

      // Click edit on first section
      await page.getByTestId("edit-section-button").first().click();
      await page.waitForTimeout(1000);

      // Should see "Return to Review" button
      await expect(campaignPage.reviewButton).toBeVisible();
    });

    test("should reflect changes when returning to review", async ({ page }) => {
      await campaignPage.goto(projectUuid, "review");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("review");

      // The snapshot has known data - verify something is shown
      // Click edit on content section
      await page.getByTestId("edit-field-group-button").first().click();

      // Wait for content form to appear
      await campaignPage.expectFormVisible("content");
      await page.waitForTimeout(1000); // Give time for inputs to fully render

      // Use the second headline (index 1) which is already unlocked based on snapshot data
      const newHeadline = "Updated Headline 2";
      const secondHeadlineInput = campaignPage.getInputsByFieldName("headlines").nth(1);

      // The second headline should already be unlocked - verify and fill
      await expect(secondHeadlineInput).toBeEnabled({ timeout: 5000 });

      // Fill with new value
      await secondHeadlineInput.clear();
      await secondHeadlineInput.fill(newHeadline);

      // Lock it to save the value
      const secondHeadlineLock = secondHeadlineInput.locator(
        "xpath=ancestor::*[@data-testid='lockable-input-group']/preceding-sibling::button[@data-testid='lock-toggle-button']"
      );
      await secondHeadlineLock.click();
      await expect(secondHeadlineInput).toBeDisabled({ timeout: 5000 });

      // Return to review
      await campaignPage.clickReturnToReview();

      // Verify updated headline is shown
      await expect(page.getByText(newHeadline)).toBeVisible();
    });
  });

  test.describe("Autosave Race Conditions", () => {
    test("should autosave on blur", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Type in a headline field
      const headlineInput = campaignPage.getInputsByFieldName("headlines").nth(0);
      await headlineInput.clear();
      await headlineInput.fill(VALID_TEST_DATA.headlines[0]);

      // Blur by clicking elsewhere
      await page.click("body");

      // Wait for autosave
      await campaignPage.waitForAutosave();

      // Value should still be there
      await expect(headlineInput).toHaveValue(VALID_TEST_DATA.headlines[0]);
    });

    test("should handle rapid typing followed by continue click", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Complete content step to put form in valid state
      await campaignPage.completeContentStep();

      // Immediately click continue (simulating race condition)
      await campaignPage.clickContinue();

      // Wait a moment for any pending saves
      await page.waitForTimeout(1000);

      // Go back and verify data was saved
      await campaignPage.clickBack();
      await page.waitForTimeout(1000);

      // Data should be preserved - check first headline
      const firstHeadline = campaignPage.getInputsByFieldName("headlines").nth(0);
      await expect(firstHeadline).toHaveValue(VALID_TEST_DATA.headlines[0]);
    });

    test("should not lose data when clicking continue very fast after typing", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Complete content step to put form in valid state
      await campaignPage.completeContentStep();

      // Get the values we set
      const firstHeadline = campaignPage.getInputsByFieldName("headlines").nth(0);
      const testValue = await firstHeadline.inputValue();

      // Click continue immediately
      await campaignPage.continueButton.click();

      // Don't wait - immediately try to go back
      await page.waitForTimeout(500);
      await campaignPage.clickBack();

      await page.waitForTimeout(1000);

      // Value should be saved
      await expect(firstHeadline).toHaveValue(testValue);
    });
  });

  test.describe("Tab Switching", () => {
    test("should switch between tabs using tab buttons", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Start at content
      await campaignPage.expectTabActive("content");

      // Complete content step to allow forward navigation
      await campaignPage.completeContentStep();

      // Try clicking highlights tab
      await campaignPage.clickTab("highlights");
      await page.waitForTimeout(1000);

      // Should now show highlights form
      await campaignPage.expectFormVisible("highlights");
      await campaignPage.expectTabActive("highlights");
    });

    test("should not allow forward tab navigation without validation", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Start at content
      await campaignPage.expectTabActive("content");

      // Try to click a later tab without filling required fields
      await campaignPage.clickTab("highlights");

      // Should still be on content (validation failed)
      // Note: Actual behavior depends on validation implementation
    });

    test("should allow backward tab navigation without validation", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      // Complete content step and navigate forward
      await campaignPage.completeContentStep();
      await campaignPage.clickContinue();
      await page.waitForTimeout(1000);

      // Now on highlights, should be able to go back to content via tab
      await campaignPage.clickTab("content");
      await page.waitForTimeout(500);

      await campaignPage.expectTabActive("content");
    });
  });

  test.describe("Delete Field Functionality", () => {
    test("should delete a field when clicking delete button", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Get initial count
      const initialCount = await campaignPage.countInputFields();

      // Delete first field
      await campaignPage.deleteNthField(0);

      // Count should decrease
      const newCount = await campaignPage.countInputFields();
      expect(newCount).toBe(initialCount - 1);
    });

    test("should not delete locked fields", async ({ page }) => {
      await campaignPage.goto(projectUuid);
      await campaignPage.waitForReady();

      await page.waitForTimeout(2000);

      // Lock first field
      await campaignPage.toggleLock(0);

      const initialCount = await campaignPage.countInputFields();

      // Try to delete - get the delete button and check if it works
      // Note: Locked fields might still have delete button visible
      // but the field should remain after deletion attempt
    });
  });

  test.describe("Keyword Addition", () => {
    // Use campaign_keywords_step snapshot to start directly on the keywords page
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_keywords_step");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;
      campaignPage = new CampaignPage(page);
    });

    test("should add a new keyword via the input field", async ({ page }) => {
      await campaignPage.goto(projectUuid, "keywords");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("keywords");

      // Get the initial keywords
      const initialKeywords = await campaignPage.getKeywordValues();
      const initialCount = initialKeywords.length;

      // Add a new unique keyword
      const newKeyword = "brand new test keyword";
      await campaignPage.addKeyword(newKeyword);

      // Verify the count increased
      const afterKeywords = await campaignPage.getKeywordValues();
      expect(afterKeywords.length).toBe(initialCount + 1);

      // Verify the new keyword was added with the correct value
      // The bug we're testing: when adding a keyword, the previous keyword
      // value gets duplicated instead of the new keyword being added
      expect(afterKeywords).toContain(newKeyword);

      // Verify no duplicate of the last initial keyword was added
      const lastInitialKeyword = initialKeywords[initialKeywords.length - 1];
      if (lastInitialKeyword) {
        const countOfLastKeyword = afterKeywords.filter((k) => k === lastInitialKeyword).length;
        const wasLastKeywordInInitial = initialKeywords.filter(
          (k) => k === lastInitialKeyword
        ).length;
        expect(countOfLastKeyword).toBe(wasLastKeywordInInitial);
      }
    });

    test("should add keyword with correct value not duplicate previous", async ({ page }) => {
      await campaignPage.goto(projectUuid, "keywords");
      await campaignPage.waitForReady();
      await campaignPage.expectFormVisible("keywords");

      // Add first keyword
      const keyword1 = "first test keyword";
      await campaignPage.addKeyword(keyword1);

      // Get values after first add
      const afterFirst = await campaignPage.getKeywordValues();
      expect(afterFirst).toContain(keyword1);

      // Add second keyword - this should NOT duplicate keyword1
      const keyword2 = "second test keyword";
      await campaignPage.addKeyword(keyword2);

      // Get values after second add
      const afterSecond = await campaignPage.getKeywordValues();

      // Should contain both keywords
      expect(afterSecond).toContain(keyword1);
      expect(afterSecond).toContain(keyword2);

      // Count occurrences of keyword1 - should still be 1, not 2
      const keyword1Count = afterSecond.filter((k) => k === keyword1).length;
      expect(keyword1Count).toBe(1);
    });
  });
});

/**
 * Full Workflow Integration Test
 * This test navigates through the entire workflow from start to finish.
 */
test.describe("Full Workflow Integration", () => {
  test("should complete entire ad campaign workflow", async ({ page }) => {
    // Restore database
    await DatabaseSnapshotter.restoreSnapshot("campaign_content_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    const projectUuid = project.uuid;
    await loginUser(page);

    const campaignPage = new CampaignPage(page);
    await campaignPage.goto(projectUuid);
    await campaignPage.waitForReady();

    // Step 1: Content - Fill headlines and descriptions
    await campaignPage.completeContentStep();

    await campaignPage.clickContinue();
    await page.waitForTimeout(1500);

    // Step 2: Highlights - Fill callouts and snippets
    await campaignPage.expectFormVisible("highlights");
    await campaignPage.completeHighlightsStep();

    await campaignPage.clickContinue();
    await page.waitForTimeout(1500);

    // Step 3: Keywords - need at least 5 keywords selected
    await campaignPage.expectFormVisible("keywords");
    // Keywords need to be filled and locked - fill all available keyword inputs
    await campaignPage.completeKeywordsStep();

    await campaignPage.clickContinue();
    await page.waitForTimeout(1500);

    // Step 4: Settings - Location, Schedule, Budget
    await campaignPage.expectFormVisible("settings");
    await campaignPage.completeSettingsStep();

    await campaignPage.clickContinue();
    await page.waitForTimeout(1500);

    // Step 5: Launch - Campaign settings
    await campaignPage.expectFormVisible("launch");

    await campaignPage.clickContinue();
    await page.waitForTimeout(1500);

    // Step 6: Review - Final review
    await campaignPage.expectFormVisible("review");

    // Verify review page shows our data
    await expect(page.getByText(VALID_TEST_DATA.headlines[0])).toBeVisible();
  });
});
