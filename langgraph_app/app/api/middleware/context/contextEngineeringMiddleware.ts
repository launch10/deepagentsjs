/**
 * Context Engineering Middleware
 *
 * Fetches events since last AI message and injects them as context
 * HumanMessages before the current user message.
 *
 * This enables agents to be aware of changes that happened outside
 * of the conversation (e.g., user uploaded images via QuickActions).
 *
 * NOTE: We use a custom middleware function (not createMiddlewareFromHooks)
 * because we need to AWAIT the context injection before the stream starts.
 * createMiddlewareFromHooks uses fire-and-forget for onStart.
 */
import {
  createMultimodalContextMessage,
  type StreamMiddleware,
  type StreamMiddlewareContext,
} from "langgraph-ai-sdk";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { getSubscribedEventTypes } from "./subscriptions";
import { summarizeEvents, type SummarizedEvent } from "./summarization";
import { ContextEventsAPIService } from "@rails_api";

/**
 * Build a context message from a summarized event.
 * Uses multimodal format for events with images, text-only for others.
 */
function buildContextMessage(summary: SummarizedEvent): BaseMessage {
  // Multimodal content (e.g., images)
  if (summary.content && summary.content.length > 0) {
    return createMultimodalContextMessage(summary.content);
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
 * Inject context events into the message stream.
 * This modifies ctx.state.messages to include context messages.
 */
async function injectContextEvents(ctx: StreamMiddlewareContext<any>): Promise<void> {
  const { state, graphName } = ctx;

  // Extract project_id from state (websites have projectId)
  const projectId = state?.projectId;
  const jwt = state?.jwt;

  // Skip if no project or JWT
  if (!projectId || !jwt) {
    return;
  }

  // Get subscriptions for this graph
  const eventTypes = getSubscribedEventTypes(graphName);
  if (eventTypes.length === 0) {
    return;
  }

  // Find timestamp of last AI message
  const messages = state.messages ?? [];
  const lastAiTime = findLastAiMessageTime(messages);

  // Fetch events from Rails
  const api = new ContextEventsAPIService({ jwt: jwt as string });
  let rawEvents;
  try {
    rawEvents = await api.list({
      project_id: projectId as number,
      "event_types[]": [...eventTypes],
      since: lastAiTime?.toISOString(),
    });
  } catch (error) {
    console.warn("[contextEngineering] Failed to fetch events:", error);
    return;
  }

  if (rawEvents.length === 0) {
    return;
  }

  // Summarize events
  const summarizedEvents = summarizeEvents(rawEvents);
  if (summarizedEvents.length === 0) {
    return;
  }

  // Build context messages (text-only or multimodal)
  const contextMessages = summarizedEvents.map((summary) => buildContextMessage(summary));

  // Inject before last message (the user's current input)
  const existingMessages = [...messages];
  const lastMessage = existingMessages.pop();

  ctx.state = {
    ...state,
    messages: [...existingMessages, ...contextMessages, lastMessage].filter(Boolean),
  };
}

/**
 * Context Engineering Middleware
 *
 * Custom middleware that AWAITS context injection before calling next().
 * This is necessary because createMiddlewareFromHooks fires onStart without awaiting.
 *
 * NOTE: We can't use async/await directly because StreamMiddleware expects
 * a synchronous Response return. Instead, we block on the async work using
 * a ReadableStream that waits for injection before piping through.
 */
export const contextEngineeringMiddleware: StreamMiddleware<any> = (ctx, next) => {
  // Create a stream that waits for context injection before starting
  const { readable, writable } = new TransformStream();

  // Run async injection, then pipe the real response through
  (async () => {
    try {
      await injectContextEvents(ctx);
      const response = next();

      if (response.body) {
        await response.body.pipeTo(writable);
      } else {
        await writable.close();
      }
    } catch (error) {
      const writer = writable.getWriter();
      await writer.abort(error);
    }
  })();

  // Return immediately with the readable side
  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream" },
  });
};
