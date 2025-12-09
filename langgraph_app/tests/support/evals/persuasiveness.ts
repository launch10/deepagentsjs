import { PromptTemplate } from "@langchain/core/prompts";
import { createScorer } from "./createScorer";

const template = PromptTemplate.fromTemplate(`
  Rate the persuasiveness of this landing page copy on
   a scale of 0-1.

   Consider:

   - Emotional triggers and pain point addressing
   - Value proposition clarity
   - Urgency and scarcity tactics
   - Trust signals and social proof
   - Call-to-action effectiveness

   Copy: {output}

   Provide a score and detailed explanation.

   Available options:

   {options}
`);
const choiceScores = { excellent: 1, good: 0.75, average: 0.5, poor: 0.25 };

export const PersuasivenessScorer = createScorer({ prompt: template, choiceScores });
