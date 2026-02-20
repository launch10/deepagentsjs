import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { appQuery, appEval } from "../support/on-rails";
import { loginUser } from "../fixtures/auth";
import { DeployPage } from "../pages/deploy.page";
import { mockDeployStream, DeployStates } from "../fixtures/deploy-stream";

/**
 * Deploy Screen Tests (Layer 1)
 *
 * Deterministic tests that mock the SSE stream via page.route().
 * No server interaction needed beyond initial page load.
 * Tests every screen renders correctly with the right elements.
 */

test.describe("Deploy Screens — Google Flow Screens", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test("Google Connect screen shows sign-in button", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.googleConnect()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(deployPage.googleConnectHeading).toBeVisible({
      timeout: 15000,
    });
    await expect(deployPage.signInWithGoogleButton).toBeVisible();
  });

  test("Invite Accept screen shows Open Gmail button and Resend Invite", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.inviteAccept()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(deployPage.inviteHeading).toBeVisible({ timeout: 15000 });
    await expect(deployPage.openGmailButton).toBeVisible();
    await expect(deployPage.resendInviteLink).toBeVisible();
  });

  test("Payment Required screen shows Add Payment Method button", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.paymentRequired()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(deployPage.paymentHeading).toBeVisible({ timeout: 15000 });
    await expect(deployPage.addPaymentButton).toBeVisible();
    await expect(deployPage.externalActionBadge).toBeVisible();
  });

  test("Checking Payment screen shows Google Payment Setup heading", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.checkingPayment()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(deployPage.checkingPaymentHeading).toBeVisible({
      timeout: 15000,
    });
  });

  test("Payment Confirmed screen shows confirmed text", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.paymentConfirmed()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(deployPage.paymentConfirmedText).toBeVisible({
      timeout: 15000,
    });
  });

  test("Waiting for Google screen shows check again button", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.waitingGoogle()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(deployPage.waitingGoogleText).toBeVisible({ timeout: 15000 });
    await expect(deployPage.checkAgainButton).toBeVisible();
  });
});

test.describe("Deploy Screens — In-Progress", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test("website in-progress shows 'Launching your website'", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.websiteInProgress()));

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(page.getByText("Launching your website")).toBeVisible({
      timeout: 15000,
    });
  });

  test("campaign in-progress shows 'Launching your website & campaign'", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.campaignInProgress()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(page.getByText("Launching your website & campaign")).toBeVisible({
      timeout: 15000,
    });
  });

  test("footer buttons are disabled during in-progress deploy", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.websiteInProgress()));

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(deployPage.previousStepButton).toBeVisible({
      timeout: 15000,
    });
    await expect(deployPage.previousStepButton).toBeDisabled();
    await expect(deployPage.seePerformanceButton).toBeDisabled();
  });
});

test.describe("Deploy Screens — Completion", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test("website deploy complete shows success heading and Live badge", async ({ page }) => {
    // Create a deploy record so the SDK loads state atomically via GET.
    await appEval(`
      project = Project.first
      Deploy.create!(
        project: project,
        status: 'completed',
        deploy_type: 'website'
      )
    `);

    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.websiteComplete()));

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(page.getByText("You've just launched your website")).toBeVisible({
      timeout: 15000,
    });
    await expect(deployPage.liveBadge).toBeVisible();
  });

  test("campaign deploy complete shows success heading and Live badge", async ({ page }) => {
    // Create a deploy record so the SDK has a threadId and loads state
    // atomically via GET. Without this, the module-level resolvedDeployThreadId
    // cache is cleared on every render (when !deploy && !thread_id), causing
    // late-mounting components to create new empty chat instances.
    await appEval(`
      project = Project.first
      Deploy.create!(
        project: project,
        status: 'completed',
        deploy_type: 'campaign'
      )
    `);

    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.campaignComplete()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(page.getByText("You've just launched your first campaign")).toBeVisible({
      timeout: 15000,
    });
    await expect(deployPage.liveBadge).toBeVisible();
  });

  test("continue button says 'See Performance' and navigates to performance page", async ({ page }) => {
    await appEval(`
      project = Project.first
      Deploy.create!(
        project: project,
        status: 'completed',
        deploy_type: 'campaign'
      )
    `);

    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.campaignComplete()));
    await deployPage.gotoCampaignDeploy(projectUuid);

    // Wait for deploy complete screen
    await expect(page.getByText("You've just launched your first campaign")).toBeVisible({ timeout: 15000 });

    // Button should say "See Performance" and be enabled
    await expect(deployPage.seePerformanceButton).toBeVisible();
    await expect(deployPage.seePerformanceButton).toBeEnabled();

    // Click navigates to performance page
    await deployPage.seePerformanceButton.click();
    await page.waitForURL(`**/projects/${projectUuid}/performance`);
  });
});

