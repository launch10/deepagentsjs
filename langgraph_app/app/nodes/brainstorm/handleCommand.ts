import { NodeMiddleware } from "@middleware";
import type { BrainstormGraphState, CoreGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { isHumanMessage } from "@types";
import { Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";
import { BaseMessage } from "@langchain/core/messages";

// TODO: Make it clean like this
interface ICommand<TGraphState extends CoreGraphState> {
    command: Brainstorm.CommandType;
    humanMessage: string;
    action: (state: TGraphState) => Partial<TGraphState>;
}
class Command<TGraphState extends CoreGraphState> implements ICommand<TGraphState> {
    command: Brainstorm.CommandType;
    humanMessage: string;
    action: (state: TGraphState) => Partial<TGraphState>;

    constructor(command: ICommand<TGraphState>) {
        this.command = command.command;
        this.humanMessage = command.humanMessage;
        this.action = command.action;
    }
    
    messageIsCommand(message: BaseMessage): boolean {
        return message.content === this.humanMessage;
    }
}

// Skip executes a tool, the rest 
const getCommand = async (state: BrainstormGraphState): Promise<Brainstorm.CommandType | undefined> => {
    const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
    if (!lastHumanMessage) {
        throw new Error("No human message found")
    }
    const userCommands: Record<string, Brainstorm.CommandType> = {
        "Skip": "skip",
        "Please do the rest for me": "doTheRest",
        "Help me answer this question": "helpMe",
        "I'm finished": "finished",
    }
    const userCommand = (lastHumanMessage.content as string) in userCommands ? userCommands[lastHumanMessage.content as keyof typeof userCommands] : undefined;

    if (!userCommand) {
        return undefined;
    }

    if (!state.availableCommands.includes(userCommand)) {
        return undefined;
    }

    return userCommand
}

const skip = (state: BrainstormGraphState): Partial<BrainstormGraphState> => {
    if (!state.currentTopic) {
        throw new Error("No current topic found")
    }
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
    const updates = await new BrainstormNextStepsService(state).nextSteps();
    const updatedState = {
        ...state,
        ...updates,
    }

    const command = await getCommand(updatedState);
    if (!command) return updatedState;

    if (command === "skip") {
        return skip(updatedState as BrainstormGraphState);
    }

    return {
        command,
    }
});