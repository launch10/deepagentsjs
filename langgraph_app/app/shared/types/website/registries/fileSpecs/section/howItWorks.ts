import { z } from 'zod';
import { baseSectionSchema } from './base';

export const howItWorksSchema = baseSectionSchema.extend({
    headline: z.string().describe("The main headline for the section."),
    subheadline: z.string().nullable().describe("Optional supporting text below the headline."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    steps: z.array(z.object({
        title: z.string().describe("The title or action for this step."),
        description: z.string().describe("A brief description of this step."),
        visual: z.string().nullable().describe("Description or suggestion for an icon/illustration for this step."),
    })).describe("An array outlining the sequential steps."),
});

export type HowItWorksType = z.infer<typeof howItWorksSchema>;
