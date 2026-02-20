/**
 * Conversation-level compaction for long-running graph conversations.
 *
 * Thin wrapper around Conversation.compact() — provides the LLM-based
 * summarizer and NodeMiddleware wiring for graph nodes.
 *
 * Works with any graph that has `messages: BaseMessage[]` in its state
 * (website, brainstorm, ads, etc.).
 */
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Conversation } from "@conversation";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { type CoreGraphState } from "@state";

export interface CompactConversationOptions {
  /** Trigger compaction when human turns (non-context HumanMessages) exceed this count. Default: 30 */
  messageThreshold?: number;
  /** Number of recent human turns to keep (not summarized). All associated AI/tool messages are kept too. Default: 20 */
  keepRecent?: number;
  /** Max total chars before forced compaction. Default: 200000 */
  maxChars?: number;
  /** Override the summarizer (for testing). Default: LLM-based summarization. */
  summarizer?: (messages: BaseMessage[], existingSummaries: string[]) => Promise<string>;
}

/**
 * Create a compaction node for any graph that has `messages` in its state.
 * Works with website, brainstorm, ads, or any graph extending BaseAnnotation.
 */
export function createCompactConversationNode(options?: CompactConversationOptions) {
  return NodeMiddleware.use({}, async (state: CoreGraphState) => {
    return compactConversation(state.messages, options);
  });
}

/** Pre-built node for the website graph (default options). */
export const compactConversationNode = createCompactConversationNode();

/**
 * Compact a message array by summarizing old messages.
 *
 * Delegates to Conversation.compact() — returns partial state with
 * RemoveMessage entries + a summary message, or empty object if
 * compaction isn't needed.
 */
export async function compactConversation(
  messages: BaseMessage[],
  options?: CompactConversationOptions
): Promise<{ messages: BaseMessage[] } | Record<string, never>> {
  const conversation = new Conversation(messages);
  const result = await conversation.compact({
    messageThreshold: options?.messageThreshold,
    keepRecent: options?.keepRecent,
    maxChars: options?.maxChars,
    summarizer: options?.summarizer ?? summarizeMessages,
  });

  if (!result) return {};
  return { messages: result.toMessages() };
}

/** LLM-based summarizer — consolidates old messages + existing summaries. */
export async function summarizeMessages(
  messages: BaseMessage[],
  existingSummaries: string[]
): Promise<string> {
  const llm = await getLLM({
    skill: "coding",
    cost: "paid",
    maxTier: 3,
  });

  const parts: string[] = [];

  // Include existing summaries first so the LLM can fold them in
  if (existingSummaries.length > 0) {
    parts.push("=== Previous Summary ===");
    parts.push(existingSummaries.join("\n\n"));
    parts.push("=== New Messages to Incorporate ===");
  }

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

  parts.push(formatted);

  const response = await llm.invoke([
    new SystemMessage(
      `Summarize this conversation into the following structured sections. Use third person ("The user", "The assistant"). Be specific — include exact values (hex codes, file paths, component names).

## User Goals
What the user wants to build or achieve overall.

## Current State
What has been built so far. List specific files and their purpose.

## Design Decisions
Colors, fonts, layout choices, component decisions. Include specifics like hex codes and Tailwind classes.

## User Preferences
Expressed constraints, style preferences, things they liked or disliked.

## Recent Changes
What was most recently modified and why.

## Open Issues
Anything unresolved, pending, or that the user mentioned wanting to change. Leave empty if none.

Keep each section concise (1-3 bullet points). Total summary under 300 words.
If a previous summary is included, incorporate it — produce ONE consolidated summary with all sections updated.`
    ),
    new HumanMessage(parts.join("\n")),
  ]);

  return typeof response.content === "string"
    ? response.content
    : "Previous conversation involved edits and changes.";
}
