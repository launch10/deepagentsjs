/**
 * Usage Tracking Middleware
 *
 * Wraps graph streams with billing tracking. Automatically captures
 * token usage and persists traces when the stream completes.
 *
 * Credit tracking:
 * - Extracts accountId and preRunCreditsRemaining from state
 * - Credit status is emitted to frontend via withCreditTracking graph wrapper
 */
import { createStorageMiddleware, type StreamMiddleware } from "langgraph-ai-sdk";
import {
  usageStorage,
  createUsageContext,
  persistUsage,
  persistTrace,
  notifyRails,
  calculateRunCost,
  deriveCreditStatus,
  LLMManager,
  getLogger,
  type UsageContext,
  type UsageSummary,
} from "@core";
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
 * Extract credit state from graph state if available.
 */
function extractCreditState(state?: Record<string, unknown>): {
  accountId?: number;
  preRunCreditsRemaining?: number;
} {
  if (!state) return {};

  return {
    accountId: typeof state.accountId === "number" ? state.accountId : undefined,
    preRunCreditsRemaining:
      typeof state.preRunCreditsRemaining === "number" ? state.preRunCreditsRemaining : undefined,
  };
}

/**
 * Middleware that tracks usage and persists billing data.
 */
export const usageTrackingMiddleware: StreamMiddleware<any> = createStorageMiddleware<
  any,
  UsageContext
>({
  name: "usage-tracking",
  storage: usageStorage,

  createContext(ctx) {
    // Extract credit tracking state if provided
    const creditState = extractCreditState(ctx.state);

    return createUsageContext({
      threadId: ctx.threadId,
      graphName: ctx.graphName,
      accountId: creditState.accountId,
      preRunCreditsRemaining: creditState.preRunCreditsRemaining,
    });
  },

  async onComplete(ctx, usageContext) {
    const { records, messages, runId, accountId, preRunCreditsRemaining } = usageContext;

    const log = getLogger({ component: "usageTracking" });
    log.info({ runId, recordCount: records.length, messageCount: messages.length, threadId: ctx.threadId }, "onComplete fired");

    if (records.length === 0 && messages.length === 0) {
      log.warn({ runId }, "Zero records AND zero messages — nothing to persist");
      return;
    }

    const chatId = await getChatIdFromThread(ctx.threadId);
    if (!chatId) {
      log.warn({ threadId: ctx.threadId, recordCount: records.length }, "No chat found for threadId, skipping billing — usage records LOST");
      return;
    }

    const usageSummary: UsageSummary = {
      totalInputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      totalOutputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
      llmCallCount: records.length,
    };

    try {
      // Fetch model configs for cost calculation (best-effort, non-blocking)
      let modelConfigs: Record<string, import("@core").ModelConfig> | undefined;
      try {
        modelConfigs = await LLMManager.getModelConfigs();
      } catch {
        // Config fetch failed — persist without costs, Rails will calculate later
      }

      await Promise.all([
        persistTrace(
          { chatId, threadId: ctx.threadId, runId, graphName: ctx.graphName || "unknown" },
          messages,
          usageSummary
        ),
        persistUsage(
          records,
          {
            chatId,
            threadId: ctx.threadId,
            graphName: ctx.graphName || "unknown",
          },
          modelConfigs
        ),
      ]);

      log.info({ recordCount: records.length, messageCount: messages.length, chatId, runId }, "Persisted usage");

      notifyRails(runId);
    } catch (error) {
      log.error({ err: error, runId, chatId }, "Failed to persist usage");
    }
  },
});
