import { NodeMiddleware } from "@middleware";
import { db, codeFiles, eq, and } from "@db";
import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { WebsiteAPIService } from "@rails_api";
import { Website, isChangeThemeIntent } from "@types";

/**
 * Path to the CSS file that contains theme variables.
 * Rails updates this file when theme_id changes (via ThemeCssInjection concern).
 */
const INDEX_CSS_PATH = "src/index.css";

/**
 * Handles the change_theme intent.
 *
 * 1. Updates the website's theme via Rails API
 * 2. Rails regenerates index.css with new theme colors (after_save callback)
 * 3. Fetches only the updated index.css from database
 * 4. Returns the single updated file to frontend
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

    // Validate we have a change_theme intent
    if (!intent || !isChangeThemeIntent(intent)) {
      throw new Error("themeHandler called without change_theme intent");
    }

    if (!websiteId) {
      throw new Error("websiteId is required for theme change");
    }

    if (!jwt) {
      throw new Error("jwt is required for theme change");
    }

    const { themeId } = intent.payload;

    // 1. Update website theme via Rails API
    // Rails after_save callback (ThemeCssInjection) updates src/index.css
    const websiteAPI = new WebsiteAPIService({ jwt });
    await websiteAPI.update(websiteId, { theme_id: themeId });

    // 2. Fetch only the updated index.css file
    const [indexCssFile] = await db
      .select()
      .from(codeFiles)
      .where(and(eq(codeFiles.websiteId, websiteId), eq(codeFiles.path, INDEX_CSS_PATH)))
      .limit(1);

    // 3. Build files map with just the updated CSS
    const files: Website.FileMap = state.files;
    if (indexCssFile) {
      files[INDEX_CSS_PATH] = {
        content: indexCssFile.content!,
        created_at: indexCssFile.createdAt!,
        modified_at: indexCssFile.updatedAt!,
      };
    }

    // 4. Return updated state - frontend merges this with existing files
    // themeId is streamed to frontend so the theme picker stays in sync
    return {
      files,
      themeId,
      status: "completed",
    };
  }
);
