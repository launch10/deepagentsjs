import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { websiteGraph } from "@graphs";
import { graphParams } from "@core";

type Variables = {
  auth: AuthContext;
};

export const websiteRoutes = new Hono<{ Variables: Variables }>();

const graph = websiteGraph.compile({ ...graphParams, name: "website" });

websiteRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  const { threadId, state } = body;
  const websiteId = body.websiteId ?? state?.websiteId;

  if (!threadId) {
    return c.json({ error: "Missing required field: threadId" }, 400);
  }

  if (!websiteId) {
    return c.json({ error: "Missing required field: websiteId" }, 400);
  }

  // Validate thread ownership before processing
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  try {
    // Build initial state from request
    const initialState = {
      threadId,
      jwt: auth.jwt,
      websiteId,
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
    console.error("Website stream error:", error);
    return c.json({ error: "Stream failed", details: String(error) }, 500);
  }
});

websiteRoutes.get("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership before processing
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  try {
    const state = await graph.getState({ configurable: { thread_id: threadId } });
    return c.json({ state: state?.values || {} });
  } catch (error) {
    console.error("Get state error:", error);
    return c.json({ error: "Failed to get state", details: String(error) }, 500);
  }
});

websiteRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "website",
    timestamp: new Date().toISOString(),
  });
});
