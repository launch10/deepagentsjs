import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db, eq, and, llmUsage, llmConversationTraces } from "@db";
import { DatabaseSnapshotter } from "@services";
import {
  persistUsage,
  persistTrace,
  type UsageRecord,
  type UsageSummary,
} from "@core";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

/**
 * DATABASE PERSISTENCE TESTS - BILLING CRITICAL
 *
 * These tests verify that usage records and conversation traces
 * are ACTUALLY written to the database, not just transformed.
 *
 * Unit tests for transformation logic exist elsewhere. These tests
 * verify the full database write path.
 *
 * Failure = lost billing data = lost revenue.
 */

describe.sequential("Database Persistence - BILLING CRITICAL", () => {
  beforeAll(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  }, 30000);

  const testRunId = `test-run-${Date.now()}`;
  const testChatId = 1;
  const testThreadId = `test-thread-${Date.now()}`;

  afterEach(async () => {
    // Clean up test data from both tables
    await Promise.all([
      db.delete(llmUsage).where(eq(llmUsage.runId, testRunId)),
      db.delete(llmConversationTraces).where(eq(llmConversationTraces.runId, testRunId)),
    ]);
  });

  describe("persistUsage - Database Writes", () => {
    it("MUST write usage record to llm_usage table", async () => {
      const records: UsageRecord[] = [
        {
          runId: testRunId,
          messageId: "msg-001",
          langchainRunId: "lc-run-001",
          model: "claude-3-opus-20240229",
          inputTokens: 1500,
          outputTokens: 500,
          reasoningTokens: 0,
          cacheCreationTokens: 100,
          cacheReadTokens: 50,
          timestamp: new Date(),
        },
      ];

      await persistUsage(records, {
        chatId: testChatId,
        threadId: testThreadId,
        graphName: "brainstorm",
      });

      // Verify it was written to database
      const dbRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.runId, testRunId));

      expect(dbRecords.length).toBe(1);

      const dbRecord = dbRecords[0]!;
      expect(dbRecord.runId).toBe(testRunId);
      expect(dbRecord.messageId).toBe("msg-001");
      expect(dbRecord.modelRaw).toBe("claude-3-opus-20240229");
      expect(dbRecord.inputTokens).toBe(1500);
      expect(dbRecord.outputTokens).toBe(500);
      expect(dbRecord.cacheCreationTokens).toBe(100);
      expect(dbRecord.cacheReadTokens).toBe(50);
      expect(dbRecord.chatId).toBe(testChatId);
      expect(dbRecord.threadId).toBe(testThreadId);
      expect(dbRecord.graphName).toBe("brainstorm");
    });

    it("MUST write multiple usage records in single call", async () => {
      const records: UsageRecord[] = [
        {
          runId: testRunId,
          messageId: "msg-001",
          langchainRunId: "lc-run-001",
          model: "claude-3-opus-20240229",
          inputTokens: 1000,
          outputTokens: 200,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
        {
          runId: testRunId,
          messageId: "msg-002",
          langchainRunId: "lc-run-002",
          model: "claude-3-opus-20240229",
          inputTokens: 1200,
          outputTokens: 300,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
        {
          runId: testRunId,
          messageId: "msg-003",
          langchainRunId: "lc-run-003",
          model: "gpt-4-turbo-preview",
          inputTokens: 800,
          outputTokens: 150,
          reasoningTokens: 50,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
      ];

      await persistUsage(records, {
        chatId: testChatId,
        threadId: testThreadId,
        graphName: "brainstorm",
      });

      const dbRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.runId, testRunId));

      expect(dbRecords.length).toBe(3);

      // Verify each record
      const msg1 = dbRecords.find((r) => r.messageId === "msg-001");
      const msg2 = dbRecords.find((r) => r.messageId === "msg-002");
      const msg3 = dbRecords.find((r) => r.messageId === "msg-003");

      expect(msg1).toBeDefined();
      expect(msg2).toBeDefined();
      expect(msg3).toBeDefined();

      expect(msg1!.inputTokens).toBe(1000);
      expect(msg2!.inputTokens).toBe(1200);
      expect(msg3!.inputTokens).toBe(800);
      expect(msg3!.reasoningTokens).toBe(50);
    });

    it("MUST handle empty records array gracefully", async () => {
      // Should not throw, just no-op
      await expect(
        persistUsage([], {
          chatId: testChatId,
          threadId: testThreadId,
          graphName: "brainstorm",
        })
      ).resolves.toBeUndefined();
    });

    it("MUST preserve optional fields when present", async () => {
      const records: UsageRecord[] = [
        {
          runId: testRunId,
          messageId: "msg-optional",
          langchainRunId: "lc-run-optional",
          parentLangchainRunId: "lc-parent-001",
          model: "claude-3-sonnet-20240229",
          inputTokens: 500,
          outputTokens: 100,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
          tags: ["tag1", "tag2"],
          metadata: { key: "value" },
        },
      ];

      await persistUsage(records, {
        chatId: testChatId,
        threadId: testThreadId,
        graphName: "brainstorm",
      });

      const dbRecords = await db
        .select()
        .from(llmUsage)
        .where(eq(llmUsage.runId, testRunId));

      expect(dbRecords.length).toBe(1);
      expect(dbRecords[0]!.parentLangchainRunId).toBe("lc-parent-001");
      expect(dbRecords[0]!.tags).toEqual(["tag1", "tag2"]);
      expect(dbRecords[0]!.metadata).toEqual({ key: "value" });
    });
  });

  describe("persistTrace - Database Writes", () => {
    it("MUST write trace to conversation traces table", async () => {
      const messages = [
        new SystemMessage("You are a helpful assistant."),
        new HumanMessage("What is 2+2?"),
        new AIMessage("2+2 equals 4."),
      ];

      const usageSummary: UsageSummary = {
        totalInputTokens: 100,
        totalOutputTokens: 50,
        llmCallCount: 1,
      };

      await persistTrace(
        {
          chatId: testChatId,
          threadId: testThreadId,
          runId: testRunId,
          graphName: "brainstorm",
        },
        messages,
        usageSummary
      );

      // Verify trace was written
      const dbTraces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.runId, testRunId));

      expect(dbTraces.length).toBe(1);

      const trace = dbTraces[0]!;
      expect(trace.runId).toBe(testRunId);
      expect(trace.chatId).toBe(testChatId);
      expect(trace.threadId).toBe(testThreadId);
      expect(trace.graphName).toBe("brainstorm");

      // Usage summary is stored as JSONB
      const storedSummary = trace.usageSummary as { totalInputTokens: number; totalOutputTokens: number; llmCallCount: number };
      expect(storedSummary.totalInputTokens).toBe(100);
      expect(storedSummary.totalOutputTokens).toBe(50);
      expect(storedSummary.llmCallCount).toBe(1);

      // Verify messages are serialized correctly
      const serializedMessages = trace.messages as any[];
      expect(serializedMessages.length).toBe(3);

      expect(serializedMessages[0].type).toBe("system");
      expect(serializedMessages[0].content).toBe("You are a helpful assistant.");

      expect(serializedMessages[1].type).toBe("human");
      expect(serializedMessages[1].content).toBe("What is 2+2?");

      expect(serializedMessages[2].type).toBe("ai");
      expect(serializedMessages[2].content).toBe("2+2 equals 4.");
    });

    it("MUST extract system prompt for convenience querying", async () => {
      const messages = [
        new SystemMessage("You are a coffee shop naming expert."),
        new HumanMessage("Name my shop"),
      ];

      const usageSummary: UsageSummary = {
        totalInputTokens: 50,
        totalOutputTokens: 25,
        llmCallCount: 1,
      };

      await persistTrace(
        {
          chatId: testChatId,
          threadId: testThreadId,
          runId: testRunId,
          graphName: "brainstorm",
        },
        messages,
        usageSummary
      );

      const dbTraces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.runId, testRunId));

      expect(dbTraces[0]!.systemPrompt).toBe("You are a coffee shop naming expert.");
    });

    it("MUST preserve message metadata for debugging", async () => {
      const aiMessage = new AIMessage({
        content: "Here's my response",
        response_metadata: {
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
        },
        usage_metadata: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      });

      const messages = [new HumanMessage("Hello"), aiMessage];

      await persistTrace(
        {
          chatId: testChatId,
          threadId: testThreadId,
          runId: testRunId,
          graphName: "brainstorm",
        },
        messages,
        { totalInputTokens: 100, totalOutputTokens: 50, llmCallCount: 1 }
      );

      const dbTraces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.runId, testRunId));

      const serializedMessages = dbTraces[0]!.messages as any[];
      const aiMsg = serializedMessages.find((m: any) => m.type === "ai");

      expect(aiMsg.usage_metadata).toBeDefined();
      expect(aiMsg.response_metadata).toBeDefined();
    });

    it("MUST mark context messages for filtering", async () => {
      // Context message is a HumanMessage with name="context"
      const contextMessage = new HumanMessage({
        content: "User is on the pricing page",
        name: "context",
      });

      const messages = [
        new SystemMessage("You are helpful."),
        new HumanMessage("What prices?"),
        contextMessage,
        new AIMessage("Here are the prices..."),
      ];

      await persistTrace(
        {
          chatId: testChatId,
          threadId: testThreadId,
          runId: testRunId,
          graphName: "brainstorm",
        },
        messages,
        { totalInputTokens: 100, totalOutputTokens: 50, llmCallCount: 1 }
      );

      const dbTraces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.runId, testRunId));

      const serializedMessages = dbTraces[0]!.messages as any[];

      // Context message should be marked
      const contextMsg = serializedMessages.find(
        (m: any) => m.content === "User is on the pricing page"
      );
      expect(contextMsg.is_context_message).toBe(true);

      // Regular messages should not be marked
      const regularHuman = serializedMessages.find((m: any) => m.content === "What prices?");
      expect(regularHuman.is_context_message).toBe(false);
    });

    it("MUST handle empty messages gracefully", async () => {
      await expect(
        persistTrace(
          {
            chatId: testChatId,
            threadId: testThreadId,
            runId: testRunId,
            graphName: "brainstorm",
          },
          [],
          { totalInputTokens: 0, totalOutputTokens: 0, llmCallCount: 0 }
        )
      ).resolves.toBeUndefined();

      // Verify no trace was written
      const dbTraces = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.runId, testRunId));

      expect(dbTraces.length).toBe(0);
    });
  });

  describe("End-to-End: persistUsage + persistTrace", () => {
    it("MUST persist both usage and trace for complete billing record", async () => {
      const records: UsageRecord[] = [
        {
          runId: testRunId,
          messageId: "msg-e2e",
          langchainRunId: "lc-run-e2e",
          model: "claude-3-opus-20240229",
          inputTokens: 1000,
          outputTokens: 500,
          reasoningTokens: 0,
          cacheCreationTokens: 50,
          cacheReadTokens: 25,
          timestamp: new Date(),
        },
      ];

      const messages = [
        new SystemMessage("You are helpful."),
        new HumanMessage("Help me"),
        new AIMessage("Here to help!"),
      ];

      const usageSummary: UsageSummary = {
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        llmCallCount: 1,
      };

      // This is what middleware's onComplete does
      await Promise.all([
        persistUsage(records, {
          chatId: testChatId,
          threadId: testThreadId,
          graphName: "brainstorm",
        }),
        persistTrace(
          {
            chatId: testChatId,
            threadId: testThreadId,
            runId: testRunId,
            graphName: "brainstorm",
          },
          messages,
          usageSummary
        ),
      ]);

      // Verify both were written
      const usageRecords = await db.select().from(llmUsage).where(eq(llmUsage.runId, testRunId));

      const traceRecords = await db
        .select()
        .from(llmConversationTraces)
        .where(eq(llmConversationTraces.runId, testRunId));

      expect(usageRecords.length).toBe(1);
      expect(traceRecords.length).toBe(1);

      // Verify they can be correlated
      expect(usageRecords[0]!.runId).toBe(traceRecords[0]!.runId);
      expect(usageRecords[0]!.chatId).toBe(traceRecords[0]!.chatId);
      expect(usageRecords[0]!.threadId).toBe(traceRecords[0]!.threadId);
    });
  });
});
