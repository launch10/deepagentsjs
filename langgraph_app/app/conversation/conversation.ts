/**
 * Conversation — a structured view of a message array.
 *
 * Models a conversation as a sequence of Turns. A Turn is simply a
 * BaseMessage[] slice: from one non-context HumanMessage through
 * everything up to (but not including) the next non-context HumanMessage.
 *
 * Context messages that appear before a turn's HumanMessage are
 * included at the start of that turn's slice — they represent
 * out-of-band events (brainstorm, images, build errors) that
 * happened between the previous AI response and this human message.
 *
 * Summary messages ([[[CONVERSATION SUMMARY]]]) are separated out —
 * they represent compacted history and always live at the front.
 * Identified by metadata flag (isSummary) and content marker.
 *
 * Concerns:
 * - **Parsing**: flat messages → structured turns
 * - **Windowing**: keep recent N turns, drop old ones
 * - **Compaction**: summarize old turns, produce reducer-compatible output
 * - **prepareTurn**: inject context + window → ready for the LLM
 *
 * Windowing and compaction drop entire turns — they never strip
 * tool blocks or mutate individual messages. The agent needs to see
 * the full tool call history to learn that it actually performed actions.
 */
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, RemoveMessage, ToolMessage } from "@langchain/core/messages";
import { isContextMessage, isSummaryMessage } from "langgraph-ai-sdk";

/**
 * A Turn is a BaseMessage[] slice from one non-context HumanMessage
 * through everything before the next non-context HumanMessage.
 * Includes any preceding context messages.
 *
 * Extends Array<BaseMessage> so existing array-access patterns
 * (indexing, .length, .filter, .flat) keep working.
 */
export class Turn extends Array<BaseMessage> {
  /** Ensure .filter(), .map(), .slice() return plain arrays, not Turn instances. */
  // @ts-expect-error -- override static Symbol.species from Array
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  constructor(messages: BaseMessage[]) {
    super(...messages);
    Object.setPrototypeOf(this, Turn.prototype);
  }

  /**
   * Returns true if this turn contains image context.
   *
   * Image context is identified by:
   * - Array content with `{ type: "image_url" }` blocks
   * - String content containing both "[Context]" and "image"
   */
  hasImageContext(): boolean {
    return this.some((msg) => {
      if (Array.isArray(msg.content)) {
        return msg.content.some((block: any) => block.type === "image_url");
      }
      const content = typeof msg.content === "string" ? msg.content : "";
      return content.includes("[Context]") && content.includes("image");
    });
  }
}

export interface CompactOptions {
  /** Trigger compaction when human turns exceed this count. Default: 30 */
  messageThreshold?: number;
  /** Number of recent turns to keep (not summarized). Default: 20 */
  keepRecent?: number;
  /** Max total chars before forced compaction. Default: 200000 */
  maxChars?: number;
  /** Max chars for tool results before clearing. Default: 500 */
  toolResultMaxChars?: number;
  /** Summarizer function — receives messages to summarize + existing summary texts. */
  summarizer: (messages: BaseMessage[], existingSummaries: string[]) => Promise<string>;
}

export interface CompactResult {
  /** New consolidated summary message */
  readonly summary: AIMessage;
  /** Messages to remove via LangGraph reducer */
  readonly removals: RemoveMessage[];
  /** Produce reducer-compatible output: [...removals, summary] */
  toMessages(): BaseMessage[];
}

export interface PrepareTurnOptions {
  /** New context events to inject */
  contextMessages?: BaseMessage[];
  /** Max turn pairs to keep. Default: 10 */
  maxTurnPairs?: number;
  /** Max total chars. Default: 40000 */
  maxChars?: number;
}

export class Conversation {
  readonly summaryMessages: BaseMessage[];
  readonly turns: Turn[];
  /** Messages before the first human message or after the last turn */
  readonly trailingMessages: BaseMessage[];

  constructor(readonly messages: BaseMessage[]) {
    const { summaryMessages, turns, trailingMessages } = Conversation.parse(messages);
    this.summaryMessages = summaryMessages;
    this.turns = turns;
    this.trailingMessages = trailingMessages;
  }

  /** Number of actual human turns */
  get humanTurnCount(): number {
    return this.turns.length;
  }

  /** Total character count across all messages */
  get totalChars(): number {
    return this.messages.reduce((sum, m) => sum + Conversation.charCount(m), 0);
  }

  // ── Windowing ────────────────────────────────────────────────

