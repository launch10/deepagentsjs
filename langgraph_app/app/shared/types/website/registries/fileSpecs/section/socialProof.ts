import { z } from 'zod';
import { baseSectionSchema } from './base';

export const socialProofSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the social proof section (e.g., 'Trusted By')."),
    contentType: z.enum(['Logos', 'Stats', 'Awards', 'Mix']).describe("The primary type of social proof displayed."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    logos: z.array(z.string()).nullable().describe("List of company names or identifiers for logos."),
    stats: z.array(z.object({
        value: z.string().describe("The statistic value (e.g., '10,000+', '98%')."),
        label: z.string().describe("The label or context for the statistic (e.g., 'Active Users', 'Customer Satisfaction').")
    })).nullable().describe("List of key statistics."),
    awards: z.array(z.string()).nullable().describe("List of award names or badges.")
});

export type SocialProofType = z.infer<typeof socialProofSchema>;
