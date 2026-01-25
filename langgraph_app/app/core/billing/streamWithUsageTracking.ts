/**
 * Stream-compatible usage tracking wrapper.
 *
 * Use this for routes that don't use the Bridge pattern (e.g., deploy).
 * For Bridge-based routes, use createAppBridge from @bridges instead.
 *
 * ChatId is looked up from threadId at stream completion (not upfront),
 * allowing graphs to create the chat during execution.
 *
 * @example
 * ```typescript
 * return streamWithUsageTracking(
 *   { threadId, graphName: "deploy" },
 *   async () => {
 *     const stream = await graph.stream(state, config);
 *     return new Response(stream);
 *   }
 * );
 * ```
 */
import { usageStorage, type UsageContext } from "../usage";
import { persistTrace, type UsageSummary } from "../tracing";
import { persistUsage } from "../usage";
import { notifyRails } from "./notifyRails";
import { db, eq, chats as chatsTable } from "@db";
import { generateUUID } from "@types";

/**
 * Context options for stream tracking.
 */
export interface StreamTrackingContext {
  threadId: string;
  graphName: string;
}

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
 */
function createTrackingContext(ctx: StreamTrackingContext): UsageContext {
  return {
    runId: generateUUID(),
    threadId: ctx.threadId,
    graphName: ctx.graphName,
    records: [],
    messages: [],
    _seenMessageIds: new Set(),
    _lastInputMessageCount: 0,
  };
}

/**
 * Wraps a streaming Response with usage tracking.
 *
 * This function:
 * 1. Establishes AsyncLocalStorage context BEFORE the stream starts
 * 2. Returns the Response immediately (streaming begins)
 * 3. Intercepts stream completion to persist usage and trace
 * 4. Notifies Rails for credit charging
 */
export function streamWithUsageTracking(
  context: StreamTrackingContext,
  streamFn: () => Response
): Response;
export function streamWithUsageTracking(
  context: StreamTrackingContext,
  streamFn: () => Promise<Response>
): Promise<Response>;
export function streamWithUsageTracking(
  context: StreamTrackingContext,
  streamFn: () => Response | Promise<Response>
): Response | Promise<Response> {
  // Create a fresh tracking context
  const trackingContext = createTrackingContext(context);

  // Enter AsyncLocalStorage context and execute the stream function
  const responseOrPromise = usageStorage.run(trackingContext, () => streamFn());

  // Handle async stream functions
  if (responseOrPromise instanceof Promise) {
    return responseOrPromise.then((response) =>
      wrapResponse(response, trackingContext, context)
    );
  }

  // Handle sync stream functions
  return wrapResponse(responseOrPromise, trackingContext, context);
}

/**
 * Wrap a Response to intercept stream completion for persistence.
 */
function wrapResponse(
  response: Response,
  trackingContext: UsageContext,
  streamContext: StreamTrackingContext
): Response {
  // Get the original body - if none, just return as-is
  const originalBody = response.body;
  if (!originalBody) {
    return response;
  }

  // Create a TransformStream that passes data through unchanged
  // but intercepts completion to persist billing data
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // Pass through unchanged
      controller.enqueue(chunk);
    },

    async flush() {
      // Stream ended - persist usage and trace
      await persistTrackingData(trackingContext, streamContext);
    },
  });

  // Pipe the original stream through our transform
  // This happens in the background - we don't await it
  originalBody.pipeTo(writable).catch((error) => {
    console.error("[streamWithUsageTracking] Stream pipe error:", error);
    // Still try to persist what we have
    persistTrackingData(trackingContext, streamContext).catch((e) => {
      console.error(
        "[streamWithUsageTracking] Failed to persist after pipe error:",
        e
      );
    });
  });

  // Return a new Response with the tracked readable stream
  return new Response(readable, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Internal helper to persist tracking data after stream completion.
 */
async function persistTrackingData(
  trackingContext: UsageContext,
  streamContext: StreamTrackingContext
): Promise<void> {
  const { records, messages, runId } = trackingContext;

  // Skip if nothing to persist
  if (records.length === 0 && messages.length === 0) {
    return;
  }

  // Look up chatId from threadId - chat should exist by now
  const chatId = await getChatIdFromThread(streamContext.threadId);
  if (!chatId) {
    console.warn(
      `[streamWithUsageTracking] No chat found for threadId ${streamContext.threadId}, skipping billing`
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
  await Promise.all([
    persistTrace(
      {
        chatId,
        threadId: streamContext.threadId,
        runId,
        graphName: streamContext.graphName,
      },
      messages,
      usageSummary
    ),
    persistUsage(records, {
      chatId,
      threadId: streamContext.threadId,
      graphName: streamContext.graphName,
    }),
  ]);

  // Fire-and-forget notification to Rails
  notifyRails(runId);
}
