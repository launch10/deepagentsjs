import { NodeMiddleware } from "@middleware";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { isHumanMessage, Brainstorm } from "@types";
import { db, brainstorms as brainstormsTable } from "@db";
import { withTimestamps, withUpdatedAt } from "@db";

export const saveAnswersNode = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  if (!state.currentTopic) {
    throw new Error("saveAnswersNode called without currentTopic");
  }

  if (!state.websiteId) {
    throw new Error("saveAnswersNode called without websiteId");
  }

  const lastUserMessage = state.messages.filter(isHumanMessage).at(-1);
  if (!lastUserMessage) {
    throw new Error("saveAnswersNode called without user message");
  }

  try {
    const updates: Partial<Brainstorm.MemoriesType> = {
      [state.currentTopic]: lastUserMessage.content as string,
    };

    const insert = withTimestamps(updates);
    const update = withUpdatedAt(updates);

    await db.insert(brainstormsTable).values({
      ...insert,
      websiteId: state.websiteId,
    }).onConflictDoUpdate({
      target: [brainstormsTable.websiteId],
      set: {
        ...update,
      }
    }).returning();

    return {};
  } catch (error) {
    console.error('=== ERROR IN SAVE ANSWERS NODE ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
});