test.describe("Deploy Screens — Error & Warning", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test("failed deploy with support ticket shows ticket reference", async ({ page }) => {
    // Create a deploy record so the SDK loads state atomically via GET.
    // Without this, the supportTicket key may not be visible to DeployErrorScreen
    // when it mounts (see campaign complete test for full explanation).
    await appEval(`
      project = Project.first
      Deploy.create!(
        project: project,
        status: 'failed',
        deploy_type: 'website'
      )
    `);

    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream(DeployStates.failedWithTicket("SR-TEST9999"))
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(deployPage.deployFailedHeading).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("We've been notified and are looking into this")).toBeVisible();
    await expect(page.getByText("Reference: SR-TEST9999")).toBeVisible();
  });

  test("failed deploy without ticket shows retry button", async ({ page }) => {
    // Create a deploy record so the SDK loads state atomically via GET.
    await appEval(`
      project = Project.first
      Deploy.create!(
        project: project,
        status: 'failed',
        deploy_type: 'website'
      )
    `);

    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream(DeployStates.failedWithoutTicket())
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(deployPage.deployFailedHeading).toBeVisible({
      timeout: 15000,
    });
    await expect(deployPage.retryDeployButton).toBeVisible();
  });

  test("warning banner shows amber warning text", async ({ page }) => {
    const warningMsg = "Deploying website is taking longer than expected";
    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream(DeployStates.withWarning(warningMsg))
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(page.getByText(warningMsg)).toBeVisible({ timeout: 15000 });
  });

  test("no warning banner when no task has a warning", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.websiteInProgress()));

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(page.getByText("Launching your website")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("taking longer than expected")).not.toBeVisible();
  });
});

test.describe("Deploy Screens — Sidebar Tasks", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test("website deploy sidebar shows only website tasks", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.websiteInProgress()));

    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Wait for the in-progress heading to confirm page is loaded
    await expect(page.getByText("Launching your website")).toBeVisible({
      timeout: 15000,
    });
    // Website phase labels visible in sidebar
    await expect(page.getByText("Checking for bugs")).toBeVisible();
    await expect(page.getByText("Optimizing SEO")).toBeVisible();
    await expect(page.getByText("Connecting Analytics")).toBeVisible();

    // Google phase labels NOT visible
    await expect(page.getByText("Signing into Google")).not.toBeVisible();
    await expect(page.getByText("Syncing Campaign")).not.toBeVisible();
  });

  test("campaign deploy sidebar shows all tasks including Google", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.campaignInProgress()));

    await deployPage.gotoCampaignDeploy(projectUuid);

    // Wait for the in-progress heading to confirm page is loaded
    await expect(page.getByText("Launching your website & campaign")).toBeVisible({
      timeout: 15000,
    });
    // Google phase labels visible
    await expect(page.getByText("Signing into Google")).toBeVisible();
    await expect(page.getByText("Verifying Google Account")).toBeVisible();
    await expect(page.getByText("Checking payment status")).toBeVisible();
    // Website phase labels visible
    await expect(page.getByText("Checking for bugs")).toBeVisible();
    // Campaign phase labels visible
    // "Syncing Campaign" appears both as sidebar label and in-progress subtitle,
    // so use .first() to avoid strict mode violation
    await expect(page.getByText("Syncing Campaign").first()).toBeVisible();
    await expect(page.getByText("Enabling Campaign")).toBeVisible();
  });
});
