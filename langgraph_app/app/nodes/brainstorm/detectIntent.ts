import { z } from "zod";
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { isHumanMessage, Brainstorm } from "@types";
import { chatHistoryPrompt, toJSON } from "@prompts";

const intentSchema = z.enum([
  "attempted_answer",
  "skip",
  "process_question", 
  "do_the_rest",
  "off_topic",
  "finished"
]);

export type IntentType = z.infer<typeof intentSchema>;

export const detectIntent = NodeMiddleware.use(async (
  state: BrainstormGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<BrainstormGraphState>> => {
  const lastHumanMessage = state.messages.filter(isHumanMessage).at(-1);
  
  if (!lastHumanMessage) {
    return { intent: "off_topic" as IntentType };
  }

  const chatHistory = await chatHistoryPrompt({ messages: state.messages, limit: 5 });
  const answeredTopics = Object.keys(state.memories || {}).filter(
    k => state.memories![k as Brainstorm.TopicType]
  );

  const prompt = `
    <role>
      You are an intent classifier for a brainstorming conversation.
    </role>

    <current_context>
      - Current topic: ${state.currentTopic}
      - Topics answered: ${answeredTopics.join(', ') || 'None yet'}
      - Remaining topics: ${state.remainingTopics?.join(', ') || 'None'}
      - Available actions: ${state.availableCommands?.join(', ') || 'None'}
    </current_context>

    <conversation_history>
      ${chatHistory}
    </conversation_history>

    <users_latest_message>
      ${lastHumanMessage.content}
    </users_latest_message>

    <task>
      Classify the user's intent into ONE of these categories:

      1. **attempted_answer** - User is genuinely trying to answer the current question about "${state.currentTopic}"
         Examples: "I'm building a SaaS tool for...", "My target audience is...", "I solve this by..."

      2. **skip** - User wants to skip this question and come back later
         Examples: "skip", "I'll do this later", "pass", "let's come back to this"

      3. **process_question** - User is asking about the brainstorming process itself
         Examples: "Why are you asking this?", "What's this for?", "How many questions?", "What happens next?", "What's going on?", "What's the point?"

      4. **do_the_rest** - User wants AI to fill in remaining answers
         Examples: "Just fill in the rest", "Do the remaining questions for me", "I trust you to complete this"

      5. **off_topic** - User is being silly, off-topic, or unclear
         Examples: User is being very silly, making jokes, etc

      6. **finished** - User indicates they're done or wants to move on to next steps
         Examples: "I'm done", "let's move forward", "build my site", "next"

      <important>
        - Be strict about "attempted_answer" - only use if they're ACTUALLY answering "${state.currentTopic}"
        - "skip" is available: ${state.availableCommands?.includes('skip') ? 'YES' : 'NO'}
        - "do_the_rest" is available: ${state.availableCommands?.includes('doTheRest') ? 'YES' : 'NO'}
        - If action not available but user requests it, classify as "process_question"
      </important>
    </task>

    Output ONLY the intent name, nothing else.
  `;

  const llm = getLLM("reasoning", "blazing");
  const intent = (await llm.invoke(prompt)).content;

  console.log(`[detectIntent] Classified intent: ${JSON.stringify(intent)} for message: "${lastHumanMessage.content}"`);

  return {
    intent
  };
});
