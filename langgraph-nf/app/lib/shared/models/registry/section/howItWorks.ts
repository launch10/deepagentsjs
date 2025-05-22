import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const howItWorksSchema = baseSectionSchema.extend({
    headline: z.string().describe("The main headline for the section."),
    subheadline: z.string().optional().describe("Optional supporting text below the headline."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    steps: z.array(z.object({
        title: z.string().describe("The title or action for this step."),
        description: z.string().describe("A brief description of this step."),
        visual: z.string().optional().describe("Description or suggestion for an icon/illustration for this step."),
    })).describe("An array outlining the sequential steps."),
});

export type HowItWorks = z.infer<typeof howItWorksSchema>;

export const howItWorksPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: How It Works**

        <section-goal>
        The goal of the 'How It Works' section is to clearly and concisely explain the process a user goes through to use the product/service or achieve the main outcome. It simplifies complexity and builds confidence by showing the steps involved.
        </section-goal>

        <key-components>
        1.  **Section Headline:** Clearly indicates the section's purpose (e.g., "How It Works", "Get Started in 3 Easy Steps", "Our Simple Process").
        2.  **Numbered or Sequential Steps:** The core of the section, typically 3-5 steps.
        3.  **Step Title/Headline:** A short, action-oriented title for each step (e.g., "Sign Up", "Connect Your Account", "Launch Your Campaign", "See Results").
        4.  **Step Description:** A brief explanation (1-2 sentences) of what happens in that step or what the user needs to do.
        5.  **(Optional) Visuals per Step:** Simple icons or illustrations representing each step can greatly improve clarity and engagement.
        </key-components>

        <content-considerations>
        *   Identify the core process steps from the user-provided content or product description.
        *   Is the process broken down into logical, sequential steps?
        *   Are the step titles and descriptions clear, concise, and easy to follow?
        *   Is the number of steps appropriate (usually 3-5 is ideal)? Too many can be overwhelming.
        *   Are there visuals suggested or provided for each step?
        *   Does the flow make sense from the user's perspective?
        </content-considerations>
    `;
}