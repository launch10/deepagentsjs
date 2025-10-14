import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { type NotificationOptions } from "@core";
import { chatHistoryPrompt, fewShotExamplesPrompt, formatInstructionsPrompt, structuredOutputPrompt } from "@prompts";
import { withStructuredResponse } from "@utils";
import { renderPrompt } from "@prompts";

export const askQuestionInputSchema = z.object({
    messages: z.array(z.object({ role: z.string(), content: z.string() })).describe("The user's request/description for the project"),
    questionIndex: z.number().describe("The index of the question to ask"),
});

export type AskQuestionInput = z.infer<typeof askQuestionInputSchema>;

const askQuestionOutputSchema = z.object({
    askQuestion: z.string().describe("The unique-name-of-the-project using kebab-case"),
});

const basePrompt = (messages: string, question: string, schema: string) => {
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

    ${fewShotExamplesPrompt(question)}

    ${chatHistoryPrompt(messages)}

    <question>
      ${question}
    </question>

    ${formatInstructionsPrompt(schema)}
`);
}

export const notificationContext: NotificationOptions = {
    taskName: "Generating project name",
};

type QuestionStyle = "Verbatim" | "Rephrased";

interface Question {
    question: string;
    style: QuestionStyle;
}

const QUESTIONS: Question[] = [
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
        context: "The user is a gym owner, whose gym is focused on high-impact cardio.",
        sampleResponses: [
          "The gym offers a wide range of high-intensity workouts, including HIIT, Tabata, and circuit training."
        ]

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
  async execute(input: AskQuestionInput, config?: LangGraphRunnableConfig): Promise<{ question: string }> {
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
      
      const llm = getLlm(LLMSkill.Writing, LLMSpeed.Slow);
      const schemaPrompt = await structuredOutputPrompt({ schema: askQuestionOutputSchema });
      const prompt = await basePrompt.format({ messages, question, schema: schemaPrompt });
      // const structuredLlm = llm.withStructuredOutput(projectNameOutputSchema);
      // return await structuredLlm.invoke(prompt) as { projectName: string };
      return withStructuredResponse({
          llm,
          prompt,
          schema: askQuestionOutputSchema
      })
  }
}