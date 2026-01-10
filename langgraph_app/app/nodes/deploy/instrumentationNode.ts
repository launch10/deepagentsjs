import type { DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { Task } from "@types";
import { db, codeFiles, eq } from "@db";

const TASK_NAME = "Instrumentation" as const;

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
    _config?: LangGraphRunnableConfig
  ): Promise<Partial<DeployGraphState>> => {
    const task = Task.findTask(state.tasks, TASK_NAME);

    if (task?.status === "completed") {
      return {};
    }

    if (!state.websiteId) {
      throw new Error("Missing websiteId");
    }

    try {
      const files = await db
        .select({ path: codeFiles.path, content: codeFiles.content })
        .from(codeFiles)
        .where(eq(codeFiles.websiteId, state.websiteId));

      const codeFilesList = files.filter(
        (f): f is { path: string; content: string } =>
          f.path !== null &&
          f.content !== null &&
          (f.path.endsWith(".tsx") || f.path.endsWith(".ts") || f.path.endsWith(".jsx"))
      );

      if (codeFilesList.length === 0) {
        return {
          tasks: [
            {
              ...task,
              status: "completed",
            },
          ],
        };
      }

      // Check for L10.createLead usage
      const filesWithCreateLead = codeFilesList.filter((f) => f.content.includes("L10.createLead"));
      const filesWithImport = codeFilesList.filter((f) =>
        f.content.includes("from '@/lib/tracking'")
      );
      const isCompliant = filesWithCreateLead.length > 0 || filesWithImport.length > 0;

      return {
        tasks: [
          {
            ...task,
            status: isCompliant ? "completed" : "failed",
          },
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
          },
        ],
      };
    }
  }
);
