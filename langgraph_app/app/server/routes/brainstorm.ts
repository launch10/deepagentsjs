import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { brainstormGraph } from "@graphs";
import { graphParams } from "@core";
import { Brainstorm } from "@types";
import { BrainstormBridge } from "@annotation";

type Variables = {
  auth: AuthContext;
};

export const brainstormRoutes = new Hono<{ Variables: Variables }>();

const graph = brainstormGraph.compile({ ...graphParams, name: "brainstorm" });
const BrainstormAPI = BrainstormBridge.bind(graph);

brainstormRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();

  const { messages, threadId, state } = body;

  if (!messages || !threadId) {
    return c.json({ error: "Missing required fields: messages, threadId" }, 400);
  }

  let stateObj = state || {};

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

  return BrainstormAPI.loadHistory(threadId);
});

brainstormRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "brainstorm",
    timestamp: new Date().toISOString(),
  });
});
