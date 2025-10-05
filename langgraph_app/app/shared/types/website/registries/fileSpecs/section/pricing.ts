import { z } from 'zod';
import { baseSectionSchema } from './base';

export const pricingSchema = baseSectionSchema.extend({
    headline: z.string().nullable().describe("The headline for the pricing section (e.g., 'Choose Your Plan')."),
    billingCycleToggleInfo: z.string().nullable().describe("Information about billing cycle options (e.g., 'Save 20% with annual billing')."),
    plans: z.array(z.object({
        name: z.string().describe("Name of the pricing plan (e.g., 'Basic', 'Pro')."),
        price: z.string().describe("The price of the plan (e.g., '$19', 'Free')."),
        billingFrequency: z.string().describe("How often the price is charged (e.g., 'per month', 'per year')."),
        description: z.string().nullable().describe("A brief description of who the plan is best for."),
        features: z.array(z.string()).describe("List of key features included in this plan."),
        ctaText: z.string().describe("Text for the call-to-action button (e.g., 'Sign Up', 'Buy Now')."),
        cta_link_or_goal: z.string().nullable().describe("The target link or goal for the CTA button."),
        highlight: z.boolean().nullable().describe("Whether this plan should be visually highlighted (e.g., 'Most Popular').")
    })).describe("An array containing the details for each pricing plan."),
    guaranteeTrialInfo: z.string().nullable().describe("Text describing any money-back guarantee or free trial period."),
});

export type PricingType = z.infer<typeof pricingSchema>;
