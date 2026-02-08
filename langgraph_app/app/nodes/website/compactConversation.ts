/**
 * Conversation-level compaction for long-running graph conversations.
 *
 * Runs after the main work node completes. Checks if state.messages
 * exceeds a threshold, and if so, summarizes old messages into a
 * compact summary, preserving recent context.
 *
 * Works with any graph that has `messages: BaseMessage[]` in its state
 * (website, brainstorm, ads, etc.).
 */
import type { BaseMessage } from "@langchain/core/messages";
import {
  RemoveMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { type CoreGraphState } from "@state";

export interface CompactConversationOptions {
  /** Trigger compaction when non-context messages exceed this count. Default: 12 */
  messageThreshold?: number;
  /** Number of recent messages to keep (not summarized). Default: 6 */
  keepRecent?: number;
  /** Max total chars before forced compaction. Default: 100000 */
  maxChars?: number;
}

const DEFAULTS: Required<CompactConversationOptions> = {
  messageThreshold: 12,
  keepRecent: 6,
  maxChars: 100_000,
};

/**
 * Create a compaction node for any graph that has `messages` in its state.
 * Works with website, brainstorm, ads, or any graph extending BaseAnnotation.
 */
export function createCompactConversationNode(
  options?: CompactConversationOptions
) {
  return NodeMiddleware.use(
    {},
    async (state: CoreGraphState) => {
      return compactConversation(state.messages, options);
    }
  );
}

/** Pre-built node for the website graph (default options). */
export const compactConversationNode = createCompactConversationNode();

/**
 * Compact a message array by summarizing old messages.
 *
 * Returns partial state with RemoveMessage entries + a summary message,
 * or empty object if compaction isn't needed.
 *
 * Generic — works with any graph state that has `messages`.
 */
export async function compactConversation(
  messages: BaseMessage[],
  options?: CompactConversationOptions
): Promise<{ messages: BaseMessage[] } | Record<string, never>> {
  const opts = { ...DEFAULTS, ...options };

  // Separate context events from conversation messages
  const contextMessages = messages.filter(isContextMessage);
  const conversationMessages = messages.filter((m) => !isContextMessage(m));

  // Check if compaction is needed
  const totalChars = messages.reduce((sum, m) => sum + charCount(m), 0);
  const needsCompaction =
    conversationMessages.length > opts.messageThreshold ||
    totalChars > opts.maxChars;

  if (!needsCompaction) {
    return {};
  }

  // Split: messages to summarize vs messages to keep
  const toKeep = conversationMessages.slice(-opts.keepRecent);
  const toSummarize = conversationMessages.slice(0, -opts.keepRecent);

  if (toSummarize.length === 0) {
    return {};
  }

  // Summarize old messages with cheap LLM
  const summary = await summarizeMessages(toSummarize);

  // RemoveMessage for each old conversation message
  const removals = toSummarize
    .filter((m) => m.id)
    .map((m) => new RemoveMessage({ id: m.id! }));

  // Also remove old context events — they'll be re-injected by injectAgentContext
  const contextRemovals = contextMessages
    .filter((m) => m.id)
    .map((m) => new RemoveMessage({ id: m.id! }));

  // Summary stored as a context message so it's filtered from the UI
  const summaryMessage = new HumanMessage({
    content: `[Conversation Summary] ${summary}`,
    name: "context",
  });

  return {
    messages: [
      ...removals,
      ...contextRemovals,
      summaryMessage,
    ] as BaseMessage[],
  };
}

async function summarizeMessages(messages: BaseMessage[]): Promise<string> {
  const llm = await getLLM({
    skill: "coding",
    cost: "paid",
    maxTier: 3,
  });

  const formatted = messages
    .map((m) => {
      const role = m._getType?.() === "ai" ? "Assistant" : "User";
      const text =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join(" ")
            : "";
      return `${role}: ${text.slice(0, 500)}`;
    })
    .join("\n");

  const response = await llm.invoke([
    new SystemMessage(
      `Summarize this conversation history into a brief paragraph. Focus on:
- What changes were requested and made
- Key decisions (colors chosen, sections added/removed, layout changes, content changes)
- Any user preferences expressed
Keep it under 200 words. Be specific about what was changed.`
    ),
    new HumanMessage(formatted),
  ]);

  return typeof response.content === "string"
    ? response.content
    : "Previous conversation involved edits and changes.";
}

function charCount(msg: BaseMessage): number {
  if (typeof msg.content === "string") return msg.content.length;
  if (Array.isArray(msg.content)) {
    return msg.content.reduce(
      (sum: number, block: any) => sum + (block.text?.length ?? 0),
      0
    );
  }
  return 0;
}
