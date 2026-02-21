/**
 * Conversation.parse() ordering test for context messages.
 *
 * Reproduces the bug where context messages bunch up at the end of
 * conversation history instead of staying interspersed with their
 * respective AI responses.
 *
 * Root cause: Conversation.parse() only creates turns when it sees
 * a non-context HumanMessage. Context messages go to `pendingContext`,
 * and AI messages from auto-init turns (no real HumanMessage) get
 * appended to the current turn or orphaned. When a real HumanMessage
 * finally arrives, all orphaned context messages get absorbed into
 * that turn's prefix, creating the bunching effect.
 */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createContextMessage, isContextMessage } from "langgraph-ai-sdk";
import { Conversation } from "@conversation";

const ctx = (text: string) => createContextMessage(`[[SYSTEM]] ${text}`);

describe("Conversation context message ordering", () => {
  describe("simple auto-init flow (no real HumanMessages)", () => {
    it("preserves [ctx, ai, ctx, ai, ctx, ai] order", () => {
      const messages = [
        ctx("navigated to content"),
        new AIMessage("headlines response"),
        ctx("navigated to highlights"),
        new AIMessage("callouts response"),
        ctx("navigated to keywords"),
        new AIMessage("keywords response"),
      ];

      const conv = new Conversation(messages);
      const windowed = conv.window({ maxTurnPairs: 10, maxChars: 100_000 });

      // Messages should stay in original interleaved order
      assertOrder(windowed, [
        "CTX:navigated to content",
        "AI:headlines response",
        "CTX:navigated to highlights",
        "AI:callouts response",
        "CTX:navigated to keywords",
        "AI:keywords response",
      ]);
    });
  });

  describe("mixed flow: auto-init + user feedback + refresh + page switches", () => {
    it("preserves context messages interspersed with AI responses", () => {
      // This is the exact scenario from the LangSmith screenshot.
      // Storage order: CTX comes before HUMAN — startConversation uses
      // RemoveMessage to lift the HUMAN and re-add it after context,
      // so the reducer stores [CTX, HUMAN, AI] in the correct order.
      const messages = [
        ctx("navigated to content"), // auto-init content
        new AIMessage("here are your headlines"), // content response
        ctx("user sent feedback on content"), // context for feedback turn (before human)
        new HumanMessage("make it eco-friendly"), // user feedback
        new AIMessage("updated eco-friendly heads"), // feedback response
        ctx("refresh 4 headlines"), // refresh
        new AIMessage("refreshed headlines"), // refresh response
        ctx("navigated to highlights"), // page switch
        new AIMessage("here are callouts"), // highlights response
        ctx("navigated to keywords"), // page switch
      ];

      const conv = new Conversation(messages);
      const windowed = conv.window({ maxTurnPairs: 10, maxChars: 100_000 });

      // CRITICAL: Context messages must NOT bunch up at the end.
      // They must stay with their respective AI responses.
      assertOrder(windowed, [
        "CTX:navigated to content",
        "AI:here are your headlines",
        "CTX:user sent feedback on content",
        "HUMAN:make it eco-friendly",
        "AI:updated eco-friendly heads",
        "CTX:refresh 4 headlines",
        "AI:refreshed headlines",
        "CTX:navigated to highlights",
        "AI:here are callouts",
        "CTX:navigated to keywords",
      ]);
    });
  });

  describe("context messages should not be separated from their AI responses", () => {
    it("auto-init ctx + ai pairs stay together after windowing", () => {
      const messages = [
        ctx("navigated to content"),
        new AIMessage("headlines"),
        ctx("navigated to highlights"),
        new AIMessage("callouts"),
      ];

      const conv = new Conversation(messages);
      const windowed = conv.window({ maxTurnPairs: 4, maxChars: 20_000 });

      // No consecutive context messages
      for (let i = 1; i < windowed.length; i++) {
        if (isContextMessage(windowed[i]!) && isContextMessage(windowed[i - 1]!)) {
          const types = windowed.map((m) =>
            isContextMessage(m)
              ? `CTX: ${(m.content as string).slice(0, 40)}`
              : `${m._getType().toUpperCase()}: ${(m.content as string).slice(0, 40)}`
          );
          throw new Error(
            `Consecutive context messages at [${i - 1}] and [${i}]:\n${types.join("\n")}`
          );
        }
      }
    });
  });

  describe("prepareTurn() places context before human for the LLM", () => {
    it("injects new context before the last human message", () => {
      // State has: [CTX, AI, HUMAN] — user sent a message on a page
      // that already had an auto-init turn.
      const messages = [
        ctx("navigated to content"),
        new AIMessage("here are your headlines"),
        new HumanMessage("make them funnier"),
      ];

      const turnCtx = ctx("user sent feedback on content");

      const conv = new Conversation(messages);
      const prepared = conv.prepareTurn({
        contextMessages: [turnCtx],
        maxTurnPairs: 10,
        maxChars: 100_000,
      });

      // LLM should see: [CTX, AI, CTX(new), HUMAN]
      assertOrder(prepared, [
        "CTX:navigated to content",
        "AI:here are your headlines",
        "CTX:user sent feedback on content",
        "HUMAN:make them funnier",
      ]);
    });

    it("appends context at end for intent-driven turns (no trailing human)", () => {
      // State has: [CTX, AI] — auto-init, now switching pages
      const messages = [ctx("navigated to content"), new AIMessage("here are your headlines")];

      const turnCtx = ctx("navigated to highlights");

      const conv = new Conversation(messages);
      const prepared = conv.prepareTurn({
        contextMessages: [turnCtx],
        maxTurnPairs: 10,
        maxChars: 100_000,
      });

      // LLM should see: [CTX, AI, CTX(new)]
      assertOrder(prepared, [
        "CTX:navigated to content",
        "AI:here are your headlines",
        "CTX:navigated to highlights",
      ]);
    });
  });

  describe("windowing with aggressive trim still preserves order", () => {
    it("drops oldest turns but keeps remaining in order", () => {
      // 3 pages of auto-init, window to 2 turns
      const messages = [
        ctx("navigated to content"),
        new AIMessage("headlines"),
        ctx("navigated to highlights"),
        new AIMessage("callouts"),
        ctx("navigated to keywords"),
        new AIMessage("keywords"),
      ];

      const conv = new Conversation(messages);
      // With 2 maxTurnPairs, should drop oldest turn but keep order
      const windowed = conv.window({ maxTurnPairs: 2, maxChars: 100_000 });

      // At minimum, the most recent messages should be in order
      // and no consecutive context messages
      const types = windowed.map((m) => (isContextMessage(m) ? "CTX" : m._getType().toUpperCase()));

      // Should contain the keywords turn
      expect(
        windowed.some((m) => !isContextMessage(m) && (m.content as string).includes("keywords"))
      ).toBe(true);

      // No consecutive CTX messages
      for (let i = 1; i < types.length; i++) {
        expect(
          !(types[i] === "CTX" && types[i - 1] === "CTX"),
          `Consecutive CTX at index ${i - 1} and ${i}: ${types.join(", ")}`
        ).toBe(true);
      }
    });
  });
});

// ─── Helpers ────────────────────────────────────────────

function assertOrder(messages: any[], expected: string[]): void {
  const actual = messages.map((m) => {
    const type = isContextMessage(m) ? "CTX" : m._getType().toUpperCase();
    const content = typeof m.content === "string" ? m.content : "";
    // Strip [[SYSTEM]] prefix for cleaner matching
    const cleanContent = content.replace(/^\[\[SYSTEM\]\]\s*/, "");
    return `${type}:${cleanContent}`;
  });

  expect(actual.length).toEqual(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i], `Message[${i}]`).toEqual(expected[i]);
  }
}
