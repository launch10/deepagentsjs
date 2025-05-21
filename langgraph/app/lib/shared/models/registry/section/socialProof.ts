import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const socialProofSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the social proof section (e.g., 'Trusted By')."),
    contentType: z.enum(['Logos', 'Stats', 'Awards', 'Mix']).describe("The primary type of social proof displayed."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    logos: z.array(z.string()).optional().describe("List of company names or identifiers for logos."),
    stats: z.array(z.object({
        value: z.string().describe("The statistic value (e.g., '10,000+', '98%')."),
        label: z.string().describe("The label or context for the statistic (e.g., 'Active Users', 'Customer Satisfaction').")
    })).optional().describe("List of key statistics."),
    awards: z.array(z.string()).optional().describe("List of award names or badges.")
});

export type SocialProof = z.infer<typeof socialProofSchema>;

export const socialProofPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: Social Proof (Logos, Stats, Awards)**

        <section-goal>
        The goal of this Social Proof section is to quickly build credibility and trust by showcasing endorsements, recognition, scale, or association with reputable entities. It uses borrowed authority (logos) or impressive numbers (stats) to reassure visitors. Often placed relatively high on the page (below hero) or near CTAs.
        </section-goal>

        <key-components>
        1.  **Section Headline (Often Minimal):** Simple and direct (e.g., "Trusted By", "Featured In", "Join Thousands of Satisfied Customers", or sometimes no headline, just the logos/stats).
        2.  **Logos:** High-quality logos of well-known clients, partners, or media publications where the company has been featured.
        3.  **Key Statistics/Metrics:** Impressive and relevant numbers (e.g., "10,000+ Users Worldwide", "98% Customer Satisfaction", "$5M Saved for Clients"). Should be easily verifiable or credible.
        4.  **(Optional) Awards/Badges:** Official badges or names of awards won.
        </key-components>

        <content-considerations>
        *   Analyze user content for lists of client names, media mentions, statistics, or awards.
        *   **Logos:** Are specific company names or logo files provided? Are they recognizable and relevant to the target audience? Quality matters.
        *   **Stats:** Are specific numbers provided? Are they impactful and easy to understand? Do they have context (e.g., "users" of what? "saved" how?)?
        *   **Awards:** Are specific award names mentioned?
        </content-considerations>
    `;
}