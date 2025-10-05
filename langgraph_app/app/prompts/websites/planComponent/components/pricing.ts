import { renderPrompt } from '@prompts';

export const pricingPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Pricing section is to clearly and transparently communicate the cost of the product or service and what is included in each option. 
        It should help users understand the value they receive for the price and enable them to select the plan that best fits their needs and budget.
      </section-goal>

      <key-components>
        <li>**Section Headline:** Clearly identifies the section (e.g., "Pricing Plans", "Choose Your Plan", "Simple, Transparent Pricing").</li>
        <li>**Pricing Tiers/Plans:** Distinct columns or blocks for each available plan (e.g., Free, Basic, Pro, Enterprise). Each needs a clear name.</li>
        <li>**Price:** The cost of each plan, prominently displayed. Must specify the billing frequency (e.g., per month, per year, one-time).</li>
        <li>**Plan Description/Audience:** A brief description of who each plan is best suited for (e.g., "Ideal for freelancers", "For growing teams").</li>
        <li>**Feature List per Plan:** Bullet points or checkmarks indicating the key features included in each specific tier. Clear differentiation is key.</li>
        <li>**Call to Action (CTA) per Plan:** A button for each plan allowing users to sign up, purchase, or learn more about that specific option (e.g., "Sign Up", "Buy Now", "Contact Sales").</li>
        <li>**(Optional) Highlighted Plan:** Visually emphasize the most popular or recommended plan.</li>
        <li>**(Optional) Billing Frequency Toggle:** Allow users to switch between monthly and annual pricing (if applicable, often showing savings for annual).</li>
        <li>**(Optional) Guarantee/Trial Info:** Mention money-back guarantees or free trial periods.</li>
      </key-components>

      <content-considerations>
        <li>Analyze the user-provided pricing information.</li>
        <li>Are there distinct plans with names, prices, and billing frequencies?</li>
        <li>Is the list of features included in each plan clear? Is the difference between plans obvious?</li>
        <li>Is there a CTA for each plan?</li>
        <li>Is information about trials, guarantees, or different billing cycles provided?</li>
        <li>Is the value proposition clear for each tier relative to its price?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};