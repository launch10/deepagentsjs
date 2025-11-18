import { z } from 'zod';
import { baseSectionSchema } from './base';

export const faqSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the FAQ section (e.g., 'Frequently Asked Questions')."),
    paragraphs: z.string().nullable().describe("Paragraphs of text to be included in the section."),
    categories: z.array(z.string()).nullable().describe("Optional list of categories if the FAQ is organized by topic."),
    qaPairs: z.array(z.object({
        question: z.string().describe("The frequently asked question."),
        answer: z.string().describe("The answer to the question.")
    })).describe("An array of question-and-answer pairs.")
})

export type FaqType = z.infer<typeof faqSchema>;
