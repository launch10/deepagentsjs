import { z } from 'zod';
import { baseSectionSchema } from './base';

export const featuresSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the features section (e.g., 'Explore Key Features')."),
    subheadline: z.string().nullable().describe("Supporting text below the headline."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    features: z.array(z.object({
        name: z.string().describe("The name of the feature."),
        description: z.string().describe("A brief description of the feature."),
        visual: z.string().nullable().describe("Description of the desired primary visual (image/video)."),
    })),
    cta: z.string().nullable().describe("Text for a call-to-action button, if desired.")
})

export type FeaturesType = z.infer<typeof featuresSchema>;
