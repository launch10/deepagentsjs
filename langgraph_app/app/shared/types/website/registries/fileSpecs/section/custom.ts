import { z } from 'zod';
import { baseSectionSchema } from './base';

export const customSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the custom section, if requested."),
    subheadline: z.string().nullable().describe("A subheadline or introductory text, if requested."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    visualDescription: z.string().nullable().describe("Description of the desired visual (image/video) based on user prompt (e.g., 'Illustration of team working', 'Screenshot of dashboard feature X'). Not necessarily a URL."),
    listItems: z.array(z.string()).nullable().describe("List of text items, if the user requested a bulleted or numbered list."),
    // Store the original user prompt for reference/debugging
    userPrompt: z.string().nullable().describe("The original user instruction provided for this specific custom section."),
    // Allow for a CTA if explicitly requested for this section
    cta: z.string().nullable().describe("Text for a call-to-action button, if requested for this section.")
})

export type CustomType = z.infer<typeof customSchema>;
