/**
 * startConversation — canonical entry point for agent turns.
 *
 * Handles the full lifecycle:
 * 1. Fetch context events from Rails (if credentials provided)
 * 2. Merge with caller-supplied extraContext
 * 3. Inject context + window via Conversation.prepareTurn()
 * 4. Run agent callback with prepared messages
 * 5. Compact conversation if needed
 * 6. Return messages ready for the graph reducer
 *
 * The callback MUST return only NEW messages produced by the agent,
 * not the input messages. startConversation() prepends context messages
 * and handles compaction removals/summary for the reducer.
 */
import type { BaseMessage } from "@langchain/core/messages";
import { Conversation, type CompactOptions } from "./conversation";
import { fetchContextMessages } from "./prepareTurn";
import type { SubscribableGraph } from "./subscriptions";

export interface ConversationStartOptions {
  /** Current messages in graph state */
  messages: BaseMessage[];
  /** Graph name for event subscriptions — skip event fetch if not set */
  graphName?: SubscribableGraph;
  /** Project ID for event fetching */
  projectId?: number;
  /** JWT for Rails API auth */
  jwt?: string;
  /** Extra context messages (build errors, mode switches, etc.) */
  extraContext?: BaseMessage[];
  /** Max turn pairs to keep. Default: 10 */
  maxTurnPairs?: number;
  /** Max total chars. Default: 40000 */
  maxChars?: number;
  /** Compaction options. Pass { summarizer } to enable, or false/omit to disable. */
  compact?: CompactOptions | false;
}

export type AgentResult = { messages: BaseMessage[]; [key: string]: any };

/**
 * Run a full agent turn with context injection, windowing, and compaction.
 *
 * @param options - Conversation configuration (messages, context, windowing, compaction)
 * @param callback - Agent function. Receives prepared messages, must return only NEW messages.
 * @returns Agent result with messages ready for the graph reducer
 */
export async function startConversation(
  options: ConversationStartOptions,
  callback: (preparedMessages: BaseMessage[]) => Promise<AgentResult>
): Promise<AgentResult> {
  // 1. Fetch context events from Rails (if credentials provided)
  let fetchedContext: BaseMessage[] = [];
  if (options.graphName && options.projectId && options.jwt) {
    fetchedContext = await fetchContextMessages({
      graphName: options.graphName,
      projectId: options.projectId,
      jwt: options.jwt,
      messages: options.messages,
    });
  }

  // 2. Merge with extraContext
  const allContext = [...fetchedContext, ...(options.extraContext ?? [])];

  // 3. Prepare turn: inject context + window
  const prepared = new Conversation(options.messages).prepareTurn({
    contextMessages: allContext,
    maxTurnPairs: options.maxTurnPairs,
    maxChars: options.maxChars,
  });

  // 4. Run agent callback (receives prepared messages, returns only NEW messages)
  const agentResult = await callback(prepared);

  // 5. Build return messages: context + agent new messages
  // Context messages aren't in state.messages yet — include them so
  // the reducer appends them in the correct position.
  let returnMessages: BaseMessage[] = [...allContext, ...agentResult.messages];

  // 6. Compact if enabled
  if (options.compact) {
    // Build the full conversation: existing + context + agent new messages
    const fullMessages = [...options.messages, ...allContext, ...agentResult.messages];
    const fullConv = new Conversation(fullMessages);
    const compactResult = await fullConv.compact(options.compact);

    if (compactResult) {
      // Prepend removals + summary before context + new messages
      returnMessages = [...compactResult.toMessages(), ...returnMessages];
    }
  }

  return { ...agentResult, messages: returnMessages };
}
