/**
 * Context Engineering Middleware
 *
 * Fetches events since last AI message and injects them as context
 * HumanMessages before the current user message.
 *
 * This enables agents to be aware of changes that happened outside
 * of the conversation (e.g., user uploaded images via QuickActions).
 */
import { createMiddlewareFromHooks, type StreamMiddlewareContext } from "langgraph-ai-sdk";
import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { getSubscribedEventTypes } from "./subscriptions";
import { summarizeEvents } from "./summarization";
import { ContextEventsAPIService } from "@rails_api";

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
 * Context Engineering Middleware
 *
 * Injected into the bridge factory to run before every graph invocation.
 */
export const contextEngineeringMiddleware = createMiddlewareFromHooks({
  name: "context-engineering",

  async onStart(ctx: StreamMiddlewareContext<any>) {
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
        event_types: eventTypes,
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

    // Build context messages
    const contextMessages = summarizedEvents.map(
      (summary) =>
        new HumanMessage({
          content: `[Context] ${summary.message}`,
        })
    );

    // Inject before last message (the user's current input)
    const existingMessages = [...messages];
    const lastMessage = existingMessages.pop();

    ctx.state = {
      ...state,
      messages: [...existingMessages, ...contextMessages, lastMessage].filter(Boolean),
    };
  },
});
