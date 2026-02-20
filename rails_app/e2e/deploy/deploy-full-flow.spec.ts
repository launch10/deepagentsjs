import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { appQuery, appScenario, appEval } from "../support/on-rails";
import { loginUser, testUser } from "../fixtures/auth";
import { DeployPage } from "../pages/deploy.page";
import { E2EMocks } from "../fixtures/e2e-mocks";

/**
 * Deploy Full-Flow Integration Tests (Layer 2)
 *
 * Real Langgraph + Rails + threaded Sidekiq. Google Ads API mocked via
 * E2eGoogleAdsClient, Cloudflare R2 mocked via E2eS3Client.
 *
 * These tests exercise the entire deploy lifecycle:
 * - Langgraph graph orchestrates the deploy
 * - Rails API creates job_runs
 * - Sidekiq workers run in background threads (SIDEKIQ_THREADED)
 * - Workers call services that use mock clients
 * - Workers complete and notify Langgraph via webhook
 * - Frontend renders progressive task updates via SSE
 *
 * Timeouts are long (60-120s) because real workers and graph traversal take time.
 */

// Use a longer default timeout for these full-stack tests
test.setTimeout(120_000);

test.describe("Deploy Full-Flow — Website Only", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    // deploy_ready = domain_step + SEO index.html + llms.txt
    // All LLM-heavy deploy tasks (SEO, LLMs, Analytics) skip naturally.
    await DatabaseSnapshotter.restoreSnapshot("deploy_ready");
    await E2EMocks.reset();
    await E2EMocks.setupDeployMocks();
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("sidebar shows progressive task updates, skips Google steps, and completes", async ({
    page,
  }) => {
    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Assert: "Checking for bugs" must appear in a non-completed state first.
    // page.waitForSelector uses CDP DOM observation, which catches even
    // brief intermediate states that React may batch away on the next frame.
    await page.waitForSelector(
      '[data-testid="checklist-item-Checking for bugs"]:not([data-status="completed"])',
      { timeout: 30000 }
    );

    // Assert: it then transitions to completed
    await expect(deployPage.checklistItem("Checking for bugs")).toHaveAttribute(
      "data-status",
      "completed",
      { timeout: 60000 }
    );

    // Google-specific screens should NOT appear
    await expect(deployPage.googleConnectHeading).not.toBeVisible();

    // Assert: deploy completes successfully
    await expect(deployPage.deployCompleteHeading).toBeVisible({
      timeout: 90000,
    });
    await expect(deployPage.liveBadge).toBeVisible();
  });
});

test.describe("Deploy Full-Flow — Campaign Happy Path", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    // campaign_launch_step = project at ads/launch step with campaign data
    await DatabaseSnapshotter.restoreSnapshot("campaign_launch_step");
    await appScenario("reset_deploy_state");
    await appScenario("fix_campaign_for_deploy");
    await E2EMocks.reset();
    await E2EMocks.setupDeployMocks();
    // Add SEO index.html + llms.txt so LLM-heavy tasks skip
    await appScenario("prepare_website_for_deploy");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("full campaign deploy — OAuth → invite → payment → campaign", async ({ page }) => {
    // Capture DEPLOY_SCREEN_DEBUG console logs
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("DEPLOY_SCREEN_DEBUG")) {
        require("fs").appendFileSync("/tmp/deploy-console.log", text + "\n");
      }
    });

    // Configure mock: invite "accepted", billing "approved"
    // These return immediately when polled, so steps complete fast
    await E2EMocks.setupGoogleMock({
      billing: "approved",
      invite: "accepted",
    });

    await deployPage.gotoCampaignDeploy(projectUuid);

    // 1. Deploy starts → Google Connect screen (OAuth is browser redirect)
    await expect(deployPage.googleConnectHeading).toBeVisible({
      timeout: 30000,
    });

    // 2. Simulate OAuth completion via scenario
    await E2EMocks.completeOAuth(testUser.email);

    // 3. Progressive rendering: "Verifying Google Account" should appear
    //    in a non-completed state before completing
    await page.waitForSelector(
      '[data-testid="checklist-item-Verifying Google Account"]:not([data-status="completed"])',
      { timeout: 30000 }
    );

    // 4. After OAuth, real workers cascade:
    //    SendInviteWorker → PollInviteAcceptanceWorker (mock returns "accepted")
    //    PaymentCheckWorker (mock returns "approved")
    //    CampaignDeploy::DeployWorker runs all steps
    //    CampaignEnableWorker enables campaign

    // 5. Wait for deploy to complete (all workers run with mock responses)
    await expect(deployPage.deployCompleteHeading).toBeVisible({
      timeout: 120000,
    });
    await expect(deployPage.liveBadge).toBeVisible();
  });

  test("skips OAuth when Google already connected", async ({ page }) => {
    // Pre-create ConnectedAccount so OAuth step is skipped
    await E2EMocks.createGoogleAccount(testUser.email);
    await E2EMocks.setupGoogleMock({
      billing: "approved",
      invite: "accepted",
    });

    await deployPage.gotoCampaignDeploy(projectUuid);

    // Should NOT show Google Connect screen (already connected)
    await expect(deployPage.googleConnectHeading).not.toBeVisible();

    // Progressive rendering: "Checking for bugs" should appear
    // in a non-completed state before completing
    await page.waitForSelector(
      '[data-testid="checklist-item-Checking for bugs"]:not([data-status="completed"])',
      { timeout: 30000 }
    );

    // Wait for completion
    await expect(deployPage.deployCompleteHeading).toBeVisible({
      timeout: 120000,
    });
  });
});

