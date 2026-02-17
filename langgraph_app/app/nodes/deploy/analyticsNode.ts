import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { Deploy, Task } from "@types";
import { createCodingAgent } from "@nodes";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";
import { db, websiteFiles, eq, and, like } from "@db";
import { trackingPrompt } from "@prompts";
import { codingToolsPrompt, environmentPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { getLogger } from "@core";

const TASK_NAME = "AddingAnalytics" as const;

/**
 * Build the system prompt for the analytics instrumentation agent
 */
const buildSystemPrompt = async (
  state: DeployGraphState,
  config: LangGraphRunnableConfig
): Promise<string> => {
  const mergedState = { ...state, isCreateFlow: false };
  const [trackingContext, tools, environment] = await Promise.all([
    trackingPrompt({ websiteId: state.websiteId, jwt: state.jwt, isCreateFlow: false }, config),
    codingToolsPrompt(mergedState, config),
    environmentPrompt(mergedState, config),
  ]);

  return `You are a code instrumentation specialist. Your job is to add L10.createLead() tracking to React components that capture email addresses.

${trackingContext}

## Your Task

1. Read the component files listed in the user message
2. Find form submission handlers or button click handlers that capture email
3. Add L10.createLead() call when the email is captured following the patterns above
4. Save each file with your changes

## Rules

- Only add L10.createLead() - don't change anything else
- Follow the import and usage patterns from the tracking context above
- If a component doesn't actually capture emails, leave it unchanged

${tools}

${environment}

Reply DONE when finished.
`;
};

interface FileToInstrument {
  path: string;
  content: string;
}

/**
 * Check if a file needs L10 instrumentation.
 * Returns true if file has email/form capture patterns but no L10.createLead.
 *
 * Detection covers: type="email" inputs, setEmail state, <form elements,
 * onSubmit/handleSubmit handlers, and useForm() hooks.
 * Better to have a false positive (agent checks and decides no email capture)
 * than a false negative (no tracking deployed).
 */
export function needsInstrumentation(content: string): boolean {
  const hasEmailInput =
    content.includes('type="email"') ||
    content.includes("type='email'") ||
    content.includes('type={"email"}') ||
    content.includes("type={'email'}");

  const hasEmailState = /setEmail\s*\(/i.test(content);
  const hasFormElement = content.includes("<form");
  const hasSubmitHandler = /onSubmit|handleSubmit/i.test(content);
  const hasFormHook = /useForm\s*\(/i.test(content);

  const hasEmailCapture =
    hasEmailInput || hasEmailState || hasFormElement || hasSubmitHandler || hasFormHook;
  const hasL10 = content.includes("L10.createLead");

  return hasEmailCapture && !hasL10;
}

/**
 * Run analytics instrumentation using the full coding agent
 */
async function instrumentAnalytics(
  state: DeployGraphState,
  config: LangGraphRunnableConfig
): Promise<"CONFIRMED" | "FIXED"> {
  if (!state.websiteId || !state.jwt) {
    throw new Error("Missing websiteId or jwt");
  }

  // Query DB directly for component files
  const files = await db
    .select({
      path: websiteFiles.path,
      content: websiteFiles.content,
    })
    .from(websiteFiles)
    .where(
      and(
        eq(websiteFiles.websiteId, state.websiteId),
        like(websiteFiles.path, "%src/components/%"),
        like(websiteFiles.path, "%.tsx")
      )
    );

  // Filter out ui/ (base shadcn components) and find files needing work
  const filesNeedingWork = files.filter(
    (f): f is FileToInstrument =>
      f.path !== null &&
      f.content !== null &&
      !f.path.includes("components/ui/") &&
      needsInstrumentation(f.content)
  );

  if (filesNeedingWork.length === 0) {
    getLogger().info("All files already instrumented or no email forms found");
    return "CONFIRMED";
  }

  getLogger().info(
    { fileCount: filesNeedingWork.length, files: filesNeedingWork.map((f) => f.path) },
    "Found files needing instrumentation"
  );

  const systemPrompt = await buildSystemPrompt(state, config);
  const filePaths = filesNeedingWork.map((f) => f.path).join(", ");

  await createCodingAgent(
    { websiteId: state.websiteId, jwt: state.jwt, isCreateFlow: false },
    {
      messages: [new HumanMessage(`Add L10.createLead() tracking to these files: ${filePaths}`)],
      systemPrompt,
      route: "full",
      config,
    }
  );

  getLogger().info({ fileCount: filesNeedingWork.length }, "Instrumented files");
  return "FIXED";
}

/**
 * Analytics Task Runner
 *
 * Adds L10.createLead() tracking to landing page components that capture emails.
 * Uses the full coding agent to read, edit, and verify multiple files.
 */
export const analyticsTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    // Ready after page optimization for LLMs is done
    return isTaskDone(state, "OptimizingPageForLLMs");
  },

  shouldSkip: (state: DeployGraphState) => {
    return !Deploy.shouldDeployWebsite(state);
  },

  run: async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

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
      const result = await instrumentAnalytics(state, config);
      getLogger().info({ result }, "Analytics task completed");

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
      getLogger().error({ err: error }, "Analytics task failed");

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

registerTask(analyticsTaskRunner);

export const analyticsNode = NodeMiddleware.use({}, analyticsTaskRunner.run);
export const shouldSkipAnalytics = analyticsTaskRunner.shouldSkip;
