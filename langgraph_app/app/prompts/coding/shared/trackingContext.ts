/**
 * Lead capture and conversion tracking context for coding agents.
 * L10.createLead() handles both the API call and conversion tracking transparently.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const trackingContextPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Lead Capture & Conversion Tracking

All landing pages capture email leads via \`L10.createLead()\`. This single call handles:
1. Submitting the email to our backend API
2. Firing Google Ads conversion tracking on success

### Scenario 1: Tiered Pricing Pages
When the page has pricing tiers (e.g., Basic/Pro/Enterprise), pass the tier price for ROAS measurement.

\`\`\`tsx
const handleTierSignup = (email: string, tierPrice: number) => {
  L10.createLead(email, { value: tierPrice })
    .then(() => setStatus('success'))
    .catch((e) => setError(e.message));
};
\`\`\`

### Scenario 2: Simple Waitlist/Signup
For basic signup forms without pricing context (hero signup, footer CTA, etc.).

\`\`\`tsx
const handleSignup = (email: string) => {
  L10.createLead(email)
    .then(() => setStatus('success'))
    .catch((e) => setError(e.message));
};
\`\`\`

### Implementation Rules
- Import: \`import { L10 } from '@/lib/tracking'\`
- Use \`L10.createLead(email)\` for all email signups - it handles everything
- Pass \`{ value: tierPrice }\` only when user selected a pricing tier
- Resolves on success, rejects on error - use \`.then()/.catch()\` or try/catch
`;
