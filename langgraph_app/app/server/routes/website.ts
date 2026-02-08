import { Hono } from "hono";
import { type AuthContext, streamMiddleware, readOnlyMiddleware, getCreditState } from "@server/middleware";
import { validateThreadOrError } from "../middleware/threadValidation";
import { WebsiteAPI } from "@api";

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

websiteRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "website",
    timestamp: new Date().toISOString(),
  });
});
