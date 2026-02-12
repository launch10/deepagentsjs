/**
 * Unit tests for compactConversation.
 *
 * Tests:
 * 1. Atomic grouping: tool_call/tool_result pairs are never split
 * 2. Summary consolidation: multiple old summaries get folded into one
 * 3. Existing summary is included in new summarization input
 * 4. Exactly one summary message in the result
 * 5. Structural layout: after reducer + Conversation.window(), messages are
 *    [summary (context)] [recent conversation messages]
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import { messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { compactConversation } from "@nodes";
import { Conversation } from "@conversation";
import { isSummaryMessage } from "langgraph-ai-sdk";

/**
 * Deterministic mock summarizer so tests never hit a real LLM.
 * Incorporates existing summaries (like the real one does) for consolidation tests.
 */
const mockSummarizer = async (messages: BaseMessage[], existingSummaries: string[]) => {
  const parts: string[] = [];
  if (existingSummaries.length > 0) {
    parts.push(`Previous: ${existingSummaries.join("; ")}.`);
  }
  parts.push(`Summarized ${messages.length} messages.`);
  return parts.join(" ");
};

describe("compactConversation", () => {
  describe("atomic grouping: never splits tool_call/tool_result pairs", () => {
    it("keeps AIMessage(tool_calls) + ToolMessages together when at the boundary", async () => {
      // Build a history where naive slice(-7) would split a tool pair:
      //   positions 0-12: [h0, a0, h1, a1, h2, a2(tool_calls), t2, a2-summary, h3, a3, h4, a4, h5]
      //   slice(-7) keeps positions 6-12: [t2, a2-summary, h3, a3, h4, a4, h5]
      //   slice(0, -7) removes 0-5: [h0, a0, h1, a1, h2, a2(tool_calls)]
      //   SPLIT: a2(tool_calls) removed but t2 kept → orphan!
      const messages: BaseMessage[] = [
        new HumanMessage({ content: "Old request", id: "h0" }),
        new AIMessage({ content: "Done 0", id: "a0" }),
        new HumanMessage({ content: "Another old", id: "h1" }),
        new AIMessage({ content: "Done 1", id: "a1" }),
        new HumanMessage({ content: "Edit request", id: "h2" }),
        // Tool pair — must stay together
        new AIMessage({
          content: "Editing...",
          id: "a2-tool",
          tool_calls: [{ id: "tc1", name: "str_replace_based_edit_tool", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: "Successfully replaced text.", tool_call_id: "tc1", id: "t2" }),
        new AIMessage({ content: "Done with edit.", id: "a2-summary" }),
        new HumanMessage({ content: "Third request", id: "h3" }),
        new AIMessage({ content: "Done 3", id: "a3" }),
        new HumanMessage({ content: "Fourth request", id: "h4" }),
        new AIMessage({ content: "Done 4", id: "a4" }),
        new HumanMessage({ content: "Fifth request", id: "h5" }),
      ];

      const result = await compactConversation(messages, {
        messageThreshold: 3,
        keepRecent: 3,  // Naive slice(-7) would split the tool pair
        summarizer: mockSummarizer,
      });

      if (!("messages" in result)) {
        throw new Error("Expected compaction to trigger");
      }

      // Collect removed IDs
      const removedIds = new Set<string>();
      for (const m of result.messages) {
        if (m instanceof RemoveMessage) {
          removedIds.add((m as any).id);
        }
      }

      // The tool pair must stay together: either BOTH removed or BOTH kept
      const toolAIRemoved = removedIds.has("a2-tool");
      const toolResultRemoved = removedIds.has("t2");
      expect(toolAIRemoved).toBe(toolResultRemoved);
    });

    it("includes multiple ToolMessages when AIMessage has parallel tool calls", async () => {
      // Naive slice(-8) would split the group:
      //   positions 0-13: [h0, a0, h1, a1, h2, a2-dispatch, t2a, t2b, a2-summary, h3, a3, h4, a4, h5]
      //   slice(-8) keeps 6-13: [t2a, t2b, a2-summary, h3, a3, h4, a4, h5]
      //   slice(0,-8) removes 0-5: [h0, a0, h1, a1, h2, a2-dispatch]
      //   SPLIT: a2-dispatch removed but t2a,t2b kept → orphans!
      const messages: BaseMessage[] = [
        new HumanMessage({ content: "Old stuff", id: "h0" }),
        new AIMessage({ content: "Old response", id: "a0" }),
        new HumanMessage({ content: "More old stuff", id: "h1" }),
        new AIMessage({ content: "More old", id: "a1" }),
        new HumanMessage({ content: "Build my page", id: "h2" }),
        // AI dispatches parallel subagents — group of 3 (AI + 2 ToolMessages)
        new AIMessage({
          content: "Building sections...",
          id: "a2-dispatch",
          tool_calls: [
            { id: "tc1", name: "task", args: {}, type: "tool_call" as const },
            { id: "tc2", name: "task", args: {}, type: "tool_call" as const },
          ],
        }),
        new ToolMessage({ content: "Hero built.", tool_call_id: "tc1", id: "t2a" }),
        new ToolMessage({ content: "CTA built.", tool_call_id: "tc2", id: "t2b" }),
        new AIMessage({ content: "Page complete!", id: "a2-summary" }),
        new HumanMessage({ content: "Change headline", id: "h3" }),
        new AIMessage({ content: "Changed.", id: "a3" }),
        new HumanMessage({ content: "Change color", id: "h4" }),
        new AIMessage({ content: "Changed color.", id: "a4" }),
        new HumanMessage({ content: "Something else", id: "h5" }),
      ];

      const result = await compactConversation(messages, {
        messageThreshold: 3,
        keepRecent: 3,  // Naive slice(-8) splits the group
        summarizer: mockSummarizer,
      });

      if (!("messages" in result)) {
        throw new Error("Expected compaction to trigger");
      }

      const removedIds = new Set<string>();
      for (const m of result.messages) {
        if (m instanceof RemoveMessage) {
          removedIds.add((m as any).id);
        }
      }

      const dispatchRemoved = removedIds.has("a2-dispatch");
      const tool1Removed = removedIds.has("t2a");
      const tool2Removed = removedIds.has("t2b");
      // All or nothing — the group stays together
      expect(tool1Removed).toBe(dispatchRemoved);
      expect(tool2Removed).toBe(dispatchRemoved);
    });
  });

  // ─── Summary consolidation ──────────────────────────────────────────────

  describe("summary consolidation", () => {
    it("produces exactly one summary message (not multiple)", async () => {
      const messages: BaseMessage[] = [
        // Two old summaries (accumulated from previous compactions)
        new HumanMessage({
          content: "[[[CONVERSATION SUMMARY]]] Built the initial page.",
          name: "context",
          id: "summary-1",
        }),
        new HumanMessage({
          content: "[[[CONVERSATION SUMMARY]]] Changed the headline.",
          name: "context",
          id: "summary-2",
        }),
        // Conversation
        new HumanMessage({ content: "Change 1", id: "h1" }),
        new AIMessage({ content: "Done 1", id: "a1" }),
        new HumanMessage({ content: "Change 2", id: "h2" }),
        new AIMessage({ content: "Done 2", id: "a2" }),
        new HumanMessage({ content: "Change 3", id: "h3" }),
        new AIMessage({ content: "Done 3", id: "a3" }),
        new HumanMessage({ content: "Change 4", id: "h4" }),
        new AIMessage({ content: "Done 4", id: "a4" }),
        new HumanMessage({ content: "Change 5", id: "h5" }),
        new AIMessage({ content: "Done 5", id: "a5" }),
        new HumanMessage({ content: "Change 6", id: "h6" }),
        new AIMessage({ content: "Done 6", id: "a6" }),
        new HumanMessage({ content: "Latest", id: "h7" }),
      ];

      const result = await compactConversation(messages, { messageThreshold: 3, keepRecent: 4, summarizer: mockSummarizer });

      if (!("messages" in result)) {
        throw new Error("Expected compaction to trigger");
      }

      // Count summary messages (non-removal messages with name="context")
      const summaryMessages = result.messages.filter(
        (m) => isSummaryMessage(m as BaseMessage)
      );
      expect(summaryMessages.length).toBe(1);

      // Both old summaries should be removed
      const removedIds = new Set<string>();
      for (const m of result.messages) {
        if ((m as any).constructor?.name === "RemoveMessage") {
          removedIds.add((m as any).id);
        }
      }
      expect(removedIds.has("summary-1")).toBe(true);
      expect(removedIds.has("summary-2")).toBe(true);
    });
  });

  // ─── Structural layout: [summary] [recent messages] ─────────────────────

  describe("structural layout after reducer application", () => {
    /**
     * Simulate what the graph does: apply compaction output through
     * messagesStateReducer, then separate context (summary) from conversation.
     * The result should always be: [summary context messages] [recent conversation].
     */
    function applyAndSeparate(original: BaseMessage[], compactionOutput: BaseMessage[]) {
      const afterReducer = messagesStateReducer(original, compactionOutput);
      const isContext = (m: BaseMessage) => (m as any).name === "context";
      const contextMsgs = afterReducer.filter(isContext);
      const conversationMsgs = afterReducer.filter((m) => !isContext(m));
      return { afterReducer, contextMsgs, conversationMsgs };
    }

    it("after compaction, state has exactly ONE summary and recent messages only", async () => {
      const messages: BaseMessage[] = [
        new HumanMessage({ content: "Build my page", id: "h1" }),
        new AIMessage({
          content: "Building...", id: "a1",
          tool_calls: [{ id: "tc1", name: "task", args: {}, type: "tool_call" as const }],
        }),
        new ToolMessage({ content: "Hero built.", tool_call_id: "tc1", id: "t1" }),
        new AIMessage({ content: "Done!", id: "a1-done" }),
        new HumanMessage({ content: "Change headline", id: "h2" }),
        new AIMessage({ content: "Changed.", id: "a2" }),
        new HumanMessage({ content: "Change color", id: "h3" }),
        new AIMessage({ content: "Changed color.", id: "a3" }),
        new HumanMessage({ content: "Add CTA", id: "h4" }),
        new AIMessage({ content: "Added CTA.", id: "a4" }),
        new HumanMessage({ content: "Fix typo", id: "h5" }),
        new AIMessage({ content: "Fixed.", id: "a5" }),
        new HumanMessage({ content: "Latest request", id: "h6" }),
      ];

      const result = await compactConversation(messages, { messageThreshold: 3, keepRecent: 4, summarizer: mockSummarizer });
      if (!("messages" in result)) throw new Error("Expected compaction to trigger");

      const { contextMsgs, conversationMsgs } = applyAndSeparate(messages, result.messages);

      // Exactly one summary
      expect(contextMsgs.length).toBe(1);
      expect(isSummaryMessage(contextMsgs[0] as BaseMessage)).toBe(true);

      // Recent messages are only the kept ones — old tool calls are gone
      const keptIds = new Set(conversationMsgs.map((m) => m.id));
      expect(keptIds.has("h1")).toBe(false);   // old
      expect(keptIds.has("a1")).toBe(false);    // old tool_call AI
      expect(keptIds.has("t1")).toBe(false);    // old ToolMessage
      expect(keptIds.has("h6")).toBe(true);     // recent
    });

    it("old tool call groups are fully summarized away, not preserved", async () => {
      // Create flow: AI dispatches 4 subagents (big tool group), then 3 edit turns.
      // After compaction, the tool group from turn 1 should be GONE (summarized).
      const messages: BaseMessage[] = [
        new HumanMessage({ content: "Build my page", id: "h1" }),
        new AIMessage({
          content: "Building all sections...", id: "a1-dispatch",
          tool_calls: [
            { id: "tc1", name: "task", args: {}, type: "tool_call" as const },
            { id: "tc2", name: "task", args: {}, type: "tool_call" as const },
            { id: "tc3", name: "task", args: {}, type: "tool_call" as const },
            { id: "tc4", name: "task", args: {}, type: "tool_call" as const },
          ],
        }),
        new ToolMessage({ content: "Hero section built.", tool_call_id: "tc1", id: "t1" }),
        new ToolMessage({ content: "Features section built.", tool_call_id: "tc2", id: "t2" }),
        new ToolMessage({ content: "CTA section built.", tool_call_id: "tc3", id: "t3" }),
        new ToolMessage({ content: "Footer built.", tool_call_id: "tc4", id: "t4" }),
        new AIMessage({ content: "Your page is ready!", id: "a1-done" }),
        // Edit turns
        new HumanMessage({ content: "Change headline", id: "h2" }),
        new AIMessage({ content: "Changed headline.", id: "a2" }),
        new HumanMessage({ content: "Change colors", id: "h3" }),
        new AIMessage({ content: "Changed colors.", id: "a3" }),
        new HumanMessage({ content: "Fix spacing", id: "h4" }),
        new AIMessage({ content: "Fixed spacing.", id: "a4" }),
        new HumanMessage({ content: "Latest edit", id: "h5" }),
      ];

      const result = await compactConversation(messages, { messageThreshold: 3, keepRecent: 3, summarizer: mockSummarizer });
      if (!("messages" in result)) throw new Error("Expected compaction to trigger");

      const { contextMsgs, conversationMsgs } = applyAndSeparate(messages, result.messages);

      // One summary
      expect(contextMsgs.length).toBe(1);

      // All 4 ToolMessages from the create flow should be gone
      const keptIds = new Set(conversationMsgs.map((m) => m.id));
      expect(keptIds.has("t1")).toBe(false);
      expect(keptIds.has("t2")).toBe(false);
      expect(keptIds.has("t3")).toBe(false);
      expect(keptIds.has("t4")).toBe(false);
      expect(keptIds.has("a1-dispatch")).toBe(false);

      // Recent edits should be kept
      expect(keptIds.has("h5")).toBe(true);
    });

    it("second compaction round consolidates — never more than one summary", async () => {
      // Simulate state AFTER a previous compaction: [old-summary, recent messages]
      const messages: BaseMessage[] = [
        new HumanMessage({
          content: "[[[CONVERSATION SUMMARY]]] Built a landing page with hero, features, CTA. Changed headline to be punchier.",
          name: "context",
          id: "old-summary",
        }),
        new HumanMessage({ content: "Edit 1", id: "h1" }),
        new AIMessage({ content: "Done 1", id: "a1" }),
        new HumanMessage({ content: "Edit 2", id: "h2" }),
        new AIMessage({ content: "Done 2", id: "a2" }),
        new HumanMessage({ content: "Edit 3", id: "h3" }),
        new AIMessage({ content: "Done 3", id: "a3" }),
        new HumanMessage({ content: "Edit 4", id: "h4" }),
        new AIMessage({ content: "Done 4", id: "a4" }),
        new HumanMessage({ content: "Edit 5", id: "h5" }),
        new AIMessage({ content: "Done 5", id: "a5" }),
        new HumanMessage({ content: "Edit 6", id: "h6" }),
        new AIMessage({ content: "Done 6", id: "a6" }),
        new HumanMessage({ content: "Latest", id: "h7" }),
      ];

      const result = await compactConversation(messages, { messageThreshold: 3, keepRecent: 4, summarizer: mockSummarizer });
      if (!("messages" in result)) throw new Error("Expected compaction to trigger");

      const { contextMsgs, conversationMsgs, afterReducer } = applyAndSeparate(messages, result.messages);

      // Still exactly ONE summary — old one replaced, not stacked
      expect(contextMsgs.length).toBe(1);

      // Old summary should be gone (replaced by consolidated one)
      const allIds = new Set(afterReducer.map((m) => m.id).filter(Boolean));
      expect(allIds.has("old-summary")).toBe(false);

      // Recent messages survive
      expect(conversationMsgs.some((m) => m.id === "h7")).toBe(true);
    });

    it("Conversation.window() places summary BEFORE recent messages", async () => {
      const messages: BaseMessage[] = [
        new HumanMessage({ content: "Build page", id: "h1" }),
        new AIMessage({ content: "Done", id: "a1" }),
        new HumanMessage({ content: "Edit 1", id: "h2" }),
        new AIMessage({ content: "Done 1", id: "a2" }),
        new HumanMessage({ content: "Edit 2", id: "h3" }),
        new AIMessage({ content: "Done 2", id: "a3" }),
        new HumanMessage({ content: "Edit 3", id: "h4" }),
        new AIMessage({ content: "Done 3", id: "a4" }),
        new HumanMessage({ content: "Edit 4", id: "h5" }),
        new AIMessage({ content: "Done 4", id: "a5" }),
        new HumanMessage({ content: "Edit 5", id: "h6" }),
        new AIMessage({ content: "Done 5", id: "a6" }),
        new HumanMessage({ content: "Latest", id: "h7" }),
      ];

      const compactionResult = await compactConversation(messages, { messageThreshold: 3, keepRecent: 4, summarizer: mockSummarizer });
      if (!("messages" in compactionResult)) throw new Error("Expected compaction to trigger");

      // Apply reducer
      const afterReducer = messagesStateReducer(messages, compactionResult.messages);

      // Window through Conversation (like prepareTurn does internally)
      const finalMessages = new Conversation(afterReducer).window();

      // First message should be the summary (context message)
      expect((finalMessages[0] as any).name).toBe("context");
      expect(isSummaryMessage(finalMessages[0]!)).toBe(true);

      // Remaining messages should be conversation (not context)
      for (let i = 1; i < finalMessages.length; i++) {
        expect((finalMessages[i] as any).name).not.toBe("context");
      }
    });
  });

  // ─── Structured summarization ───────────────────────────────────────────

  describe("structured summarization prompt", () => {
    it("summary uses the triple-bracket marker for agent visibility", async () => {
      const messages: BaseMessage[] = [
        new HumanMessage({ content: "Build my page", id: "h1" }),
        new AIMessage({ content: "Done!", id: "a1" }),
        new HumanMessage({ content: "Change headline", id: "h2" }),
        new AIMessage({ content: "Changed.", id: "a2" }),
        new HumanMessage({ content: "Change color", id: "h3" }),
        new AIMessage({ content: "Changed color.", id: "a3" }),
        new HumanMessage({ content: "Add CTA", id: "h4" }),
        new AIMessage({ content: "Added CTA.", id: "a4" }),
        new HumanMessage({ content: "Fix typo", id: "h5" }),
        new AIMessage({ content: "Fixed.", id: "a5" }),
        new HumanMessage({ content: "Latest request", id: "h6" }),
      ];

      const result = await compactConversation(messages, {
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      if (!("messages" in result)) throw new Error("Expected compaction to trigger");

      const summaryMsgs = result.messages.filter(
        (m) => !(m instanceof RemoveMessage) && (m as any).name === "context"
      );
      expect(summaryMsgs.length).toBe(1);

      const content = summaryMsgs[0]!.content as string;
      // Should use the triple-bracket marker
      expect(content).toContain("[[[CONVERSATION SUMMARY]]]");
    });

    it("summary message has isSummary metadata flag", async () => {
      const messages: BaseMessage[] = [
        ...Array.from({ length: 6 }, (_, i) => [
          new HumanMessage({ content: `Turn ${i + 1}`, id: `h${i + 1}` }),
          new AIMessage({ content: `Reply ${i + 1}`, id: `a${i + 1}` }),
        ]).flat(),
        new HumanMessage({ content: "Latest", id: "h7" }),
      ];

      const result = await compactConversation(messages, {
        messageThreshold: 3,
        keepRecent: 3,
        summarizer: mockSummarizer,
      });

      if (!("messages" in result)) throw new Error("Expected compaction to trigger");

      const summaryMsgs = result.messages.filter(
        (m) => !(m instanceof RemoveMessage) && (m as any).name === "context"
      );
      expect(summaryMsgs.length).toBe(1);

      // Should have metadata flag for reliable identification
      expect(summaryMsgs[0]!.additional_kwargs?.isSummary).toBe(true);
    });
  });

});
