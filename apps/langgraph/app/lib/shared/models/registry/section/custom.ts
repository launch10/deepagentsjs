import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '@shared/state/graph';

export const customSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the custom section, if requested."),
    subheadline: z.string().optional().describe("A subheadline or introductory text, if requested."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    visualDescription: z.string().optional().describe("Description of the desired visual (image/video) based on user prompt (e.g., 'Illustration of team working', 'Screenshot of dashboard feature X'). Not necessarily a URL."),
    listItems: z.array(z.string()).optional().describe("List of text items, if the user requested a bulleted or numbered list."),
    // Store the original user prompt for reference/debugging
    userPrompt: z.string().optional().describe("The original user instruction provided for this specific custom section."),
    // Allow for a CTA if explicitly requested for this section
    cta: z.string().optional().describe("Text for a call-to-action button, if requested for this section.")
})

export type Custom = z.infer<typeof customSchema>;

export const customPrompt = (state: GraphState) => {
    return `
    **SECTION TYPE: Custom**

    <section-goal>
    The goal of this Custom section is to fulfill a specific user request that doesn't fit neatly into other predefined section types (like Hero, Features, Benefits, FAQ, Social Proof, etc.). It allows for unique content blocks, layouts, or specific messaging tailored entirely to the user's explicit instructions for this part of the landing page. Its purpose is dictated solely by the user's input for this section.
    </section-goal>

    <key-components>
    *   **Highly Variable:** Components depend entirely on the user's prompt for this section.
    *   **Common Elements Often Requested:**
        *   **Headline:** A title for the section.
        *   **Paragraphs:** Descriptive or explanatory content.
        *   **Visuals:** Specific images, videos, or illustrations described by the user.
        *   **Lists:** Bulleted or numbered points.
        *   **Call-to-Action (CTA):** A specific button or link request.
        *   **Specific Layout Instructions:** User might describe columns, arrangements, etc.
    *   **Primary Component:** The user's raw instruction or description for what this section should contain and achieve.
    </key-components>

    <content-considerations>
    *   **PRIORITY: Interpret User's Intent:** Carefully analyze the user's prompt *specifically for this section*. What content elements are they explicitly asking for (text, images, lists, CTAs)? What is the apparent purpose or message?
    *   **Identify Key Information:** Extract headlines, body text, descriptions of visuals, list items, CTA text, and any layout preferences mentioned.
    *   **Tone and Style:** Match the tone requested or implied in the user's prompt for this section, while ensuring it aligns overall with the page's context.
    *   **Placement Context:** Consider where this section might logically fit based on its content, if the user hasn't specified placement. Does it support the sections before and after it?
    </content-considerations>
    `;
}