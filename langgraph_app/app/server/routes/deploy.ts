import { Hono } from "hono";
import {
  type AuthContext,
  streamMiddleware,
  readOnlyMiddleware,
  authMiddleware,
  getCreditState,
} from "@server/middleware";
import { validateThreadOrError } from "../middleware/threadValidation";
import { DeployAPI } from "@api";
import { env, getLogger } from "@core";

type Variables = {
  auth: AuthContext;
};

const log = getLogger({ component: "deployRoutes" });

export const deployRoutes = new Hono<{ Variables: Variables }>();

deployRoutes.post("/stream", ...streamMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const creditState = getCreditState(c);
  const body = await c.req.json();

  const { threadId, state } = body;
  // Extract fields from top-level body or nested state (SDK may send either way)
  const projectId = body.projectId ?? state?.projectId;
  const deployId = body.deployId ?? state?.deployId;
  const websiteId = body.websiteId ?? state?.websiteId;
  const campaignId = body.campaignId ?? state?.campaignId;
  const instructions = body.instructions ?? state?.instructions;

  log.info(
    {
      threadId,
      projectId,
      deployId,
      websiteId,
      campaignId,
      instructions,
      stateOnly: body.stateOnly,
      hasState: !!state,
      stateKeys: state ? Object.keys(state) : [],
    },
    "Deploy stream request received"
  );

  if (!threadId) {
    log.warn("Missing threadId");
    return c.json({ error: "Missing required field: threadId" }, 400);
  }

  if (!projectId) {
    log.warn(
      { threadId, bodyKeys: Object.keys(body), stateKeys: state ? Object.keys(state) : [] },
      "Missing projectId"
    );
    return c.json({ error: "Missing required field: projectId" }, 400);
  }

  // No thread validation on POST - chat doesn't exist yet.
  // The graph's initDeploy node creates the deploy + chat via Rails API.
  // This mirrors the brainstorm pattern where JWT auth is sufficient for new threads.

  // Stream with automatic billing via middleware
  // ChatId is looked up from threadId at stream completion
  // Note: Deploy doesn't use chat messages, but Bridge API requires the field
  return DeployAPI.stream({
    messages: [],
    threadId,
    state: {
      // Spread raw state first so explicit fields below take precedence
      ...state,
      threadId,
      jwt: auth.jwt,
      projectId,
      deployId,
      websiteId,
      campaignId,
      ...creditState,
      // Deploy instructions — extracted from body or state, defaulting to both
      instructions: instructions ?? { website: true, googleAds: true },
    },
  });
});

deployRoutes.get("/stream", ...readOnlyMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const threadId = c.req.query("threadId");

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  // Validate thread ownership for loading history - chat must exist
  const validationError = await validateThreadOrError(c, threadId, auth);
  if (validationError) return validationError;

  // loadHistory doesn't make LLM calls - no billing needed
  return DeployAPI.loadHistory(threadId);
});

// DEV ONLY: Delete checkpoints for a thread (used by restart deploy)
deployRoutes.delete("/thread/:threadId", authMiddleware, async (c) => {
  if (env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const threadId = c.req.param("threadId");
  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

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

deployRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    graph: "deploy",
    timestamp: new Date().toISOString(),
  });
});
