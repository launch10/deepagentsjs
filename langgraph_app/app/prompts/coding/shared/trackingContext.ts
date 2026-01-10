/**
 * Conversion tracking context for coding agents.
 * Describes the two main conversion patterns and lets the agent decide which applies.
 */
export const trackingContextPrompt = () => `
## Conversion Tracking

All landing pages require conversion tracking. Determine the appropriate pattern based on page structure:

### Scenario 1: Tiered Pricing Pages
When the page has pricing tiers (e.g., Basic/Pro/Enterprise), users click a tier to open a waitlist modal.
- Pass the tier price to track conversion value for ROAS measurement
- The tier value helps us understand which price points convert best
- We do not actually allow checkout - we only allow waitlist signups

\`\`\`tsx
// When user signs up from a pricing tier
const handleTierSignup = async (email: string, tierPrice: number) => {
  const response = await submitToWaitlist(email);
  if (response.ok) {
    L10.conversion({ label: 'signup', value: tierPrice });
  }
};
\`\`\`

### Scenario 2: Simple Waitlist/Signup
When the page has a basic signup form without pricing context (hero signup, footer CTA, etc.).
- Track with zero value since there's no tier selection

\`\`\`tsx
// Simple email signup without pricing
const handleSignup = async (email: string) => {
  const response = await submitToWaitlist(email);
  if (response.ok) {
    L10.conversion({ label: 'signup', value: 0 });
  }
};
\`\`\`

### Implementation Rules
- Import: \`import { L10 } from '@/lib/tracking'\`
- Fire on SUCCESS only (after API confirms signup, before showing thank-you state)
- One conversion per signup action, not on every button click
- Config uses \`import.meta.env.VITE_GOOGLE_ADS_ID\` (injected at build time)
`;
