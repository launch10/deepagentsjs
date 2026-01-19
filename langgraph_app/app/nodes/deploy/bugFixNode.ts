import { type DeployGraphState, withPhases } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { HumanMessage } from "@langchain/core/messages";
import { Deploy, Task } from "@types";
import { buildBugFixPrompt } from "@prompts";
import { type TaskRunner, registerTask, isTaskFailed, isTaskDone } from "./taskRunner";

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
  const linksTask = Task.findTask(state.tasks, "ValidateLinks");
  const validationTask = Task.findTask(state.tasks, "RuntimeValidation");
  const failedTask = [linksTask, validationTask].find((t) => t?.status === "failed");

  if (!failedTask) {
    return {};
  }

  if (failedTask.status !== "failed") {
    return {};
  }

  if (!state.websiteId || !state.jwt) {
    throw new Error("websiteId and jwt are required");
  }

  if (!failedTask.error) {
    throw new Error("Validation error is required");
  }

  const fixTask = Task.findTask(state.tasks, TASK_NAME);

  // Build prompt with errors in state for consistent async pattern
  // Bug fixes are always edits (isFirstMessage: false) with errors present
  const promptState = {
    websiteId: state.websiteId,
    jwt: state.jwt,
    errors: failedTask.error,
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
          ...failedTask,
          retryCount: failedTask.retryCount + 1,
        } as Task.Task,
        {
          ...fixTask,
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
          ...failedTask,
          retryCount: failedTask.retryCount + 1,
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
    // Ready when either validation task has failed
    return isTaskFailed(state, "ValidateLinks") || isTaskFailed(state, "RuntimeValidation");
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying a website
    if (!Deploy.shouldDeployWebsite(state)) {
      return true;
    }

    // Skip if validation passed (no bugs to fix)
    // Both validation tasks must be done (completed/skipped) AND neither failed
    const validateLinksDone = isTaskDone(state, "ValidateLinks");
    const runtimeValidationDone = isTaskDone(state, "RuntimeValidation");
    const noValidationFailed = !isTaskFailed(state, "ValidateLinks") && !isTaskFailed(state, "RuntimeValidation");

    return validateLinksDone && runtimeValidationDone && noValidationFailed;
  },

  // Use middleware-wrapped version for Polly recording support in tests
  run: bugFixNode,
};

// Register this task runner
registerTask(bugFixTaskRunner);
