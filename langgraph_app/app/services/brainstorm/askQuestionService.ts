import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { type NotificationOptions } from "@core";
import { withStructuredResponse } from "@utils";
import { renderPrompt, fewShotExamplesPrompt, structuredOutputPrompt, chatHistoryPrompt } from "@prompts";
import { type SchemaFewShotExample } from "@types";

export const askQuestionInputSchema = z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })).describe("The user's request/description for the project"),
    questionIndex: z.number().describe("The index of the question to ask"),
});

export type AskQuestionInput = z.infer<typeof askQuestionInputSchema>;

// Define a schema that matches the desired output structure
const semiStructuredQuestionSchema = z.object({
  intro: z.string().describe("A brief, engaging introductory sentence or two, personalized to the user's business."),
  question: z.string().describe("The core question being asked, adapted for the user's context."),
  sampleResponses: z.array(z.string()).describe("A list of 3 high-quality, diverse sample responses relevant to the user's business."),
  conclusion: z.string().describe("A concluding sentence to re-engage the user, potentially repeating the core question."),
});

export type SemiStructuredQuestionType = z.infer<typeof semiStructuredQuestionSchema>;

const stringQuestionOutputSchema = z.object({
  question: z.string().describe("The question to ask the user")
});

const structuredQuestionOutputSchema = z.object({
  question: semiStructuredQuestionSchema.describe("The structured question to ask the user")
});

export type AskQuestionOutput = 
  | { question: string }
  | { question: SemiStructuredQuestionType };

const basePrompt = ({
  messages, 
  question, 
  schema,
}: {
  messages: { role: string; content: string }[], 
  question: QuestionType, 
  schema: z.ZodType<any>,
}) => {
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
    </task>

    ${question.fewShotExamples ? fewShotExamplesPrompt<typeof semiStructuredQuestionSchema>({ 
        fewShotExamples: question.fewShotExamples, 
        schema: semiStructuredQuestionSchema 
      }) : ""}

    ${chatHistoryPrompt({messages})}

    <question>
      ${question.question}
    </question>

    ${structuredOutputPrompt({ schema })}
`);
}

export const notificationContext: NotificationOptions = {
    taskName: "Generating project name",
};

type QuestionStyle = "Verbatim" | "Rephrased";
interface QuestionType {
    question: string;
    style: QuestionStyle;
    fewShotExamples?: SchemaFewShotExample<typeof semiStructuredQuestionSchema>[];
}

const QUESTIONS: QuestionType[] = [
  {
    question: "Tell us about your business. More info -> better outcomes.",
    style: "Verbatim"
  },
  {
    question: "Who are your customers, and what are they trying to achieve?",
    style: "Rephrased"
  },
  {
    question: "How does [BUSINESS NAME] solve the customer's problem? [ 3 SAMPLE RESPONSES ]. Rephrase the answer.",
    style: "Rephrased",
    fewShotExamples: [
      { 
        input: "The user is a gym owner, whose gym (ImpactZone) is focused on high-impact cardio.",
        output: {
          intro: "Great! Let's dig into what makes ImpactZone special.",
          question: "How does ImpactZone solve the customer's problem?",
          sampleResponses: [
            "ImpactZone offers a wide range of high-intensity workouts, including HIIT, Tabata, and circuit training.",
            "ImpactZone is proven to increase caloric burn by 20%.",
            "ImpactZone builds accountability through group training and community."
          ],
          conclusion: "So what do you think? How does ImpactZone solve the customer's problem?"
        }
      }
    ]
  },
  {
    question: "Do you have testimonials, reviews, high-profile customers, or other social proof?",
    style: "Verbatim"
  },
  {
    question: "Before we build, do you have a logo, color palette, or images you want to include?",
    style: "Verbatim"
  },
]

export class AskQuestionService {
  async execute(input: AskQuestionInput, config?: LangGraphRunnableConfig): Promise<AskQuestionOutput> {
      const { messages, questionIndex } = input;
      if (!messages) {
          throw new Error('User request is required');
      }

      const nextQuestion = QUESTIONS[questionIndex];

      if (!nextQuestion) {
          throw new Error('Invalid question index');
      }

      if (nextQuestion.style === "Verbatim") {
        return { question: nextQuestion.question }
      }

      const outputSchema = nextQuestion.fewShotExamples 
        ? structuredQuestionOutputSchema 
        : stringQuestionOutputSchema;
      
      const llm = getLlm(LLMSkill.Writing, LLMSpeed.Slow);
      const prompt = await basePrompt({ messages, question: nextQuestion, schema: outputSchema });
      const structuredLlm = llm.withStructuredOutput(outputSchema);
      return await structuredLlm.invoke(prompt) as AskQuestionOutput;
  }
}