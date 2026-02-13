import { NodeMiddleware } from "@middleware";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";

export const skipTopic = NodeMiddleware.use(
  {},
  async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    const updates = await new BrainstormNextStepsService(state).nextSteps();
    const updatedState = {
      ...state,
      ...updates,
    };

    if (!updatedState.currentTopic) {
      throw new Error("No current topic found");
    }

    return {
      currentTopic: Brainstorm.BrainstormTopics.at(
        Brainstorm.BrainstormTopics.indexOf(updatedState.currentTopic) + 1
      ),
      skippedTopics: [...(updatedState.skippedTopics || []), updatedState.currentTopic],
    };
  }
);
