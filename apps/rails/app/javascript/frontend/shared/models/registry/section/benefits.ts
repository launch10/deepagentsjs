import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '@shared/state/graph';

export const benefitsSchema = baseSectionSchema.extend({
    headline: z.string().describe("The main headline text."),
    subheadline: z.string().optional().describe("Supporting text below the headline."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    benefits: z.array(z.object({
        statement: z.string().describe("The benefit statement."),
        elaboration: z.string().optional().describe("Elaboration on how the product delivers the benefit."),
        visual: z.string().optional().describe("Description of the desired primary visual (image/icon)."),
    })),
    cta: z.string().optional().describe("Text for a call-to-action button, if desired."),
});

export type Benefits = z.infer<typeof benefitsSchema>;

export const benefitsPrompt = (state: GraphState) => {
    return `**SECTION TYPE: Benefits**
    <section-goal>
    The goal of the Benefits section is to explain *why* the features matter to the user. It translates features into positive outcomes, solutions to problems, and value propositions. This section addresses the "What's in it for me?" question and connects with the user's needs and desires on an emotional or practical level.
    </section-goals>

    <key-components>
    1.  **Section Headline:** Clearly identifies the section, often focusing on outcomes (e.g., "Unlock Your Potential", "Why Choose Us?", "Experience the Difference").
    2.  **Benefit Statements:** Clear statements describing the positive results or advantages users gain. Often starts with a verb or focuses on the outcome (e.g., "Save hours every week", "Reduce costly errors", "Impress your clients").
    3.  **Elaboration/Proof (Optional but Recommended):** Briefly explain *how* the product/service delivers that benefit, potentially linking back to a specific feature. (e.g., "Save hours every week *with our automated reporting feature*.")
    4.  **(Optional) Supporting Visuals:** Images or icons that illustrate the benefit or the positive outcome (e.g., someone relaxing because they saved time, a graph showing growth).
    </key-components>

    <content-considerations>
    *   Analyze the user content for statements describing value, outcomes, or solutions.
    *   Distinguish benefits (the *result*) from features (the *tool*). Does the content explain the "so what?" of the features?
    *   Are the benefits specific and credible?
    *   Do they address known pain points or desires of the target audience?
    *   Are visuals suggested or provided that reinforce the benefits?
    </content-considerations>
    `;
}