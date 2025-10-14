import z from "zod";

const structuredQuestionSchema = z.object({
  intro: z.string().describe("A brief, engaging introductory sentence or two, personalized to the user's business."),
  question: z.string().describe("The core question being asked, adapted for the user's context."),
  sampleResponses: z.array(z.string()).describe("A list of 3 high-quality, diverse sample responses relevant to the user's business."),
  conclusion: z.string().describe("A concluding sentence to re-engage the user, potentially repeating the core question."),
});

export type StructuredQuestionType = z.infer<typeof structuredQuestionSchema>;

export type QuestionType = string | StructuredQuestionType;