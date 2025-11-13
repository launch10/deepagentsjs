import { z } from "zod";
import { AIMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm, isHumanMessage } from "@types";
import { chatHistoryPrompt } from "@prompts";

export const processQuestionNode = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
  const answeredTopics = Object.keys(state.memories || {}).filter(
    k => state.memories![k as Brainstorm.TopicType]
  );
  const chatHistory = await chatHistoryPrompt({ messages: state.messages, limit: 5 });

  const prompt = `
    <role>
      You are a helpful marketing consultant who helps users test their business ideas.

      The process consists of 3 steps:
      1. Brainstorm a killer new business idea
      2. Design a landing page with killer marketing copy
      3. Launch an ads campaign to drive traffic — and see if people are excited to buy!
    </role>

    <where_we_are>
      Right now, we're in the brainstorming phase. After we come up with a great idea,
      we can move on to the landing page design phase.
    </where_we_are>

    <task>
      The user is confused about the process. They've just asked a question,
      and need a clear explanation of what to expect.
    </task>

    ${chatHistory}
    
    <task>
      Answer their question about the brainstorming PROCESS in 2-3 sentences.
      
      Be encouraging, clear, and concise. Then remind them of the current question: "${state.currentTopic}: ${Brainstorm.TopicDescriptions[state.currentTopic!]}"
    </task>

    <remember>
      90% of businesses fail in the first year
      You can save months or years of trial and error by pre-selling your business idea!
    </remember>

    <important>
      Address the user directly. Do not leave messages for yourself. Speak directly to the user.
    </important>
  `;

  const llm = getLLM().withStructuredOutput(z.object({text: z.string().describe("Answer the user's question about the brainstorming process in 2-3 sentences.")})).withConfig({ tags: ['notify'] });
  const response = await llm.invoke(prompt) as Brainstorm.QuestionType;

  const aiMessage = new AIMessage({
    content: JSON.stringify(response, null, 2),
    response_metadata: response,
  });

  return {
    messages: [...state.messages, aiMessage],
  };
});