  /**
   * Window the conversation to fit within limits.
   *
   * Summary messages always go to the front.
   * Keeps the most recent N turns (each turn includes its context
   * and full tool call history — nothing is stripped).
   * Turns outside the window are dropped entirely.
   * Respects a character ceiling.
   */
  window(options?: { maxTurnPairs?: number; maxChars?: number }): BaseMessage[] {
    const maxTurnPairs = options?.maxTurnPairs ?? 10;
    const maxChars = options?.maxChars ?? 40_000;

    // If within limits, return summaries + everything else in timeline order
    if (this.humanTurnCount <= maxTurnPairs && this.totalChars <= maxChars) {
      return this.toMessages();
    }

    // Walk backwards through turns, collecting up to limits
    let chars = this.summaryMessages.reduce((sum, m) => sum + Conversation.charCount(m), 0);
    const keptTurns: Turn[] = [];
    let turnCount = 0;

    for (let i = this.turns.length - 1; i >= 0; i--) {
      const turn = this.turns[i]!;
      turnCount++;
      if (turnCount > maxTurnPairs) break;

      const turnChars = turn.reduce((sum, m) => sum + Conversation.charCount(m), 0);
      if (chars + turnChars > maxChars) break;

      chars += turnChars;
      keptTurns.unshift(turn);
    }

    // Include trailing messages if they fit
    const trailingChars = this.trailingMessages.reduce(
      (sum, m) => sum + Conversation.charCount(m), 0
    );
    const includeTrailing = chars + trailingChars <= maxChars;

    return [
      ...this.summaryMessages,
      ...keptTurns.flat(),
      ...(includeTrailing ? this.trailingMessages : []),
    ];
  }

  // ── Compaction ───────────────────────────────────────────────

  /**
   * Compact the conversation by summarizing old turns.
   *
   * Returns a CompactResult with RemoveMessage entries + a new summary,
   * or null if compaction isn't needed.
   *
   * Existing summaries are consolidated into one new summary.
   * Tool call groups stay atomic (they're whole turns, never split).
   */
  async compact(options: CompactOptions): Promise<CompactResult | null> {
    const threshold = options.messageThreshold ?? 30;
    const keepRecent = options.keepRecent ?? 20;
    const maxChars = options.maxChars ?? 200_000;

    // Check if compaction is needed
    if (this.humanTurnCount <= threshold && this.totalChars <= maxChars) {
      return null;
    }

    // Split turns: keep recent, summarize the rest
    const splitIdx = Math.max(0, this.turns.length - keepRecent);
    const turnsToSummarize = this.turns.slice(0, splitIdx);

    // Extract non-context messages from summarized turns (for the summarizer)
    // Clear large tool results to reduce noise and token cost
    const toolResultMaxChars = options.toolResultMaxChars ?? 500;
    const toSummarize = turnsToSummarize
      .flat()
      .filter(m => !isContextMessage(m))
      .map(m => Conversation.clearToolResult(m, toolResultMaxChars));

    if (toSummarize.length === 0 && this.summaryMessages.length <= 1) {
      return null;
    }

    // Collect removals:

    // 1. All messages from summarized turns (including their context)
    const summarizedRemovals = turnsToSummarize
      .flat()
      .filter(m => m.id)
      .map(m => new RemoveMessage({ id: m.id! }));

    // 2. Old summaries (consolidating into one)
    const summaryRemovals = this.summaryMessages
      .filter(m => m.id)
      .map(m => new RemoveMessage({ id: m.id! }));

    // Context in kept turns STAYS — it's part of that turn's history.
    // prepareTurn only adds what's new since the last AI message.

    // Extract existing summary texts for consolidation
    const existingSummaryTexts = this.summaryMessages
      .map(m => {
        const content = typeof m.content === "string" ? m.content : "";
        return content.replace(/^\[{1,3}CONVERSATION SUMMARY\]{1,3}\s*/i, "");
      })
      .filter(Boolean);

    // Summarize
    const summaryText = await options.summarizer(toSummarize, existingSummaryTexts);

    const summary = new AIMessage({
      content: `[[[CONVERSATION SUMMARY]]]\n${summaryText}`,
      name: "context",
      additional_kwargs: { timestamp: new Date().toISOString(), isSummary: true },
    });

    const removals = [
      ...summarizedRemovals,
      ...summaryRemovals,
    ];

    return {
      summary,
      removals,
      toMessages() {
        return [...removals, summary] as BaseMessage[];
      },
    };
  }

  // ── prepareTurn ──────────────────────────────────────────────

