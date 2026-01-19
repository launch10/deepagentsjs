# LangGraph ↔ Rails Async Job Pattern (v3)

## The Problem

When a LangGraph node triggers a Rails background job (e.g., deploying a campaign), we need:
1. The graph to fire-and-forget the job
2. The frontend to know the job is pending
3. The webhook to deliver results back to the graph
4. The frontend to detect completion and see results
5. All of this to work with horizontal scaling

## The Solution: Fire-and-Forget + Idempotent Nodes + Task Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│  Pattern: Backend controls flow, frontend polls for completion  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User triggers deploy                                        │
│     → Graph runs → Node fires job → Adds task to tasks[]        │
│     → Returns { pending } → Stream ends                         │
│                                                                 │
│  2. Frontend sees deployStatus: "pending" && !isStreaming       │
│     → Enters poll loop, sends "check" message every N seconds   │
│                                                                 │
│  3. Check triggers graph run                                    │
│     → Node checks tasks[]: job pending, no result yet           │
│     → Returns {} (no-op) → Stream ends                          │
│                                                                 │
│  4. Webhook arrives from Rails (job completed)                  │
│     → Calls graph.updateState() with job result                 │
│     → updateState RUNS the graph (nodes are idempotent!)        │
│     → Node processes result → Returns { completed }             │
│                                                                 │
│  5. Frontend receives stream with completed status              │
│     → Stops polling, shows result                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Critical Insight: `graph.updateState()` Runs the Graph

**This is actually fine because nodes are idempotent.**

When the webhook calls `graph.updateState()`, it:
1. Updates the checkpoint state
2. Triggers a graph run with the updated state
3. Idempotent nodes check state first and return `{}` if nothing to do

This means:
- The webhook's `updateState` call processes the result immediately
- The frontend might receive the completed status on the NEXT poll
- OR the frontend might still be streaming when the webhook triggers the graph
- Either way, the idempotent nodes handle it correctly

## Why This Works

| Concern | Solution |
|---------|----------|
| **Horizontal scaling** | Checkpointer is Postgres (shared). Any instance handles webhook/check. |
| **Status ambiguity** | Frontend checks `pending && !isStreaming` before polling |
| **Idempotency** | Nodes check `tasks[]` state first, exit early if nothing to do |
| **No in-memory state** | Just Postgres. No promises, no event emitters. |
| **Race conditions** | Doesn't matter - nodes are idempotent, worst case is a no-op |

## Implementation

### 1. Task Type and LaunchAnnotation

```typescript
// langgraph_app/app/types/task.ts
import { z } from "zod";
import { v7 as uuid } from "uuid";

export const TaskStatus = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

export const taskSchema = z.object({
  id: z.string().uuid(),
  name: z.string(), // Node name that owns this task
  jobId: z.number().optional(), // Rails JobRun ID
  status: z.enum(["pending", "running", "completed", "failed"]),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});

export type Task = z.infer<typeof taskSchema>;

export function createTask(name: string, jobId?: number): Task {
  return {
    id: uuid(),
    name,
    jobId,
    status: "pending",
  };
}

export function findTask(tasks: Task[], name: string): Task | undefined {
  return tasks.find((t) => t.name === name);
}

export function updateTask(tasks: Task[], name: string, updates: Partial<Task>): Task[] {
  return tasks.map((t) => (t.name === name ? { ...t, ...updates } : t));
}
```

```typescript
// langgraph_app/app/annotation/launchAnnotation.ts
import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { PrimaryKeyType, Task } from "@types";

export const LaunchAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Campaign to deploy
  campaignId: Annotation<PrimaryKeyType | undefined>(),

  // Task tracking for idempotency
  tasks: Annotation<Task[]>({
    default: () => [],
    reducer: (current, next) => {
      // Merge by task name - next values override current
      const taskMap = new Map(current.map((t) => [t.name, t]));
      for (const task of next) {
        taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
      }
      return Array.from(taskMap.values());
    },
  }),

  // Final deploy status for frontend
  deployStatus: Annotation<"pending" | "completed" | "failed" | undefined>(),
  deployResult: Annotation<Record<string, unknown> | undefined>(),
});

export type LaunchGraphState = typeof LaunchAnnotation.State;
```

### 2. Idempotent Deploy Node

