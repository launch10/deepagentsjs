import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { db, eq, chats, llmUsage, llmConversationTraces } from "@db";
import { DatabaseSnapshotter } from "@services";
import { BrainstormAPI } from "@api";
import type { ThreadIDType } from "@types";

/**
 * API INTEGRATION TESTS - BILLING CRITICAL
 *
 * These tests verify the REAL billing flow by calling actual production APIs:
 * 1. Call BrainstormAPI.stream() (the real API used by routes)
 * 2. Consume the stream to completion (triggers middleware onComplete)
 * 3. Verify usage records written to llm_usage table
 * 4. Verify trace records written to llm_conversation_traces table
 *
 * This is the single most valuable billing test - it tests the actual code path
 * that runs in production, not mocked internals.
 *
 * Uses Polly for HTTP recording/replay so tests don't hit real LLMs.
 */

describe.sequential("API Integration - BILLING CRITICAL", () => {
  let testChatId: number;
  let testThreadId: string;

  beforeEach(async () => {
    // website_step snapshot includes brainstorm chat we can reuse
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    // Get the existing brainstorm chat from the snapshot
    const [chat] = await db.select().from(chats).where(eq(chats.chatType, "brainstorm")).limit(1);

    if (!chat?.threadId || !chat?.id) {
      throw new Error("No brainstorm chat found in website_step snapshot");
    }

    testThreadId = chat.threadId;
    testChatId = chat.id;
  });

  afterEach(async () => {
    // Clean records created during tests (by threadId to be safe)
    await db.delete(llmUsage).where(eq(llmUsage.threadId, testThreadId));
    await db.delete(llmConversationTraces).where(eq(llmConversationTraces.threadId, testThreadId));
  });

  /**
   * Helper to consume a Response stream to completion.
   * This triggers the middleware's onComplete callback.
   */
  async function consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response has no body");
    }

    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    return result;
  }

  /**
   * Single comprehensive test that verifies all billing assertions.
   *
   * NOTE: We use a single test because Polly records/replays at the HTTP level,
   * but LangChain callbacks fire at the SDK level. During Polly replay, callbacks
   * don't fire, so multiple tests with separate API calls would fail after the
   * first recording. By consolidating into one test, we ensure all assertions
   * run after a single real LLM call.
   */
  it("MUST persist usage records, traces, and correlate them correctly", async () => {
    // Call the real API
    const response = await BrainstormAPI.stream({
      messages: [new HumanMessage("Hello, I have a business idea about dogs")],
      threadId: testThreadId,
      state: {
        threadId: testThreadId as ThreadIDType,
        jwt: "test-jwt-token",
      },
    });

    // Consume the stream to trigger onComplete
    await consumeStream(response);

    // Give a moment for async persistence (fire-and-forget notifyRails)
    await new Promise((r) => setTimeout(r, 100));

    // ===== USAGE RECORDS =====
    const usageRecords = await db
      .select()
      .from(llmUsage)
      .where(eq(llmUsage.threadId, testThreadId));

    expect(usageRecords.length).toBeGreaterThan(0);

    // Verify record has expected fields
    const record = usageRecords[0]!;
    expect(record.chatId).toBe(testChatId);
    expect(record.threadId).toBe(testThreadId);
    expect(record.graphName).toBe("brainstorm");
    expect(record.inputTokens).toBeGreaterThan(0);
    expect(record.outputTokens).toBeGreaterThan(0);
    expect(record.modelRaw).toBeDefined();
    expect(record.runId).toBeDefined();

    // ===== CONVERSATION TRACE =====
    const traces = await db
      .select()
      .from(llmConversationTraces)
      .where(eq(llmConversationTraces.threadId, testThreadId));

    expect(traces.length).toBe(1);

    const trace = traces[0]!;
    expect(trace.chatId).toBe(testChatId);
    expect(trace.threadId).toBe(testThreadId);
    expect(trace.graphName).toBe("brainstorm");
    expect(trace.runId).toBeDefined();

    // Verify usage summary
    const usageSummary = trace.usageSummary as any;
    expect(usageSummary.totalInputTokens).toBeGreaterThan(0);
    expect(usageSummary.totalOutputTokens).toBeGreaterThan(0);
    expect(usageSummary.llmCallCount).toBeGreaterThan(0);

    // Verify messages were captured
    const messages = trace.messages as any[];
    expect(messages.length).toBeGreaterThan(0);
    // Should have at least the human message and an AI response
    expect(messages.some((m) => m.type === "human")).toBe(true);
    expect(messages.some((m) => m.type === "ai")).toBe(true);

    // ===== CORRELATION =====
    // All usage records should share the same runId as the trace
    const traceRunId = trace.runId;
    for (const usageRecord of usageRecords) {
      expect(usageRecord.runId).toBe(traceRunId);
    }

    // ===== USAGE SUMMARY ACCURACY =====
    // The trace's usage summary should match the sum of individual records
    const totalInputFromRecords = usageRecords.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
    const totalOutputFromRecords = usageRecords.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);
    expect(usageSummary.totalInputTokens).toBe(totalInputFromRecords);
    expect(usageSummary.totalOutputTokens).toBe(totalOutputFromRecords);
    expect(usageSummary.llmCallCount).toBe(usageRecords.length);
  });
});
