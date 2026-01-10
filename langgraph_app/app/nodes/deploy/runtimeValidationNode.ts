import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { ErrorExporter } from "@services";
import { createChecklistTask, findChecklistTask, updateChecklistTask } from "@types";

const TASK_NAME = "runtime_validation" as const;

/**
 * Runtime Validation Node
 *
 * Uses Playwright to validate the website before deployment:
 * 1. Starts dev server using WebsiteRunner
 * 2. Loads page in browser context from pool
 * 3. Captures console errors
 * 4. Returns validation status
 */
export const runtimeValidationNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const existingTask = findChecklistTask(state.tasks, TASK_NAME);

    // Already completed or failed? No-op (idempotent)
    if (existingTask?.status === "completed" || existingTask?.status === "failed") {
      return {};
    }

    if (!state.websiteId) {
      return {
        validationPassed: false,
        tasks: [
          ...state.tasks,
          { ...createChecklistTask(TASK_NAME), status: "failed", error: "Missing websiteId" },
        ],
      };
    }

    // Create task with running status
    const task = createChecklistTask(TASK_NAME);
    const tasksWithRunning = [...state.tasks, { ...task, status: "running" as const }];

    try {
      // Use await using for proper cleanup (AsyncDisposable)
      await using exporter = new ErrorExporter(state.websiteId);
      const errors = await exporter.run();

      const passed = errors.length === 0;

      return {
        validationPassed: passed,
        consoleErrors: errors,
        tasks: updateChecklistTask(tasksWithRunning, TASK_NAME, {
          status: passed ? "completed" : "failed",
          result: { errorCount: errors.length },
          error: passed ? undefined : `Found ${errors.length} console error(s)`,
        }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        validationPassed: false,
        tasks: updateChecklistTask(tasksWithRunning, TASK_NAME, {
          status: "failed",
          error: errorMessage,
        }),
      };
    }
  }
);
