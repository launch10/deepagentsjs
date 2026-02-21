import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { appQuery, appScenario } from "../support/on-rails";
import { loginUser, testUser } from "../fixtures/auth";
import { DeployPage } from "../pages/deploy.page";
import { mockDeployStream, DeployStates } from "../fixtures/deploy-stream";

/**
 * Deploy Error & Recovery E2E Tests
 *
 * Tests the deploy hardening UI:
 * - Error screen shows on failed deploy (from Rails status)
 * - Support ticket reference displayed when present
 * - Error screen without ticket (transient failures)
 * - Retry button available on error screen
 * - Warning banner during in-progress deploys (mocked stream)
 */

test.describe("Deploy Error Screen", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.describe("Failed deploy (Rails status fallback)", () => {
    test.beforeEach(async ({ page }) => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
      projectUuid = project.uuid;

      // Fail the deploy in Rails DB — frontend uses railsDeployStatus fallback
      await appScenario("fail_deploy", { email: testUser.email, with_ticket: false });

      await loginUser(page);
      deployPage = new DeployPage(page);
    });

    test("shows error screen on page load for failed deploy", async ({ page }) => {
      await deployPage.gotoWebsiteDeploy(projectUuid);

      // Error screen visible immediately via railsDeployStatus fallback (no Langgraph needed)
      await expect(deployPage.deployFailedHeading).toBeVisible({ timeout: 15000 });
    });

    test("shows retry button on error screen", async ({ page }) => {
      await deployPage.gotoWebsiteDeploy(projectUuid);

      await expect(deployPage.deployFailedHeading).toBeVisible({ timeout: 15000 });
      await expect(deployPage.retryDeployButton).toBeVisible();
    });
  });
});

test.describe("Deploy Warning Banner (Mocked Stream)", () => {
  let projectUuid: string;
  let deployPage: DeployPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
    deployPage = new DeployPage(page);
  });

  test("shows amber warning banner when task has a warning", async ({ page }) => {
    const warningMsg = "Deploying website is taking longer than expected";
    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream(DeployStates.withWarning(warningMsg))
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(page.getByText(warningMsg)).toBeVisible({ timeout: 15000 });
  });

  test("does not show warning banner when no task has a warning", async ({ page }) => {
    await page.route("**/api/deploy/stream**", mockDeployStream(DeployStates.websiteInProgress()));

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(page.getByText("Launching your website")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("taking longer than expected")).not.toBeVisible();
  });

  test("shows error screen with support ticket from mocked stream", async ({ page }) => {
    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream(DeployStates.failedWithTicket("SR-MOCK1234"))
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    await expect(deployPage.deployFailedHeading).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("We've been notified and are looking into this")).toBeVisible();
    await expect(page.getByText("Reference: SR-MOCK1234")).toBeVisible();
  });
});
