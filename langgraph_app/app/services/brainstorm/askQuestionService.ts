import { z } from "zod";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { type NotificationOptions } from "@core";
import { renderPrompt, fewShotExamplesPrompt, structuredOutputPrompt, chatHistoryPrompt } from "@prompts";
import { type SchemaFewShotExample, type QuestionType as OutputQuestionType } from "@types";
import { BaseMessage } from "@langchain/core/messages";

export const askQuestionInputSchema = z.object({
    messages: z.array(z.instanceof(BaseMessage)).describe("The user's request/description for the project"),
    questionIndex: z.number().describe("The index of the question to ask"),
    userNeedsHelp: z.boolean().optional().describe("Whether the user needs help"),
});

export type AskQuestionInput = z.infer<typeof askQuestionInputSchema>;

export type AskQuestionOutput = { question: OutputQuestionType };

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
interface SimpleQuestionTemplate {
    question: string;
    style: "Verbatim";
}
interface HelpfulQuestionTemplate {
    question: string;
    style: "Rephrased";
    fewShotExamples: SchemaFewShotExample<typeof structuredQuestionSchema>[];
}
interface Question {
  name: string;
  order: number;
  variants: QuestionVariants;
  default: "simple" | "helpful";
}
interface QuestionVariants {
  simple?: SimpleQuestionTemplate;
  helpful: HelpfulQuestionTemplate;
}

type QuestionVariant = SimpleQuestionTemplate | HelpfulQuestionTemplate;

const QUESTIONS: Question[] = [
  {
    name: "Introduction",
    order: 1,
    default: "simple",
    variants: {
      simple: {
        question: "Tell us about your business. More info -> better outcomes.",
        style: "Verbatim"
      },
      helpful: {
        question: "I help people develop high-converting landing pages for their businesses. To start, can you tell me about your business?",
        style: "Rephrased",
        fewShotExamples: [
          {
            input: "<none provided>",
            output: {
              intro: "Sorry, let's try again. I help people develop high-converting landing pages for their businesses.",
              question: "To start, can you tell me about your business?",
              sampleResponses: [
                "I'm a gym owner, whose gym (ImpactZone) is focused on high-impact cardio.",
                "EagleEye helps software companies identify product-market fit.",
                "IceBreaker is a social media platform for introverts.",
              ],
              conclusion: "So how would you describe your business?"
            }
          }
        ]
      }
    }
  },

  {
    name: "Customers",
    order: 2,
    default: "helpful",
    variants: {
      helpful: {
        question: "Who are your customers, and what are they trying to achieve?",
        style: "Rephrased",
        fewShotExamples: [
          { 
            input: "The user is a gym owner, whose gym (ImpactZone) is focused on high-impact cardio.",
            output: {
              intro: "Great! Let's talk about your customers.",
              question: "Who are your customers, and what are they trying to achieve?",
              sampleResponses: [
                "Our customers are fitness enthusiasts looking for high-intensity workouts.",
                "Our customers are newbies, looking for a friendly and approachable workout experience.",
                "Our customers community-oriented, looking for a way to build accountability through group training and community.",
              ],
              conclusion: "So what do you think? Who are your customers, and what are they trying to achieve?"
            }
          }
        ]
      }
    }
  },

  {
    name: "Value Proposition",
    order: 3,
    default: "helpful",
    variants: {
      helpful: {
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
      }
    }
  },

  {
    name: "Social Proof",
    order: 4,
    default: "simple",
    variants: {
      helpful: {
        question: "Do you have testimonials, reviews, high-profile customers, or other social proof? [ 3 SAMPLE RESPONSES ]. Rephrase the answer.",
        style: "Rephrased",
        fewShotExamples: [
          {
            input: "The user is a gym owner, whose gym (ImpactZone) is focused on high-impact cardio. Their customers are fitness enthusiasts, and their value proposition is that they offer a wide range of high-intensity workouts, including HIIT, Tabata, and circuit training.",
            output: {
              intro: "Great! Let's talk about your social proof.",
              question: "Do you have testimonials, reviews, high-profile customers, or other social proof?",
              sampleResponses: [
                "ImpactZone has received rave reviews from its customers.",
                "ImpactZone has been featured in Forbes and Inc. Magazine.",
                "Our founder has over 20 years of experience in the fitness industry.",
              ],
              conclusion: "Don't worry if you don't have a great answer yet, we can chat more to uncover unique social proof based on your background!"
            }
          }
        ]
      }
    }
  },

  {
    name: "Look & Feel",
    order: 5,
    default: "simple",
    variants: {
      simple: {
        question: "Before we build, do you have a logo, color palette, or images you want to include?",
        style: "Verbatim"
      },
      helpful: {
        question: "Perhaps that was unclear. You can provide logo, color palette, or images in the right-hand nav bar, or you can click below to build your site!",
        style: "Rephrased",
        fewShotExamples: []
      }
    }
  },

]

const basePrompt = async ({
  messages, 
  question, 
  schema,
  isRetry = false,
}: {
  messages: BaseMessage[], 
  question: QuestionVariant, 
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

      const actualQuestionIndex = questionIndex === 0 ? 1 : questionIndex;
      const nextQuestion = QUESTIONS[actualQuestionIndex - 1];
      console.log(`next question:`, nextQuestion)

      if (!nextQuestion) {
          throw new Error('Invalid question index');
      }

      let questionVariant: QuestionVariant;
      
      if (userNeedsHelp) {
        questionVariant = nextQuestion.variants.helpful;
      } else {
        questionVariant = (nextQuestion.default === "simple" ? nextQuestion.variants.simple : nextQuestion.variants.helpful)!;
      }

      if (questionVariant.style === "Verbatim") {
        return { question: questionVariant.question }
      }

      const outputSchema = questionVariant.fewShotExamples && questionVariant.fewShotExamples.length > 0
        ? structuredQuestionOutputSchema 
        : stringQuestionOutputSchema;
      
      const llm = getLlm(LLMSkill.Writing, LLMSpeed.Slow);
      const prompt = await basePrompt({ 
        messages, 
        question: questionVariant, 
        schema: outputSchema,
        isRetry: userNeedsHelp 
      });
      const structuredLlm = llm.withStructuredOutput(outputSchema);
      const result = await structuredLlm.invoke(prompt);

      return { question: result.question };
  }
}