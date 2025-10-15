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
    const service = new BrainstormGuardrailService();

    const result: BrainstormGuardrailOutput = await service.execute({
      messages: state.messages,
      questionIndex: state.questionIndex,
    }, config);

    return {
      userNeedsHelp: result.userNeedsHelp,
      messages: state.messages
    };
  }
}

export const brainstormGuardrailNode = new BrainstormGuardrailNode().toNodeFunction();