  /**
   * Prepare messages for an LLM turn.
   *
   * Injects new context events (brainstorm, images, build errors)
   * before the last user message, then windows the result.
   *
   * This is the input to the agent — not a return through the reducer.
   */
  /**
   * Prepare messages for an LLM turn.
   *
   * Automatically determines where to place new context messages:
   *
   * - If the last non-context message is a HumanMessage, the user just
   *   sent something → context goes **before** that message so the
   *   agent sees context → user question in order.
   *
   * - If the last non-context message is NOT a HumanMessage (AI, tool,
   *   or empty), this is an intent-driven turn → context goes at the
   *   **end**, because everything in the checkpoint already happened
   *   and the context is what's new.
   *
   * This is the input to the agent — not a return through the reducer.
   */
  prepareTurn(options?: PrepareTurnOptions): BaseMessage[] {
    const contextMessages = options?.contextMessages ?? [];
    const maxTurnPairs = options?.maxTurnPairs ?? 10;
    const maxChars = options?.maxChars ?? 40_000;

    let allMessages = this.toMessages();

    if (contextMessages.length > 0) {
      // Auto-detect placement: is the last real message a HumanMessage?
      const lastRealMsg = this.lastNonContextMessage();

      if (lastRealMsg && lastRealMsg._getType() === "human") {
        // User-message turn: inject context before the last human message
        // so the agent sees context → user question in the right order.
        let lastHumanIdx = -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
          if (allMessages[i]!._getType() === "human" && !isContextMessage(allMessages[i]!)) {
            lastHumanIdx = i;
            break;
          }
        }

        allMessages = [
          ...allMessages.slice(0, lastHumanIdx),
          ...contextMessages,
          ...allMessages.slice(lastHumanIdx),
        ];
      } else {
        // Intent-driven turn (or empty conversation): everything in
        // state already happened. New context goes at the end.
        allMessages = [...allMessages, ...contextMessages];
      }
    }

    // Annotate image_url blocks with visible URL text so the LLM can reference them
    allMessages = Conversation.annotateImageUrls(allMessages);

