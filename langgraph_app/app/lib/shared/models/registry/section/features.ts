import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const featuresSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the features section (e.g., 'Explore Key Features')."),
    subheadline: z.string().optional().describe("Supporting text below the headline."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    features: z.array(z.object({
        name: z.string().describe("The name of the feature."),
        description: z.string().describe("A brief description of the feature."),
        visual: z.string().optional().describe("Description of the desired primary visual (image/video)."),
    })),
    cta: z.string().optional().describe("Text for a call-to-action button, if desired.")
})

export type Features = z.infer<typeof featuresSchema>;

export const featuresPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: Features**

        <section-goal>
        The goal of the Features section is to detail *what* the product or service specifically *does* or *includes*. It focuses on the concrete capabilities, components, or specifications. This section helps logical buyers understand the tangible aspects of the offering.
        </section-goal>

        <key-components>
        1.  **Section Headline:** Clearly identifies the section (e.g., "Explore Key Features", "What's Included", "Packed with Powerful Tools").
        2.  **Feature List:** Typically presented as distinct blocks or list items.
        3.  **Feature Title/Name:** A concise name for each feature.
        4.  **Feature Description:** A brief explanation (1-3 sentences) of what the feature does. Should be clear and easy to understand.
        5.  **(Optional) Icons or Small Visuals:** An icon or simple graphic representing each feature can improve scannability and visual appeal.
        </key-components>

        <content-considerations>
        *   Identify the list of features provided by the user.
        *   Does each feature have a clear name and description?
        *   Are the descriptions focused on *what it is* or *what it does* (not *why* it matters - that's for Benefits)?
        *   Is the level of technical detail appropriate for the target audience?
        *   Are there suggestions or assets for icons/visuals?
        </content-considerations>
    `;
}