import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { codingAgentGraph } from "@graphs";
import { graphParams } from "@core";
import { HumanMessage } from "@langchain/core/messages";
import { createChecklistTask, findChecklistTask, updateChecklistTask } from "@types";

const TASK_NAME = "code_fix" as const;

/**
 * Fix With Coding Agent Node
 *
 * Invokes the codingAgentGraph as a subgraph to fix runtime errors.
 * Increments retryCount to track retry attempts.
 */
export const fixWithCodingAgentNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    // Get validation errors from runtime_validation task
    const validationTask = findChecklistTask(state.tasks, "runtime_validation");
    const consoleErrors = state.consoleErrors ?? [];

    if (consoleErrors.length === 0) {
      // No errors to fix
      return {};
    }

    // Format errors for coding agent
    const errorContext = consoleErrors
      .map((e) => `- ${e.type || "error"}: ${e.message}`)
      .join("\n");

    // Create task with running status
    const task = createChecklistTask(TASK_NAME);
    const tasksWithRunning = [...state.tasks, { ...task, status: "running" as const }];

    try {
      // Compile and invoke codingAgentGraph as subgraph
      const compiled = codingAgentGraph.compile({
        ...graphParams,
        name: "codingAgent-fix",
      });

      await compiled.invoke({
        websiteId: state.websiteId,
        accountId: state.accountId,
        projectId: state.projectId,
        jwt: state.jwt,
        threadId: state.threadId,
        messages: [
          new HumanMessage(
            `Fix the following runtime errors:\n\n${errorContext}\n\nAnalyze the errors and modify the code files to resolve them.`
          ),
        ],
      });

      return {
        tasks: updateChecklistTask(tasksWithRunning, TASK_NAME, {
          status: "completed",
          result: { errorsFixed: consoleErrors.length },
        }),
        retryCount: state.retryCount + 1,
        // Reset validation state for re-validation
        validationPassed: false,
        consoleErrors: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        tasks: updateChecklistTask(tasksWithRunning, TASK_NAME, {
          status: "failed",
          error: errorMessage,
        }),
        retryCount: state.retryCount + 1,
      };
    }
  }
);
