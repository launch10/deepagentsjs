import type { AdsGraphState } from "@state";
import {
  websites as websitesTable,
  projects as projectsTable,
  brainstorms as brainstormsTable,
  db,
  eq,
} from "@db";
import { Brainstorm } from "@types";
import { NodeMiddleware } from "@middleware";

export const getBusinessContext = NodeMiddleware.use({}, async (state: AdsGraphState) => {
  if (state.websiteId) {
    return {};
  }

  if (!state.projectUUID) {
    throw new Error("Project UUID is required");
  }

  const result = await db
    .select({ websiteId: websitesTable.id })
    .from(projectsTable)
    .innerJoin(websitesTable, eq(projectsTable.id, websitesTable.projectId))
    .where(eq(projectsTable.uuid, state.projectUUID))
    .limit(1);

  if (result.length === 0) {
    throw new Error("Website not found for this project");
  }

  const brainstorms = await db
    .select()
    .from(brainstormsTable)
    .where(eq(brainstormsTable.websiteId, result[0]!.websiteId))
    .orderBy(brainstormsTable.id);

  if (!brainstorms || brainstorms.length === 0) {
    throw new Error("No brainstorm found for this website");
  }

  return {
    websiteId: result[0]!.websiteId,
    brainstorm: Brainstorm.MemoriesSchema.passthrough().parse(brainstorms[0]),
  };
});
