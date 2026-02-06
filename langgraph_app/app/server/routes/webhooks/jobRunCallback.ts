import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { deployGraph } from "@graphs";
import { graphParams, env, getLogger } from "@core";
import { Task } from "@types";
export interface JobRunCallbackPayload {
  job_run_id: number;
  thread_id: string;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export const jobRunCallbackRoutes = new Hono();

// Lazy initialization to avoid circular deps
// Uses shared checkpointer from graphParams for consistency with deploy routes
let _graph: ReturnType<typeof deployGraph.compile> | null = null;
function getGraph() {
  if (!_graph) {
    _graph = deployGraph.compile({ ...graphParams, name: "deploy" });
  }
  return _graph;
}

export const jobRunCallback = async (payload: JobRunCallbackPayload): Promise<boolean> => {
  const graph = getGraph();

  // Get current state to find the task by jobId
  const currentState = await graph.getState({
    configurable: { thread_id: payload.thread_id },
  });

  if (!currentState?.values) {
    getLogger({ component: "jobRunCallback" }).error({ threadId: payload.thread_id }, "Thread not found");
    return false
  }

  const tasks: Task.Task[] = currentState.values.tasks || [];
  const task = tasks.find((t) => t.jobId === payload.job_run_id);

  if (!task) {
    getLogger({ component: "jobRunCallback" }).error({ jobId: payload.job_run_id }, "Task not found");
    return false;
  }

  // Update the task with result/error
  // Note: updateState RUNS the graph - this is intentional!
  // The idempotent node will process the result
  const updatedTasks = Task.updateTask(tasks, task.name, {
    status: "running", // Keep running until node processes it
    result: payload.status === "completed" ? payload.result : undefined,
    error: payload.status === "failed" ? payload.error : undefined,
  });

  await graph.updateState(
    { configurable: { thread_id: payload.thread_id } },
    { tasks: updatedTasks }
  );

  return true;
}

jobRunCallbackRoutes.post("/webhooks/job_run_callback", async (c) => {
  const signature = c.req.header("X-Signature");
  const body = await c.req.text();

  if (!verifySignature(body, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const payload: JobRunCallbackPayload = JSON.parse(body);

  try {
    const success = await jobRunCallback(payload);

    if (!success) {
      return c.json({ error: "Failed to update state" }, 404);
    }

    return c.json({ success });
  } catch (error) {
    getLogger({ component: "jobRunCallback" }).error({ err: error }, "Failed to update state");
    return c.json({ error: "Failed to update state" }, 500);
  }
});

function verifySignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  if (!env.JWT_SECRET) {
    getLogger({ component: "jobRunCallback" }).error("JWT_SECRET is not configured");
    return false;
  }
  const expected = createHmac("sha256", env.JWT_SECRET).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    getLogger({ component: "jobRunCallback" }).error({ err: e }, "Signature comparison failed");
    return false;
  }
}
