import { NodeMiddleware } from "@core";
import { type BrainstormGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@core";
import { isHumanMessage, isAIMessage } from "@types";
import { chatHistoryPrompt } from "@prompts";

export const keepBrainstormingNode = NodeMiddleware.use(
  async (
    state: BrainstormGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<BrainstormGraphState>> => {
    const lastHumanMessage: HumanMessage = state.messages?.filter(isHumanMessage).slice(-1);
    const lastAIMessage: AIMessage = state.messages?.filter(isAIMessage).slice(-1);

    const [chatHistory] = await Promise.all([
        chatHistoryPrompt({ messages: state.messages }),
    ]);

    const llm = getLLM("writing", "slow");
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
);