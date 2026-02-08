/**
 * Logging Middleware
 *
 * Wraps graph streams with request-scoped structured logging.
 * Uses AsyncLocalStorage to propagate a child Pino logger through
 * all graph node execution, LLM callbacks, and service calls.
 *
 * The logger child includes: requestId, threadId, graphName.
 */
import { createStorageMiddleware, type StreamMiddleware } from "langgraph-ai-sdk";
import { loggerStorage, rootLogger, type LoggerContext } from "@core";
import { randomUUID } from "node:crypto";

export const loggingMiddleware: StreamMiddleware<any> = createStorageMiddleware<any, LoggerContext>({
  name: "logging",
  storage: loggerStorage,

  createContext(ctx) {
    const requestId = ctx.requestId ?? randomUUID();

    return {
      requestId,
      logger: rootLogger.child({
        requestId,
        threadId: ctx.threadId,
        graphName: ctx.graphName,
      }),
    };
  },
});
