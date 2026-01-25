import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { db, eq, chats, llmUsage, llmConversationTraces } from "@db";
import { DatabaseSnapshotter } from "@services";
import { createAppBridge } from "@api";
import { getLLM, usageStorage } from "@core";

/**
 * USAGE TRACKING INTEGRATION TESTS - BILLING CRITICAL
 *
 * These tests verify the usage tracking system using REAL Bridge/middleware code paths.
 * Unlike mocked tests, these use:
 * - createAppBridge (real factory with usageTrackingMiddleware)
 * - getLLM() (real LLM calls via Polly recording)
 * - Real database persistence
 *
 * Test scenarios:
 * 1. Multi-turn conversations - Each turn gets distinct runId (no double-counting)
 * 2. Error scenarios - Usage captured even when graph fails
 * 3. Context propagation - AsyncLocalStorage survives through nodes
 * 4. Multiple LLM calls per run - All calls attributed to same runId
 */

// ============================================================================
// TEST GRAPH SETUP
// Uses real createAppBridge for authentic middleware testing
// ============================================================================

/**
 * Minimal test annotation for usage tracking tests
 */
const UsageTestAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (curr, next) => [...curr, ...next],
  }),
  threadId: Annotation<string>({
    default: () => "",
    reducer: (_, next) => next,
  }),
  jwt: Annotation<string>({
    default: () => "",
    reducer: (_, next) => next,
  }),
  scenario: Annotation<"direct" | "multi-llm" | "error-after-llm" | "context-check">({
    default: () => "direct",
    reducer: (_, next) => next,
  }),
  contextWasAvailable: Annotation<boolean>({
    default: () => false,
    reducer: (_, next) => next,
  }),
});

type UsageTestState = typeof UsageTestAnnotation.State;

/**
 * Bridge using real createAppBridge - this is the key!
 * The middleware is the actual production middleware.
 */
const UsageTestBridge = createAppBridge({
  endpoint: "/api/usage-test/stream",
  stateAnnotation: UsageTestAnnotation,
});

/**
 * Test graph with different scenarios for usage tracking verification
 */
const usageTestGraph = new StateGraph(UsageTestAnnotation)
  .addNode("router", async () => {
    // Just routes to the right scenario
    return {};
  })
  .addNode("directLLM", async () => {
    // Simple direct LLM call
    const llm = await getLLM();
    const response = await llm.invoke([new HumanMessage("Say 'hello' and nothing else")]);
    return { messages: [response] };
  })
  .addNode("multiLLM", async () => {
    // Multiple LLM calls in one node - should all share same runId
    const llm = await getLLM();

    const response1 = await llm.invoke([new HumanMessage("Say 'one'")]);

    const response2 = await llm.invoke([new HumanMessage("Say 'two'")]);

    return { messages: [response1, response2] };
  })
  .addNode("errorAfterLLM", async () => {
    // Makes LLM call successfully, then throws
    // Usage should still be captured!
    const llm = await getLLM();
    await llm.invoke([new HumanMessage("Say 'before error'")]);

    throw new Error("Intentional test error after LLM call");
  })
  .addNode("contextCheck", async () => {
    // Verifies AsyncLocalStorage context is available
    const context = usageStorage.getStore();
    const contextWasAvailable = context !== undefined && context.runId !== undefined;

    // Still make an LLM call to generate usage
    const llm = await getLLM();
    await llm.invoke([new HumanMessage("Say 'context test'")]);

    return { contextWasAvailable };
  })
  .addConditionalEdges("router", (state: UsageTestState) => {
    switch (state.scenario) {
      case "direct":
        return "directLLM";
      case "multi-llm":
        return "multiLLM";
      case "error-after-llm":
        return "errorAfterLLM";
      case "context-check":
        return "contextCheck";
      default:
        return "directLLM";
    }
  })
  .addEdge("directLLM", END)
  .addEdge("multiLLM", END)
  .addEdge("errorAfterLLM", END)
  .addEdge("contextCheck", END)
  .addEdge("__start__", "router");

// Compile with checkpointer for state management
const compiledUsageTestGraph = usageTestGraph.compile({
  checkpointer: new MemorySaver(),
  name: "usage-test",
});

// Bind to the bridge - this is what routes do in production
const UsageTestAPI = UsageTestBridge.bind(compiledUsageTestGraph);

// ============================================================================
// TESTS
// ============================================================================

