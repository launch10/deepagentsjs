import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const testimonialsSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the testimonials section (e.g., 'What Our Customers Say')."),
    subheadline: z.string().optional().describe("Optional supporting text below the headline."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    testimonials: z.array(z.object({
        quote: z.string().describe("The customer's testimonial quote."),
        name: z.string().describe("The name of the person providing the testimonial."),
        title_company: z.string().describe("Job title and/or company for context."),
        photoUrl: z.string().url().optional().describe("URL to the testimonial's photo."),
        location: z.string().optional().describe("Optional location (e.g., City, State)."),
        starRating: z.number().optional().describe("Star rating if applicable (e.g., 4.5 stars)."),
    })).describe("An array of testimonials.")
});

export type Testimonials = z.infer<typeof testimonialsSchema>;

export const testimonialsPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: Testimonials**

        <section-goal>
        The goal of the Testimonials section is to build trust, credibility, and social proof by showcasing positive feedback from real, satisfied customers or users. It helps overcome skepticism by demonstrating that others have achieved success or satisfaction with the offering.
        </section-goal>

        <key-components>
        1.  **Section Headline:** Clearly identifies the section (e.g., "What Our Customers Say", "Trusted by Thousands", "Real Results").
        2.  **Testimonial Quote:** The actual words from the customer. Should ideally be specific, benefit-oriented, and authentic. Highlight the most impactful part.
        3.  **Attribution:** Name of the person providing the testimonial.
        4.  **Title/Company (Context):** Job title, company name, or other relevant context (e.g., "Small Business Owner," "Marketing Manager at Acme Corp"). Adds credibility.
        5.  **(Highly Recommended) Photo or Video:** A picture or video of the person significantly increases trust and authenticity.
        6.  **(Optional) Location:** City/State or Country can add context.
        7.  **(Optional) Star Rating:** A visual rating if applicable (e.g., for reviews).
        </key-components>

        <content-considerations>
        *   Analyze the user-provided testimonials.
        *   Does each testimonial include a quote, name, and context (title/company)?
        *   Are photos or video links provided?
        *   Are the quotes specific and impactful? Do they mention specific benefits or results?
        *   Is there a good variety of testimonials (e.g., representing different user types or benefits)?
        </content-considerations>
    `;
}