import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { HumanMessage } from "@langchain/core/messages";
import { Deploy, Task } from "@types";
import { buildBugFixPrompt } from "@prompts";
import { type TaskRunner, registerTask, isTaskFailed } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "FixingBugs";

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
  // Get validation errors from runtime_validation task
  const validationTask = Task.findTask(state.tasks, "RuntimeValidation");
  if (!validationTask) {
    return {};
  }

  if (validationTask.status !== "failed") {
    return {};
  }

  if (!state.websiteId || !state.jwt) {
    throw new Error("websiteId and jwt are required");
  }

  if (!validationTask.error) {
    throw new Error("Validation error is required");
  }

  const task = Task.findTask(state.tasks, TASK_NAME);

  // Build prompt with errors in state for consistent async pattern
  // Bug fixes are always edits (isFirstMessage: false) with errors present
  const promptState = {
    websiteId: state.websiteId,
    jwt: state.jwt,
    errors: validationTask.error,
    isFirstMessage: false,
  };
  const systemPrompt = await buildBugFixPrompt(promptState, config);

  try {
    // Compile and invoke codingAgentGraph as subgraph
    const agent = await createCodingAgent(
      { websiteId: state.websiteId, jwt: state.jwt, isFirstMessage: false },
      systemPrompt
    );

    // This will update the files in the database, or throw an error
    await agent.invoke({
      messages: [
        new HumanMessage(
          `Please analyze the errors and resolve them so my site runs successfully.`
        ),
      ],
    });

    return {
      tasks: [
        {
          ...validationTask,
          retryCount: validationTask.retryCount + 1,
        } as Task.Task,
        {
          ...task,
          status: "completed",
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
          ...validationTask,
          retryCount: validationTask.retryCount + 1,
        } as Task.Task,
        {
          ...task,
          status: "failed",
          error: errorMessage,
        } as Task.Task,
      ],
    };
  }
}

// Legacy export with middleware
export const bugFixNode = NodeMiddleware.use({}, runBugFix);

/**
 * Bug Fix Task Runner
 *
 * Only runs when validation has failed. Attempts to fix runtime errors.
 */
export const bugFixTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    // Ready when either validation task has failed
    return isTaskFailed(state, "ValidateLinks") || isTaskFailed(state, "RuntimeValidation");
  },

  shouldSkip: (state: DeployGraphState) => {
    return !Deploy.shouldDeployWebsite(state)
  },

  run: runBugFix,
};

// Register this task runner
registerTask(bugFixTaskRunner);
