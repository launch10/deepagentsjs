/**
 * Conversation-level compaction for long-running graph conversations.
 *
 * Runs after the main work node completes. Checks if state.messages
 * exceeds a threshold, and if so, summarizes old messages into a
 * compact summary, preserving recent context.
 *
 * Key invariants:
 * 1. Tool call pairs are atomic — an AIMessage with tool_calls and its
 *    following ToolMessages are never split across the keep/summarize boundary.
 * 2. Existing summaries are consolidated — previous [Conversation Summary]
 *    messages are folded into the new summarization input so only ONE
 *    summary message exists at any time.
 *
 * Works with any graph that has `messages: BaseMessage[]` in its state
 * (website, brainstorm, ads, etc.).
 */
import type { BaseMessage } from "@langchain/core/messages";
import {
  AIMessage,
  RemoveMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
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
  /** Override the summarizer (for testing). Default: LLM-based summarization. */
  summarizer?: (messages: BaseMessage[], existingSummaries: string[]) => Promise<string>;
}

const DEFAULTS: Required<Omit<CompactConversationOptions, "summarizer">> = {
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
 * An atomic message group — either a single message or an AIMessage with
 * tool_calls bundled with its ToolMessage results.
 */
type MessageGroup = BaseMessage[];

/**
 * Group a flat message array into atomic units. An AIMessage with tool_calls
 * and its immediately-following ToolMessages form one indivisible group.
 * All other messages are solo groups.
 */
function groupMessages(messages: BaseMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i]!;

    if (msg._getType() === "ai" && ((msg as AIMessage).tool_calls?.length ?? 0) > 0) {
      // Start an atomic group: AI with tool_calls + following ToolMessages
      const group: BaseMessage[] = [msg];
      let j = i + 1;
      while (j < messages.length && messages[j]!._getType() === "tool") {
        group.push(messages[j]!);
        j++;
      }
      groups.push(group);
      i = j;
    } else {
      groups.push([msg]);
      i++;
    }
  }

  return groups;
}

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

  // Separate summaries and context events from conversation messages
  const existingSummaries: BaseMessage[] = [];
  const contextMessages: BaseMessage[] = [];
  const conversationMessages: BaseMessage[] = [];

  for (const m of messages) {
    if (isSummaryMessage(m)) {
      existingSummaries.push(m);
    } else if (isContextMessage(m)) {
      contextMessages.push(m);
    } else {
      conversationMessages.push(m);
    }
  }

  // Check if compaction is needed
  const totalChars = messages.reduce((sum, m) => sum + charCount(m), 0);
  const needsCompaction =
    conversationMessages.length > opts.messageThreshold ||
    totalChars > opts.maxChars;

  if (!needsCompaction) {
    return {};
  }

  // Group messages into atomic units (tool_call + tool_result pairs stay together)
  const groups = groupMessages(conversationMessages);

  // Walk backwards to find the split point — keep at least keepRecent individual messages
  let keptMessageCount = 0;
  let splitGroupIndex = groups.length;

  for (let g = groups.length - 1; g >= 0; g--) {
    const groupSize = groups[g]!.length;
    if (keptMessageCount + groupSize > opts.keepRecent && keptMessageCount >= opts.keepRecent) {
      break;
    }
    keptMessageCount += groupSize;
    splitGroupIndex = g;
  }

  // Flatten groups into toSummarize / toKeep
  const toSummarize: BaseMessage[] = groups.slice(0, splitGroupIndex).flat();
  // toKeep is just for reference — we don't emit it, the graph state already has them

  if (toSummarize.length === 0 && existingSummaries.length <= 1) {
    return {};
  }

  // Extract text from existing summaries to fold into the new summarization
  const existingSummaryTexts = existingSummaries
    .map((m) => {
      const content = typeof m.content === "string" ? m.content : "";
      return content.replace(/^\[Conversation Summary\]\s*/, "");
    })
    .filter(Boolean);

  // Summarize old messages + existing summaries into one consolidated summary
  const summarize = opts.summarizer ?? summarizeMessages;
  const summary = await summarize(toSummarize, existingSummaryTexts);

  // RemoveMessage for each old conversation message
  const removals = toSummarize
    .filter((m) => m.id)
    .map((m) => new RemoveMessage({ id: m.id! }));

  // Remove old summaries (we're consolidating into one)
  const summaryRemovals = existingSummaries
    .filter((m) => m.id)
    .map((m) => new RemoveMessage({ id: m.id! }));

  // Remove old context events — they'll be re-injected by injectAgentContext
  const contextRemovals = contextMessages
    .filter((m) => m.id)
    .map((m) => new RemoveMessage({ id: m.id! }));

  // One consolidated summary stored as a context message (filtered from UI)
  const summaryMessage = new HumanMessage({
    content: `[Conversation Summary] ${summary}`,
    name: "context",
  });

  return {
    messages: [
      ...removals,
      ...summaryRemovals,
      ...contextRemovals,
      summaryMessage,
    ] as BaseMessage[],
  };
}

/** Check if a message is a [Conversation Summary] context message. */
function isSummaryMessage(m: BaseMessage): boolean {
  if (!isContextMessage(m)) return false;
  const content = typeof m.content === "string" ? m.content : "";
  return content.includes("[Conversation Summary]");
}

async function summarizeMessages(
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
      `Summarize this conversation history into a brief paragraph. Focus on:
- What changes were requested and made
- Which files were modified (if mentioned)
- Key decisions (colors chosen, sections added/removed, layout changes, content changes)
- Any user preferences expressed
Keep it under 200 words. Be specific about what was changed.
Important: Note when the assistant used tools to make changes vs just discussing them.
If a previous summary is included, incorporate it into the new summary — produce ONE consolidated summary.`
    ),
    new HumanMessage(parts.join("\n")),
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
