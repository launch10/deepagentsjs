import { NodeMiddleware } from "@core";
import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm, isAIMessage, type Message } from "@types";
import { AIMessage } from "@langchain/core/messages";

/**
 * Ensure implicit first question is in state
 */
export const setupNode = NodeMiddleware.use(
  async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
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