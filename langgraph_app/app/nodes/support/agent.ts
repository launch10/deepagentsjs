import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { type SupportGraphState } from "@annotation";
import { createAgent, createMiddleware } from "langchain";
import { type BaseMessage } from "@langchain/core/messages";
import { lastAIMessage } from "@types";
import { SupportBridge } from "@annotation";

const SUPPORT_SYSTEM_PROMPT = `You are a helpful Launch10 support assistant. Your job is to answer user questions about Launch10, a platform that helps users test their business ideas through landing pages and Google Ads campaigns.

Answer questions using the FAQ content provided below. Be concise, friendly, and accurate.

Guidelines:
- If the user's question is directly answered in the FAQs, provide the relevant answer.
- If the question is partially related, share what you know and mention that the FAQs cover related topics.
- If you cannot answer from the FAQs, let the user know and suggest they submit a support request using the contact form below the chat.
- Keep responses focused and avoid lengthy preambles.
- Use markdown formatting for readability (bullet points, bold for emphasis).
- Do not make up information that isn't in the FAQs.`;

/**
 * Creates middleware that injects the FAQ context into the system prompt.
 */
const createSupportMiddleware = (faqContext: string | undefined) => {
  const fullPrompt = faqContext
    ? `${SUPPORT_SYSTEM_PROMPT}\n\n---\n\n# FAQ Knowledge Base\n\n${faqContext}`
    : SUPPORT_SYSTEM_PROMPT;

  return createMiddleware({
    name: "SupportMiddleware",
    wrapModelCall: async (request, handler) => {
      return await handler({
        ...request,
        systemPrompt: fullPrompt,
      });
    },
  });
};

/**
 * Support agent node that handles user questions using FAQ context.
 * Simple conversational agent with no tools for v1.
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
      tools: [],
      middleware: [createSupportMiddleware(state.faqContext)],
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
