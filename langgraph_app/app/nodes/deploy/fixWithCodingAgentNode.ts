import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "../codingAgent/utils";
import { graphParams } from "@core";
import { HumanMessage } from "@langchain/core/messages";
import { Task } from "@types";

const TASK_NAME = "BugFix" as const;

const fixBugSystemPrompt = (errorContext: string) => {
  return `
    The user has a simple, static landing page that uses:
      1. React Router
      2. Tailwind
      3. ShadCN

    <task>
      Fix the following errors:
    </task>

    <errors>
      ${errorContext}
    </errors>

    Analyze the errors and modify the code files to resolve them.
  `;
};

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

    const errorContext = validationTask.error;
    const systemPrompt = fixBugSystemPrompt(errorContext);

    try {
      // Compile and invoke codingAgentGraph as subgraph
      const agent = createCodingAgent({ websiteId: state.websiteId, jwt: state.jwt }, systemPrompt)

      debugger;
      const result = await agent.invoke({
        websiteId: state.websiteId,
        accountId: state.accountId,
        projectId: state.projectId,
        jwt: state.jwt,
        threadId: state.threadId,
        messages: [
          new HumanMessage(
            `Please analyze the errors and resolve them so my site runs successfully.`
          ),
        ],
      });
      debugger;

      return {};
    } catch (error) {
      debugger;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {};
    }
  }
);
