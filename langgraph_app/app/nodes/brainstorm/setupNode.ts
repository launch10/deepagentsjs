import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { Brainstorm, isAIMessage, type Message } from "@types";
import { AIMessage } from "@langchain/core/messages";

/**
 * Ensure implicit first question is in state
 */
class SetupNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const anyAIMessage = state.messages?.some((msg) => isAIMessage(msg));
    if (anyAIMessage) {
      return {};
    }
    if (!state.messages) {
      state.messages = [];
    }
    const question: AIMessage = Brainstorm.getFirstQuestion();
    const newMessages: Message[] = [
      question,
      ...state.messages,
    ];
    return {
        messages: newMessages
    }
  }
}

// Export as a function for use in the graph
export const setupNode = new SetupNode().toNodeFunction();
