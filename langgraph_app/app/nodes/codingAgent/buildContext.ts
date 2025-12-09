import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { CodingAgentGraphState } from "@annotation";
import {
  db,
  websites,
  brainstorms,
  themes,
  uploads,
  websiteUploads,
  eq,
} from "@db";
import type { Brainstorm, Website } from "@types";
import { NodeMiddleware } from "@middleware";

export const buildContext = NodeMiddleware.use({}, async (
  state: CodingAgentGraphState,
): Promise<Partial<CodingAgentGraphState>> => {
  if (!state.websiteId) {
    throw new Error("websiteId is required");
  }

  const [website] = await db
    .select()
    .from(websites)
    .where(eq(websites.id, state.websiteId))
    .limit(1);

  if (!website) {
    throw new Error(`Website ${state.websiteId} not found`);
  }

  const [brainstorm] = await db
    .select()
    .from(brainstorms)
    .where(eq(brainstorms.websiteId, state.websiteId))
    .limit(1);

  let theme: Website.ThemeType | undefined;
  if (website.themeId) {
    const [themeRow] = await db
      .select()
      .from(themes)
      .where(eq(themes.id, website.themeId))
      .limit(1);

    if (themeRow) {
      theme = {
        id: themeRow.id,
        name: themeRow.name,
        colors: (themeRow.colors as string[]) || [],
        theme: (themeRow.theme as Website.Theme.CssThemeType) || {},
      };
    }
  }

  const websiteUploadRows = await db
    .select({
      file: uploads.file,
      isLogo: uploads.isLogo,
    })
    .from(websiteUploads)
    .innerJoin(uploads, eq(websiteUploads.uploadId, uploads.id))
    .where(eq(websiteUploads.websiteId, state.websiteId));

  const images = websiteUploadRows.map((row) => ({
    url: row.file,
    isLogo: row.isLogo,
  }));

  const brainstormContext: Brainstorm.MemoriesType = {
    idea: brainstorm?.idea ?? null,
    audience: brainstorm?.audience ?? null,
    solution: brainstorm?.solution ?? null,
    socialProof: brainstorm?.socialProof ?? null,
  };

  return {
    brainstorm: brainstormContext,
    theme,
    images,
    status: "running",
  };
});
