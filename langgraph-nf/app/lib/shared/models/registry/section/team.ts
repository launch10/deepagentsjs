import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const teamSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the team section (e.g., 'Meet the Team')."),
    teamMembers: z.array(z.object({
        name: z.string().describe("Full name of the team member."),
        title: z.string().describe("Job title or role of the team member."),
        photoUrl: z.string().url().optional().describe("URL to the team member's photo."),
        bio: z.string().optional().describe("A short biography highlighting relevant experience or expertise."),
        socialLinks: z.array(z.object({
            platform: z.string().describe("Social media platform (e.g., 'LinkedIn', 'Twitter')."),
            url: z.string().url().describe("URL to the profile.")
        })).optional().describe("Links to the team member's social media profiles.")
    })).describe("An array of team member profiles.")
});

export type Team = z.infer<typeof teamSchema>;

export const teamPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: Team**

        <section-goal>
        The goal of the Team section is to humanize the brand, build trust by showcasing the real people behind the company, and potentially highlight relevant expertise (especially important for service-based businesses or startups).
        </section-goal>

        <key-components>
        1.  **Section Headline:** Introduces the team (e.g., "Meet the Team", "Our Experts", "The People Behind [Brand Name]").
        2.  **Team Member Profiles:** Typically includes:
            *   **Photo:** Professional, high-quality headshots. Consistency in style is good.
            *   **Name:** Full name of the team member.
            *   **Title/Role:** Their position within the company.
        3.  **(Optional) Short Bio:** Brief description highlighting relevant experience, expertise, or passion related to the company's mission. Keep it concise.
        4.  **(Optional) Social Media Links:** Links to professional profiles like LinkedIn.
        </key-components>   

        <content-considerations>
        *   Does the user provide names, titles, photos, or bios for team members?
        *   Are the photos professional and reasonably consistent?
        *   Are the titles clear?
        *   Do the optional bios add value by highlighting relevant expertise or personality?
        *   Is the selection of team members appropriate (e.g., key leadership, client-facing roles)?
        </content-considerations>
    `;
}