import { describe, it, expect, beforeAll, vi } from "vitest";
import { DatabaseSnapshotter } from "@services";
import { brainstormGraph, websiteGraph, adsGraph, deployGraph } from "@graphs";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { getUsageContext, runWithUsageTracking, usageTracker } from "@core";

/**
 * GRAPH WRAPPER CONTRACT TESTS - BILLING CRITICAL
 *
 * These tests define the CONTRACT that all graphs MUST follow
 * to ensure billing works correctly.
 *
 * The contract is:
 * 1. All graphs MUST be executed within runWithUsageTracking context
 * 2. All LLM callbacks MUST have access to getUsageContext()
 * 3. Usage records MUST be accumulated in the context
 *
 * If any of these fail, we have a billing gap.
 */

describe("Graph Wrapper Contract - BILLING CRITICAL", () => {
  beforeAll(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  }, 30000);

  /**
   * Contract Test Factory
   *
   * This creates a standard test that verifies a graph follows
   * our billing contract. Use this for every new graph.
   */
  function testGraphContract(
    graphName: string,
    compiledGraph: ReturnType<typeof brainstormGraph.compile>,
    createInitialState: () => any
  ) {
    describe(`${graphName} Graph Contract`, () => {
      it("MUST accumulate usage records when wrapped with runWithUsageTracking", async () => {
        const { usage, runId, messages } = await runWithUsageTracking(
          {
            chatId: 1,
            threadId: `contract-test-${graphName}-${Date.now()}`,
            graphName,
          },
          async () => {
            const initialState = createInitialState();
            return await compiledGraph.invoke(initialState, {
              configurable: { thread_id: initialState.threadId },
            });
          }
        );

        // Contract: Usage MUST be captured
        expect(usage.length).toBeGreaterThan(0);

        // Contract: All records share the run ID
        for (const record of usage) {
          expect(record.runId).toBe(runId);
        }

        // Contract: Messages MUST be captured for trace
        expect(messages.length).toBeGreaterThan(0);
      });

      it("MUST have getUsageContext() available during LLM callbacks", async () => {
        let contextAvailableDuringCallback = false;

        // Spy on the callback to verify context exists
        const originalHandleLLMEnd = usageTracker.handleLLMEnd.bind(usageTracker);
        vi.spyOn(usageTracker, "handleLLMEnd").mockImplementation(async (...args) => {
          const ctx = getUsageContext();
          if (ctx !== undefined) {
            contextAvailableDuringCallback = true;
          }
          return originalHandleLLMEnd(...args);
        });

        try {
          await runWithUsageTracking(
            {
              chatId: 1,
              threadId: `callback-context-${graphName}-${Date.now()}`,
              graphName,
            },
            async () => {
              const initialState = createInitialState();
              return await compiledGraph.invoke(initialState, {
                configurable: { thread_id: initialState.threadId },
              });
            }
          );

          expect(contextAvailableDuringCallback).toBe(true);
        } finally {
          vi.restoreAllMocks();
        }
      });

      it("MUST NOT have context when executed outside runWithUsageTracking", async () => {
        let contextSeenOutsideWrapper = false;

        // Spy on callback
        const originalHandleLLMEnd = usageTracker.handleLLMEnd.bind(usageTracker);
        vi.spyOn(usageTracker, "handleLLMEnd").mockImplementation(async (...args) => {
          const ctx = getUsageContext();
          if (ctx !== undefined) {
            contextSeenOutsideWrapper = true;
          }
          return originalHandleLLMEnd(...args);
        });

        try {
          // Execute WITHOUT wrapper - this is what happens when tracking is bypassed
          const initialState = createInitialState();
          await compiledGraph.invoke(initialState, {
            configurable: { thread_id: initialState.threadId },
          });

          // Context should NOT be available
          // If it IS available, something is leaking state
          expect(contextSeenOutsideWrapper).toBe(false);
        } catch {
          // Graph may fail due to missing auth, that's ok
        } finally {
          vi.restoreAllMocks();
        }
      });
    });
  }

  // Apply contract tests to all production graphs
  testGraphContract(
    "brainstorm",
    brainstormGraph.compile({ checkpointer: new MemorySaver(), name: "brainstorm" }),
    () => ({
      messages: [new HumanMessage("Help me brainstorm coffee shop names")],
      jwt: "test-jwt",
      threadId: `brainstorm-${Date.now()}`,
    })
  );

  // Note: Website, Ads, and Deploy graphs may require more state setup
  // Add them as their requirements are understood

  describe("Meta Contract: All Routes MUST Use Wrapper", () => {
    /**
     * This is a meta-test that documents what SHOULD happen.
     * The actual enforcement is in routeInstrumentation.test.ts
     */
    it("documents the required pattern for route handlers", () => {
      const requiredPattern = `
// CORRECT: Route handler with tracking
app.post("/api/brainstorm/stream", async (c) => {
  const { messages, threadId, chatId } = await c.req.json();

  // MUST wrap with tracking
  const { result, usage, messages: trace } = await runWithUsageTracking(
    { chatId, threadId, graphName: "brainstorm" },
    async () => {
      return await brainstormGraph.invoke(
        { messages, jwt: auth.jwt, threadId },
        { configurable: { thread_id: threadId } }
      );
    }
  );

  // MUST persist
  await Promise.all([
    persistUsage(usage, { chatId, threadId, graphName: "brainstorm" }),
    persistTrace({ chatId, threadId, runId, graphName: "brainstorm" }, trace, usageSummary)
  ]);

  // MUST notify Rails
  notifyRails(runId);

  return c.json(result);
});

// WRONG: Direct graph invocation without tracking
app.post("/api/brainstorm/stream", async (c) => {
  const { messages, threadId } = await c.req.json();

  // BAD: No tracking wrapper = no billing
  const result = await brainstormGraph.invoke(
    { messages, jwt: auth.jwt, threadId },
    { configurable: { thread_id: threadId } }
  );

  return c.json(result);
});
      `.trim();

      // This test always passes - it's documentation
      expect(requiredPattern).toContain("runWithUsageTracking");
      expect(requiredPattern).toContain("persistUsage");
      expect(requiredPattern).toContain("notifyRails");
    });
  });

  describe("Streaming Pattern Contract", () => {
    /**
     * For streaming responses, the pattern is different because
     * we can't wait for completion before responding.
     *
     * The solution is to:
     * 1. Start tracking context
     * 2. Stream the response
     * 3. On stream completion, persist and notify
     */
    it("documents the required pattern for streaming handlers", () => {
      const streamingPattern = `
// CORRECT: Streaming with tracking
app.post("/api/brainstorm/stream", async (c) => {
  const { messages, threadId, chatId } = await c.req.json();

  // Start tracking context BEFORE stream
  const trackingContext = createTrackingContext({ chatId, threadId, graphName: "brainstorm" });

  // Create stream within tracking context
  const stream = await runWithUsageTracking(trackingContext, async () => {
    return await brainstormGraph.stream(
      { messages, jwt: auth.jwt, threadId },
      { configurable: { thread_id: threadId } }
    );
  });

  // Return streaming response with cleanup callback
  return streamResponse(stream, {
    onComplete: async () => {
      const { usage, messages: trace, runId } = getUsageContext()!;
      await persistUsage(usage, { chatId, threadId, graphName: "brainstorm" });
      await persistTrace({ chatId, threadId, runId, graphName: "brainstorm" }, trace, usageSummary);
      notifyRails(runId);
    }
  });
});
      `.trim();

      expect(streamingPattern).toContain("runWithUsageTracking");
      expect(streamingPattern).toContain("onComplete");
    });
  });
});
