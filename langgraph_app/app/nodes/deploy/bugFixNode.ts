import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "../codingAgent/utils";
import { HumanMessage } from "@langchain/core/messages";
import { Task } from "@types";
import { buildBugFixPrompt } from "@prompts";

const TASK_NAME = "BugFix" as const;

/**
 * Fix With Coding Agent Node
 *
 * Invokes the codingAgentGraph as a subgraph to fix runtime errors.
 * Increments retryCount to track retry attempts.
 */
export const bugFixNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
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
    const promptState = {
      websiteId: state.websiteId,
      jwt: state.jwt,
      errors: validationTask.error,
    };
    const systemPrompt = await buildBugFixPrompt(promptState, config);

    try {
      // Compile and invoke codingAgentGraph as subgraph
      const agent = await createCodingAgent(
        { websiteId: state.websiteId, jwt: state.jwt },
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
      return {};
    }
  }
);
