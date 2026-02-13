/**
 * afterAgent — runs after the coding agent (or any intent subgraph) finishes.
 *
 * Combines three cleanup concerns:
 * 1. cleanupFilesystem — removes temp files from the coding agent backend
 * 2. syncWebsiteChanges — reloads files + themeId from DB so streamed state is fresh
 * 3. todos: [] — clears stale todos so they don't persist into the next interaction
 */
import { NodeMiddleware } from "@middleware";
import { db, codeFiles, websites, eq } from "@db";
import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getCodingAgentBackend, type MinimalCodingAgentState } from "@nodes";
import { Website } from "@types";

export const afterAgentNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    // 1. Cleanup filesystem (best-effort — don't fail the graph if backend is missing)
    try {
      const backend = await getCodingAgentBackend(state as unknown as MinimalCodingAgentState);
      await backend.cleanup();
    } catch {
      // No coding agent backend to clean up (e.g. theme change) — that's fine
    }

    // 2. Sync website changes from DB
    if (!state.websiteId) {
      return { todos: [] };
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
      // 3. Clear todos for next interaction
      todos: [],
    };
  }
);
