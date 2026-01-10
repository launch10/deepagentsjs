import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createChecklistTask, findChecklistTask, updateChecklistTask } from "@types";

const TASK_NAME = "instrumentation" as const;

/**
 * Instrumentation Node
 *
 * Pre-deploy instrumentation using hybrid LLM + deterministic approach:
 * 1. LLM semantic analysis: identify primary conversion form
 * 2. Deterministic injection: add L10.conversion() calls, gtag.js, etc.
 *
 * TODO: Full implementation with LLM analysis and file modification
 * For now, this is a stub that marks instrumentation as complete.
 */
export const instrumentationNode = NodeMiddleware.use(
  {},
  async (
    state: DeployGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const existingTask = findChecklistTask(state.tasks, TASK_NAME);

    // Already completed? No-op (idempotent)
    if (existingTask?.status === "completed") {
      return {};
    }

    // Already failed? Allow retry
    if (existingTask?.status === "failed") {
      // On retry, reset and try again
    }

    if (!state.websiteId) {
      return {
        tasks: [
          ...state.tasks,
          { ...createChecklistTask(TASK_NAME), status: "failed", error: "Missing websiteId" },
        ],
      };
    }

    // TODO: Implement full instrumentation logic
    // 1. Load website files using WebsiteFilesBackend
    // 2. Use LLM to identify primary conversion form
    // 3. Inject L10.conversion() call on form submission
    // 4. Inject gtag.js script into index.html
    // 5. Inject L10_CONFIG with googleAdsId

    // For now, mark as complete (stub)
    const task = createChecklistTask(TASK_NAME);
    return {
      tasks: [
        ...state.tasks.filter((t) => t.name !== TASK_NAME),
        {
          ...task,
          status: "completed",
          result: {
            instrumentedFiles: [],
            conversionsAdded: [],
            note: "Instrumentation stub - full implementation pending",
          },
        },
      ],
    };
  }
);
