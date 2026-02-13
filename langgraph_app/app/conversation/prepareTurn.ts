/**
 * Turn Preparation with Context Injection
 *
 * Fetches context events since the last AI message, combines them with
 * any extra context provided by the caller, injects everything before
 * the last user message, and windows the result.
 *
 * Delegates to Conversation.prepareTurn() for the pure logic.
 * This layer adds the Rails API event-fetching concern.
 *
 * Unlike the stream middleware approach, this runs WITHIN the node's
 * AsyncLocalStorage context, preserving Polly.js recording and billing.
 *
 * Usage:
 *   const messages = await prepareTurn({
 *     graphName: "website",
 *     projectId: state.projectId,
 *     jwt: state.jwt,
 *     messages: state.messages,
 *     extraContext: [createContextMessage("Build errors...")],
 *     maxTurnPairs: 10,
 *     maxChars: 40_000,
 *   });
 */
import { createContextMessage, createMultimodalContextMessage, isSummaryMessage } from "langgraph-ai-sdk";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { getSubscribedEventTypes, type SubscribableGraph } from "./subscriptions";
import { summarizeEvents, type SummarizedEvent, type ContentBlock } from "./summarization";
import { ContextEventsAPIService } from "@rails_api";
import { getLogger } from "@core";
import { Conversation } from "./conversation";

export interface PrepareTurnParams {
  /** Graph name for event subscriptions */
  graphName: SubscribableGraph;
  /** Project ID to fetch events for */
  projectId: number;
  /** JWT for Rails API auth */
  jwt: string;
  /** Current messages in the conversation */
  messages: BaseMessage[];
  /** Additional context messages to inject (build errors, instructions, etc.) */
  extraContext?: BaseMessage[];
  /** Max turn pairs to keep. Default: 10 */
  maxTurnPairs?: number;
  /** Max total chars. Default: 40000 */
  maxChars?: number;
}

/**
 * Build a context message from a summarized event.
 * Uses multimodal format for events with images, text-only for others.
 * Includes event timestamp so context messages preserve timeline position.
 */
function buildContextMessage(summary: SummarizedEvent): BaseMessage {
  const metadata = { timestamp: summary.created_at || new Date().toISOString() };

  // Multimodal content (e.g., images)
  if (summary.content && summary.content.length > 0) {
    return createMultimodalContextMessage(summary.content as ContentBlock[], metadata);
  }

  // Text-only content
  return createContextMessage(`[Context] ${summary.message}`, metadata);
}

/**
 * Find the timestamp of the last real AI message in the conversation.
 *
 * Skips summary messages (AIMessages with name="context") — after compaction,
 * using a summary's timestamp would fetch stale events.
 *
 * Keeps searching when an AI message lacks a timestamp, so we fall back to
 * earlier timestamped AI messages instead of returning null.
 *
 * Returns null if no timestamped AI messages found.
 */
export function findLastAiMessageTime(messages: BaseMessage[]): Date | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;

    if (msg instanceof AIMessage || msg._getType?.() === "ai") {
      // Skip summary messages — their timestamps represent compaction time, not conversation time
      if (isSummaryMessage(msg)) continue;

      // Try to get timestamp from message metadata
      const timestamp = msg.additional_kwargs?.timestamp;
      if (timestamp) {
        return new Date(timestamp as string);
      }
      // Try response_metadata
      const responseTimestamp = (msg.response_metadata as Record<string, unknown> | undefined)
        ?.timestamp;
      if (responseTimestamp) {
        return new Date(responseTimestamp as string);
      }

      // No timestamp on this AI message — keep searching earlier messages
      continue;
    }
  }
  return null;
}

/**
 * Fetch context events from Rails and build them into context messages.
 *
 * Returns context messages ready to pass to Conversation.prepareTurn().
 * Returns empty array if no events, no subscriptions, or on error.
 */
export async function fetchContextMessages({
  graphName,
  projectId,
  jwt,
  messages,
}: {
  graphName: SubscribableGraph;
  projectId: number;
  jwt: string;
  messages: BaseMessage[];
}): Promise<BaseMessage[]> {
  // Get subscriptions for this graph
  const eventTypes = getSubscribedEventTypes(graphName);
  if (eventTypes.length === 0) {
    return [];
  }

  // Find timestamp of last AI message
  const lastAiTime = findLastAiMessageTime(messages);

  // Fetch events from Rails
  const api = new ContextEventsAPIService({ jwt });
  let rawEvents;
  try {
    rawEvents = await api.list({
      project_id: projectId,
      "event_types[]": [...eventTypes],
      since: lastAiTime?.toISOString(),
    });
  } catch (error) {
    getLogger({ component: "prepareTurn" }).warn({ err: error }, "Failed to fetch events");
    return [];
  }

  if (rawEvents.length === 0) {
    return [];
  }

  // Summarize events
  const summarizedEvents = summarizeEvents(rawEvents);
  if (summarizedEvents.length === 0) {
    return [];
  }

  // Build context messages (text-only or multimodal)
  return summarizedEvents.map((summary) => buildContextMessage(summary));
}

/**
 * Prepare messages for an LLM turn.
 *
 * 1. Fetches context events from Rails (brainstorm, images, etc.)
 * 2. Combines with any extra context (build errors, instructions)
 * 3. Injects all context before the last user message
 * 4. Windows the result to fit within limits
 */
export async function prepareTurn({
  graphName,
  projectId,
  jwt,
  messages,
  extraContext,
  maxTurnPairs,
  maxChars,
}: PrepareTurnParams): Promise<BaseMessage[]> {
  const eventContext = await fetchContextMessages({ graphName, projectId, jwt, messages });
  const contextMessages = [...eventContext, ...(extraContext ?? [])];

  return new Conversation(messages).prepareTurn({
    contextMessages,
    maxTurnPairs,
    maxChars,
  });
}