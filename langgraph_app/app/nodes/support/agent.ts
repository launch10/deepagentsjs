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

## Parallel Queries - CRITICAL FOR SPEED

When a user's question spans multiple topics, run multiple FAQ queries in parallel in a single message. This is much faster than sequential queries.

**Example - User asks about pricing AND ads setup:**
\`\`\`
// GOOD: Query both topics at once (single message, parallel)
faq(query="how much does Launch10 cost pricing credits")
faq(query="how to set up Google Ads campaign")

// BAD: One query, wait, then another (slow)
\`\`\`

**Example - User asks a complex question:**
"How do I create a landing page and run ads for it?"
\`\`\`
// GOOD: Break into parallel queries
faq(query="how to create landing page")
faq(query="how to run Google Ads campaign")
faq(query="connecting landing page to ads")
\`\`\`

**When to use parallel queries:**
- Questions with "and" or multiple topics
- Questions that might need context from different areas (billing + features, setup + troubleshooting)
- Complex questions where you're not sure which FAQ will have the answer

**When single query is fine:**
- Simple, focused questions ("How do I reset my password?")
- Follow-up questions on a topic you just queried

## Guidelines
- Use the FAQ tool to look up answers before responding to questions.
- If the FAQ tool returns relevant results, use them to provide an accurate answer.
- If the FAQ tool returns no results or the question isn't covered, let the user know and suggest they submit a support request using the "Contact Support" tab.
- DO NOT mention the FAQ tool. Just talk to the user as if you know the answer. No one needs to see behind the curtain.
- Keep responses focused and avoid lengthy preambles.
- Use markdown formatting for readability (bullet points, bold for emphasis).
- Speak as though you are an expert in Launch10, or a customer service agent.
- Do not make up information that isn't in the FAQs.`;

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
      systemPrompt: SUPPORT_SYSTEM_PROMPT,
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
