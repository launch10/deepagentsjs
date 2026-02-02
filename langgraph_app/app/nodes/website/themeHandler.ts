import { NodeMiddleware } from "@middleware";
import { db, codeFiles, eq } from "@db";
import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { WebsiteAPIService } from "@rails_api";
import { Website, isChangeThemeIntent } from "@types";

/**
 * Handles the change-theme intent.
 *
 * 1. Updates the website's theme via Rails API
 * 2. Rails regenerates index.css with new theme colors
 * 3. Fetches updated files from database
 * 4. Clears intent and returns files to frontend
 *
 * This is a "silent" action - no AI messages are generated.
 */
export const themeHandler = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    const { intent, websiteId, jwt } = state;

    // Validate we have a change-theme intent
    if (!intent || !isChangeThemeIntent(intent)) {
      throw new Error("themeHandler called without change-theme intent");
    }

    if (!websiteId) {
      throw new Error("websiteId is required for theme change");
    }

    if (!jwt) {
      throw new Error("jwt is required for theme change");
    }

    const { themeId } = intent.payload;

    // 1. Update website theme via Rails API
    const websiteAPI = new WebsiteAPIService({ jwt });
    await websiteAPI.update(websiteId, { theme_id: themeId });

    // 2. Fetch updated files from database (same as syncFilesNode)
    const generatedFiles = await db
      .select()
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, websiteId));

    const files = generatedFiles.reduce((acc, file) => {
      acc[file.path!] = {
        content: file.content!,
        created_at: file.createdAt!,
        modified_at: file.updatedAt!,
      };
      return acc;
    }, {} as Website.FileMap);

    // 3. Return updated state with cleared intent
    return {
      intent: undefined, // Clear intent after handling
      files,
      status: "completed",
    };
  }
);
