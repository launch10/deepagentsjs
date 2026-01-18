import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";
import { createCodingAgent } from "@nodes";
import { codingToolsPrompt, trackingPrompt, environmentPrompt } from "@prompts";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";

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

    # Task: 
    The landing page should already be properly instrumented.
      1. If it is, simply reply: CONFIRMED.
      2. If it is not, add the instrumentation and reply: FIXED.

    # Workflow:
    1. First, query all available components in src/components - not in src/components/ui (these are just base ShadCN components)
    2. Then, narrow down to files likely to require instrumentation (e.g. Hero, Pricing, CTA)
    3. Assign each file to a coder subagent in parallel to instrument.
    4. Trust your subagents to do their job quickly. Prioritize speed.
  `;
};

/**
 * Analytics Task Runner
 *
 * Validates that landing pages use L10.createLead() for lead capture.
 * Does NOT inject code - the coding agent is responsible for using the correct patterns.
 * This node just verifies compliance before deploy.
 */
export const analyticsTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    // Ready when Google setup is done OR not deploying Google Ads
    if (!Deploy.shouldDeployGoogleAds(state)) {
      return true;
    }
    return isTaskDone(state, "VerifyingGoogle");
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying a website
    return !state.deploy?.website;
  },

  run: async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    // Already completed - idempotent
    if (task?.status === "completed") {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("Missing websiteId");
    }

    if (!config) {
      throw new Error("Config is required for analytics task");
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
      await agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: `Ensure the landing page is instrumented`,
            },
          ],
        },
        {
          ...config,
          recursionLimit: 75,
        }
      );
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
  },
};

// Register this task runner
registerTask(analyticsTaskRunner);

// Legacy exports for backwards compatibility during migration
export const analyticsNode = analyticsTaskRunner.run;
export const shouldSkipAnalytics = analyticsTaskRunner.shouldSkip;