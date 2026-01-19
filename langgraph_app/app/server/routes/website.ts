import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { websiteGraph } from "@graphs";
import { graphParams } from "@core";
import { WebsiteBridge } from "@annotation";

type Variables = {
  auth: AuthContext;
};

export const websiteRoutes = new Hono<{ Variables: Variables }>();

const graph = websiteGraph.compile({ ...graphParams, name: "website" });
const WebsiteAPI = WebsiteBridge.bind(graph);

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

  // Use the Bridge API to stream properly formatted responses
  return WebsiteAPI.stream({
    messages: [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      websiteId,
      ...state,
    },
  });
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

  // Use the Bridge API to return properly formatted history
  return WebsiteAPI.loadHistory(threadId);
});

websiteRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "website",
    timestamp: new Date().toISOString(),
  });
});
