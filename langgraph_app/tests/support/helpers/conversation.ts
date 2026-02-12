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
