import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { HumanMessage } from "@langchain/core/messages";
import { db, codeFiles, eq } from "@db";
import { validateLinks } from "@utils";

const MAX_VALIDATION_RETRIES = 2;

export const validateLinksNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId) {
      return { status: "completed" };
    }

    // Fetch files from database (websiteId is number, matches bigint column)
    const rawFiles = await db
      .select({ path: codeFiles.path, content: codeFiles.content })
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, state.websiteId));

    // Filter out files with null path or content
    const files = rawFiles.filter(
      (f): f is { path: string; content: string } => f.path !== null && f.content !== null
    );

    const errors = validateLinks(files);

    if (errors.length === 0) {
      return { status: "completed" };
    }

    // Check retry limit
    if (state.errorRetries >= MAX_VALIDATION_RETRIES) {
      return { status: "completed" };
    }

    // Format errors and retry
    const errorList = errors.map((e) => `- ${e.file}: ${e.message}`).join("\n");

    return {
      errorRetries: state.errorRetries + 1,
      messages: [
        new HumanMessage(
          `Validation failed:\n${errorList}\n\nFix these issues. For real sections with missing IDs, add the id attribute. For invented sections or pages that were never part of the plan (e.g. careers, blog, privacy, terms), remove the link instead of creating fake content.`
        ),
      ],
    };
  }
);
