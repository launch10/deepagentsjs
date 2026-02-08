/**
 * Request Logger Middleware (Hono)
 *
 * Replaces the default Hono logger() with structured Pino logging.
 * - Generates or accepts X-Request-Id from incoming headers
 * - Sets X-Request-Id response header for cross-service correlation
 * - Logs request start and completion with duration
 * - Stores requestId on Hono context for downstream use
 */
import type { MiddlewareHandler } from "hono";
import { rootLogger } from "@core";
import { randomUUID } from "node:crypto";

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("X-Request-Id") ?? randomUUID();
  const method = c.req.method;
  const path = c.req.path;

  // Make requestId available to route handlers
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  const logger = rootLogger.child({ requestId });
  logger.info({ method, path }, "request start");

  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;

  logger.info({ method, path, status: c.res.status, durationMs }, "request end");
};
