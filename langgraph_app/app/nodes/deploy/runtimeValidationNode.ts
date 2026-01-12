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
    const task = Task.findTask(state.tasks, TASK_NAME);

    // Already completed or failed? No-op (idempotent)
    if (task?.status !== "running") {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("WebsiteId is required for runtime validation");
    }

    try {
      // Use await using for proper cleanup (AsyncDisposable)
      await using exporter = new ErrorExporter(state.websiteId);
      const errors = await exporter.run();

      // Use hasErrors with excludeWarnings to only fail on actual errors
      const passed = !errors.hasErrors({ excludeWarnings: true });

      return {
        tasks: [
          {
            ...task,
            status: passed ? "completed" : "failed",
            result: {
              browserErrorCount: errors.browser.filter(e => e.type === "error").length,
              serverErrorCount: errors.server.length,
              viteOverlayErrorCount: errors.viteOverlay.length,
              report: errors.getFormattedReport()
            },
            error: passed ? undefined : errors.getFormattedReport(),
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
