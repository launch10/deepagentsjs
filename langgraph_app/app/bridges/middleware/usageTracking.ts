/**
 * Usage Tracking Middleware
 *
 * App-level middleware that wraps all graph streams with billing/usage tracking.
 * Uses AsyncLocalStorage to propagate context through LangChain callbacks.
 *
 * This middleware:
 * 1. Creates a UsageContext before streaming starts
 * 2. Runs the stream inside AsyncLocalStorage context
 * 3. Persists usage and trace data when stream completes
 * 4. Notifies Rails to charge credits
 *
 * ChatId is looked up from threadId at stream completion (not upfront),
 * allowing graphs to create the chat during execution.
 */
import { createStorageMiddleware, type StreamMiddleware } from "langgraph-ai-sdk";
import {
  usageStorage,
  persistUsage,
  type UsageContext,
} from "@core/usage";
import { persistTrace, type UsageSummary } from "@core/tracing";
import { notifyRails } from "@core/billing";
import { db, eq, chats as chatsTable } from "@db";
import { generateUUID } from "@types";

/**
 * Get chatId from threadId for billing.
 * Called at stream completion - chat should exist by then.
 */
async function getChatIdFromThread(threadId: string): Promise<number | undefined> {
  const chat = await db
    .select({ id: chatsTable.id })
    .from(chatsTable)
    .where(eq(chatsTable.threadId, threadId))
    .limit(1);
  return chat[0]?.id;
}

/**
 * Create a fresh UsageContext for tracking.
 * Called at the start of each stream.
 */
function createUsageContextFromMiddleware(
  threadId: string,
  graphName: string | undefined
): UsageContext {
  return {
    runId: generateUUID(),
    threadId,
    graphName,
    records: [],
    messages: [],
    _seenMessageIds: new Set(),
    _lastInputMessageCount: 0,
  };
}

/**
 * Usage tracking middleware for graph streams.
 *
 * ChatId is looked up from threadId when the stream completes,
 * allowing the graph to create the chat during execution.
 */
export const usageTrackingMiddleware: StreamMiddleware<any> = createStorageMiddleware<
  any,
  UsageContext
>({
  name: "usage-tracking",
  storage: usageStorage,

  createContext(ctx) {
    return createUsageContextFromMiddleware(ctx.threadId, ctx.graphName);
  },

  async onComplete(ctx, usageContext, result) {
    const { records, messages, runId } = usageContext;

    // Skip if nothing to persist
    if (records.length === 0 && messages.length === 0) {
      return;
    }

    // Look up chatId from threadId - chat should exist by now
    const chatId = await getChatIdFromThread(ctx.threadId);
    if (!chatId) {
      console.warn(
        `[usageTrackingMiddleware] No chat found for threadId ${ctx.threadId}, skipping billing`
      );
      return;
    }

    // Compute usage summary
    const usageSummary: UsageSummary = {
      totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
      llmCallCount: records.length,
    };

    // Persist trace and usage in parallel
    try {
      await Promise.all([
        persistTrace(
          {
            chatId,
            threadId: ctx.threadId,
            runId,
            graphName: ctx.graphName || "unknown",
          },
          messages,
          usageSummary
        ),
        persistUsage(records, {
          chatId,
          threadId: ctx.threadId,
          graphName: ctx.graphName || "unknown",
        }),
      ]);

      // Fire-and-forget notification to Rails
      notifyRails(runId);
    } catch (error) {
      console.error("[usageTrackingMiddleware] Failed to persist:", error);
      // Don't throw - we don't want to break the stream
    }
  },
});
