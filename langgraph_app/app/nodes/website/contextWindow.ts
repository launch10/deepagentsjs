/**
 * Safety-net windowing for message arrays.
 *
 * Pure function — no LLM calls. Walks backwards from the end of the
 * message array, collecting turn pairs up to a limit. Always preserves
 * context events (name="context") regardless of the window.
 *
 * Treats AI+ToolMessage groups as atomic units — if an AI message has
 * tool_use blocks, the following ToolMessages are kept together with it.
 * If including the group would exceed limits, the tool artifacts are
 * stripped from the AI message instead of orphaning them.
 *
 * This is a safety ceiling for the rare case where compactConversation
 * hasn't run yet. The real compaction happens in the graph node.
 */
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";

export interface ContextWindowOptions {
  /** Max number of human+AI turn pairs to keep. Default: 10 */
  maxTurnPairs?: number;
  /** Max total chars before truncating. Default: 40000 */
  maxChars?: number;
}

const DEFAULTS: Required<ContextWindowOptions> = {
  maxTurnPairs: 10,
  maxChars: 40_000,
};

/**
 * Check if an AI message has tool_use content blocks or tool_calls.
 */
function hasToolUse(msg: BaseMessage): boolean {
  if (msg._getType() !== "ai") return false;
  const ai = msg as AIMessage;
  if (ai.tool_calls && ai.tool_calls.length > 0) return true;
  if (Array.isArray(ai.content)) {
    return ai.content.some((block: any) => block.type === "tool_use");
  }
  return false;
}

/**
 * Strip tool_use content blocks from an AI message (lightweight version for windowing).
 * Returns a new AIMessage with only text/image/reasoning content.
 */
function stripToolBlocks(msg: AIMessage): AIMessage {
  const TOOL_BLOCK_TYPES = new Set(["tool_use", "tool_call", "tool_call_chunk"]);

  let cleanContent: typeof msg.content;
  if (Array.isArray(msg.content)) {
    const filtered = msg.content.filter(
      (block: any) => !TOOL_BLOCK_TYPES.has(block.type)
    );
    cleanContent = filtered.length > 0 ? filtered : "";
  } else {
    cleanContent = msg.content;
  }

  return new AIMessage({
    content: cleanContent,
    id: msg.id,
    name: msg.name,
    response_metadata: msg.response_metadata,
    tool_calls: [],
    invalid_tool_calls: [],
  });
}

/**
 * Window a message array to fit within limits.
 *
 * Keeps all context events + the most recent N turn pairs,
 * subject to a character ceiling. Returns the windowed array.
 *
 * AI messages with tool_use blocks and their following ToolMessages are
 * treated as atomic groups. If splitting would orphan tool artifacts,
 * the tool blocks are stripped from the AI message instead.
 */
export function prepareContextWindow(
  messages: BaseMessage[],
  options?: ContextWindowOptions
): BaseMessage[] {
  const opts = { ...DEFAULTS, ...options };

  // Separate context messages (always kept) from conversation
  const contextMessages = messages.filter(isContextMessage);
  const conversationMessages = messages.filter((m) => !isContextMessage(m));

  // If already within limits, return as-is
  const totalChars = messages.reduce((sum, m) => sum + charCount(m), 0);
  if (
    conversationMessages.length <= opts.maxTurnPairs * 2 &&
    totalChars <= opts.maxChars
  ) {
    return messages;
  }

  // Group messages into atomic units: AI messages with tool_use + their ToolMessages
  // are grouped together so they can't be split at the window boundary.
  const groups = groupMessages(conversationMessages);

  // Walk backwards through groups, collecting up to limits
  const kept: BaseMessage[] = [];
  let chars = contextMessages.reduce((sum, m) => sum + charCount(m), 0);
  let turnPairs = 0;

  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]!;
    const groupChars = group.reduce((sum, m) => sum + charCount(m), 0);

    // Count turn pairs (each AI message = one turn pair)
    const hasAI = group.some((m) => m._getType() === "ai");
    if (hasAI) {
      turnPairs++;
    }

    if (turnPairs > opts.maxTurnPairs) {
      break;
    }

    if (chars + groupChars > opts.maxChars) {
      // If this group has tool artifacts, try stripping them to fit
      if (group.length > 1 && hasToolUse(group[0]!)) {
        const stripped = stripToolBlocks(group[0] as AIMessage);
        const strippedChars = charCount(stripped);
        if (chars + strippedChars <= opts.maxChars) {
          kept.unshift(stripped);
          chars += strippedChars;
        }
      }
      break;
    }

    chars += groupChars;
    kept.unshift(...group);
  }

  return [...contextMessages, ...kept];
}

/**
 * Group conversation messages into atomic units.
 * An AI message with tool_use blocks + its following ToolMessages form one group.
 * All other messages are their own single-element group.
 */
function groupMessages(messages: BaseMessage[]): BaseMessage[][] {
  const groups: BaseMessage[][] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i]!;

    if (hasToolUse(msg)) {
      // Collect this AI message + all following ToolMessages
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
