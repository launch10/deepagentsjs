import { NodeMiddleware } from "@middleware";
import { db, codeFiles, eq } from "@db";
import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Website } from "@types"

export const syncFilesNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId) {
      return {};
    }

    const generatedFiles = await db
        .select()
        .from(codeFiles)
        .where(eq(codeFiles.websiteId, state.websiteId!));

     return {
        files: generatedFiles.reduce((acc, file) => {
            acc[file.path!] = { content: file.content!, created_at: file.createdAt!, modified_at: file.updatedAt! };
            return acc;
        }, {} as Website.FileMap)
     }
  }
);