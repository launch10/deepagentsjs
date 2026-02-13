import { type DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { db, codeFiles, eq } from "@db";
import { Deploy, Task } from "@types";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";
import { validateLinks } from "@utils";

const TASK_NAME: Deploy.TaskName = "ValidateLinks";

// Re-export for backwards compatibility with tests
export {
  validateLinks,
  getLinkType,
  collectAnchors,
  parseRoutes,
  type ValidationError,
  type LinkType,
} from "@utils";

/**
 * Validate Links - Raw Function (Deploy Graph)
 *
 * Static analysis of links before runtime validation.
 * Checks anchor hrefs against element IDs and route hrefs against App.tsx routes.
 */
async function runValidateLinks(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const task = Task.findTask(state.tasks, TASK_NAME);

  if (task?.status !== "running") {
    return {};
  }

  if (!state.websiteId) {
    return {
      tasks: [{ ...task, status: "completed" }],
    };
  }

  const rawFiles = await db
    .select({ path: codeFiles.path, content: codeFiles.content })
    .from(codeFiles)
    .where(eq(codeFiles.websiteId, state.websiteId));

  const files = rawFiles.filter(
    (f): f is { path: string; content: string } => f.path !== null && f.content !== null
  );

  const errors = validateLinks(files);

  if (errors.length === 0) {
    return {
      tasks: [{ ...task, status: "completed" }],
    };
  }

  const errorList = errors.map((e) => `- ${e.file}: ${e.message}`).join("\n");

  return {
    tasks: [
      {
        ...task,
        status: "failed",
        error: `Link validation failed:\n${errorList}`,
      },
    ],
  };
}

// Legacy export with middleware
export const validateLinksNode = NodeMiddleware.use({}, runValidateLinks);

/**
 * Validate Links Task Runner
 *
 * Static analysis of links before runtime validation.
 */
export const validateLinksTaskRunner: TaskRunner = {
  taskName: TASK_NAME,
  isFailureRecoverable: true,

  readyToRun: (state: DeployGraphState) => {
    // For campaign deploys, wait until Google setup + billing is resolved
    if (Deploy.shouldDeployGoogleAds(state)) {
      return isTaskDone(state, "CheckingBilling");
    }
    // For website-only deploys, ready immediately
    return true;
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying a website
    if (!state.deploy?.website) {
      return true;
    }

    // Skip if already completed
    const task = Task.findTask(state.tasks, TASK_NAME);
    return task?.status === "completed";
  },

  run: runValidateLinks,
};

// Register this task runner
registerTask(validateLinksTaskRunner);
