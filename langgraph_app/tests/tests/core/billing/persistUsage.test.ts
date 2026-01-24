import { describe, it, expect } from "vitest";
import { prepareUsageRecordsForInsert, type UsageRecord } from "@core";

describe("persistUsage", () => {
  describe("prepareUsageRecordsForInsert", () => {
    it("transforms UsageRecord to database row format", () => {
      const records: UsageRecord[] = [
        {
          runId: "run_123",
          messageId: "msg_456",
          langchainRunId: "lc_789",
          parentLangchainRunId: "lc_parent",
          model: "claude-haiku-4-5-20251001",
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 0,
          cacheCreationTokens: 10,
          cacheReadTokens: 5,
          timestamp: new Date("2026-01-23T10:00:00Z"),
          tags: ["test"],
          metadata: { source: "unit-test" },
        },
      ];

      const context = {
        chatId: 123,
        threadId: "thread_abc",
        graphName: "brainstorm",
      };

      const prepared = prepareUsageRecordsForInsert(records, context);

      expect(prepared).toHaveLength(1);
      expect(prepared[0]).toMatchObject({
        chatId: 123,
        threadId: "thread_abc",
        runId: "run_123",
        messageId: "msg_456",
        langchainRunId: "lc_789",
        parentLangchainRunId: "lc_parent",
        graphName: "brainstorm",
        modelRaw: "claude-haiku-4-5-20251001",
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        cacheCreationTokens: 10,
        cacheReadTokens: 5,
        tags: ["test"],
        metadata: { source: "unit-test" },
      });
    });

    it("handles multiple records", () => {
      const records: UsageRecord[] = [
        {
          runId: "run_123",
          messageId: "msg_1",
          langchainRunId: "lc_1",
          model: "claude-haiku-4-5-20251001",
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
        {
          runId: "run_123",
          messageId: "msg_2",
          langchainRunId: "lc_2",
          model: "claude-haiku-4-5-20251001",
          inputTokens: 200,
          outputTokens: 100,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
        },
      ];

      const context = {
        chatId: 123,
        threadId: "thread_abc",
        graphName: "brainstorm",
      };

      const prepared = prepareUsageRecordsForInsert(records, context);

      expect(prepared).toHaveLength(2);
      expect(prepared[0]!.messageId).toBe("msg_1");
      expect(prepared[1]!.messageId).toBe("msg_2");
    });

    it("returns empty array for empty input", () => {
      const context = {
        chatId: 123,
        threadId: "thread_abc",
        graphName: "brainstorm",
      };

      const prepared = prepareUsageRecordsForInsert([], context);

      expect(prepared).toHaveLength(0);
    });

    it("handles records without optional fields", () => {
      const records: UsageRecord[] = [
        {
          runId: "run_123",
          messageId: "msg_1",
          langchainRunId: "lc_1",
          model: "gpt-4.1-mini",
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 25,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp: new Date(),
          // No parentLangchainRunId, tags, or metadata
        },
      ];

      const context = {
        chatId: 123,
        threadId: "thread_abc",
      };

      const prepared = prepareUsageRecordsForInsert(records, context);

      expect(prepared).toHaveLength(1);
      expect(prepared[0]!.parentLangchainRunId).toBeUndefined();
      expect(prepared[0]!.graphName).toBeUndefined();
      expect(prepared[0]!.tags).toBeUndefined();
      expect(prepared[0]!.metadata).toBeUndefined();
    });

    it("includes createdAt timestamp from record", () => {
      const timestamp = new Date("2026-01-23T15:30:00Z");
      const records: UsageRecord[] = [
        {
          runId: "run_123",
          messageId: "msg_1",
          langchainRunId: "lc_1",
          model: "claude-haiku-4-5",
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          timestamp,
        },
      ];

      const context = {
        chatId: 123,
        threadId: "thread_abc",
      };

      const prepared = prepareUsageRecordsForInsert(records, context);

      expect(prepared[0]!.createdAt).toBe(timestamp.toISOString());
    });
  });
});
