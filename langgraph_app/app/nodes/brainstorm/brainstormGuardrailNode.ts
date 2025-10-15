import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { BrainstormGuardrailService, type BrainstormGuardrailOutput } from "@services";
import { AIMessage } from "@langchain/core/messages";

class BrainstormGuardrailNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const messages = [...state.messages];
    
    if (state.questionIndex === 0) {
      messages.unshift(new AIMessage("Tell us about your business. More info -> better outcomes."));
    }

    const service = new BrainstormGuardrailService();

    const result: BrainstormGuardrailOutput = await service.execute({
      messages,
      questionIndex: state.questionIndex,
    }, config);

    return {
      userNeedsHelp: result.userNeedsHelp,
      messages
    };
  }
}

export const brainstormGuardrailNode = new BrainstormGuardrailNode().toNodeFunction();
