import { z } from 'zod';
import { baseSectionSchema } from './base';

export const footerSchema = baseSectionSchema.extend({
    layoutStructure: z.string().optional().describe('Description of the footer layout, e.g., "3 columns"'),
    copyrightNotice: z.string().optional().describe('Copyright notice, e.g., "© 2025 Company Name"'),
    legalLinks: z.array(z.object({
      text: z.string().describe('Text for the legal link, e.g., "Privacy Policy"'),
    })).optional(),
    navigationLinks: z.array(z.object({
      text: z.string().describe('Text for the navigation link, e.g., "About Us"'),
    })).optional(),
    socialMediaLinks: z.array(z.object({
      platform: z.string().describe('Social media platform, e.g., "Twitter"'),
    })).optional(),
    contactSnippet: z.string().optional().describe('Contact snippet, e.g., "Contact Us"'),
    newsletter: z.object({
      placeholder: z.string().optional().describe('Placeholder text for the newsletter field, e.g., "Enter your email"'),
      buttonText: z.string().optional().describe('Button text for the newsletter form, e.g., "Subscribe"'),
    }).optional(),
})

export type Footer = z.infer<typeof footerSchema>;
