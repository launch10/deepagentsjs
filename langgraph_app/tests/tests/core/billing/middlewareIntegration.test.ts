import { describe, it, expect } from "vitest";
import { usageStorage, createUsageContext, type UsageContext } from "@core";

/**
 * MIDDLEWARE INTEGRATION TESTS - BILLING CRITICAL
 *
 * These tests verify the core mechanics that enable usage tracking:
 * 1. AsyncLocalStorage context propagation
 * 2. Context isolation between concurrent requests
 * 3. Record accumulation across async boundaries
 *
 * Note: The actual persistence (writing to llm_usage and llm_conversation_traces)
 * is tested in databasePersistence.test.ts. The middleware onComplete callback
 * is tested implicitly through those persistence tests.
 *
 * The callback handler (usageTracker) that captures LLM calls is tested
 * in messageTraceCapture.test.ts.
 *
 * These tests do NOT require database access - they only test AsyncLocalStorage
 * context propagation which happens entirely in memory.
 */

describe.sequential("Usage Tracking Middleware - Context Mechanics", () => {
  describe("AsyncLocalStorage Context Propagation", () => {
    it("MUST make usage context available via getUsageContext within run", async () => {
      const usageContext = createUsageContext({
        threadId: "test-thread",
        graphName: "test-graph",
      });

      let capturedContext: UsageContext | undefined;

      await usageStorage.run(usageContext, async () => {
        // Simulate what happens inside a graph node
        capturedContext = usageStorage.getStore();
      });

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.runId).toBe(usageContext.runId);
      expect(capturedContext!.threadId).toBe("test-thread");
      expect(capturedContext!.graphName).toBe("test-graph");
    });

    it("MUST isolate contexts between concurrent runs", async () => {
      const contexts: string[] = [];

      await Promise.all([
        usageStorage.run(createUsageContext({ threadId: "thread-A" }), async () => {
          await new Promise((r) => setTimeout(r, 10));
          contexts.push(usageStorage.getStore()!.threadId!);
        }),
        usageStorage.run(createUsageContext({ threadId: "thread-B" }), async () => {
          await new Promise((r) => setTimeout(r, 5));
          contexts.push(usageStorage.getStore()!.threadId!);
        }),
      ]);

      // Both contexts should be captured correctly despite concurrent execution
      expect(contexts).toContain("thread-A");
      expect(contexts).toContain("thread-B");
      expect(contexts.length).toBe(2);
    });

    it("MUST accumulate records across async boundaries within same context", async () => {
      const usageContext = createUsageContext({ threadId: "test-thread" });

      await usageStorage.run(usageContext, async () => {
        const ctx = usageStorage.getStore()!;

        // First async operation
        await Promise.resolve();
        ctx.records.push({
          runId: ctx.runId,
          messageId: "msg-1",
          langchainRunId: "lc-1",
          model: "test-model",
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        });

        // Second async operation
        await Promise.resolve();
        ctx.records.push({
          runId: ctx.runId,
          messageId: "msg-2",
          langchainRunId: "lc-2",
          model: "test-model",
          inputTokens: 200,
          outputTokens: 75,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        });
      });

      // Records accumulated correctly
      expect(usageContext.records.length).toBe(2);
      expect(usageContext.records[0]!.inputTokens).toBe(100);
      expect(usageContext.records[1]!.inputTokens).toBe(200);
    });

    it("MUST preserve context through nested async functions", async () => {
      const usageContext = createUsageContext({ threadId: "nested-test" });

      const innerFunction = async () => {
        const ctx = usageStorage.getStore();
        return ctx?.threadId;
      };

      const middleFunction = async () => {
        await Promise.resolve();
        return innerFunction();
      };

      let capturedThreadId: string | undefined;
      await usageStorage.run(usageContext, async () => {
        capturedThreadId = await middleFunction();
      });

      expect(capturedThreadId).toBe("nested-test");
    });

    it("MUST allow parallel branches to share the same context", async () => {
      const usageContext = createUsageContext({ threadId: "parallel-test" });

      await usageStorage.run(usageContext, async () => {
        const ctx = usageStorage.getStore()!;

        // Simulate parallel LLM calls (like in agent tool loops)
        await Promise.all([
          (async () => {
            await new Promise((r) => setTimeout(r, 5));
            ctx.records.push({
              runId: ctx.runId,
              messageId: "parallel-1",
              langchainRunId: "lc-p1",
              model: "test-model",
              inputTokens: 100,
              outputTokens: 50,
              reasoningTokens: 0,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              timestamp: new Date(),
            });
          })(),
          (async () => {
            await new Promise((r) => setTimeout(r, 3));
            ctx.records.push({
              runId: ctx.runId,
              messageId: "parallel-2",
              langchainRunId: "lc-p2",
              model: "test-model",
              inputTokens: 150,
              outputTokens: 75,
              reasoningTokens: 0,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              timestamp: new Date(),
            });
          })(),
        ]);
      });

      // Both records from parallel branches accumulated
      expect(usageContext.records.length).toBe(2);
    });

    it("MUST return undefined when called outside of tracking context", () => {
      const context = usageStorage.getStore();
      expect(context).toBeUndefined();
    });
  });

  describe("Context Creation", () => {
    it("createUsageContext generates unique runId for each context", () => {
      const ctx1 = createUsageContext({ threadId: "thread-1" });
      const ctx2 = createUsageContext({ threadId: "thread-2" });

      expect(ctx1.runId).toBeDefined();
      expect(ctx2.runId).toBeDefined();
      expect(ctx1.runId).not.toBe(ctx2.runId);
    });

    it("createUsageContext initializes empty records and messages arrays", () => {
      const ctx = createUsageContext({ threadId: "test" });

      expect(ctx.records).toEqual([]);
      expect(ctx.messages).toEqual([]);
      expect(ctx._seenMessageIds).toBeInstanceOf(Set);
    });
  });
});
