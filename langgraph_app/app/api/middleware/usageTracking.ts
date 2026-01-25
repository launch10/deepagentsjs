/**
 * Usage Tracking Middleware
 *
 * Wraps graph streams with billing tracking. Automatically captures
 * token usage and persists traces when the stream completes.
 */
import {
  createBridgeFactory,
  createStorageMiddleware,
  type StreamMiddleware,
} from "langgraph-ai-sdk";
import {
  usageStorage,
  createUsageContext,
  persistUsage,
  persistTrace,
  notifyRails,
  type UsageContext,
  type UsageSummary,
} from "@core/billing";
import { db, eq, chats as chatsTable } from "@db";

/**
 * Look up chatId from threadId for billing.
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
 * Middleware that tracks usage and persists billing data.
 */
const usageTrackingMiddleware: StreamMiddleware<any> = createStorageMiddleware<any, UsageContext>({
  name: "usage-tracking",
  storage: usageStorage,

  createContext(ctx) {
    return createUsageContext({ threadId: ctx.threadId, graphName: ctx.graphName });
  },

  async onComplete(ctx, usageContext) {
    const { records, messages, runId } = usageContext;

    if (records.length === 0 && messages.length === 0) return;

    const chatId = await getChatIdFromThread(ctx.threadId);
    if (!chatId) {
      console.warn(
        `[usageTrackingMiddleware] No chat found for threadId ${ctx.threadId}, skipping billing`
      );
      return;
    }

    const usageSummary: UsageSummary = {
      totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
      llmCallCount: records.length,
    };

    try {
      await Promise.all([
        persistTrace(
          { chatId, threadId: ctx.threadId, runId, graphName: ctx.graphName || "unknown" },
          messages,
          usageSummary
        ),
        persistUsage(records, {
          chatId,
          threadId: ctx.threadId,
          graphName: ctx.graphName || "unknown",
        }),
      ]);

      notifyRails(runId);
    } catch (error) {
      console.error("[usageTrackingMiddleware] Failed to persist:", error);
    }
  },
});

/**
 * Bridge factory with usage tracking baked in.
 * All graph APIs use this to get automatic billing.
 */
export const createAppBridge = createBridgeFactory({
  middleware: [usageTrackingMiddleware],
});
