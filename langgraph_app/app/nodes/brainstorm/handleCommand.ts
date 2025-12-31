import { NodeMiddleware } from "@middleware";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { isHumanMessage, getMessageText } from "@types";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";
import { BaseMessage } from "@langchain/core/messages";

const getCommand = async (state: BrainstormGraphState): Promise<Brainstorm.Command | undefined> => {
  const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
  const messageText = getMessageText(lastHumanMessage);

  if (!Brainstorm.promptIsCommand(messageText)) return undefined;

  const command = Brainstorm.promptToCommand(messageText) as Brainstorm.Command;

  if (!state.availableCommands.includes(command.name)) {
    return undefined;
  }

  return command;
};

const skip = (state: BrainstormGraphState): Partial<BrainstormGraphState> => {
  if (!state.currentTopic) {
    throw new Error("No current topic found");
  }
  return {
    currentTopic: Brainstorm.BrainstormTopics.at(
      Brainstorm.BrainstormTopics.indexOf(state.currentTopic) + 1
    ),
    skippedTopics: [...(state.skippedTopics || []), state.currentTopic],
  };
};

export const handleCommand = NodeMiddleware.use(
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

    const command = await getCommand(updatedState);
    if (!command) return updatedState;

    if (command.name === "skip") {
      return skip(updatedState as BrainstormGraphState);
    }

    return {
      command: command.name,
    };
  }
);
