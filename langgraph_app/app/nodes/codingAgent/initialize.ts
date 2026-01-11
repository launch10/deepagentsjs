import type { CodingAgentGraphState } from "@annotation";
import {
  db,
  brainstorms,
  uploads,
  websiteUploads,
  eq,
} from "@db";
import type { Brainstorm } from "@types";

/**
 * Initialize coding agent state.
 * Note: Theme is seeded at the agent utils layer via ThemeAPIService,
 * so we only need to fetch brainstorm and images here.
 */
export async function initializeCodingAgent(
  state: CodingAgentGraphState,
): Promise<Partial<CodingAgentGraphState>> {
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
}
