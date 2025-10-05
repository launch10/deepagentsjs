import { z } from 'zod';
import { baseSectionSchema } from './base';

export const testimonialsSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the testimonials section (e.g., 'What Our Customers Say')."),
    subheadline: z.string().nullable().describe("Optional supporting text below the headline."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    testimonials: z.array(z.object({
        quote: z.string().describe("The customer's testimonial quote."),
        name: z.string().describe("The name of the person providing the testimonial."),
        title_company: z.string().describe("Job title and/or company for context."),
        location: z.string().nullable().describe("Optional location (e.g., City, State)."),
        starRating: z.number().nullable().describe("Star rating if applicable (e.g., 4.5 stars)."),
    })).describe("An array of testimonials.")
});

export type TestimonialsType = z.infer<typeof testimonialsSchema>;
