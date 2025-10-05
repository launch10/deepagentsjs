import { z } from 'zod';
import { baseSectionSchema } from './base';

export const ctaSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the CTA section (e.g., 'Ready to Get Started?')."),
    supportingText: z.string().nullable().describe("Supporting text for the CTA section (e.g., 'Don't miss out on this opportunity!')."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    cta: z.object({
      text: z.string().describe("The text for the primary CTA button (e.g., 'Start Your Free Trial')."),
    }),
    supportingVisualOrTrustSignal: z.string().nullable(),
});

export type CtaType = z.infer<typeof ctaSchema>;
