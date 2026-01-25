import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { compiledDeployGraph } from "@graphs";
import { streamWithUsageTracking } from "@core";

// Note: Deploy graph doesn't use the Bridge pattern, so we use
// streamWithUsageTracking directly for billing.

type Variables = {
  auth: AuthContext;
};

export const deployRoutes = new Hono<{ Variables: Variables }>();

deployRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  const { threadId, state } = body;
  // Support both top-level and state.deploy.* patterns for SDK compatibility
  const deployId = body.deployId ?? state?.deploy?.deployId;
  const websiteId = body.websiteId ?? state?.deploy?.websiteId;
  const campaignId = body.campaignId ?? state?.deploy?.campaignId;

  if (!threadId) {
    return c.json({ error: "Missing required field: threadId" }, 400);
  }

  if (!deployId) {
    return c.json({ error: "Missing required field: deployId" }, 400);
  }

  // Validate thread ownership - chat must exist (pre-created via ChatCreatable)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  try {
    // Build initial state from request
    const initialState = {
      threadId,
      jwt: auth.jwt,
      deployId,
      websiteId,
      campaignId,
      // Default deploy instructions - deploy both if not specified
      deploy: state?.deploy ?? { website: true, googleAds: true },
      ...state,
    };

    // Use streamWithUsageTracking for billing
    // ChatId is looked up from threadId at stream completion
    return streamWithUsageTracking(
      { threadId, graphName: "deploy" },
      async () => {
        // Create streaming response - await the stream promise
        const stream = await compiledDeployGraph.stream(initialState, {
          configurable: { thread_id: threadId },
          streamMode: "values",
        });

        // Convert to SSE format
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                const data = JSON.stringify(chunk);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch (error) {
              console.error("Stream error:", error);
              controller.error(error);
            }
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    );
  } catch (error) {
    console.error("Deploy stream error:", error);
    return c.json({ error: "Stream failed", details: String(error) }, 500);
  }
});

deployRoutes.get("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership - chat must exist (pre-created via ChatCreatable)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  try {
    const state = await compiledDeployGraph.getState({
      configurable: { thread_id: threadId },
    });
    return c.json({ state: state?.values || {} });
  } catch (error) {
    console.error("Get state error:", error);
    return c.json({ error: "Failed to get state", details: String(error) }, 500);
  }
});

deployRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "deploy",
    timestamp: new Date().toISOString(),
  });
});
