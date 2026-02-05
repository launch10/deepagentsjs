import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Deploy, Task } from "@types";
import { createLightEditAgent, getCodingAgentBackend } from "@nodes";
import type { WebsiteFilesBackend } from "@services";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";
import { db, websiteFiles, eq, and, like } from "@db";
import { trackingPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";

const TASK_NAME = "AddingAnalytics" as const;

/**
 * Build the instrumentation prompt using the shared tracking context
 */
const buildInstrumentationPrompt = async (
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<string> => {
  const trackingContext = await trackingPrompt(
    { websiteId: state.websiteId, jwt: state.jwt, isFirstMessage: false },
    config
  );

  return `You are a code instrumentation specialist. Your job is to add L10.createLead() tracking to a React component.

${trackingContext}

## Your Task

1. Read the file at the path provided
2. Find form submission handlers or button click handlers that capture email
3. Add L10.createLead() call when the email is captured following the patterns above
4. Save the file with your changes

## Rules

- Only add L10.createLead() - don't change anything else
- Follow the import and usage patterns from the tracking context above
- If the component doesn't actually capture emails, leave it unchanged

Reply DONE when finished.
`;
};

interface FileToInstrument {
  path: string;
  content: string;
}

/**
 * Check if a file needs L10 instrumentation
 * Returns true if file has email capture but no L10.createLead
 */
function needsInstrumentation(content: string): boolean {
  const hasEmailInput =
    content.includes('type="email"') ||
    content.includes("type='email'") ||
    content.includes('type={"email"}') ||
    content.includes("type={'email'}");

  const hasEmailState = /setEmail\s*\(/i.test(content);
  const hasEmailCapture = hasEmailInput || hasEmailState;
  const hasL10 = content.includes("L10.createLead");

  return hasEmailCapture && !hasL10;
}

/**
 * Instrument a single file using a coding agent
 */
async function instrumentFile(
  state: DeployGraphState,
  file: FileToInstrument,
  backend: WebsiteFilesBackend,
  config?: LangGraphRunnableConfig
): Promise<void> {
  const prompt = await buildInstrumentationPrompt(state, config);
  const agent = await createLightEditAgent(
    { ...state, isFirstMessage: false },
    { backend, systemPrompt: prompt }
  );

  // Generate a unique thread_id for this agent invocation
  const threadId = `analytics-${state.websiteId}-${file.path.replace(/\//g, "-")}-${Date.now()}`;

  await agent.invoke(
    {
      messages: [
        {
          role: "user",
          content: `Instrument this file with L10.createLead(): ${file.path}`,
        },
      ],
    },
    {
      recursionLimit: 75,
      configurable: {
        thread_id: threadId,
      },
    }
  );
}

/**
 * Direct analytics instrumentation - parallel agents, each handling one file
 */
async function instrumentAnalytics(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
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
    console.log("[Analytics] All files already instrumented or no email forms found");
    return "CONFIRMED";
  }

  console.log(
    `[Analytics] Found ${filesNeedingWork.length} files needing instrumentation:`,
    filesNeedingWork.map((f) => f.path)
  );

  // Create backend once and share it with all agents
  const backend = await getCodingAgentBackend({
    websiteId: state.websiteId,
    jwt: state.jwt,
  });

  // Instrument all files in parallel - each agent shares the same backend
  await Promise.all(
    filesNeedingWork.map((file) => instrumentFile(state, file, backend, config))
  );

  console.log(`[Analytics] Instrumented ${filesNeedingWork.length} files`);
  return "FIXED";
}

/**
 * Analytics Task Runner
 *
 * Validates that landing pages use L10.createLead() for lead capture.
 * Uses parallel coding agents for speed - each agent handles one file.
 */
export const analyticsTaskRunner: TaskRunner = {
  taskName: TASK_NAME,

  readyToRun: (state: DeployGraphState) => {
    if (!Deploy.shouldDeployGoogleAds(state)) {
      return true;
    }
    return isTaskDone(state, "VerifyingGoogle");
  },

  shouldSkip: (state: DeployGraphState) => {
    return !state.deploy?.website;
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
      console.log(`[Analytics] Task completed with result: ${result}`);

      return {
        tasks: [
          {
            ...task,
            status: "completed",
          } as Task.Task,
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[Analytics] Task failed:`, errorMessage);

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
