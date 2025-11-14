import { NodeMiddleware } from "@middleware";
import type { BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { isHumanMessage } from "@types";
import { Brainstorm } from "@types";

const expectedTools = {
    "skip": "skipTool",
    "doTheRest": "doTheRestTool",
    "finished": "finishedTool",
}

const getCommand = (state: BrainstormGraphState): Brainstorm.ActionType | undefined => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found")
    }
    const userCommands: Record<string, Brainstorm.ActionType> = {
        "Skip": "skip",
        "Please do the rest for me": "doTheRest",
        "Help me": "helpMe",
        "I'm finished": "finished",
    }
    const userCommand = (lastHumanMessage.content as string) in userCommands ? userCommands[lastHumanMessage.content as keyof typeof userCommands] : undefined;

    if (!userCommand) {
        return undefined;
    }

    const expectedToolName = expectedTools[userCommand as keyof typeof expectedTools];
    const alreadyExecutedTool = state.messages.slice(-state.messages.indexOf(lastHumanMessage)).some((message) => {
        return message.name === expectedToolName
    })
    if (alreadyExecutedTool) {
        console.log(`we already executed and the currentTopic is ${state.currentTopic}`)
        console.log(state.skippedTopics)
        return undefined;
    }

    return userCommand
}

const skip = (state: BrainstormGraphState): Partial<BrainstormGraphState> => {
    return {
        currentTopic: Brainstorm.BrainstormTopics.at(
            Brainstorm.BrainstormTopics.indexOf(state.currentTopic) + 1
        ),
        skippedTopics: [...(state.skippedTopics || []), state.currentTopic],
    };
}

export const handleCommand = NodeMiddleware.use({}, async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    const command = getCommand(state);
    if (command === "skip") {
        return skip(state);
    }
    return state;
  });