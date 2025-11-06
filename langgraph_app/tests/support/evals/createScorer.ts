import { z } from "zod";
import { getLLM } from "@core";
import { AIMessage } from "@langchain/core/messages";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { structuredOutputPrompt } from "@prompts";

const PLAIN_RESPONSE_SCHEMA = z.object({
  choice: z.string().describe(`The best answer from the provided options`)
});

const COT_RESPONSE_SCHEMA = z.object({
  choice: z.string().describe(`The best answer from the provided options`),
  reasons: z.string().describe(`Write out in a step by step manner your reasoning to be sure that your conclusion is correct. Avoid simply stating the correct answer at the outset.`)
});

export interface BuildScorerParams {
  prompt: PromptTemplate,
  choiceScores: Record<string, number>,
  additionalPromptParams?: Record<string, unknown>
}

export interface ScorerParams {
  input: string,
  output: unknown,
  useCoT?: boolean,
}

const getChoiceScore = (choice: string, choiceScores: Record<string, number>): number => {
  return Object.entries(choiceScores).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {} as Record<string, number>)[choice.toLowerCase()]
}

export const createScorer = ({prompt, choiceScores, additionalPromptParams = {}}: BuildScorerParams) => {
  return async ({input, output, useCoT = false}: ScorerParams): Promise<number> => {
    const llm = getLLM("reasoning")
    const outputSchema = useCoT ? COT_RESPONSE_SCHEMA : PLAIN_RESPONSE_SCHEMA;
    additionalPromptParams["options"] = choiceScores;

    // For ollama, we need to decompose structured output to another step
    const basePrompt = await prompt.format({ input: input, output: JSON.stringify(output), ...additionalPromptParams })
    const structuredPrompt = basePrompt + await structuredOutputPrompt({schema: outputSchema});

    const unstructuredResponse = await llm.invoke(structuredPrompt) as AIMessage
    const parser = StructuredOutputParser.fromZodSchema(outputSchema);
    const result = await parser.parse(unstructuredResponse.content as string)
    const choice = result.choice as keyof typeof choiceScores;

    return getChoiceScore(choice, choiceScores)
  }
}