test.describe("Deploy Full-Flow — Payment States", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("campaign_launch_step");
    await appScenario("reset_deploy_state");
    await appScenario("fix_campaign_for_deploy");
    await E2EMocks.reset();
    await E2EMocks.setupDeployMocks();
    await appScenario("prepare_website_for_deploy");
    // Pre-create ConnectedAccount so OAuth is skipped in these tests
    await E2EMocks.createGoogleAccount(testUser.email);
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("payment pending shows Payment Required screen", async ({ page }) => {
    // Billing status "pending" means no payment method yet
    await E2EMocks.setupGoogleMock({
      billing: "pending",
      invite: "accepted",
    });

    await deployPage.gotoCampaignDeploy(projectUuid);

    // OAuth skips (ConnectedAccount exists)
    // Invite completes (mock returns "accepted")
    // Payment check returns "pending" → shows Payment Required screen
    await expect(deployPage.paymentHeading).toBeVisible({ timeout: 60000 });
    await expect(deployPage.addPaymentButton).toBeVisible();
  });
});

test.describe("Deploy Full-Flow — Error Recovery", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("campaign_launch_step");
    await appScenario("reset_deploy_state");
    await appScenario("fix_campaign_for_deploy");
    await E2EMocks.reset();
    await E2EMocks.setupDeployMocks();
    await appScenario("prepare_website_for_deploy");
    // Pre-create ConnectedAccount so OAuth is skipped in these tests
    await E2EMocks.createGoogleAccount(testUser.email);
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("campaign deploy error shows failure screen", async ({ page }) => {
    // Inject error at the campaign creation step
    await E2EMocks.setupGoogleMock({
      billing: "approved",
      invite: "accepted",
      error_at: "create_campaign",
    });

    await deployPage.gotoCampaignDeploy(projectUuid);

    // Deploy starts, budget step succeeds, campaign step fails
    await expect(deployPage.deployFailedHeading).toBeVisible({
      timeout: 120000,
    });
  });

  test("retry after failure succeeds when error is cleared", async ({ page }) => {
    // First deploy: inject error at budget step
    await E2EMocks.setupGoogleMock({
      billing: "approved",
      invite: "accepted",
      error_at: "sync_budget",
    });

    await deployPage.gotoCampaignDeploy(projectUuid);

    // Wait for failure
    await expect(deployPage.deployFailedHeading).toBeVisible({
      timeout: 120000,
    });

    // Clear the error for retry
    await E2EMocks.setErrorAt(null);

    // Click retry
    await deployPage.retryDeployButton.click();

    // Should eventually complete
    await expect(deployPage.deployCompleteHeading).toBeVisible({
      timeout: 120000,
    });
  });

  test("invite declined shows error", async ({ page }) => {
    await E2EMocks.setupGoogleMock({
      billing: "approved",
      invite: "declined",
    });

    await deployPage.gotoCampaignDeploy(projectUuid);

    // Invite worker sees "declined" → fails the job
    await expect(deployPage.deployFailedHeading).toBeVisible({
      timeout: 60000,
    });
  });
});
