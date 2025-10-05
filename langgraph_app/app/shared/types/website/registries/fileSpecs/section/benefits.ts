import { z } from 'zod';
import { baseSectionSchema } from './base';

export const benefitsSchema = baseSectionSchema.extend({
    headline: z.string().describe("The main headline text."),
    subheadline: z.string().nullable().describe("Supporting text below the headline."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    benefits: z.array(z.object({
        statement: z.string().describe("The benefit statement."),
        elaboration: z.string().nullable().describe("Elaboration on how the product delivers the benefit."),
        visual: z.string().nullable().describe("Description of the desired primary visual (image/icon)."),
    })),
    cta: z.string().nullable().describe("Text for a call-to-action button, if desired."),
});

export type BenefitsType = z.infer<typeof benefitsSchema>;
