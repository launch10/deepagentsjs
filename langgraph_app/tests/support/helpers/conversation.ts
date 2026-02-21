/**
 * Shared test helpers for conversation-related tests.
 *
 * Provides factories for building messages, turns, summaries,
 * and a mock summarizer — reusable across conversation, compaction,
 * append-only invariant, and lifecycle tests.
 */
import { HumanMessage, AIMessage, ToolMessage, RemoveMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { messagesStateReducer } from "@langchain/langgraph";
import { isContextMessage } from "langgraph-ai-sdk";
import { Conversation } from "@conversation";

/** Create N simple human+AI turn pairs. */
export function makeSimpleTurns(count: number, startId = 1): BaseMessage[] {
  const msgs: BaseMessage[] = [];
  for (let i = 0; i < count; i++) {
    const idx = startId + i;
    msgs.push(new HumanMessage({ content: `User message ${idx}`, id: `h${idx}` }));
    msgs.push(new AIMessage({ content: `AI response ${idx}`, id: `a${idx}` }));
  }
  return msgs;
}

/** Create a turn with tool calls: Human → AI(tool_calls) → ToolMessage(s) → AI(final). */
export function makeTurnWithTools(turnIdx: number, toolCount = 2): BaseMessage[] {
  const msgs: BaseMessage[] = [];
  msgs.push(new HumanMessage({ content: `User turn ${turnIdx}`, id: `h${turnIdx}` }));
  msgs.push(new AIMessage({
    content: "Working...",
    id: `a${turnIdx}-tc`,
    tool_calls: Array.from({ length: toolCount }, (_, j) => ({
      id: `tc-${turnIdx}-${j}`,
      name: `tool_${j}`,
      args: {},
      type: "tool_call" as const,
    })),
  }));
  for (let j = 0; j < toolCount; j++) {
    msgs.push(new ToolMessage({
      content: `Tool result ${j}`,
      id: `t${turnIdx}-${j}`,
      tool_call_id: `tc-${turnIdx}-${j}`,
    }));
  }
  msgs.push(new AIMessage({ content: `Done ${turnIdx}`, id: `a${turnIdx}-final` }));
  return msgs;
}

/** Create a summary message (AIMessage with [[[CONVERSATION SUMMARY]]]). */
export function makeSummary(text: string, id?: string): AIMessage {
  return new AIMessage({
    content: `[[[CONVERSATION SUMMARY]]]\n${text}`,
    name: "context",
    id: id ?? `summary-${Date.now()}`,
    additional_kwargs: { isSummary: true },
  });
}

/** Deterministic mock summarizer — no LLM calls. */
export const mockSummarizer = async (messages: BaseMessage[], existingSummaries: string[]): Promise<string> => {
  const parts: string[] = [];
  if (existingSummaries.length > 0) {
    parts.push(`Previous: ${existingSummaries.join("; ")}.`);
  }
  parts.push(`Summarized ${messages.length} messages.`);
  return parts.join(" ");
};

/**
 * Apply compaction result through LangGraph's reducer, return new state.
 * First initializes state through the reducer (assigns IDs, like production).
 * Then re-creates the Conversation and compacts against the initialized state.
 */
export async function applyCompactionWithReducer(
  original: BaseMessage[],
  compactOpts: Parameters<Conversation["compact"]>[0],
): Promise<{ after: BaseMessage[]; result: Awaited<ReturnType<Conversation["compact"]>> }> {
  // Initialize state through reducer (assigns IDs to all messages)
  const initialized = messagesStateReducer([], original);
  // Re-parse and compact the initialized state
  const conv = new Conversation(initialized);
  const result = await conv.compact(compactOpts);
  if (!result) return { after: initialized, result: null };
  // Apply compaction through reducer
  const after = messagesStateReducer(initialized, result.toMessages());
  return { after, result };
}

/** Get IDs from a message array, using "ctx" for context messages without IDs. */
export function ids(msgs: BaseMessage[]): string[] {
  return msgs.map((m) => m.id ?? "ctx");
}

// ── Message timeline assertions ─────────────────────────────────

/** Tag a message as CTX / AI / HUMAN / TOOL for readable assertions. */
export function tagMessage(m: BaseMessage): string {
  if (isContextMessage(m)) return "CTX";
  return m._getType().toUpperCase();
}

/** Dump a readable message timeline for error diagnostics. */
export function dumpTimeline(msgs: BaseMessage[]): string {
  return msgs
    .map((m, i) => {
      const t = tagMessage(m);
      const raw = typeof m.content === "string" ? m.content : "[complex]";
      return `  [${i}] ${t}: ${raw.slice(0, 80)}`;
    })
    .join("\n");
}

/**
 * Assert no two consecutive context messages.
 * Detects bunching where context messages pile up instead of
 * staying interspersed with their AI responses.
 */
export function assertNoBunching(msgs: BaseMessage[], label: string): void {
  for (let i = 1; i < msgs.length; i++) {
    if (isContextMessage(msgs[i]!) && isContextMessage(msgs[i - 1]!)) {
      throw new Error(
        `${label}: BUNCHING DETECTED — consecutive CTX at [${i - 1}] and [${i}].\n` +
          `Full timeline:\n${dumpTimeline(msgs)}`
      );
    }
  }
}

/**
 * Assert expected message type pattern.
 * e.g. assertMessageTypes(msgs, ["CTX", "AI", "HUMAN", "CTX", "AI"], "step2")
 */
export function assertMessageTypes(msgs: BaseMessage[], expected: string[], label: string): void {
  const actual = msgs.map(tagMessage);
  if (actual.length !== expected.length || actual.some((t, i) => t !== expected[i])) {
    throw new Error(
      `${label}: Message types don't match.\n` +
        `Expected: [${expected.join(", ")}]\n` +
        `Actual:   [${actual.join(", ")}]\n` +
        `Timeline:\n${dumpTimeline(msgs)}`
    );
  }
}

/**
 * Simulate what the agent does: build context and pass through
 * prepareTurn({ contextMessages }). Verify the LLM sees CTX
 * before HUMAN — the last human message must have CTX immediately
 * before it (the injected context).
 */
export function assertCtxBeforeHumanInLLMView(
  msgs: BaseMessage[],
  ctxMessage: BaseMessage,
  label: string,
  options?: { maxTurnPairs?: number; maxChars?: number },
): void {
  const conv = new Conversation(msgs);
  const prepared = conv.prepareTurn({
    contextMessages: [ctxMessage],
    maxTurnPairs: options?.maxTurnPairs ?? 4,
    maxChars: options?.maxChars ?? 20_000,
  });
  const tags = prepared.map(tagMessage);

  // The LAST human message must have a CTX immediately before it
  let lastHumanIdx = -1;
  for (let i = tags.length - 1; i >= 0; i--) {
    if (tags[i] === "HUMAN") { lastHumanIdx = i; break; }
  }
  if (lastHumanIdx > 0 && tags[lastHumanIdx - 1] !== "CTX") {
    throw new Error(
      `${label}: Last HUMAN at [${lastHumanIdx}] preceded by ${tags[lastHumanIdx - 1]} — expected CTX.\n` +
        `Prepared timeline:\n${dumpTimeline(prepared)}`
    );
  }

  assertNoBunching(prepared, `${label} (LLM view)`);
}
