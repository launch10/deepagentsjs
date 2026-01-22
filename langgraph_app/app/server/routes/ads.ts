import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { validateThreadOrError } from "../middleware/threadValidation";
import { adsGraph } from "@graphs";
import { graphParams } from "@core";
import { AdsBridge } from "@annotation";
import { env } from "@core";
import pkg from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const { Pool } = pkg;
const connectionString = env.DATABASE_URL || "postgresql://localhost/langgraph_backend_test";

const pool = new Pool({
  connectionString,
});

type Variables = {
  auth: AuthContext;
};

export const adsRoutes = new Hono<{ Variables: Variables }>();

const checkpointer = new PostgresSaver(pool);
const graph = adsGraph.compile({ checkpointer, name: "ads" });
const AdsAPI = AdsBridge.bind(graph as any);

adsRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
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
    return AdsAPI.stream({
      messages: messages || [],
      threadId,
      state: {
        threadId,
        jwt: auth.jwt,
        ...stateObj,
      },
    });
  } catch (error) {
    console.error("AdsAPI.stream error:", error);
    return c.json({ error: "Stream failed", details: String(error) }, 500);
  }
});

adsRoutes.get("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership - chat must exist (pre-created via ChatCreatable)
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  return await AdsAPI.loadHistory(threadId);
});

adsRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "ads",
    timestamp: new Date().toISOString(),
  });
});
