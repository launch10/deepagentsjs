import { z } from 'zod';
import { baseSectionSchema } from './base';

export const footerSchema = baseSectionSchema.extend({
    layoutStructure: z.string().nullable().describe('Description of the footer layout, e.g., "3 columns"'),
    copyrightNotice: z.string().nullable().describe('Copyright notice, e.g., "© 2025 Company Name"'),
    legalLinks: z.array(z.object({
      text: z.string().describe('Text for the legal link, e.g., "Privacy Policy"'),
    })).nullable(),
    navigationLinks: z.array(z.object({
      text: z.string().describe('Text for the navigation link, e.g., "About Us"'),
    })).nullable(),
    socialMediaLinks: z.array(z.object({
      platform: z.string().describe('Social media platform, e.g., "Twitter"'),
    })).nullable(),
    contactSnippet: z.string().nullable().describe('Contact snippet, e.g., "Contact Us"'),
    newsletter: z.object({
      placeholder: z.string().nullable().describe('Placeholder text for the newsletter field, e.g., "Enter your email"'),
      buttonText: z.string().nullable().describe('Button text for the newsletter form, e.g., "Subscribe"'),
    }).nullable(),
})

export type FooterType = z.infer<typeof footerSchema>;
