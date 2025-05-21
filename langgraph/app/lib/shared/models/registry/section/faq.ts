import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const faqSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the FAQ section (e.g., 'Frequently Asked Questions')."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    categories: z.array(z.string()).optional().describe("Optional list of categories if the FAQ is organized by topic."),
    qaPairs: z.array(z.object({
        question: z.string().describe("The frequently asked question."),
        answer: z.string().describe("The answer to the question.")
    })).describe("An array of question-and-answer pairs.")
})

export type Faq = z.infer<typeof faqSchema>;

export const faqPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: FAQ (Frequently Asked Questions)**

        <section-goal>
        The goal of the FAQ section is to proactively address common questions, concerns, and potential objections that visitors might have. It aims to reduce uncertainty, build trust, save support time, and help users make an informed decision.
        </section-goal>

        <key-components>
        1.  **Section Headline:** Clearly identifies the section (e.g., "Frequently Asked Questions", "Have Questions?", "Answers to Your Questions").
        2.  **List of Questions:** Clear, concise questions that reflect genuine user queries or potential barriers.
        3.  **List of Answers:** Direct, helpful, and easy-to-understand answers to each question.
        4.  **(Optional) Categorization:** For extensive FAQs, group questions by topic (e.g., General, Pricing, Technical).
        5.  **(Optional) Expand/Collapse Functionality:** Allows users to easily scan questions and expand only the ones relevant to them.
        </key-components>

        <content-considerations>
        *   Analyze the user-provided questions and answers.
        *   Are the questions relevant to the product/service and target audience?
        *   Are the answers clear, concise, and accurate?
        *   Do the Q&As address potential objections or points of confusion?
        *   Is the list long enough to warrant categorization?
        </content-considerations>
    `;
}