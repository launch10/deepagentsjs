import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeployGraphState } from "@annotation";
import type { ThreadIDType } from "@types";
import { Deploy, Task } from "@types";
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@rails_api";
import { db, websiteFiles, websiteUrls, domains, eq, and, withTimestamps } from "@db";
import { isNull } from "drizzle-orm";
import { NodeMiddleware } from "@middleware";

// Import the task runner so it registers itself
import { optimizePageForLLMsTaskRunner } from "@nodes";

// Wrap the runner's run method for use with testGraph.runNode()
const optimizePageForLLMsNode = NodeMiddleware.use({}, optimizePageForLLMsTaskRunner.run);

// Mock getLLM to avoid real API calls
vi.mock("@core", async () => {
  const actual = await vi.importActual("@core");
  return {
    ...actual,
    getLLM: vi.fn(),
  };
});

import { getLLM } from "@core";
const mockGetLLM = vi.mocked(getLLM);

// Mock ContextAPIService
vi.mock("@rails_api", async () => {
  const actual = await vi.importActual("@rails_api");
  return {
    ...actual,
    ContextAPIService: vi.fn(),
  };
});

import { ContextAPIService } from "@rails_api";
const mockContextAPIService = vi.mocked(ContextAPIService);

const TEST_WEBSITE_ID = 1;

/**
 * Helper: get the site URL from the database for test assertions
 */
async function getSiteUrl(websiteId: number): Promise<string | null> {
  const result = await db
    .select({ domain: domains.domain })
    .from(websiteUrls)
    .innerJoin(domains, eq(websiteUrls.domainId, domains.id))
    .where(
      and(
        eq(websiteUrls.websiteId, websiteId),
        isNull(websiteUrls.deletedAt),
        isNull(domains.deletedAt)
      )
    )
    .limit(1);

  const domain = result[0]?.domain;
  return domain ? `https://${domain}` : null;
}

/**
 * Helper: get file content from websiteFiles
 */
async function getFileContent(websiteId: number, path: string): Promise<string | null> {
  const result = await db
    .select({ content: websiteFiles.content })
    .from(websiteFiles)
    .where(and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, path)))
    .limit(1);

  return result[0]?.content ?? null;
}

/**
 * Helper: insert a file into websiteFiles
 */
async function insertFile(websiteId: number, path: string, content: string): Promise<void> {
  await db
    .insert(websiteFiles)
    .values(withTimestamps({ websiteId, path, content }));
}

/**
 * Helper: set up mock LLM that returns a canned response
 */
function setupMockLLM(responseContent: string) {
  mockGetLLM.mockResolvedValue({
    invoke: vi.fn().mockResolvedValue({ content: responseContent }),
  } as any);
}

/**
 * Helper: set up mock ContextAPIService
 */
function setupMockContext(brainstorm?: {
  idea?: string;
  audience?: string;
  solution?: string;
  social_proof?: string;
}) {
  mockContextAPIService.mockImplementation(
    () =>
      ({
        get: vi.fn().mockResolvedValue({
          brainstorm: brainstorm ?? null,
          uploads: [],
        }),
      }) as any
  );
}

describe.sequential("OptimizePageForLLMs Node", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");
    setupMockContext({
      idea: "AI-powered dog walking service",
      audience: "Busy pet owners in urban areas",
      solution: "On-demand dog walking with real-time GPS tracking",
    });
    setupMockLLM(`# PawWalker
> AI-powered on-demand dog walking with real-time GPS tracking

## Key Information
- Target Audience: Busy pet owners in urban areas
- Value Proposition: On-demand dog walking with real-time GPS tracking`);
  });

  it("skips when llms.txt already exists", async () => {
    await insertFile(TEST_WEBSITE_ID, "public/llms.txt", "# Test\n> Test site\n");

    const result = await testGraph<DeployGraphState>()
      .withState({
        jwt: "test-jwt",
        threadId: "thread_llms_skip" as ThreadIDType,
        websiteId: TEST_WEBSITE_ID,
        instructions: { website: true },
        tasks: [Deploy.createTask("OptimizingPageForLLMs")],
        chatId: 1,
      })
      .runNode(optimizePageForLLMsNode)
      .execute();

    const task = Task.findTask(result.state.tasks, "OptimizingPageForLLMs");
    expect(task?.status).toBe("completed");

    // LLM should not have been called
    expect(mockGetLLM).not.toHaveBeenCalled();
  });

  it("generates llms.txt using AI with programmatic homepage link", async () => {
    const siteUrl = await getSiteUrl(TEST_WEBSITE_ID);
    expect(siteUrl).toBeTruthy();

    const result = await testGraph<DeployGraphState>()
      .withState({
        jwt: "test-jwt",
        threadId: "thread_llms_gen" as ThreadIDType,
        websiteId: TEST_WEBSITE_ID,
        instructions: { website: true },
        tasks: [Deploy.createTask("OptimizingPageForLLMs")],
        chatId: 1,
      })
      .runNode(optimizePageForLLMsNode)
      .execute();

    const task = Task.findTask(result.state.tasks, "OptimizingPageForLLMs");
    expect(task?.status).toBe("completed");

    const content = await getFileContent(TEST_WEBSITE_ID, "public/llms.txt");
    expect(content).toBeDefined();
    // LLM-generated content
    expect(content).toContain("# PawWalker");
    expect(content).toContain("AI-powered on-demand dog walking");
    // Programmatically added homepage link
    expect(content).toContain(`[Homepage](${siteUrl}/)`);
    // Verify the LLM was called
    expect(mockGetLLM).toHaveBeenCalledWith(
      expect.objectContaining({ skill: "writing", speed: "blazing" })
    );
  });

  it("completes gracefully when no domain is found", async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    const result = await testGraph<DeployGraphState>()
      .withState({
        jwt: "test-jwt",
        threadId: "thread_llms_no_domain" as ThreadIDType,
        websiteId: TEST_WEBSITE_ID,
        instructions: { website: true },
        tasks: [Deploy.createTask("OptimizingPageForLLMs")],
        chatId: 1,
      })
      .runNode(optimizePageForLLMsNode)
      .execute();

    const task = Task.findTask(result.state.tasks, "OptimizingPageForLLMs");
    expect(task?.status).toBe("completed");
  });

  it("generates fallback llms.txt when no brainstorm data", async () => {
    setupMockContext(); // null brainstorm

    const siteUrl = await getSiteUrl(TEST_WEBSITE_ID);
    expect(siteUrl).toBeTruthy();

    const result = await testGraph<DeployGraphState>()
      .withState({
        jwt: "test-jwt",
        threadId: "thread_llms_fallback" as ThreadIDType,
        websiteId: TEST_WEBSITE_ID,
        instructions: { website: true },
        tasks: [Deploy.createTask("OptimizingPageForLLMs")],
        chatId: 1,
      })
      .runNode(optimizePageForLLMsNode)
      .execute();

    const task = Task.findTask(result.state.tasks, "OptimizingPageForLLMs");
    expect(task?.status).toBe("completed");

    const content = await getFileContent(TEST_WEBSITE_ID, "public/llms.txt");
    expect(content).toBeDefined();
    expect(content).toContain("# Landing Page");
    expect(content).toContain(`[Homepage](${siteUrl}/)`);
    // LLM should NOT have been called (fallback used)
    expect(mockGetLLM).not.toHaveBeenCalled();
  });
});
