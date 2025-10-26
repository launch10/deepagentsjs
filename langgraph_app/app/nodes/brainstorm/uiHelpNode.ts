import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { isHumanMessage, isAIMessage, Brainstorm } from "@types";

class UIHelpNode extends BaseNode<BrainstormGraphState> {
  async execute(
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> {
    const lastHumanMessage: HumanMessage = state.messages?.filter(isHumanMessage).slice(-1);
    const lastAIMessage: AIMessage = state.messages?.filter(isAIMessage).slice(-1);

    const llm = getLlm(LLMSkill.Writing, LLMSpeed.Slow);
    const response = await llm.invoke(`
        <background>
            You and the user have been having a conversation about a landing page they want to build.

            The user has finished all Q&A steps, and has now indicated that they want to do something UI related (uploading a logo, color palette, or image)
        </background>

        <role>
            You are the UI explainer agent.
        </role>
        
        <task>
            Analyze what the user wants to do and explain to them that they can find what they're looking for in the Advanced sidebar. Also explain that they could simply proceed with building the landing page.
        </task>
        
        <question>
            ${lastAIMessage.content}
        </question>

        <answer>
            ${lastHumanMessage.content}
        </answer>
    `);

    return {
        messages: [
            ...state.messages,
            new AIMessage(response)
        ]
    }
  }
}

export const uiHelpNode = new UIHelpNode().toNodeFunction();