describe.sequential("Usage Tracking Integration - Real Middleware", () => {
  let testThreadId: string;

  beforeEach(async () => {
    // website_step snapshot includes a chat with threadId we can reuse
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    // Get the existing chat's threadId from the snapshot
    const [chat] = await db.select().from(chats).limit(1);
    if (!chat?.threadId) {
      throw new Error("No chat with threadId found in website_step snapshot");
    }
    testThreadId = chat.threadId;
  });

  afterEach(async () => {
    // Clean up usage records created during tests
    await db.delete(llmUsage).where(eq(llmUsage.threadId, testThreadId));
    await db.delete(llmConversationTraces).where(eq(llmConversationTraces.threadId, testThreadId));
  });

  /**
   * Helper to consume stream and return result
   */
  async function consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response has no body");

    const decoder = new TextDecoder();
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result;
  }

  describe("Multi-turn conversations (no double-counting)", () => {
    it("MUST assign different runIds to each conversation turn", async () => {
      // First turn
      const response1 = await UsageTestAPI.stream({
        messages: [new HumanMessage("First turn")],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          scenario: "direct" as const,
        },
      });
      await consumeStream(response1);
      await new Promise((r) => setTimeout(r, 100));

      const turn1Usage = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.threadId, testThreadId));

      expect(turn1Usage.length).toBeGreaterThan(0);
      const turn1RunId = turn1Usage[0]!.runId;

      // Second turn - should get NEW runId
      const response2 = await UsageTestAPI.stream({
        messages: [new HumanMessage("Second turn")],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          scenario: "direct" as const,
        },
      });
      await consumeStream(response2);
      await new Promise((r) => setTimeout(r, 100));

      const allUsage = await db.select().from(llmUsage).where(eq(llmUsage.threadId, testThreadId));

      // Should have records from both turns
      expect(allUsage.length).toBeGreaterThan(turn1Usage.length);

      // Should have 2 distinct runIds
      const runIds = new Set(allUsage.map((r) => r.runId));
      expect(runIds.size).toBe(2);
      expect(runIds.has(turn1RunId)).toBe(true);
    });

    it("MUST create separate traces for each turn", async () => {
      // Turn 1
      const response1 = await UsageTestAPI.stream({
        messages: [new HumanMessage("Trace turn 1")],
        threadId: testThreadId,
        state: { threadId: testThreadId, jwt: "test", scenario: "direct" as const },
      });
      await consumeStream(response1);
      await new Promise((r) => setTimeout(r, 100));

      // Turn 2
      const response2 = await UsageTestAPI.stream({
        messages: [new HumanMessage("Trace turn 2")],
        threadId: testThreadId,
        state: { threadId: testThreadId, jwt: "test", scenario: "direct" as const },
      });
      await consumeStream(response2);
      await new Promise((r) => setTimeout(r, 100));

      const traces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.threadId, testThreadId));

      // Should have 2 traces with different runIds
      expect(traces.length).toBe(2);
      expect(traces[0]!.runId).not.toBe(traces[1]!.runId);
    });
  });

  describe("Multiple LLM calls per run", () => {
    it("MUST attribute all LLM calls to the same runId within a single run", async () => {
      const response = await UsageTestAPI.stream({
        messages: [new HumanMessage("Test multi-LLM")],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          scenario: "multi-llm" as const,
        },
      });
      await consumeStream(response);
      await new Promise((r) => setTimeout(r, 100));

      const usageRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.threadId, testThreadId));

      // Should have multiple usage records (one per LLM call)
      expect(usageRecords.length).toBeGreaterThanOrEqual(2);

      // All should share the same runId
      const runIds = new Set(usageRecords.map((r) => r.runId));
      expect(runIds.size).toBe(1);
    });

    it("MUST sum all LLM calls in the trace usage summary", async () => {
      const response = await UsageTestAPI.stream({
        messages: [new HumanMessage("Test multi-LLM summary")],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          scenario: "multi-llm" as const,
        },
      });
      await consumeStream(response);
      await new Promise((r) => setTimeout(r, 100));

      const usageRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.threadId, testThreadId));

      const traces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.threadId, testThreadId));

      expect(traces.length).toBe(1);

      const trace = traces[0]!;
      const summary = trace.usageSummary as any;

      // Summary should match sum of individual records
      const totalInput = usageRecords.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
      const totalOutput = usageRecords.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);

      expect(summary.totalInputTokens).toBe(totalInput);
      expect(summary.totalOutputTokens).toBe(totalOutput);
      expect(summary.llmCallCount).toBe(usageRecords.length);
    });
  });

  describe("Error scenarios (usage captured on failure)", () => {
    it("MUST capture usage for LLM calls that succeed before an error", async () => {
      // This test verifies that even when a graph fails AFTER making LLM calls,
      // the usage is still captured. This is critical for billing accuracy.

      try {
        const response = await UsageTestAPI.stream({
          messages: [new HumanMessage("Test error scenario")],
          threadId: testThreadId,
          state: {
            threadId: testThreadId,
            jwt: "test-jwt",
            scenario: "error-after-llm" as const,
          },
        });
        await consumeStream(response);
      } catch {
        // Expected - graph throws intentionally
      }

      await new Promise((r) => setTimeout(r, 100));

      // But usage should STILL be captured
      const usageRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.threadId, testThreadId));

      // This is the critical assertion: usage was captured even though graph failed
      expect(usageRecords.length).toBeGreaterThan(0);
      expect(usageRecords[0]!.inputTokens).toBeGreaterThan(0);
    });
  });

  describe("AsyncLocalStorage context propagation", () => {
    it("MUST make usage context available within graph nodes", async () => {
      const response = await UsageTestAPI.stream({
        messages: [new HumanMessage("Test context")],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          scenario: "context-check" as const,
        },
      });

      await consumeStream(response);
      await new Promise((r) => setTimeout(r, 100));

      // The context-check node sets contextWasAvailable based on whether
      // it could access usageStorage.getStore()
      // We verify this by checking that usage was captured (which requires context)
      const usageRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.threadId, testThreadId));

      expect(usageRecords.length).toBeGreaterThan(0);

      // If context wasn't available, the callback handler wouldn't capture usage
      // So the presence of usage records proves context was available
    });
  });
});
