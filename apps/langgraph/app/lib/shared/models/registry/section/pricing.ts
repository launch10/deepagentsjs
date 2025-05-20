import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '@shared/state/graph';

export const pricingSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the pricing section (e.g., 'Choose Your Plan')."),
    billingCycleToggleInfo: z.string().optional().describe("Information about billing cycle options (e.g., 'Save 20% with annual billing')."),
    plans: z.array(z.object({
        name: z.string().describe("Name of the pricing plan (e.g., 'Basic', 'Pro')."),
        price: z.string().describe("The price of the plan (e.g., '$19', 'Free')."),
        billingFrequency: z.string().describe("How often the price is charged (e.g., 'per month', 'per year')."),
        description: z.string().optional().describe("A brief description of who the plan is best for."),
        features: z.array(z.string()).describe("List of key features included in this plan."),
        cta_text: z.string().describe("Text for the call-to-action button (e.g., 'Sign Up', 'Buy Now')."),
        cta_link_or_goal: z.string().optional().describe("The target link or goal for the CTA button."),
        highlight: z.boolean().optional().describe("Whether this plan should be visually highlighted (e.g., 'Most Popular').")
    })).describe("An array containing the details for each pricing plan."),
    guaranteeTrialInfo: z.string().optional().describe("Text describing any money-back guarantee or free trial period."),
});

export type Pricing = z.infer<typeof pricingSchema>;

export const pricingPrompt = (state: GraphState) => {
    return `
        **SECTION TYPE: Pricing**

        <section-goal>
        The goal of the Pricing section is to clearly and transparently communicate the cost of the product or service and what is included in each option. It should help users understand the value they receive for the price and enable them to select the plan that best fits their needs and budget.
        </section-goal>

        <key-components>
        1.  **Section Headline:** Clearly identifies the section (e.g., "Pricing Plans", "Choose Your Plan", "Simple, Transparent Pricing").
        2.  **Pricing Tiers/Plans:** Distinct columns or blocks for each available plan (e.g., Free, Basic, Pro, Enterprise). Each needs a clear name.
        3.  **Price:** The cost of each plan, prominently displayed. Must specify the billing frequency (e.g., per month, per year, one-time).
        4.  **Plan Description/Audience:** A brief description of who each plan is best suited for (e.g., "Ideal for freelancers", "For growing teams").
        5.  **Feature List per Plan:** Bullet points or checkmarks indicating the key features included in each specific tier. Clear differentiation is key.
        6.  **Call to Action (CTA) per Plan:** A button for each plan allowing users to sign up, purchase, or learn more about that specific option (e.g., "Sign Up", "Buy Now", "Contact Sales").
        7.  **(Optional) Highlighted Plan:** Visually emphasize the most popular or recommended plan.
        8.  **(Optional) Billing Frequency Toggle:** Allow users to switch between monthly and annual pricing (if applicable, often showing savings for annual).
        9.  **(Optional) Guarantee/Trial Info:** Mention money-back guarantees or free trial periods.
        </key-components>

        <content-considerations>
        *   Analyze the user-provided pricing information.
        *   Are there distinct plans with names, prices, and billing frequencies?
        *   Is the list of features included in each plan clear? Is the difference between plans obvious?
        *   Is there a CTA for each plan?
        *   Is information about trials, guarantees, or different billing cycles provided?
        *   Is the value proposition clear for each tier relative to its price?
        </content-considerations>
    `;
}