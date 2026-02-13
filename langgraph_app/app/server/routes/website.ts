import { Hono } from "hono";
import {
  type AuthContext,
  authMiddleware,
  streamMiddleware,
  readOnlyMiddleware,
  getCreditState,
} from "@server/middleware";
import { validateThreadOrError } from "../middleware/threadValidation";
import { WebsiteAPI } from "@api";
import { env } from "@core";
import { trackChatMessage } from "./shared";

type Variables = {
  auth: AuthContext;
};

export const websiteRoutes = new Hono<{ Variables: Variables }>();

websiteRoutes.post("/stream", ...streamMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const creditState = getCreditState(c);
  const body = await c.req.json();

  const { messages, threadId, state } = body;
  const websiteId = body.websiteId ?? state?.websiteId;

  if (!threadId) {
    return c.json({ error: "Missing required field: threadId" }, 400);
  }

  if (!websiteId) {
    return c.json({ error: "Missing required field: websiteId" }, 400);
  }

  // Validate thread ownership (new threads pass — chat created by updateWebsite node)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  trackChatMessage(auth, messages, threadId, "website", state);

  // Stream with automatic billing via middleware
  // ChatId is looked up from threadId at stream completion
  return WebsiteAPI.stream({
    messages: messages || [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      websiteId,
      ...creditState,
      ...state,
    },
  });
});

websiteRoutes.get("/stream", ...readOnlyMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership - chat must exist (created by updateWebsite node)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  // loadHistory doesn't make LLM calls - no billing needed
  return WebsiteAPI.loadHistory(threadId);
});

// DEV ONLY: Delete checkpoints for a thread (used by restart chat)
websiteRoutes.delete("/thread/:threadId", authMiddleware, async (c) => {
  if (env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const threadId = c.req.param("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Delete all checkpoint data for this thread
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query("DELETE FROM checkpoint_writes WHERE thread_id = $1", [threadId]);
    await pool.query("DELETE FROM checkpoint_blobs WHERE thread_id = $1", [threadId]);
    await pool.query("DELETE FROM checkpoints WHERE thread_id = $1", [threadId]);
    return c.json({ success: true });
  } finally {
    await pool.end();
  }
});

websiteRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "website",
    timestamp: new Date().toISOString(),
  });
});
