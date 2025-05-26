import { z } from 'zod';
import { baseSectionSchema } from './base';
import type { GraphState } from '../../../state/graph';

export const ctaSchema = baseSectionSchema.extend({
    headline: z.string().optional().describe("The headline for the CTA section (e.g., 'Ready to Get Started?')."),
    supportingText: z.string().optional().describe("Supporting text for the CTA section (e.g., 'Don't miss out on this opportunity!')."),
    paragraphs: z.string().optional().describe("Paragraphs of text to be included in the section."),
    cta: z.object({
      text: z.string().describe("The text for the primary CTA button (e.g., 'Start Your Free Trial')."),
    }),
    supportingVisualOrTrustSignal: z.string().optional(),
});

export type Cta = z.infer<typeof ctaSchema>;

export const ctaPrompt = (state: GraphState) => {
    return `
      **SECTION TYPE: CTA (Call to Action - Dedicated Section)**

      <section-goal>
      The goal of a dedicated CTA section is to provide a prominent, focused opportunity for conversion, often placed near the end of the page or after a key benefit section. It serves as a strong final nudge, reinforcing the main value proposition and making the desired next step unmissable.
      </section-goal>

      <key-components>
      1.  **Compelling Headline:** Action-oriented or benefit-focused headline to grab attention within this section (e.g., "Ready to Get Started?", "Transform Your Workflow Today", "Don't Miss Out").
      2.  **(Optional) Supporting Text:** Brief text (1-2 sentences) reinforcing the value proposition, addressing a key pain point, or adding urgency/scarcity.
      3.  **Prominent CTA Button:** Large, visually distinct button with clear, action-oriented text (e.g., "Start Your Free Trial", "Request Demo Now", "Get Instant Access"). Should align with the primary conversion goal.
      4.  **(Optional) Minimal Visuals/Trust Signals:** Sometimes includes a relevant subtle image, short testimonial snippet, or guarantee icon to support the CTA.
      </key-components>

      <content-considerations>
      *   Analyze the user content for a potential dedicated CTA section.
      *   Is there a clear headline intended for this purpose?
      *   Is there supporting copy? Is it concise and persuasive?
      *   Is the CTA button text strong and clear? Is the link/action defined?
      *   Does this section feel focused on a single, primary action?
      </content-considerations>
  `;
}