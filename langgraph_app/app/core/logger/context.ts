/**
 * Logger Context (AsyncLocalStorage)
 *
 * Provides request-scoped child loggers with automatic context enrichment.
 * Uses AsyncLocalStorage to propagate through graph node execution.
 *
 * Usage:
 *   import { getLogger } from "@core";
 *   const logger = getLogger();
 *   logger.info({ userId: 123 }, "Processing request");
 *
 * The returned logger automatically includes:
 * - requestId, threadId, graphName (from ALS context, if available)
 * - nodeName, graphName (from getNodeContext(), if in a graph node)
 * - Any additional bindings passed to getLogger()
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { rootLogger, type Logger } from "./logger";
import { getNodeContext } from "../node/middleware/withContext";

export interface LoggerContext {
  requestId: string;
  logger: Logger;
}

export const loggerStorage = new AsyncLocalStorage<LoggerContext>();

/**
 * Get the current logger context (if in ALS scope).
 */
export function getLoggerContext(): LoggerContext | undefined {
  return loggerStorage.getStore();
}

/**
 * Get a context-aware logger.
 *
 * Returns the request-scoped child logger if inside an ALS context,
 * or falls back to the root logger. Additional bindings are always merged.
 *
 * Node context (nodeName, graphName) is auto-attached from getNodeContext()
 * when available.
 */
export function getLogger(bindings?: Record<string, unknown>): Logger {
  const ctx = loggerStorage.getStore();
  const baseLogger = ctx?.logger ?? rootLogger;

  // Auto-attach node execution context if available
  const nodeCtx = getNodeContext();
  const mergedBindings: Record<string, unknown> = {};

  if (nodeCtx?.name) mergedBindings.nodeName = nodeCtx.name;
  if (nodeCtx?.graphName) mergedBindings.graphName = nodeCtx.graphName;
  if (bindings) Object.assign(mergedBindings, bindings);

  if (Object.keys(mergedBindings).length > 0) {
    return baseLogger.child(mergedBindings);
  }

  return baseLogger;
}
