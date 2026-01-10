import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { launchGraph } from "@graphs";
import { graphParams, env } from "@core";
import { Task } from "@types";

interface JobRunCallbackPayload {
  job_run_id: number;
  thread_id: string;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export const jobRunCallbackRoutes = new Hono();

// Lazy initialization to avoid circular deps
let _graph: ReturnType<typeof launchGraph.compile> | null = null;
function getGraph() {
  if (!_graph) {
    _graph = launchGraph.compile({ ...graphParams });
  }
  return _graph;
}

jobRunCallbackRoutes.post("/webhooks/job_run_callback", async (c) => {
  const signature = c.req.header("X-Signature");
  const body = await c.req.text();

  if (!verifySignature(body, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const payload: JobRunCallbackPayload = JSON.parse(body);

  try {
    const graph = getGraph();

    // Get current state to find the task by jobId
    const currentState = await graph.getState({
      configurable: { thread_id: payload.thread_id },
    });

    if (!currentState?.values) {
      console.error(`[jobRunCallback] Thread ${payload.thread_id} not found`);
      return c.json({ error: "Thread not found" }, 404);
    }

    const tasks: Task.Task[] = currentState.values.tasks || [];
    const task = tasks.find((t) => t.jobId === payload.job_run_id);

    if (!task) {
      console.error(
        `[jobRunCallback] Task with jobId ${payload.job_run_id} not found`
      );
      return c.json({ error: "Task not found" }, 404);
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

    return c.json({ success: true });
  } catch (error) {
    console.error("[jobRunCallback] Failed to update state:", error);
    return c.json({ error: "Failed to update state" }, 500);
  }
});

function verifySignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  if (!env.JWT_SECRET) {
    console.error("[verifySignature] JWT_SECRET is not configured");
    return false;
  }
  const expected = createHmac("sha256", env.JWT_SECRET)
    .update(body)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    console.error("[verifySignature] Comparison failed:", e);
    return false;
  }
}