    // Re-parse with injected context and window
    return new Conversation(allMessages).window({ maxTurnPairs, maxChars });
  }

  // ── Turn access ─────────────────────────────────────────────

  /** Returns the most recent turn, or undefined if there are no turns. */
  currentTurn(): Turn | undefined {
    return this.turns[this.turns.length - 1];
  }

  /**
   * Returns the last message that isn't a context message or summary.
   * Used by prepareTurn to auto-detect whether this is a user-message
   * turn (last real message is HumanMessage) or an intent-driven turn.
   */
  lastNonContextMessage(): BaseMessage | undefined {
    const all = this.toMessages();
    for (let i = all.length - 1; i >= 0; i--) {
      const msg = all[i]!;
      if (!isContextMessage(msg) && !isSummaryMessage(msg)) {
        return msg;
      }
    }
    return undefined;
  }

  // ── Digest ─────────────────────────────────────────────────

  /**
   * Returns a trimmed view of recent conversation: only HumanMessage
   * and AIMessage with string content. Strips tool calls, tool results,
   * context messages, and summaries — just the conversational back-and-forth.
   *
   * Useful for giving a classifier or router enough context to understand
   * ambiguous user messages like "great and 3 bloods I guess."
   */
  /**
   * Recent conversational history, excluding the current turn.
   *
   * Returns up to `maxTurns` prior turns of just Human + AI text
   * (no tool calls, context, or summaries). The current turn is
   * excluded because the caller typically already has the latest
   * user message and passes it separately.
   */
  digestMessages(maxTurns: number = 4): BaseMessage[] {
    // Exclude current turn — caller already has the latest user message
    const priorTurns = this.turns.slice(0, -1).slice(-maxTurns);
    return priorTurns
      .flat()
      .filter((msg) => {
        if (!HumanMessage.isInstance(msg) && !AIMessage.isInstance(msg)) return false;
        if (isContextMessage(msg)) return false;
        if (isSummaryMessage(msg)) return false;
        if (typeof msg.content !== "string") return false;
        if (msg.content.length === 0) return false;
        return true;
      });
  }

  // ── Reconstruction ───────────────────────────────────────────

  /**
   * Reconstruct the full message array from structured data.
   * Summaries at front, then turns in order, then trailing messages.
   */
  toMessages(): BaseMessage[] {
    return [
      ...this.summaryMessages,
      ...this.turns.flat(),
      ...this.trailingMessages,
    ];
  }

  // ── Static helpers ──────────────────────────────────────────────

  /**
   * Parse a flat message array into structured conversation data.
   *
   * A turn starts when we encounter a non-context HumanMessage.
   *
   * Context messages are buffered in `pendingContext`:
   * - When a HumanMessage arrives: pending context is absorbed into the
   *   new turn (context placed before the human message by prepareTurn).
   * - When an AI/tool message arrives and a turn exists: pending context
   *   is flushed into the current turn first, preserving ctx → ai pairing.
   *   This prevents context messages from being separated from their
   *   AI responses and bunching up at the end.
   * - When no turn exists (orphaned AI before any human): stays in pending.
   */
  static parse(messages: BaseMessage[]): {
    summaryMessages: BaseMessage[];
    turns: Turn[];
    trailingMessages: BaseMessage[];
  } {
    const summaryMessages: BaseMessage[] = [];
    const remaining: BaseMessage[] = [];

    for (const m of messages) {
      if (isSummaryMessage(m)) {
        summaryMessages.push(m);
      } else {
        remaining.push(m);
      }
    }

    const turns: Turn[] = [];
    let pendingContext: BaseMessage[] = [];
    let currentTurnMsgs: BaseMessage[] | null = null;

    for (const msg of remaining) {
      if (isContextMessage(msg)) {
        // Always buffer context — it'll be placed correctly when the
        // next non-context message arrives.
        pendingContext.push(msg);
        continue;
      }

      // Non-context human message starts a new turn
      if (msg._getType() === "human") {
        if (currentTurnMsgs !== null) {
          turns.push(new Turn(currentTurnMsgs));
        }
        // New turn = [buffered context] + [human message]
        currentTurnMsgs = [...pendingContext, msg];
        pendingContext = [];
        continue;
      }

      // AI or tool message
      if (currentTurnMsgs !== null) {
        // Flush pending context into the current turn, then append AI/tool.
        // This keeps ctx → ai pairs together and prevents bunching.
        if (pendingContext.length > 0) {
          currentTurnMsgs.push(...pendingContext);
          pendingContext = [];
        }
        currentTurnMsgs.push(msg);
      } else {
        // Orphaned AI/tool before any human — keep in pending
        pendingContext.push(msg);
      }
    }

    // Finalize
    if (currentTurnMsgs !== null) {
      turns.push(new Turn(currentTurnMsgs));
    }

    // Remaining pending context = trailing messages after the last turn
    return { summaryMessages, turns, trailingMessages: pendingContext };
  }

  /** Character count for a single message. */
  static charCount(msg: BaseMessage): number {
    if (typeof msg.content === "string") return msg.content.length;
    if (Array.isArray(msg.content)) {
      return msg.content.reduce(
        (sum: number, block: any) => sum + (block.text?.length ?? 0),
        0
      );
    }
    return 0;
  }

  /**
   * Replace a large tool result with a truncation notice.
   * Preserves tool_call_id and metadata so the conversation structure stays valid.
   * Returns the original message if under the threshold or not a tool message.
   */
  static clearToolResult(msg: BaseMessage, maxChars: number): BaseMessage {
    if (msg._getType() !== "tool") return msg;
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (content.length <= maxChars) return msg;

    return new ToolMessage({
      content: `[Tool result cleared — ${content.length} chars]`,
      id: msg.id ?? undefined,
      tool_call_id: (msg as ToolMessage).tool_call_id,
      name: (msg as any).name,
    });
  }

  /**
   * Annotate image_url content blocks with visible URL text.
   *
   * LLMs receive image_url blocks as rendered pixels — they cannot see the
   * URL string. This method adds a text annotation after each image_url block
   * so the agent can reference, copy, or pass the URL to tools.
   *
   * Only annotates blocks that don't already have an adjacent URL annotation.
   * Only annotates HumanMessage (images the user sent, not context images).
   */
  static annotateImageUrls(messages: BaseMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      if (msg._getType() !== "human") return msg;
      if (!Array.isArray(msg.content)) return msg;

      // Check if any image_url blocks exist
      const hasImages = msg.content.some(
        (block: any) => block?.type === "image_url" && block?.image_url?.url
      );
      if (!hasImages) return msg;

      // Build new content with URL annotations after each image_url block
      const contentBlocks = msg.content as any[];
      const newContent: any[] = [];
      for (const block of contentBlocks) {
        newContent.push(block);
        if (block?.type === "image_url" && block?.image_url?.url) {
          const url = block.image_url.url as string;
          // Skip data: URLs (base64 images have no meaningful URL to show)
          if (!url.startsWith("data:")) {
            newContent.push({
              type: "text",
              text: `[Image URL: ${url}]`,
            });
          }
        }
      }

      // Return a new HumanMessage with annotated content, preserving metadata
      return new HumanMessage({
        content: newContent,
        id: msg.id ?? undefined,
        additional_kwargs: msg.additional_kwargs,
        response_metadata: msg.response_metadata,
      });
    });
  }

}
