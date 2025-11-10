import { z } from 'zod';

export const baseSectionSchema = z.object({
  suggestedComponents: z.array(z.string()).nullable().describe("List of suggested Shadcn UI components for this section.")
})