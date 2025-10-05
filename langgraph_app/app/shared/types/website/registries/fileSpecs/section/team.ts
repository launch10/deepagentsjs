import { z } from 'zod';
import { baseSectionSchema } from './base';

export const teamSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the team section (e.g., 'Meet the Team')."),
    teamMembers: z.array(z.object({
        name: z.string().describe("Full name of the team member."),
        title: z.string().describe("Job title or role of the team member."),
        bio: z.string().nullable().describe("A short biography highlighting relevant experience or expertise."),
        socialLinks: z.array(z.object({
            platform: z.string().describe("Social media platform (e.g., 'LinkedIn', 'Twitter')."),
        })).nullable().describe("Links to the team member's social media profiles.")
    })).describe("An array of team member profiles.")
});

export type TeamType = z.infer<typeof teamSchema>;
