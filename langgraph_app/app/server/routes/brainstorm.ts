import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { BrainstormAPI } from "@graphs";

type Variables = {
  auth: AuthContext;
};

export const brainstormRoutes = new Hono<{ Variables: Variables }>();

brainstormRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  const { messages, threadId, state } = body;

  if (!messages || !threadId) {
    return c.json({ error: "Missing required fields: messages, threadId" }, 400);
  }

  let stateObj = state || {};

  // Stream with automatic billing via middleware
  // ChatId is looked up from threadId at stream completion
  return BrainstormAPI.stream({
    messages: messages || [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      ...stateObj,
    },
  });
});

brainstormRoutes.get("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership for loading history - chat must exist
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  // loadHistory doesn't make LLM calls - no billing needed
  return BrainstormAPI.loadHistory(threadId);
});

brainstormRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "brainstorm",
    timestamp: new Date().toISOString(),
  });
});
