import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import {
  type AuthContext,
  streamMiddleware,
  readOnlyMiddleware,
  getCreditState,
} from "@server/middleware";
import { validateThreadGraphOrError } from "../middleware/threadValidation";
import { InsightsAPI } from "@api";

type Variables = {
  auth: AuthContext;
};

export const insightsRoutes = new Hono<{ Variables: Variables }>();

/**
 * POST /api/insights/generate
 *
 * Generate 3 actionable insights from analytics metrics.
 * Metrics are fetched from Rails based on the authenticated user's account.
 */
insightsRoutes.post("/generate", ...streamMiddleware, async (c) => {
  const auth = c.get("auth");
  const creditState = getCreditState(c);
  const body = await c.req.json().catch(() => ({}));
  const threadId = body.threadId ?? uuidv7();

  // Validate thread ownership + graph type (new threads allowed — chat created during execution)
  const validationError = await validateThreadGraphOrError(c, threadId, auth, "insights");
  if (validationError) return validationError;

  return InsightsAPI.stream({
    messages: [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      ...creditState,
    },
  });
});

/**
 * GET /api/insights/generate
 *
 * Load history for an existing insights thread.
 */
insightsRoutes.get("/generate", ...readOnlyMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership + graph type for loading history
  const validationError = await validateThreadGraphOrError(c, threadId, auth, "insights");
  if (validationError) return validationError;

  return InsightsAPI.loadHistory(threadId);
});

/**
 * GET /api/insights/health
 *
 * Health check endpoint
 */
insightsRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "insights",
    timestamp: new Date().toISOString(),
  });
});
