import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { AskQuestionService, type AskQuestionOutput } from "@services";
import { AIMessage } from "@langchain/core/messages";

/**
 * Node that asks a question to the user during brainstorming mode
 */
class AskQuestionNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const service = new AskQuestionService();

    const result: AskQuestionOutput = await service.execute({
      messages: state.messages,
      questionIndex: state.questionIndex,
    }, config)

    const messageContent = typeof result.question === 'string' 
      ? result.question 
      : result.question.question;

    const messages = [...state.messages];
    
    if (state.questionIndex === 0) {
      messages.unshift(new AIMessage("Tell us about your business. More info -> better outcomes."));
    }
    
    messages.push(new AIMessage(messageContent));

    const nextQuestionIndex = state.questionIndex === 0 ? 2 : state.questionIndex + 1;

    return {
      nextQuestion: result.question,
      questionIndex: nextQuestionIndex,
      messages
    };
  }
}

// Export as a function for use in the graph
export const askQuestionNode = new AskQuestionNode().toNodeFunction();
