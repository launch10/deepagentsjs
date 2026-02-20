import { type DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { HumanMessage } from "@langchain/core/messages";
import { Deploy, Task } from "@types";
import { buildBugFixPrompt } from "@prompts";
import { type TaskRunner, registerTask, isTaskFailed, isTaskDone } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "FixingBugs";
const MAX_BUG_FIX_RETRIES = 2;

/**
 * Fix With Coding Agent - Raw Function
 *
 * Invokes the codingAgentGraph as a subgraph to fix runtime errors.
 * Increments retryCount to track retry attempts.
 */
async function runBugFix(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  // Get validation errors from RuntimeValidation task
  const validationTask = Task.findTask(state.tasks, "RuntimeValidation");
  const failedTask = validationTask?.status === "failed" ? validationTask : undefined;

  if (!failedTask) {
    return {};
  }

  if (failedTask.status !== "failed") {
    return {};
  }

  const fixTask = Task.findTask(state.tasks, TASK_NAME);

  if (failedTask.retryCount >= MAX_BUG_FIX_RETRIES) {
    return {
      tasks: [
        {
          ...fixTask,
          status: "failed",
          error: `Max bug fix retries (${MAX_BUG_FIX_RETRIES}) exceeded`,
        } as Task.Task,
      ],
    };
  }

  if (!state.websiteId || !state.jwt) {
    throw new Error("websiteId and jwt are required");
  }

  if (!failedTask.error) {
    throw new Error("Validation error is required");
  }

  // Build prompt with errors in state for consistent async pattern
  // Bug fixes are always edits (isCreateFlow: false) with errors present
  const promptState = {
    websiteId: state.websiteId,
    jwt: state.jwt,
    errors: failedTask.error,
    isCreateFlow: false,
  };
  const systemPrompt = await buildBugFixPrompt(promptState, config);

  try {
    await createCodingAgent(
      { websiteId: state.websiteId, jwt: state.jwt, isCreateFlow: false },
      {
        messages: [
          new HumanMessage(
            `Fix the runtime errors. Make the minimal viable change — target the affected file and make the fix.`
          ),
        ],
        systemPrompt,
        route: "full",
        config,
        recursionLimit: 30,
        subagents: [],
      }
    );

    // Reset RuntimeValidation to pending so executor re-runs validation.
    // Reset FixingBugs to pending so it can run again if validation fails.
    // retryCount tracks attempts; MAX_BUG_FIX_RETRIES prevents infinite loops.
    return {
      tasks: [
        {
          ...failedTask,
          status: "pending",
          retryCount: (failedTask.retryCount || 0) + 1,
          error: undefined,
          result: undefined,
        } as Task.Task,
        {
          ...fixTask,
          status: "pending",
        } as Task.Task,
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // IMPORTANT: Still increment retryCount to prevent infinite retry loop
    // Even if the fix attempt failed, it counts as a retry
    return {
      tasks: [
        {
          ...failedTask,
          retryCount: (failedTask.retryCount || 0) + 1,
        } as Task.Task,
        {
          ...fixTask,
          status: "failed",
          error: errorMessage,
        } as Task.Task,
      ],
    };
  }
}

// Middleware-wrapped version (enables Polly recording in tests)
export const bugFixNode = NodeMiddleware.use({}, runBugFix);

/**
 * Bug Fix Task Runner
 *
 * Only runs when validation has failed. Attempts to fix runtime errors.
 */
export const bugFixTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    return isTaskFailed(state, "RuntimeValidation");
  },

  shouldSkip: (state: DeployGraphState) => {
    if (!Deploy.shouldDeployWebsite(state)) {
      return true;
    }

    // Skip if RuntimeValidation passed (no bugs to fix)
    return isTaskDone(state, "RuntimeValidation") && !isTaskFailed(state, "RuntimeValidation");
  },

  // Use raw function - task runners are called by nodes already wrapped with middleware
  run: runBugFix,
};

// Register this task runner
registerTask(bugFixTaskRunner);
