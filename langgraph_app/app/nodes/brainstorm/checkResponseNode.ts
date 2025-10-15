import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { CheckResponseService, type CheckResponseOutput } from "@services";
import { AIMessage } from "@langchain/core/messages";

class CheckResponseNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const messages = [...state.messages];
    
    if (state.questionIndex === 0) {
      messages.unshift(new AIMessage("Tell us about your business. More info -> better outcomes."));
    }

    const service = new CheckResponseService();

    const result: CheckResponseOutput = await service.execute({
      messages,
      questionIndex: state.questionIndex,
    }, config);

    return {
      useHelpfulVariant: result.useHelpfulVariant,
      messages
    };
  }
}

export const checkResponseNode = new CheckResponseNode().toNodeFunction();
