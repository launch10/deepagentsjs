import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { ErrorExporter } from "@services";
import { Task } from "@types";

const TASK_NAME = "RuntimeValidation" as const;

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
    const existingTask = Task.findTask(state.tasks, TASK_NAME);

    // Already completed or failed? No-op (idempotent)
    if (existingTask) {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("WebsiteId is required for runtime validation");
    }

    // Create task with running status
    const task = Task.createTask(TASK_NAME);

    try {
      // Use await using for proper cleanup (AsyncDisposable)
      await using exporter = new ErrorExporter(state.websiteId);
      const errors = await exporter.run();

      const passed = errors.length === 0;

      return {
        tasks: [
          {
            ...task,
            status: passed ? "completed" : "failed",
            result: { errorCount: errors.length },
            error: passed ? undefined : `Found ${errors.length} console error(s)`,
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        tasks: [
          {
            ...task,
            status: "failed",
            error: errorMessage
          }
        ]
      };
    }
  }
);
