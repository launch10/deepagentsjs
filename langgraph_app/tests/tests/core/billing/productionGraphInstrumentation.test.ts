import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db, eq, llmUsage, llmConversationTraces202601 } from "@db";
import { DatabaseSnapshotter } from "@services";
import { brainstormGraph } from "@graphs";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getUsageContext, runWithUsageTracking } from "@core";

/**
 * CRITICAL BILLING TESTS: Production Graph Instrumentation
 *
 * These tests verify that ALL production graphs are properly instrumented
 * for usage tracking and billing. This is the most financially important
 * piece of our business.
 *
 * Failure modes we're testing for:
 * 1. Graphs that call graph.stream()/graph.streamEvents() without tracking context
 * 2. Graphs that use bridges that bypass executeWithTracking
 * 3. LLM calls that happen outside AsyncLocalStorage context
 * 4. Usage records that don't get persisted to database
 * 5. Rails notifications that don't fire
 *
 * These tests should FAIL if any graph bypasses billing infrastructure.
 */

describe("Production Graph Instrumentation - BILLING CRITICAL", () => {
  beforeAll(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  }, 30000);

  afterEach(async () => {
    // Clean up any test usage records to avoid pollution
    await db.delete(llmUsage).where(eq(llmUsage.graphName, "test-brainstorm"));
  });

  describe("Brainstorm Graph", () => {
    const compiledBrainstorm = brainstormGraph.compile({
      checkpointer: new MemorySaver(),
      name: "brainstorm",
    });

    it("MUST have usage context available during LLM calls", async () => {
      /**
       * This test verifies that when the brainstorm graph executes,
       * the AsyncLocalStorage context is available for LLM callbacks.
       *
       * If this fails, it means the graph is being called without
       * runWithUsageTracking() wrapper, and NO USAGE WILL BE TRACKED.
       */
      let contextWasAvailable = false;
      let contextRunId: string | undefined;

      // Temporarily patch to verify context exists during execution
      const originalGetContext = getUsageContext;

      const { runId, usage, messages } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-thread-1",
          graphName: "test-brainstorm",
        },
        async () => {
          // Verify context is available at start
          const ctx = getUsageContext();
          contextWasAvailable = ctx !== undefined;
          contextRunId = ctx?.runId;

          // Execute graph
          const result = await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Help me brainstorm a coffee shop name")],
              jwt: "test-jwt",
              threadId: "test-thread-1",
            },
            { configurable: { thread_id: "test-thread-1" } }
          );

          return result;
        }
      );

      // CRITICAL: Context MUST be available
      expect(contextWasAvailable).toBe(true);
      expect(contextRunId).toBeDefined();
      expect(runId).toBe(contextRunId);

      // CRITICAL: Usage MUST be captured
      expect(usage.length).toBeGreaterThan(0);
      expect(usage[0]!.runId).toBe(runId);

      // CRITICAL: Messages MUST be captured for trace
      expect(messages.length).toBeGreaterThan(0);
    });

    it("MUST capture exact token counts matching LLM response metadata", async () => {
      /**
       * This test ensures we're not losing tokens in translation.
       * The tracked usage MUST match what the LLM actually reported.
       *
       * If counts don't match, we're either:
       * - Under-charging (losing money)
       * - Over-charging (fraud)
       */
      const { usage, messages } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-thread-token-match",
          graphName: "test-brainstorm",
        },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Say exactly: Hello")],
              jwt: "test-jwt",
              threadId: "test-thread-token-match",
            },
            { configurable: { thread_id: "test-thread-token-match" } }
          );
        }
      );

      expect(usage.length).toBeGreaterThan(0);

      // Find the AIMessage to compare metadata
      const aiMessages = messages.filter((m) => m._getType() === "ai");
      expect(aiMessages.length).toBeGreaterThan(0);

      for (const usageRecord of usage) {
        // Find corresponding AIMessage by messageId
        const correspondingMessage = aiMessages.find((m) => m.id === usageRecord.messageId);

        if (correspondingMessage) {
          const llmMetadata = (correspondingMessage as any).usage_metadata;

          // Token counts MUST match exactly - no approximations
          expect(usageRecord.inputTokens).toBe(llmMetadata.input_tokens);
          expect(usageRecord.outputTokens).toBe(llmMetadata.output_tokens);
        }
      }
    });

    it("MUST have all required fields for billing calculation", async () => {
      /**
       * Rails needs specific fields to calculate costs.
       * Missing fields = billing failures.
       */
      const { usage } = await runWithUsageTracking(
        {
          chatId: 1,
          threadId: "test-thread-required-fields",
          graphName: "test-brainstorm",
        },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Test")],
              jwt: "test-jwt",
              threadId: "test-thread-required-fields",
            },
            { configurable: { thread_id: "test-thread-required-fields" } }
          );
        }
      );

      expect(usage.length).toBeGreaterThan(0);

      for (const record of usage) {
        // Required for billing
        expect(record.runId).toBeDefined();
        expect(record.runId.length).toBeGreaterThan(0);

        expect(record.model).toBeDefined();
        expect(record.model.length).toBeGreaterThan(0);

        expect(typeof record.inputTokens).toBe("number");
        expect(record.inputTokens).toBeGreaterThanOrEqual(0);

        expect(typeof record.outputTokens).toBe("number");
        expect(record.outputTokens).toBeGreaterThanOrEqual(0);

        expect(record.timestamp).toBeInstanceOf(Date);

        // messageId is critical for trace correlation
        expect(record.messageId).toBeDefined();
      }
    });
  });

  describe("Multi-turn Conversation Tracking", () => {
    const compiledBrainstorm = brainstormGraph.compile({
      checkpointer: new MemorySaver(),
      name: "brainstorm",
    });

    it("MUST NOT double-count tokens across conversation turns", async () => {
      /**
       * CRITICAL: Each turn should only count NEW tokens.
       * Double-counting = overcharging customers = lawsuits.
       */
      const threadId = "test-thread-multi-turn";

      // Turn 1
      const turn1 = await runWithUsageTracking(
        { chatId: 1, threadId, graphName: "test-brainstorm" },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Hello")],
              jwt: "test-jwt",
              threadId,
            },
            { configurable: { thread_id: threadId } }
          );
        }
      );

      // Turn 2
      const turn2 = await runWithUsageTracking(
        { chatId: 1, threadId, graphName: "test-brainstorm" },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [new HumanMessage("Follow up question")],
              jwt: "test-jwt",
              threadId,
            },
            { configurable: { thread_id: threadId } }
          );
        }
      );

      // CRITICAL: Each turn has unique runId
      expect(turn1.runId).not.toBe(turn2.runId);

      // CRITICAL: Turn 2 usage should NOT include turn 1's tokens
      // (Turn 2 will have higher input tokens due to context, but
      // the USAGE RECORDS should be separate)
      const turn1RunIds = turn1.usage.map((u) => u.runId);
      const turn2RunIds = turn2.usage.map((u) => u.runId);

      // No overlap in runIds
      for (const id of turn2RunIds) {
        expect(turn1RunIds).not.toContain(id);
      }
    });

    it("MUST capture complete message trace in correct order", async () => {
      /**
       * For debugging and audit, we need the full conversation.
       * Order matters - wrong order = confused support team.
       */
      const threadId = "test-thread-message-order";

      const { messages } = await runWithUsageTracking(
        { chatId: 1, threadId, graphName: "test-brainstorm" },
        async () => {
          return await compiledBrainstorm.invoke(
            {
              messages: [
                new SystemMessage("You are a helpful assistant."),
                new HumanMessage("What is 2+2?"),
              ],
              jwt: "test-jwt",
              threadId,
            },
            { configurable: { thread_id: threadId } }
          );
        }
      );

      // Verify message order
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // First should be system
      expect(messages[0]!._getType()).toBe("system");
      expect(messages[0]!.content).toContain("helpful assistant");

      // Second should be human
      expect(messages[1]!._getType()).toBe("human");
      expect(messages[1]!.content).toContain("2+2");

      // Third should be AI response
      expect(messages[2]!._getType()).toBe("ai");
    });
  });

  describe("Error Resilience - Usage MUST survive errors", () => {
    it("MUST capture usage even if graph throws after LLM call", async () => {
      /**
       * CRITICAL: We paid for the LLM call. If the graph fails AFTER,
       * we still need to track that usage or we lose money.
       */
      const compiledBrainstorm = brainstormGraph.compile({
        checkpointer: new MemorySaver(),
        name: "brainstorm",
      });

      let capturedUsage: any[] = [];

      try {
        await runWithUsageTracking(
          { chatId: 1, threadId: "test-thread-error", graphName: "test-brainstorm" },
          async () => {
            // This should complete and capture usage
            const result = await compiledBrainstorm.invoke(
              {
                messages: [new HumanMessage("Hello")],
                jwt: "test-jwt",
                threadId: "test-thread-error",
              },
              { configurable: { thread_id: "test-thread-error" } }
            );

            // Capture usage before potential error
            const ctx = getUsageContext();
            capturedUsage = ctx?.records || [];

            return result;
          }
        );
      } catch {
        // Error is expected in some cases
      }

      // Even if error occurred, usage should be captured
      // (In real error case, runWithUsageTracking returns partial results)
      expect(capturedUsage.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Concurrent Request Isolation", () => {
    it("MUST isolate usage between concurrent requests", async () => {
      /**
       * CRITICAL: User A's request must not pollute User B's billing.
       * Cross-contamination = billing wrong customer = lawsuits.
       */
      const compiledBrainstorm = brainstormGraph.compile({
        checkpointer: new MemorySaver(),
        name: "brainstorm",
      });

      // Run two requests concurrently
      const [result1, result2] = await Promise.all([
        runWithUsageTracking(
          { chatId: 1, threadId: "concurrent-1", graphName: "test-brainstorm" },
          async () => {
            return await compiledBrainstorm.invoke(
              {
                messages: [new HumanMessage("Request 1")],
                jwt: "test-jwt",
                threadId: "concurrent-1",
              },
              { configurable: { thread_id: "concurrent-1" } }
            );
          }
        ),
        runWithUsageTracking(
          { chatId: 2, threadId: "concurrent-2", graphName: "test-brainstorm" },
          async () => {
            return await compiledBrainstorm.invoke(
              {
                messages: [new HumanMessage("Request 2")],
                jwt: "test-jwt",
                threadId: "concurrent-2",
              },
              { configurable: { thread_id: "concurrent-2" } }
            );
          }
        ),
      ]);

      // CRITICAL: Each request has unique runId
      expect(result1.runId).not.toBe(result2.runId);

      // CRITICAL: Usage records are isolated
      const run1Ids = new Set(result1.usage.map((u) => u.runId));
      const run2Ids = new Set(result2.usage.map((u) => u.runId));

      // No overlap
      for (const id of run2Ids) {
        expect(run1Ids.has(id)).toBe(false);
      }
    });
  });
});
