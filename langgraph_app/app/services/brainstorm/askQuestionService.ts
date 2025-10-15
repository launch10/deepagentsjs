import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { type NotificationOptions } from "@core";
import { renderPrompt, fewShotExamplesPrompt, structuredOutputPrompt, chatHistoryPrompt } from "@prompts";
import { type QuestionType, type QuestionVariantType, type StructuredQuestionType, BRAINSTORMING_QUESTIONS } from "@types";
import { messageSchema, type Message } from "@types";

export const askQuestionInputSchema = z.object({
    messages: z.array(messageSchema).describe("The user's request/description for the project"),
    questionIndex: z.number().describe("The index of the question to ask"),
    userNeedsHelp: z.boolean().optional().describe("Whether the user needs help"),
});

export type AskQuestionInput = z.infer<typeof askQuestionInputSchema>;

export type AskQuestionOutput = { question: QuestionType, questionIndex: number };

const structuredQuestionSchema = z.object({
  intro: z.string().describe("A brief, engaging introductory sentence or two, personalized to the user's business."),
  question: z.string().describe("The core question being asked, adapted for the user's context."),
  sampleResponses: z.array(z.string()).describe("A list of 3 high-quality, diverse sample responses relevant to the user's business."),
  conclusion: z.string().describe("A concluding sentence to re-engage the user, potentially repeating the core question."),
});

const stringQuestionOutputSchema = z.object({
  question: z.string().describe("The question to ask the user")
});

const structuredQuestionOutputSchema = z.object({
  question: structuredQuestionSchema.describe("The structured question to ask the user")
});
const basePrompt = async ({
  messages, 
  question, 
  schema,
  isRetry = false,
}: {
  messages: Message[], 
  question: QuestionVariantType, 
  schema: z.ZodType<any>,
  isRetry?: boolean,
}) => {
  const fewShots = question.style === "Rephrased" ? question.fewShotExamples : [];

  const [fewShotExamples, chatHistory, formatInstructions] = await Promise.all([
    fewShotExamplesPrompt({ fewShotExamples: fewShots, schema }),
    chatHistoryPrompt({ messages }),
    structuredOutputPrompt({ schema })
  ]);

  const retryContext = isRetry ? `
    <context>
      The user has already been asked this question but their response was off-topic 
      or they were seeking help/clarification. Please read their response, and provide a supportive, helpful response that re-engages them with the question.

      If their response is off-topic, don't TOTALLY ignore what they said. Respond to what they said, but then guide them
      back to the question at hand.
    </context>
  ` : '';

  return renderPrompt(`
    <background>
      The user wants to create a website for their business. 
    </background>

    <role>
      You are the brainstorming agent. Your job is to help the user brainstorm 
      copy for a high-converting landing page for their business.

      You will be shown the current conversation, as well as the next question
      you are meant to ask the user. 
    </role>

    <task>
      Your task is to properly adapt the question template to the current conversation, 
      making sure the question is clear and concise. If the template requests you
      to provide the user with sample answers, you should provide good sample
      answers BASED ON what they've already told you about their business.

      If the user hasn't told you anything yet, please create new examples, so the user
      can respond to your question. They have already seen a few examples, so 
      don't repeat them, because they clearly didn't see an example that resonated.
    </task>

    ${retryContext}

    ${fewShotExamples}

    ${chatHistory}

    <question>
      ${question.question}
    </question>

    ${formatInstructions}
`);
}

export const notificationContext: NotificationOptions = {
    taskName: "Generating project name",
};

export class AskQuestionService {
  async execute(input: AskQuestionInput, config?: LangGraphRunnableConfig): Promise<AskQuestionOutput> {
      let { messages, questionIndex, userNeedsHelp } = input;
      if (!messages) {
          throw new Error('Messages are required');
      }
      questionIndex = questionIndex || 0;
      userNeedsHelp = userNeedsHelp || false;

      const nextQuestionIndex = userNeedsHelp ? questionIndex : questionIndex + 1;
      const nextQuestion = BRAINSTORMING_QUESTIONS[nextQuestionIndex];

      if (!nextQuestion) {
          throw new Error('Invalid question index');
      }

      let questionVariant: QuestionVariantType;
      
      console.log(`does user needs help? ${userNeedsHelp}`)
      if (userNeedsHelp) {
        questionVariant = nextQuestion.variants.helpful;
      } else {
        questionVariant = (nextQuestion.default === "simple" ? nextQuestion.variants.simple : nextQuestion.variants.helpful)!;
      }

      console.log(nextQuestion.default)
      console.log(nextQuestionIndex)
      console.log(nextQuestion.variants)
      console.log(questionVariant)
      if (questionVariant.style === "Verbatim") {
        return { 
          question: {
            key: nextQuestion.name,
            type: "simple",
            question: questionVariant.question 
          },
          questionIndex: nextQuestionIndex
        }
      }

      const outputType = questionVariant.style === "Rephrased" ? "structured" : "simple";
      const outputSchema = outputType === "structured" ? structuredQuestionOutputSchema : stringQuestionOutputSchema;
      
      const llm = getLlm(LLMSkill.Writing, LLMSpeed.Slow);
      const prompt = await basePrompt({ 
        messages, 
        question: questionVariant, 
        schema: outputSchema,
        isRetry: userNeedsHelp 
      });
      const structuredLlm = llm.withStructuredOutput(outputSchema);
      const result = await structuredLlm.invoke(prompt);

      return { 
        question: {
          key: nextQuestion.name,
          type: outputType,
          question: result.question
        },
        questionIndex: nextQuestionIndex
      };
  }
}