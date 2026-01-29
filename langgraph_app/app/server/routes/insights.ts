import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import { type AuthContext, streamMiddleware, getCreditState } from "@server/middleware";
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
