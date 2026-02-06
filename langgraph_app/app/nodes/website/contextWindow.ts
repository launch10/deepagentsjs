/**
 * Safety-net windowing for message arrays.
 *
 * Pure function — no LLM calls. Walks backwards from the end of the
 * message array, collecting turn pairs up to a limit. Always preserves
 * context events (name="context") regardless of the window.
 *
 * This is a safety ceiling for the rare case where compactConversation
 * hasn't run yet. The real compaction happens in the graph node.
 */
import type { BaseMessage } from "@langchain/core/messages";
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
 * Window a message array to fit within limits.
 *
 * Keeps all context events + the most recent N turn pairs,
 * subject to a character ceiling. Returns the windowed array.
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

  // Walk backwards, collecting messages up to limits
  const kept: BaseMessage[] = [];
  let chars = contextMessages.reduce((sum, m) => sum + charCount(m), 0);
  let turnPairs = 0;

  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i]!;
    const msgChars = charCount(msg);

    // Count turn pairs (each AI message roughly = one turn pair)
    if (msg._getType?.() === "ai") {
      turnPairs++;
    }

    if (turnPairs > opts.maxTurnPairs || chars + msgChars > opts.maxChars) {
      break;
    }

    chars += msgChars;
    kept.unshift(msg);
  }

  return [...contextMessages, ...kept];
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
