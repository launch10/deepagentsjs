import { test, expect, loginUser, testUser } from "../fixtures/auth";
import { DatabaseSnapshotter } from "../fixtures/database";
import { appScenario } from "../support/on-rails";
import { BrainstormPage } from "../pages/brainstorm.page";
import { WebsitePage } from "../pages/website.page";
import { CampaignPage } from "../pages/campaign.page";
import { e2eConfig } from "../config";

test.describe("Credit Limits", () => {
  let brainstormPage: BrainstormPage;

  test.describe("Pre-run 402 Response (Mocked)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");
      await loginUser(page);
      brainstormPage = new BrainstormPage(page);
    });

    test("shows exhaustion modal when Langgraph returns 402", async ({ page }) => {
      // Intercept the Langgraph stream endpoint and return 402
      await page.route("**/api/brainstorm/stream", async (route) => {
        await route.fulfill({
          status: 402,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Insufficient credits",
            code: "CREDITS_EXHAUSTED",
            balance: 0,
            planCredits: 0,
            packCredits: 0,
          }),
        });
      });

      await brainstormPage.goto();

      // Send a message which will trigger the mocked 402 response
      await brainstormPage.chatInput.fill("Test message for credit exhaustion");
      await brainstormPage.sendButton.click();

      // Verify the exhaustion modal appears
      await expect(page.getByTestId("credit-modal")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("You\u2019ve reached your credit limit")).toBeVisible();

      // Verify the modal has the expected content
      await expect(page.getByRole("link", { name: "Upgrade Plan" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Purchase Credits" })).toBeVisible();
    });

    test("can dismiss the exhaustion modal", async ({ page }) => {
      // Intercept the Langgraph stream endpoint and return 402
      await page.route("**/api/brainstorm/stream", async (route) => {
        await route.fulfill({
          status: 402,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Insufficient credits",
            code: "CREDITS_EXHAUSTED",
            balance: 0,
            planCredits: 0,
            packCredits: 0,
          }),
        });
      });

      await brainstormPage.goto();

      // Trigger the modal
      await brainstormPage.chatInput.fill("Test message");
      await brainstormPage.sendButton.click();

      // Wait for modal to appear
      await expect(page.getByTestId("credit-modal")).toBeVisible({
        timeout: 10000,
      });

      // Dismiss the modal via close button
      await page.getByTestId("credit-modal-close").click();

      // Verify modal is hidden
      await expect(page.getByTestId("credit-modal")).not.toBeVisible();
    });
  });

  test.describe("Real Credit Limits Flow", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      // Set credits to 10 millicredits (0.01 credits) - non-zero so textarea
      // isn't disabled, but small enough to be exhausted by one LLM call (~57mc)
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 10, pack_millicredits: 0 });

      await loginUser(page);
      brainstormPage = new BrainstormPage(page);
    });

    test("shows exhaustion modal after real brainstorm depletes credits", async ({ page }) => {
      await brainstormPage.goto();

      // Low credit warning modal appears first (0.10 credits = ~100% usage)
      // Dismiss it so we can interact with the chat
      await expect(page.getByTestId("credit-modal")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("credit-modal-close").click();
      await expect(page.getByTestId("credit-modal")).not.toBeVisible();

      // Send a real brainstorm message
      // This will make an actual LLM call which costs more than 0.10 credits
      await brainstormPage.sendMessage("I want to start a coffee subscription service");

      // Wait for the AI response to complete
      await brainstormPage.waitForResponse(e2eConfig.timeouts.aiResponse);

      // After the response, the credit status should trigger the exhausted modal
      // justExhausted force-shows it even though we dismissed the low credit modal
      await expect(page.getByTestId("credit-modal")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("You\u2019ve reached your credit limit")).toBeVisible();

      // Verify modal content shows the low/negative balance
      await expect(page.getByRole("link", { name: "Upgrade Plan" })).toBeVisible();
    });

    test("submit button is disabled and credit gate visible after exhaustion", async ({ page }) => {
      await brainstormPage.goto();

      // Low credit warning modal appears first — dismiss it
      await expect(page.getByTestId("credit-modal")).toBeVisible({ timeout: 10000 });
      await page.getByTestId("credit-modal-close").click();
      await expect(page.getByTestId("credit-modal")).not.toBeVisible();

      // Send a message to exhaust credits
      await brainstormPage.sendMessage("I want to start a coffee subscription service");
      await brainstormPage.waitForResponse(e2eConfig.timeouts.aiResponse);

      // Wait for the exhausted modal to appear (confirms exhaustion detected)
      await expect(page.getByTestId("credit-modal")).toBeVisible({
        timeout: 15000,
      });

      // Dismiss the exhausted modal via close button
      await page.getByTestId("credit-modal-close").click();
      await expect(page.getByTestId("credit-modal")).not.toBeVisible();

      // After exhaustion, the send button should be disabled due to credits
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.sendButton).toHaveAttribute(
        "data-disabled-reason",
        "credits"
      );

      // The CreditGate should be visible with "Purchase credits to use AI"
      await expect(page.getByTestId("credit-gate")).toBeVisible();
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      // Verify no new user message was added (input was gated)
      const userMessageCount = await brainstormPage.getUserMessageCount();
      // Should still be 1 (only the original message)
      expect(userMessageCount).toBe(1);

      // Reload the page — credit gate should persist via inertia_share hydration
      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      // After reload, credit gate should still be visible
      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      // Send button still disabled with credits reason
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.sendButton).toHaveAttribute(
        "data-disabled-reason",
        "credits"
      );

      // Textarea still disabled
      await expect(brainstormPage.chatInput).toBeDisabled();
    });
  });

  test.describe("Credit Gate Persists Across Reload", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      // Set credits to 0 (completely exhausted)
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 0, pack_millicredits: 0 });

      await loginUser(page);
      brainstormPage = new BrainstormPage(page);
    });

    test("send button and input are disabled on page load when credits are 0", async ({ page }) => {
      await brainstormPage.goto();

      // The CreditGate should be immediately visible
      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      // The send button should be disabled due to credits
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.sendButton).toHaveAttribute(
        "data-disabled-reason",
        "credits"
      );

      // The textarea should be disabled — user cannot enter input
      await expect(brainstormPage.chatInput).toBeDisabled();
    });

    test("credit exhaustion state persists after page reload", async ({ page }) => {
      await brainstormPage.goto();

      // Verify initial state: credit gate visible, input disabled
      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.chatInput).toBeDisabled();

      // Reload the page
      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      // After reload, inertia_share hydrates credits again from DB
      // Credit gate should still be visible
      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      // Send button should still be disabled due to credits
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.sendButton).toHaveAttribute(
        "data-disabled-reason",
        "credits"
      );

      // Textarea should still be disabled
      await expect(brainstormPage.chatInput).toBeDisabled();
    });

    test("credit gate links to subscriptions page", async ({ page }) => {
      await brainstormPage.goto();

      // Verify the "Purchase credits to use AI" link points to subscriptions
      const creditGateLink = page.getByTestId("credit-gate-link");
      await expect(creditGateLink).toBeVisible({ timeout: 10000 });
      await expect(creditGateLink).toHaveAttribute("href", "/subscriptions");
    });
  });

  // =========================================================================
  // Credit Gate - All Chat Pages
  // =========================================================================

  test.describe("Credit Gate - Brainstorm Conversation", () => {
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("brainstorm_step");
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 0, pack_millicredits: 0 });

      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;

      await loginUser(page);
      brainstormPage = new BrainstormPage(page);
    });

    test("chat is fully disabled when out of credits", async ({ page }) => {
      await brainstormPage.gotoConversation(projectUuid);

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.sendButton).toHaveAttribute("data-disabled-reason", "credits");
      await expect(brainstormPage.chatInput).toBeDisabled();
    });

    test("credit gate persists after page reload", async ({ page }) => {
      await brainstormPage.gotoConversation(projectUuid);

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.chatInput).toBeDisabled();

      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();
      await expect(brainstormPage.sendButton).toBeDisabled();
      await expect(brainstormPage.sendButton).toHaveAttribute("data-disabled-reason", "credits");
      await expect(brainstormPage.chatInput).toBeDisabled();
    });
  });

  test.describe("Credit Gate - Website Builder", () => {
    let websitePage: WebsitePage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 0, pack_millicredits: 0 });

      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;

      await loginUser(page);
      websitePage = new WebsitePage(page);
    });

    test("chat is fully disabled when out of credits", async ({ page }) => {
      await websitePage.goto(projectUuid);

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      const sendButton = page.getByTestId("website-chat-submit");
      await expect(sendButton).toBeDisabled();
      await expect(sendButton).toHaveAttribute("data-disabled-reason", "credits");

      const chatInput = page.getByTestId("website-chat-input");
      await expect(chatInput).toBeDisabled();
    });

    test("credit gate persists after page reload", async ({ page }) => {
      await websitePage.goto(projectUuid);

      const sendButton = page.getByTestId("website-chat-submit");
      const chatInput = page.getByTestId("website-chat-input");

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(sendButton).toBeDisabled();
      await expect(chatInput).toBeDisabled();

      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();
      await expect(sendButton).toBeDisabled();
      await expect(sendButton).toHaveAttribute("data-disabled-reason", "credits");
      await expect(chatInput).toBeDisabled();
    });
  });

  test.describe("Credit Gate - Ads Campaign", () => {
    let campaignPage: CampaignPage;
    let projectUuid: string;

    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("campaign_content_step");
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 0, pack_millicredits: 0 });

      const project = await DatabaseSnapshotter.getFirstProject();
      projectUuid = project.uuid;

      await loginUser(page);
      campaignPage = new CampaignPage(page);
    });

    test("chat is fully disabled when out of credits", async ({ page }) => {
      await campaignPage.goto(projectUuid, "content");

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();

      await expect(campaignPage.adsChatSubmit).toBeDisabled();
      await expect(campaignPage.adsChatSubmit).toHaveAttribute("data-disabled-reason", "credits");
      await expect(campaignPage.adsChatInput).toBeDisabled();
    });

    test("credit gate persists after page reload", async ({ page }) => {
      await campaignPage.goto(projectUuid, "content");

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(campaignPage.adsChatSubmit).toBeDisabled();
      await expect(campaignPage.adsChatInput).toBeDisabled();

      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Purchase credits to use AI")).toBeVisible();
      await expect(campaignPage.adsChatSubmit).toBeDisabled();
      await expect(campaignPage.adsChatSubmit).toHaveAttribute("data-disabled-reason", "credits");
      await expect(campaignPage.adsChatInput).toBeDisabled();
    });
  });

  // =========================================================================
  // Low Credit Warning (80% threshold)
  // =========================================================================

  test.describe("Low Credit Warning", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("basic_account");

      // Set plan credits to 200 millicredits (0.2 credits remaining).
      // The plan tier allocates 2000+ credits, so this is well above 80% usage.
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 200, pack_millicredits: 0 });

      await loginUser(page);

      // Clear any persisted dismiss state from localStorage (once, not on every navigation)
      await page.evaluate(() => localStorage.removeItem("credit-store"));
    });

    test("shows low credit warning modal when usage exceeds 80%", async ({ page }) => {
      const brainstorm = new BrainstormPage(page);
      await brainstorm.goto();

      // Warning modal should be visible
      await expect(page.getByTestId("credit-modal")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("running low on credits")).toBeVisible();
    });

    test("can dismiss the low credit warning modal", async ({ page }) => {
      const brainstorm = new BrainstormPage(page);
      await brainstorm.goto();

      // Warning modal visible
      await expect(page.getByTestId("credit-modal")).toBeVisible({ timeout: 10000 });

      // Dismiss it
      await page.getByTestId("credit-modal-close").click();

      // Modal gone
      await expect(page.getByTestId("credit-modal")).not.toBeVisible();
    });

    test("dismissal persists across page reload", async ({ page }) => {
      const brainstorm = new BrainstormPage(page);
      await brainstorm.goto();

      // Warning modal visible
      await expect(page.getByTestId("credit-modal")).toBeVisible({ timeout: 10000 });

      // Dismiss it
      await page.getByTestId("credit-modal-close").click();
      await expect(page.getByTestId("credit-modal")).not.toBeVisible();

      // Reload
      await page.reload();
      await page.waitForLoadState("domcontentloaded");

      // Warning should still be dismissed (zustand persist stores dismissedAt in localStorage)
      await expect(page.getByTestId("credit-modal")).not.toBeVisible({ timeout: 5000 });
    });

    test("does not show low credit warning when credits are fully exhausted", async ({ page }) => {
      // Set credits to 0 — out of credits takes precedence
      await appScenario("set_credits", { email: testUser.email, plan_millicredits: 0, pack_millicredits: 0 });

      const brainstorm = new BrainstormPage(page);
      await brainstorm.goto();

      // Credit gate should show instead (not the low credit modal)
      await expect(page.getByTestId("credit-gate")).toBeVisible({ timeout: 10000 });
      // The low credit modal should not appear (out-of-credits state prevents it)
      await expect(page.getByText("running low on credits")).not.toBeVisible();
    });

    test("warning modal links to subscriptions page", async ({ page }) => {
      const brainstorm = new BrainstormPage(page);
      await brainstorm.goto();

      await expect(page.getByTestId("credit-modal")).toBeVisible({ timeout: 10000 });

      // "Purchase Credits" and "Upgrade Plan" buttons link to /subscriptions
      const purchaseLink = page.getByTestId("credit-modal").getByRole("link", { name: "Purchase Credits" });
      await expect(purchaseLink).toBeVisible();
      await expect(purchaseLink).toHaveAttribute("href", "/subscriptions");

      const upgradeLink = page.getByTestId("credit-modal").getByRole("link", { name: "Upgrade Plan" });
      await expect(upgradeLink).toBeVisible();
      await expect(upgradeLink).toHaveAttribute("href", "/subscriptions");
    });
  });
});
