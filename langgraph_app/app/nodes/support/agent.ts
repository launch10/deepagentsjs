import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { type SupportGraphState } from "@annotation";
import { createAgent, createMiddleware } from "langchain";
import { type BaseMessage } from "@langchain/core/messages";
import { lastAIMessage } from "@types";
import { SupportBridge } from "@annotation";
import { supportFaqTool } from "@tools";

const SUPPORT_SYSTEM_PROMPT = `You are a helpful Launch10 support assistant. Your job is to answer user questions about Launch10, a platform that helps users test their business ideas through landing pages and Google Ads campaigns.

You have access to a FAQ tool that searches the knowledge base. Use it whenever the user asks a question about how Launch10 works, billing, credits, landing pages, Google Ads, or their account.

Guidelines:
- Use the FAQ tool to look up answers before responding to questions.
- If the FAQ tool returns relevant results, use them to provide an accurate answer.
- If the FAQ tool returns no results or the question isn't covered, let the user know and suggest they submit a support request using the "Contact Support" tab.
- Keep responses focused and avoid lengthy preambles.
- Use markdown formatting for readability (bullet points, bold for emphasis).
- Do not make up information that isn't in the FAQs.`;

/**
 * Creates middleware that sets the support system prompt.
 */
const createSupportMiddleware = () => {
  return createMiddleware({
    name: "SupportMiddleware",
    wrapModelCall: async (request, handler) => {
      return await handler({
        ...request,
        systemPrompt: SUPPORT_SYSTEM_PROMPT,
      });
    },
  });
};

/**
 * Support agent node that handles user questions using an FAQ tool.
 */
export const supportAgent = NodeMiddleware.use(
  {},
  async (
    state: SupportGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<SupportGraphState>> => {
    const llm = (await getLLM({ speed: "fast" })).withConfig({ tags: ["notify"] });

    const agent = await createAgent({
      model: llm,
      tools: [supportFaqTool],
      middleware: [createSupportMiddleware()],
    });

    const result = (await agent.invoke(
      {
        ...state,
        messages: state.messages || [],
      } as any,
      config
    )) as SupportGraphState;

    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
      throw new Error("Support agent did not return an AI message");
    }

    const [message] = await SupportBridge.toStructuredMessage(lastMessage);

    // Build messages: original + new agent messages
    const resultMessages = (result as any).messages || [];
    const originalMessageCount = (state.messages || []).length;
    const newMessages = resultMessages.slice(originalMessageCount);

    let messages: BaseMessage[] = [...(state.messages || [])];

    // Add intermediate messages (if any)
    if (newMessages.length > 1) {
      const intermediateMessages = newMessages.slice(0, -1);
      messages = [...(messages as any[]), ...intermediateMessages];
    }

    if (message) {
      messages = [...(messages as any[]), message];
    }

    return {
      messages: messages as BaseMessage[],
    };
  }
);
