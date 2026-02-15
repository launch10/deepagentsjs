import { test, expect, type Route } from "@playwright/test";
import { DatabaseSnapshotter } from "../fixtures/database";
import { appQuery, appScenario } from "../support/on-rails";
import { loginUser, testUser } from "../fixtures/auth";
import { DeployPage } from "../pages/deploy.page";

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

/**
 * Build an SSE body from a graph state object.
 *
 * The langgraph-ai-sdk-react SDK uses `parseJsonEventStream` which expects
 * standard Server-Sent Events format. Each state key becomes a `data-state-{key}`
 * event that the SDK's StateManager processes via `processStatePart()`.
 *
 * Format per event: `data: {"type":"data-state-{key}","id":"{n}","data":<value>}\n\n`
 */
function buildSSE(state: Record<string, unknown>): string {
  let id = 0;
  return Object.entries(state)
    .map(([key, value]) => {
      id++;
      return `data: ${JSON.stringify({ type: `data-state-${key}`, id: String(id), data: value })}\n\n`;
    })
    .join("");
}

/**
 * Route handler that correctly serves both GET (history) and POST (stream) requests
 * to the Langgraph deploy endpoint.
 *
 * - GET  → JSON `{ messages: [], state: {...} }` (history loading)
 * - POST → SSE `text/event-stream` with `data-state-*` events (stream / polling)
 */
function mockDeployStream(state: Record<string, unknown>) {
  return async (route: Route) => {
    const method = route.request().method();

    if (method === "GET") {
      // History loading — SDK expects { messages, state }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], state }),
      });
    } else {
      // POST — stream / polling. Return SSE events.
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: buildSSE(state),
      });
    }
  };
}

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
    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream({
        status: "running",
        tasks: [
          { name: "SquashingBugs", status: "completed" },
          { name: "OptimizingSEO", status: "completed" },
          { name: "AddingAnalytics", status: "completed" },
          {
            name: "DeployingWebsite",
            status: "running",
            warning: "Deploying website is taking longer than expected",
          },
        ],
      })
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Warning banner should appear with the warning text
    await expect(page.getByText("Deploying website is taking longer than expected")).toBeVisible({
      timeout: 15000,
    });
  });

  test("does not show warning banner when no task has a warning", async ({ page }) => {
    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream({
        status: "running",
        tasks: [
          { name: "SquashingBugs", status: "completed" },
          { name: "DeployingWebsite", status: "running" },
        ],
      })
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    // In-progress screen should show but no warning
    await expect(page.getByText("Launching your website")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("taking longer than expected")).not.toBeVisible();
  });

  test("shows error screen with support ticket from mocked stream", async ({ page }) => {
    await page.route(
      "**/api/deploy/stream**",
      mockDeployStream({
        status: "failed",
        error: { message: "Website deploy failed: build error", node: "DeployingWebsite" },
        supportTicket: "SR-MOCK1234",
        tasks: [
          { name: "SquashingBugs", status: "completed" },
          {
            name: "DeployingWebsite",
            status: "failed",
            error: "Website deploy failed: build error",
          },
        ],
      })
    );

    await deployPage.gotoWebsiteDeploy(projectUuid);

    // Error screen with ticket from graph state
    await expect(deployPage.deployFailedHeading).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("We've been notified and are looking into this")).toBeVisible();
    await expect(page.getByText("Reference: SR-MOCK1234")).toBeVisible();
  });
});
