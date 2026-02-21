import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { appQuery } from "../support/on-rails";
import { loginUser } from "../fixtures/auth";
import { DeployPage } from "../pages/deploy.page";

test.describe("Deploy - Website Deploy", () => {
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
  });

  test("website deploy page loads with correct layout", async ({ page }) => {
    const deployPage = new DeployPage(page);
    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Sidebar title shows "Launching Website"
    await expect(page.getByText("Launching Website")).toBeVisible({ timeout: 15000 });

    // Website deploy shows only website-related tasks (no Google tasks)
    await expect(page.getByText("Checking for bugs")).toBeVisible();
    await expect(page.getByText("Optimizing SEO")).toBeVisible();
    await expect(page.getByText("Connecting Analytics")).toBeVisible();
    await expect(page.getByText("Launching Website", { exact: false })).toBeVisible();

    // Google-specific tasks should NOT be shown for website deploy
    await expect(page.getByText("Signing into Google")).not.toBeVisible();
    await expect(page.getByText("Verifying Google Account")).not.toBeVisible();
    await expect(page.getByText("Checking payment status")).not.toBeVisible();
    await expect(page.getByText("Syncing Campaign")).not.toBeVisible();
    await expect(page.getByText("Enabling Campaign")).not.toBeVisible();
  });

  test("website deploy shows in-progress screen by default", async ({ page }) => {
    const deployPage = new DeployPage(page);
    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Content area should show in-progress screen
    await expect(page.getByText("Launching your website")).toBeVisible({ timeout: 15000 });
  });

  test("footer buttons are disabled while deploy is in progress", async ({ page }) => {
    const deployPage = new DeployPage(page);
    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Wait for page to load
    await expect(page.getByText("Launching Website")).toBeVisible({ timeout: 15000 });

    // Footer buttons should exist but be disabled
    await expect(deployPage.previousStepButton).toBeVisible();
    await expect(deployPage.seePerformanceButton).toBeVisible();
    await expect(deployPage.previousStepButton).toBeDisabled();
    await expect(deployPage.seePerformanceButton).toBeDisabled();
  });
});

test.describe("Deploy - Campaign Deploy", () => {
  let projectUuid: string;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("deploy_step");
    const project = await appQuery<{ id: number; uuid: string; name: string }>("first_project");
    projectUuid = project.uuid;
    await loginUser(page);
  });

  test("campaign deploy page loads with correct layout", async ({ page }) => {
    const deployPage = new DeployPage(page);
    await deployPage.gotoCampaignDeploy(projectUuid);

    // Sidebar title shows "Launching Campaign"
    await expect(page.getByText("Launching Campaign")).toBeVisible({ timeout: 15000 });

    // Campaign deploy shows ALL tasks including Google-specific ones
    await expect(page.getByText("Signing into Google")).toBeVisible();
    await expect(page.getByText("Verifying Google Account")).toBeVisible();
    await expect(page.getByText("Checking payment status")).toBeVisible();
    await expect(page.getByText("Checking for bugs")).toBeVisible();
    await expect(page.getByText("Optimizing SEO")).toBeVisible();
    await expect(page.getByText("Connecting Analytics")).toBeVisible();
    await expect(page.getByText("Launching Website", { exact: false })).toBeVisible();
    await expect(page.getByText("Syncing Campaign")).toBeVisible();
    await expect(page.getByText("Enabling Campaign")).toBeVisible();
  });

  test("campaign deploy shows in-progress screen by default", async ({ page }) => {
    const deployPage = new DeployPage(page);
    await deployPage.gotoCampaignDeploy(projectUuid);

    // Content area should show in-progress screen
    await expect(page.getByText("Launching your campaign")).toBeVisible({ timeout: 15000 });
  });

  test("campaign deploy footer buttons are disabled while in progress", async ({ page }) => {
    const deployPage = new DeployPage(page);
    await deployPage.gotoCampaignDeploy(projectUuid);

    await expect(page.getByText("Launching Campaign")).toBeVisible({ timeout: 15000 });

    await expect(deployPage.previousStepButton).toBeVisible();
    await expect(deployPage.seePerformanceButton).toBeVisible();
    await expect(deployPage.previousStepButton).toBeDisabled();
    await expect(deployPage.seePerformanceButton).toBeDisabled();
  });
});
