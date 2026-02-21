import { Hono } from "hono";
import {
  type AuthContext,
  streamMiddleware,
  readOnlyMiddleware,
  getCreditState,
} from "@server/middleware";
import { validateThreadGraphOrError } from "../middleware/threadValidation";
import { BrainstormAPI } from "@api";
import { trackChatMessage } from "./shared";

type Variables = {
  auth: AuthContext;
};

export const brainstormRoutes = new Hono<{ Variables: Variables }>();

brainstormRoutes.post("/stream", ...streamMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const creditState = getCreditState(c);
  const body = await c.req.json();

  const { messages, threadId, state } = body;

  if (!messages || !threadId) {
    return c.json({ error: "Missing required fields: messages, threadId" }, 400);
  }

  // Validate thread ownership + graph type (new threads allowed — chat created during execution)
  const validationError = await validateThreadGraphOrError(c, threadId, auth, "brainstorm");
  if (validationError) return validationError;

  let stateObj = state || {};

  trackChatMessage(auth, messages, threadId, "brainstorm", stateObj);

  // Stream with automatic billing via middleware
  // ChatId is looked up from threadId at stream completion
  return BrainstormAPI.stream({
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

brainstormRoutes.get("/stream", ...readOnlyMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership + graph type for loading history
  const validationError = await validateThreadGraphOrError(c, threadId, auth, "brainstorm");
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
