import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import {
  type AuthContext,
  streamMiddleware,
  readOnlyMiddleware,
  getCreditState,
} from "@server/middleware";
import { validateThreadOrError } from "../middleware/threadValidation";
import { SupportAPI } from "@api";

type Variables = {
  auth: AuthContext;
};

export const supportRoutes = new Hono<{ Variables: Variables }>();

/**
 * POST /api/support/stream
 *
 * Stream support chat responses with FAQ-powered AI assistant.
 */
supportRoutes.post("/stream", ...streamMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const creditState = getCreditState(c);
  const body = await c.req.json();

  const { messages, threadId, state } = body;

  if (!messages || !threadId) {
    return c.json({ error: "Missing required fields: messages, threadId" }, 400);
  }

  const stateObj = state || {};

  return SupportAPI.stream({
    messages: messages || [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      ...creditState,
      ...stateObj,
    },
  });
});

/**
 * GET /api/support/stream
 *
 * Load history for an existing support chat thread.
 */
supportRoutes.get("/stream", ...readOnlyMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  return SupportAPI.loadHistory(threadId);
});

/**
 * GET /api/support/health
 *
 * Health check endpoint.
 */
supportRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "support",
    timestamp: new Date().toISOString(),
  });
});
