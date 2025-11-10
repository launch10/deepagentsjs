import { z } from 'zod';
import { baseSectionSchema } from './base';

export const contactFormSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the contact form section (e.g., 'Get in Touch')."),
    introText: z.string().nullable().describe("Optional introductory text above the form."),
    formFields: z.array(z.object({
        label: z.string().describe("The user-visible label for the form field (e.g., 'Your Name')."),
        // Basic type, could be expanded (e.g., select, textarea)
        // type: z.enum(['text', 'email', 'tel', 'textarea']).optional().default('text').describe("The input type for the field."),
        required: z.boolean().nullable().default(true).describe("Whether the field is required."),
        // Placeholder could also be added
    })).describe("An array defining the fields in the contact form."),
    submitButtonText: z.string().describe("The text displayed on the form submission button (e.g., 'Send Message')."),
    privacyPolicyLinkText: z.string().nullable().describe("Optional text for a link to the privacy policy."),
    alternativeContactInfo: z.string().nullable().describe("Alternative contact details displayed near the form (e.g., email, phone number).")
});

export type ContactFormType = z.infer<typeof contactFormSchema>;

// TODO: MOVE TO PROMPTS!!!
export const contactFormPrompt = `
**SECTION TYPE: Contact Form**

<section-goal>
The goal of the Contact Form section is to provide a clear and easy way for interested visitors to initiate contact, whether for sales inquiries, support questions, partnership proposals, or general information. It captures leads directly on the page.
</section-goal>

<key-components>
1.  **Section Headline:** Clearly indicates the purpose (e.g., "Contact Us", "Get in Touch", "Request a Quote", "Ask a Question").
2.  **(Optional) Introductory Text:** Brief text setting expectations, explaining why someone should contact, or providing alternative contact methods.
3.  **Form Fields:** Input fields for collecting necessary information. Standard fields include:
    *   Name (First, Last, or Full)
    *   Email Address (Essential)
    *   Message/Inquiry Box
    *   Other common fields: Phone Number, Company Name, Subject Line, Dropdown for Inquiry Type (e.g., Sales, Support). Mark required fields clearly.
4.  **Submit Button:** Clearly labeled button to submit the form (e.g., "Send Message", "Submit Inquiry", "Get Quote Now").
5.  **(Recommended) Privacy Policy Link:** Text linking to the website's privacy policy, often near the submit button.
6.  **(Optional) Alternative Contact Info:** Displaying an email address, phone number, or physical address alongside the form.
</key-components>

<content-considerations>
*   Does the user specify which form fields are needed?
*   Is the purpose of the form clear (general contact, sales quote, etc.)? This influences the headline and fields.
*   Are required fields indicated?
*   Is alternative contact information provided?
*   Is text for the privacy policy link mentioned?
</content-considerations>
`;