import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { DeployAPI } from "@api";

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

  // Stream with automatic billing via middleware
  // ChatId is looked up from threadId at stream completion
  // Note: Deploy doesn't use chat messages, but Bridge API requires the field
  return DeployAPI.stream({
    messages: [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      deployId,
      websiteId,
      campaignId,
      // Default deploy instructions - deploy both if not specified
      deploy: state?.deploy ?? { website: true, googleAds: true },
      ...state,
    },
  });
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

  // loadHistory doesn't make LLM calls - no billing needed
  return DeployAPI.loadHistory(threadId);
});

deployRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "deploy",
    timestamp: new Date().toISOString(),
  });
});
