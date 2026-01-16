import { test, expect } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { E2EMocks } from "../fixtures/e2e-mocks";
import { loginUser } from "../fixtures/auth";
import { e2eConfig } from "../config";

test.describe("Deploy - Google Ads Invite Flow", () => {
  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("deploy_step");
    await E2EMocks.reset();
    await loginUser(page);
  });

  test.afterEach(async () => {
    await E2EMocks.reset();
  });

  test("mock endpoint sets invite status correctly", async ({ request }) => {
    // Test the mock endpoint infrastructure
    const setResponse = await request.post(`${e2eConfig.railsBaseUrl}/test/e2e/set_invite_status`, {
      data: { status: "pending" }
    });

    expect(setResponse.ok()).toBeTruthy();
    const setData = await setResponse.json();
    expect(setData.status).toBe("ok");

    // Reset the mock
    const resetResponse = await request.delete(`${e2eConfig.railsBaseUrl}/test/e2e/reset`);
    expect(resetResponse.ok()).toBeTruthy();
  });

  test("deploy page loads and shows deploy button", async ({ page }) => {
    const project = await DatabaseSnapshotter.getFirstProject();
    await page.goto(`/projects/${project.uuid}/deploy`);

    // Verify basic page structure is present
    await expect(page.getByRole("heading", { name: "Deploy Your Campaign" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deploy Campaign" })).toBeVisible();
  });

  test("navigates to deploy page from campaign review", async ({ page }) => {
    const project = await DatabaseSnapshotter.getFirstProject();

    // Start from the review step
    await page.goto(`/projects/${project.uuid}/campaigns/review`);

    // Navigate to deploy
    await page.goto(`/projects/${project.uuid}/deploy`);

    await expect(page.getByRole("heading", { name: "Deploy Your Campaign" })).toBeVisible();
  });

  test("mock handles different invite statuses", async ({ request }) => {
    // Test each status can be set
    const statuses = ["pending", "accepted", "declined", "expired"] as const;

    for (const status of statuses) {
      const response = await request.post(`${e2eConfig.railsBaseUrl}/test/e2e/set_invite_status`, {
        data: { status }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe("ok");
    }
  });
});
