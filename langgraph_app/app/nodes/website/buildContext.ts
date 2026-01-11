import type { CodingAgentGraphState } from "@annotation";
import {
  db,
  brainstorms,
  uploads,
  websiteUploads,
  eq,
} from "@db";
import type { Brainstorm } from "@types";
import { NodeMiddleware } from "@middleware";

/**
 * Build context for the coding agent on the WebsiteBuilder page.
 * 
 * Note: 
 * - We only need to seed things here that are NOT already seeded at the agent utils layer
 * - For example, theme is needed by EVERY prompt, so it is seeded at the agent utils layer
 * - Brainstorm is fetched here
 * - Images are fetched here
 * - Think about: What does the builder need that deploy/bug fix does not? 
 */
export const buildContext = NodeMiddleware.use({}, async (
  state: CodingAgentGraphState,
): Promise<Partial<CodingAgentGraphState>> => {
  if (!state.websiteId) {
    throw new Error("websiteId is required");
  }

  const [brainstorm] = await db
    .select()
    .from(brainstorms)
    .where(eq(brainstorms.websiteId, state.websiteId))
    .limit(1);

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
    images,
    status: "running",
  };
});