```typescript
// langgraph_app/app/nodes/launch/deployCampaignNode.ts
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { LaunchGraphState } from "@annotation";
import { JobRunAPIService } from "@services";
import { NodeMiddleware } from "@middleware";
import { createTask, findTask, updateTask, type Task } from "@types";

const TASK_NAME = "CampaignDeploy";

export const deployCampaignNode = NodeMiddleware.use(
  {},
  async (
    state: LaunchGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<LaunchGraphState>> => {
    const task = findTask(state.tasks, TASK_NAME);

    // 1. Already completed or failed? No-op (idempotent)
    if (task?.status === "completed" || task?.status === "failed") {
      return {};
    }

    // 2. Task exists with result? Process it
    if (task?.status === "running" && task.result) {
      return {
        tasks: updateTask(state.tasks, TASK_NAME, { status: "completed" }),
        deployStatus: "completed",
        deployResult: task.result,
      };
    }

    // 3. Task exists with error? Mark failed
    if (task?.status === "running" && task.error) {
      return {
        tasks: updateTask(state.tasks, TASK_NAME, { status: "failed" }),
        deployStatus: "failed",
        error: { message: task.error, node: "deployCampaignNode" },
      };
    }

    // 4. Task already pending/running? Just waiting, no-op
    if (task?.status === "pending" || task?.status === "running") {
      return {};
    }

    // 5. First run: validate and fire-and-forget
    if (!state.jwt) {
      throw new Error("JWT token is required for API authentication");
    }
    if (!state.threadId) {
      throw new Error("Thread ID is required");
    }
    if (!state.campaignId) {
      throw new Error("Campaign ID is required");
    }

    // Note: callback URL is computed by Rails from LANGGRAPH_API_URL (SSRF prevention)
    const apiService = new JobRunAPIService({ jwt: state.jwt });
    const jobRun = await apiService.create({
      jobClass: "CampaignDeploy",
      arguments: { campaign_id: state.campaignId },
      threadId: state.threadId,
    });

    return {
      tasks: [...state.tasks, createTask(TASK_NAME, jobRun.id)],
      deployStatus: "pending",
    };
  }
);
```

### 3. Webhook Handler

```typescript
// langgraph_app/app/server/routes/webhooks/jobRunCallback.ts
import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { launchGraph } from "@graphs";
import { graphParams, env } from "@core";
import { updateTask } from "@types";

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

    const tasks = currentState.values.tasks || [];
    const task = tasks.find((t: any) => t.jobId === payload.job_run_id);

    if (!task) {
      console.error(`[jobRunCallback] Task with jobId ${payload.job_run_id} not found`);
      return c.json({ error: "Task not found" }, 404);
    }

    // Update the task with result/error
    // Note: updateState RUNS the graph - this is intentional!
    // The idempotent node will process the result
    await graph.updateState(
      { configurable: { thread_id: payload.thread_id } },
      {
        tasks: updateTask(tasks, task.name, {
          status: "running", // Keep running until node processes it
          result: payload.status === "completed" ? payload.result : undefined,
          error: payload.status === "failed" ? payload.error : undefined,
        }),
      }
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
```

### 4. Rails Worker (Simplified - No job_key needed)

```ruby
# rails_app/app/workers/langgraph_callback_worker.rb
class LanggraphCallbackWorker
  include Sidekiq::Worker
  sidekiq_options retry: 5, queue: :default

  def perform(job_run_id, payload)
    job_run = JobRun.find(job_run_id)
    return unless job_run.langgraph_callback_url.present?

    # job_run_id is all we need - LangGraph finds the task by jobId
    LanggraphCallbackClient.new.send_callback(
      url: job_run.langgraph_callback_url,
      payload: payload # Already has job_run_id, thread_id, status, result/error
    )
  end
end
```

### 5. Frontend Polling (With Streaming Guard)

```typescript
// In your React component or hook
import { useLanggraphChat } from "langgraph-ai-sdk-react";

function useDeployStatus() {
  const { state, status, sendMessage } = useLanggraphChat({ /* ... */ });

  const isStreaming = status === "streaming" || status === "pending";
  const isPending = state.deployStatus === "pending";
  const shouldPoll = isPending && !isStreaming;

  // Track how long we've been polling for backoff
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldPoll) {
      pollStartRef.current = null;
      return;
    }

    if (!pollStartRef.current) {
      pollStartRef.current = Date.now();
    }

    const getInterval = () => {
      const elapsed = Date.now() - pollStartRef.current!;
      // After 5 minutes, slow down to 10s intervals
      return elapsed > 5 * 60 * 1000 ? 10000 : 3000;
    };

    const poll = () => {
      sendMessage({ content: "", metadata: { check: true } });
    };

    const interval = setInterval(poll, getInterval());
    return () => clearInterval(interval);
  }, [shouldPoll, sendMessage]);

  return {
    status: state.deployStatus,
    result: state.deployResult,
    isPending: state.deployStatus === "pending",
    isComplete: state.deployStatus === "completed",
    isFailed: state.deployStatus === "failed",
    isStreaming,
  };
}
```

### 6. Route Handler

```typescript
// langgraph_app/app/server/routes/launch.ts
import { Hono } from "hono";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { launchGraph } from "@graphs";
import { graphParams } from "@core";
import { LaunchBridge } from "@annotation";

type Variables = { auth: AuthContext };

export const launchRoutes = new Hono<{ Variables: Variables }>();

const graph = launchGraph.compile({ ...graphParams, name: "launch" });
const LaunchAPI = LaunchBridge.bind(graph);

// Stream endpoint - handles both initial request and check messages
launchRoutes.post("/stream", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();
  const { messages, threadId, state } = body;

  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }

  return LaunchAPI.stream({
    messages: messages || [],
    threadId,
    state: {
      threadId,
      jwt: auth.jwt,
      ...state,
    },
  });
});

// History endpoint
launchRoutes.get("/stream", authMiddleware, async (c) => {
  const threadId = c.req.query("threadId");
  if (!threadId) {
    return c.json({ error: "Missing threadId" }, 400);
  }
  return LaunchAPI.loadHistory(threadId);
});
```

