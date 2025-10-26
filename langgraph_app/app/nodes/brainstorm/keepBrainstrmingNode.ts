import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { isHumanMessage, isAIMessage, Brainstorm } from "@types";
import { chatHistoryPrompt } from "@prompts";

class KeepBrainstormingNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const lastHumanMessage: HumanMessage = state.messages?.filter(isHumanMessage).slice(-1);
    const lastAIMessage: AIMessage = state.messages?.filter(isAIMessage).slice(-1);

    const [chatHistory] = await Promise.all([
        chatHistoryPrompt({ state.messages }),
    ]);

    const llm = getLlm(LLMSkill.Writing, LLMSpeed.Slow);
    const response = await llm.invoke(`
        <background>
            The user wants to create a website for their business. 
        </background>

        <role>
            You are the brainstorming agent. Your job is to help the user brainstorm 
            copy for a high-converting landing page for their business.
        </role>

        <task>
            The user has already brainstormed a complete landing page. Continue brainstorming with them,
            and remind them that they can proceed to building the landing page at any time.
        </task>

        ${chatHistory}
    `);

    return {
        messages: [
            ...state.messages,
            new AIMessage(response)
        ]
    }
  }
}

export const keepBrainstormingNode = new KeepBrainstormingNode().toNodeFunction();