import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { deployGraph } from "@graphs";
import { graphParams } from "@core";
import { DeployService } from "@services";

type Variables = {
  auth: AuthContext;
};

export const deployRoutes = new Hono<{ Variables: Variables }>();

// Use shared checkpointer to avoid race conditions with webhook handler
const graph = deployGraph.compile({ ...graphParams, name: "deploy" });

deployRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  const { threadId, state, deployId, websiteId, campaignId } = body;

  if (!threadId) {
    return c.json({ error: "Missing required field: threadId" }, 400);
  }

  if (!deployId) {
    return c.json({ error: "Missing required field: deployId" }, 400);
  }

  try {
    // CRITICAL: Persist threadId to database FIRST, before starting the stream.
    // This ensures the frontend can reconnect to the same thread after a page refresh.
    await DeployService.saveThreadId(deployId, threadId);

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

    // Stream response using SSE format
    const stream = await graph.stream(initialState, {
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
  } catch (error) {
    console.error("Deploy stream error:", error);
    return c.json({ error: "Stream failed", details: String(error) }, 500);
  }
});

deployRoutes.get("/stream", authMiddleware, async (c) => {
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  try {
    const state = await graph.getState({ configurable: { thread_id: threadId } });
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