## The Flow (Annotated)

```
Time 0s:   User clicks "Deploy Campaign"
           → Frontend: sendMessage({ command: "deploy", campaignId: 123 })
           → Graph runs → deployCampaignNode
           → Node: No task exists. Fire job, create task, return { pending }
           → Stream ends

Time 3s:   Frontend: deployStatus === "pending" && !isStreaming
           → Send check message
           → Graph runs → deployCampaignNode
           → Node: Task exists, status=pending, no result. Return {} (no-op)
           → Stream ends

Time 6s:   Rails job completes
           → LanggraphCallbackWorker fires
           → POST /webhooks/job_run_callback
           → graph.updateState() adds result to task, RUNS GRAPH
           → Node: Task has result! Process it, return { completed }
           → Graph run completes (no one listening to this stream)

Time 9s:   Frontend: deployStatus still "pending" (hasn't polled yet), !isStreaming
           → Send check message
           → Graph runs → deployCampaignNode
           → Node: Task status=completed. Return {} (no-op)
           → Stream returns current state including deployStatus: "completed"
           → Frontend sees completed, stops polling
```

**Alternative flow (webhook during poll):**

```
Time 6s:   Frontend sends check message, stream opens
           → Graph runs → Node processing...

Time 6.5s: Webhook arrives, calls updateState
           → Another graph run starts (or queues)
           → Node is idempotent - handles both runs correctly

Time 7s:   Original stream returns state
           → Frontend sees result (either from this run or state update)
```

## Multiple Jobs Pattern

For graphs with multiple async jobs running in parallel or sequence:

```typescript
// Each node has its own TASK_NAME
const DEPLOY_TASK = "CampaignDeploy";
const SYNC_TASK = "syncGoogleAds";
const NOTIFY_TASK = "sendNotifications";

// In deployCampaignNode:
const task = findTask(state.tasks, DEPLOY_TASK);
// ... handle task states ...

// In syncGoogleAdsNode:
const task = findTask(state.tasks, SYNC_TASK);
// ... handle task states ...

// Tasks array might look like:
[
  { id: "uuid-1", name: "CampaignDeploy", jobId: 123, status: "completed", result: {...} },
  { id: "uuid-2", name: "syncGoogleAds", jobId: 124, status: "running" },
  { id: "uuid-3", name: "sendNotifications", status: "pending" },
]
```

## Files to Modify

| File | Change |
|------|--------|
| `langgraph_app/app/types/task.ts` | New file - Task type and helpers |
| `langgraph_app/app/annotation/launchAnnotation.ts` | Add `tasks: Task[]` with merge reducer |
| `langgraph_app/app/nodes/launch/deployCampaignNode.ts` | Rewrite to use Task pattern |
| `langgraph_app/app/server/routes/webhooks/jobRunCallback.ts` | Find task by jobId, updateState |
| `rails_app/app/workers/langgraph_callback_worker.rb` | Simplify (no job_key needed) |
| Frontend deploy component | Add polling with `!isStreaming` guard |

## Edge Cases Handled

| Case | Handling |
|------|----------|
| Webhook arrives during frontend poll | Both graph runs are idempotent, no conflict |
| Webhook arrives before first poll | Task updated, next poll sees completed state |
| Multiple webhooks (Sidekiq retry) | updateState is idempotent, overwrites same task |
| Thread doesn't exist | 404 response, Sidekiq stops retrying |
| Task not found | 404 response (shouldn't happen normally) |
| Server restart mid-job | State in Postgres survives, next poll resumes |
| User refreshes page | loadHistory returns current state including tasks |
| Job timeout | Rails job fails, webhook sends `status: "failed"` |
| Frontend already streaming | `!isStreaming` guard prevents duplicate polls |

## Key Architectural Points

1. **`graph.updateState()` runs the graph** - This is intentional and correct. The idempotent nodes handle it.

2. **`tasks[]` is the idempotency mechanism** - Each node checks its task status before doing work.

3. **No job_key needed** - We find tasks by `jobId` (the Rails JobRun ID).

4. **Reuse `JWT_SECRET`** - No need for separate webhook secret.

5. **`NodeMiddleware` and `LaunchBridge` are important** - They provide error handling, logging, and streaming infrastructure that's used throughout the codebase.

6. **Frontend polls only when `pending && !isStreaming`** - Prevents duplicate requests when graph is already running.

7. **Polling backoff after 5 minutes** - Reduces load for long-running jobs.
