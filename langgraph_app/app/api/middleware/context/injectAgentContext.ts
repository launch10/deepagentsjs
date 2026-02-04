/**
 * Node-Level Context Injection
 *
 * Fetches context events since the last AI message and injects them
 * as HumanMessages. Call this from nodes before agent invocation.
 *
 * Unlike the stream middleware approach, this runs WITHIN the node's
 * AsyncLocalStorage context, preserving Polly.js recording and billing.
 *
 * Usage:
 *   const contextMessages = await injectAgentContext({
 *     graphName: "website",
 *     projectId: state.projectId,
 *     jwt: state.jwt,
 *     messages: state.messages,
 *   });
 *   // contextMessages contains original messages + injected context
 */
import { createMultimodalContextMessage } from "langgraph-ai-sdk";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { getSubscribedEventTypes, type SubscribableGraph } from "./subscriptions";
import { summarizeEvents, type SummarizedEvent, type ContentBlock } from "./summarization";
import { ContextEventsAPIService } from "@rails_api";

interface InjectAgentContextParams {
  /** Graph name for event subscriptions */
  graphName: SubscribableGraph;
  /** Project ID to fetch events for */
  projectId: number;
  /** JWT for Rails API auth */
  jwt: string;
  /** Current messages in the conversation */
  messages: BaseMessage[];
}

/**
 * Build a context message from a summarized event.
 * Uses multimodal format for events with images, text-only for others.
 */
function buildContextMessage(summary: SummarizedEvent): BaseMessage {
  // Multimodal content (e.g., images)
  if (summary.content && summary.content.length > 0) {
    return createMultimodalContextMessage(summary.content as ContentBlock[]);
  }

  // Text-only content
  return new HumanMessage({
    content: `[Context] ${summary.message}`,
  });
}

/**
 * Find the timestamp of the last AI message in the conversation.
 * Returns null if no AI messages found.
 */
function findLastAiMessageTime(messages: BaseMessage[]): Date | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;

    if (msg instanceof AIMessage || msg._getType?.() === "ai") {
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
    }
  }
  return null;
}

/**
 * Inject context events into messages.
 *
 * Fetches events from Rails API, summarizes them, and inserts
 * context messages before the last user message.
 *
 * @returns New messages array with context injected (or original if no events)
 */
export async function injectAgentContext({
  graphName,
  projectId,
  jwt,
  messages,
}: InjectAgentContextParams): Promise<BaseMessage[]> {
  // Get subscriptions for this graph
  const eventTypes = getSubscribedEventTypes(graphName);
  if (eventTypes.length === 0) {
    return messages;
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
    console.warn("[injectAgentContext] Failed to fetch events:", error);
    return messages;
  }

  if (rawEvents.length === 0) {
    return messages;
  }

  // Summarize events
  const summarizedEvents = summarizeEvents(rawEvents);
  if (summarizedEvents.length === 0) {
    return messages;
  }

  // Build context messages (text-only or multimodal)
  const contextMessages = summarizedEvents.map((summary) => buildContextMessage(summary));

  // Inject before last message (the user's current input)
  const existingMessages = [...messages];
  const lastMessage = existingMessages.pop();

  return [...existingMessages, ...contextMessages, lastMessage].filter(Boolean) as BaseMessage[];
}
