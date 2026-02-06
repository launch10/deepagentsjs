import { Hono } from "hono";
import { type AuthContext, streamMiddleware, readOnlyMiddleware, getCreditState } from "@server/middleware";
import { validateThreadOrError } from "../middleware/threadValidation";
import { AdsAPI } from "@api";
import { getLogger } from "@core";

type Variables = {
  auth: AuthContext;
};

export const adsRoutes = new Hono<{ Variables: Variables }>();

adsRoutes.post("/stream", ...streamMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const creditState = getCreditState(c);
  const body = await c.req.json();

  const { messages, threadId, state } = body;

  if (!threadId) {
    return c.json({ error: "Missing required field: threadId" }, 400);
  }

  // Validate thread ownership - chat must exist (pre-created via ChatCreatable)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  let stateObj = state || {};

  try {
    // Stream with automatic billing via middleware
    // ChatId is looked up from threadId at stream completion
    return AdsAPI.stream({
      messages: messages || [],
      threadId,
      state: {
        threadId,
        jwt: auth.jwt,
        ...creditState,
        ...stateObj,
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, "AdsAPI.stream error");
    return c.json({ error: "Stream failed", details: String(error) }, 500);
  }
});

adsRoutes.get("/stream", ...readOnlyMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership - chat must exist (pre-created via ChatCreatable)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  // loadHistory doesn't make LLM calls - no billing needed
  return await AdsAPI.loadHistory(threadId);
});

adsRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "ads",
    timestamp: new Date().toISOString(),
  });
});
