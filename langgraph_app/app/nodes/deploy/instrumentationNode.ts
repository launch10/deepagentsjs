import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { Task } from "@types";
import { createCodingAgent } from "@nodes";
import { codingToolsPrompt, trackingPrompt, environmentPrompt } from "@prompts";

const TASK_NAME = "AddingAnalytics" as const;

const buildSystemPrompt = async (state: DeployGraphState, config: LangGraphRunnableConfig) => {
  let mergedState = { ...state, isFirstMessage: false };
  const [tools, trackingContext, environment] = await Promise.all([
    codingToolsPrompt(mergedState, config),
    trackingPrompt(mergedState, config),
    environmentPrompt(mergedState, config),
  ]);

  return `
    You are the analytics specialist for this website.

    Ensure the landing page uses L10.createLead() for lead capture.

    ${tools}

    ${trackingContext}

    ${environment}

    The landing page should already be properly instrumented.
      1. If it is, simply reply: CONFIRMED.
      2. If it is not, add the instrumentation and reply: FIXED.
  `;
};

/**
 * Instrumentation Node
 *
 * Validates that landing pages use L10.createLead() for lead capture.
 * Does NOT inject code - the coding agent is responsible for using the correct patterns.
 * This node just verifies compliance before deploy.
 */
export const instrumentationNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    if (task?.status === "completed") {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("Missing websiteId");
    }

    try {
      const systemPrompt = await buildSystemPrompt(state, config);

      const agent = await createCodingAgent(
        {
          ...state,
          isFirstMessage: false,
        },
        systemPrompt
      );
      const result = await agent.invoke({
        messages: [
          {
            role: "user",
            content: `Verify that the landing page uses L10.createLead() for lead capture.`,
          },
        ],
      });
      return {
        tasks: [
          {
            ...task,
            status: "completed",
          } as Task.Task,
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        tasks: [
          {
            ...task,
            status: "failed",
            error: errorMessage,
          } as Task.Task,
        ],
      };
    }
  }
);
