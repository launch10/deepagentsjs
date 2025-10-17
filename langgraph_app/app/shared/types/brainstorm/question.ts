import z from "zod";
import { type SchemaFewShotExample } from "@types";
import { AIMessage } from "@langchain/core/messages";

export const QUESTION_KEYS = ["introduction", "customers", "valueProp", "socialProof", "lookAndFeel"] as const;

export type QuestionKey = typeof QUESTION_KEYS[number];
export const QUESTION_TYPES = ["simple", "structured"] as const;
export type QuestionTypeType = typeof QUESTION_TYPES[number];

const structuredQuestionContentSchema = z.object({
  intro: z.string().describe("A brief, engaging introductory sentence or two, personalized to the user's business."),
  question: z.string().describe("The core question being asked, adapted for the user's context."),
  sampleResponses: z.array(z.string()).describe("A list of 3 high-quality, diverse sample responses relevant to the user's business."),
  conclusion: z.string().describe("A concluding sentence to re-engage the user, potentially repeating the core question."),
});

export type StructuredQuestionContentType = z.infer<typeof structuredQuestionContentSchema>;

export const questionContentSchema = z.string().or(structuredQuestionContentSchema);
export type QuestionContentType = z.infer<typeof questionContentSchema>;

export const questionSchema = z.discriminatedUnion("type", [
  z.object({
    key: z.enum(QUESTION_KEYS).describe("A unique key for the question."),
    type: z.literal("simple"),
    question: z.string(),
  }),
  z.object({
    key: z.enum(QUESTION_KEYS).describe("A unique key for the question."),
    type: z.literal("structured"),
    question: structuredQuestionContentSchema,
  }),
]);

export type QuestionType = z.infer<typeof questionSchema>;
export type SimpleQuestionType = Extract<QuestionType, { type: "simple" }>;
export type StructuredQuestionType = Extract<QuestionType, { type: "structured" }>;
interface SimpleQuestionTemplate {
    question: string;
    style: "Verbatim";
}
interface HelpfulQuestionTemplate {
    question: string;
    style: "Rephrased";
    fewShotExamples: SchemaFewShotExample<typeof structuredQuestionContentSchema>[];
}

export type QuestionGuardrail = "validAnswer" | "router";
export interface QuestionTemplateType {
  name: QuestionKey;
  index: number;
  variants: QuestionVariantsType;
  default: "simple" | "helpful";
  guardrails: QuestionGuardrail[];
}
export interface QuestionVariantsType {
  simple: SimpleQuestionTemplate;
  helpful: HelpfulQuestionTemplate;
}

export type QuestionVariantType = SimpleQuestionTemplate | HelpfulQuestionTemplate;

export const Questions: QuestionTemplateType[] = [
  {
    name: "introduction",
    index: 0,
    default: "simple",
    guardrails: ["validAnswer"],
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
    name: "customers",
    index: 1,
    default: "helpful",
    guardrails: ["validAnswer"],
    variants: {
      simple: { 
        question: "Who are your customers, and what are they trying to achieve?",
        style: "Verbatim"
      },
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
    name: "valueProp",
    index: 2,
    default: "helpful",
    guardrails: ["validAnswer"],
    variants: {
      simple: { 
        question: "How does [BUSINESS NAME] solve the customer's problem? [ 3 SAMPLE RESPONSES ]. Rephrase the answer.",
        style: "Verbatim"
      },
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
    name: "socialProof",
    index: 3,
    default: "helpful",
    guardrails: ["validAnswer"],
    variants: {
      simple: { 
        question: "Do you have testimonials, reviews, high-profile customers, or other social proof? [ 3 SAMPLE RESPONSES ]. Rephrase the answer.",
        style: "Verbatim"
      },
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
    name: "lookAndFeel",
    index: 4,
    default: "simple",
    guardrails: ["router"],
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

export const getSimpleQuestion = (index: number): AIMessage => {
  const question = BRAINSTORMING_QUESTIONS[index];
  if (!question) {
    throw new Error(`Question at index ${index} not defined`);
  }
  return new AIMessage(question.variants["simple"].question);
}

export const getFirstQuestion = () => {
  return new AIMessage(BRAINSTORMING_QUESTIONS[0]!.variants["simple"]!.question);
}

export const createBrainstormingMessage = (question: QuestionType) => {
  if (question.type === "structured") {
    const text = `
    ${question.question.intro}
    
    ${question.question.question}

    ${question.question.sampleResponses.map((response) => `* ${response}`).join("\n")}
    
    ${question.question.conclusion}
    `
   const message = new AIMessage(text);
    message.response_metadata.question = question;
   return message;
  } else {
    return new AIMessage(question.question);
  }
}