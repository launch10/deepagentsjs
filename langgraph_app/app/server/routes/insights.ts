import { Hono } from "hono";
import { type AuthContext, streamMiddleware } from "@server/middleware";
import { InsightsAPI } from "@api";
import { Insights } from "@types";

type Variables = {
  auth: AuthContext;
};

export const insightsRoutes = new Hono<{ Variables: Variables }>();

/**
 * POST /api/insights/generate
 *
 * Generate 3 actionable insights from analytics metrics.
 *
 * Request body:
 * {
 *   metricsInput: { totals, projects, trends, flags }
 * }
 *
 * Response:
 * {
 *   insights: [{ title, description, sentiment, project_uuid, action }, ...],
 *   error?: string
 * }
 */
insightsRoutes.post("/generate", ...streamMiddleware, async (c) => {
  const body = await c.req.json();

  const { metricsInput } = body;

  if (!metricsInput) {
    return c.json({ error: "Missing required field: metricsInput" }, 400);
  }

  // Validate the input schema
  const validationResult = Insights.metricsInputSchema.safeParse(metricsInput);
  if (!validationResult.success) {
    return c.json(
      {
        error: "Invalid metricsInput schema",
        details: validationResult.error.errors,
      },
      400
    );
  }

  try {
    const result = await InsightsAPI.generate(validationResult.data);

    if (result.error) {
      return c.json(
        {
          error: result.error,
          insights: [],
        },
        500
      );
    }

    return c.json({
      insights: result.insights,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating insights:", errorMessage);

    return c.json(
      {
        error: errorMessage,
        insights: [],
      },
      500
    );
  }
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
