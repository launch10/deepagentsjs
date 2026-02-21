import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import {
  type AuthContext,
  streamMiddleware,
  readOnlyMiddleware,
  getCreditState,
} from "@server/middleware";
import { validateThreadGraphOrError } from "../middleware/threadValidation";
import { SupportAPI } from "@api";
import { trackChatMessage } from "./shared";

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

  // Validate thread ownership + graph type (new threads allowed — chat created during execution)
  const validationError = await validateThreadGraphOrError(c, threadId, auth, "support");
  if (validationError) return validationError;

  const stateObj = state || {};

  trackChatMessage(auth, messages, threadId, "support", stateObj);

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

  // Validate thread ownership + graph type for loading history
  const validationError = await validateThreadGraphOrError(c, threadId, auth, "support");
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
