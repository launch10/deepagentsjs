/**
 * Lead capture and conversion tracking context for coding agents.
 * Uses the LeadForm compound component for all lead capture forms.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const trackingPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Lead Capture & Conversion Tracking

Use the \`LeadForm\` compound component for ALL lead capture forms. It handles validation, loading states, error display, and conversion tracking automatically.

\`\`\`ts
import { LeadForm } from "@/components/ui/lead-form";
\`\`\`

### Scenario 1: Email-Only (Hero CTA, Waitlist)

Use for simple signup forms — hero sections, footer CTAs, waitlists. This is the default for most forms.

\`\`\`tsx
<LeadForm className="flex gap-2">
  <LeadForm.Email placeholder="Enter your email" className="flex-1" />
  <LeadForm.Submit>Get Started</LeadForm.Submit>
  <LeadForm.Success><p>Thanks! We'll be in touch.</p></LeadForm.Success>
  <LeadForm.Error />
</LeadForm>
\`\`\`

### Scenario 2: Email + Name + Phone (Standard Signup)

Use when the form collects name and/or phone — contact forms, service signups, appointment booking, local businesses.

\`\`\`tsx
<LeadForm className="flex flex-col gap-4">
  <LeadForm.Name placeholder="Your name" />
  <LeadForm.Email placeholder="Email address" />
  <LeadForm.Phone placeholder="Phone number" />
  <LeadForm.Submit className="w-full">Sign Up</LeadForm.Submit>
  <LeadForm.Success><p>Thanks! We'll be in touch.</p></LeadForm.Success>
  <LeadForm.Error />
</LeadForm>
\`\`\`

### Scenario 3: Tiered Pricing

Use when the page has pricing tiers. Pass the tier price via the \`value\` prop for ROAS measurement.

\`\`\`tsx
<LeadForm value={49} className="flex flex-col gap-3">
  <LeadForm.Email placeholder="Email address" />
  <LeadForm.Submit className="w-full">Get Started</LeadForm.Submit>
  <LeadForm.Success><p>Thanks!</p></LeadForm.Success>
  <LeadForm.Error />
</LeadForm>
\`\`\`

### Rules

- \`LeadForm.Email\` is always required — include it in every form
- \`LeadForm.Name\` and \`LeadForm.Phone\` are optional — only include if the form needs them
- Style with \`className\` — the component handles validation and error states automatically
- Always include \`<LeadForm.Success>\` with a thank-you message and \`<LeadForm.Error />\`
- For tiered pricing, pass \`value={price}\` to \`<LeadForm>\`

### When to Use Each Pattern

- **Default (email-only):** Hero signups, CTA sections, simple waitlists
- **Email + name + phone:** When the business type suggests it (services, appointments, local businesses) or the brainstorm mentions collecting names/phones
- **Tiered pricing:** When the page has pricing tiers with specific prices

`;
