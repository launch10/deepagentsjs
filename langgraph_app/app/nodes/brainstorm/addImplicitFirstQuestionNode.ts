import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { BRAINSTORMING_QUESTIONS, isAIMessage, type QuestionTemplateType, type Message } from "@types";
import { AIMessage } from "@langchain/core/messages";

/**
 * Ensure implicit first question is in state
 */
class AddImplicitFirstQuestionNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const anyAIMessage = state.messages?.some((msg) => isAIMessage(msg));
    if (anyAIMessage) {
      return {};
    }
    const questionTemplate: QuestionTemplateType = BRAINSTORMING_QUESTIONS[0]!;
    if (!questionTemplate) {
      throw new Error("Question template is required");
    }
    const question = questionTemplate.variants.simple;
    const questionText = question?.question;
    if (!questionText) {
      throw new Error("Question text is required");
    }
    if (!state.messages) {
      state.messages = [];
    }
    const newMessages: Message[] = [
      new AIMessage(questionText),
      ...state.messages,
    ];
    return {
        messages: newMessages
    }
  }
}

// Export as a function for use in the graph
export const addImplicitFirstQuestionNode = new AddImplicitFirstQuestionNode().toNodeFunction();
