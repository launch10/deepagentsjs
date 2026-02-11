import { NodeMiddleware } from "@middleware";
import { db, codeFiles, websites, eq } from "@db";
import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Website } from "@types"

export const syncWebsiteChangesNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId) {
      return {};
    }

    const [generatedFiles, [websiteRow]] = await Promise.all([
      db.select().from(codeFiles).where(eq(codeFiles.websiteId, state.websiteId!)),
      db.select({ themeId: websites.themeId }).from(websites).where(eq(websites.id, state.websiteId!)).limit(1),
    ]);

     return {
        files: generatedFiles.reduce((acc, file) => {
            acc[file.path!] = { content: file.content!, created_at: file.createdAt!, modified_at: file.updatedAt! };
            return acc;
        }, {} as Website.FileMap),
        // Stream themeId so the frontend picker stays in sync after coding agent edits
        ...(websiteRow?.themeId ? { themeId: websiteRow.themeId } : {}),
     }
  }
);