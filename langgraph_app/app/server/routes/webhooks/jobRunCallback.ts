import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { Client } from "@langchain/langgraph-sdk";
import { env } from "@core";

interface JobRunCallbackPayload {
  job_run_id: number;
  thread_id: string;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export const jobRunCallbackRoutes = new Hono();

jobRunCallbackRoutes.post("/webhooks/job_run_callback", async (c) => {
  const signature = c.req.header("X-Signature");
  const body = await c.req.text();

  if (!verifySignature(body, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const payload: JobRunCallbackPayload = JSON.parse(body);
  const client = new Client({ apiUrl: env.LANGGRAPH_API_URL });

  try {
    // Update thread state with job result
    await client.threads.updateState(payload.thread_id, {
      values: {
        jobRunComplete: {
          jobRunId: payload.job_run_id,
          status: payload.status,
          result: payload.result,
          error: payload.error,
        },
      },
    });

    // Resume thread execution
    await client.runs.create(payload.thread_id, "launch");

    return c.json({ success: true });
  } catch (error) {
    console.error("[jobRunCallback] Failed to resume thread:", error);
    return c.json({ error: "Failed to resume thread" }, 500);
  }
});

function verifySignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", env.JWT_SECRET).update(body).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
