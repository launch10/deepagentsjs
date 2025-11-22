import { renderPrompt } from '@prompts';

export const ctaPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of a dedicated CTA section is to provide a prominent, 
        focused opportunity for conversion, often placed near the end of the 
        page or after a key benefit section. It serves as a strong final nudge, 
        reinforcing the main value proposition and making the desired next step unmissable.
      </section-goal>

      <key-components>
        <li>**Compelling Headline:** Action-oriented or benefit-focused headline 
        to grab attention within this section (e.g., "Ready to Get Started?", 
        "Transform Your Workflow Today", "Don't Miss Out").</li>
        <li>**(Optional) Supporting Text:** Brief text (1-2 sentences) reinforcing 
        the value proposition, addressing a key pain point, or adding urgency/scarcity.</li>
        <li>**Prominent CTA Button:** Large, visually distinct button with clear, 
        action-oriented text (e.g., "Start Your Free Trial", "Request Demo Now", 
        "Get Instant Access"). Should align with the primary conversion goal.</li>
        <li>**(Optional) Minimal Visuals/Trust Signals:** Sometimes includes a relevant 
        subtle image, short testimonial snippet, or guarantee icon to support the CTA.</li>
      </key-components>

      <content-considerations>
        <li>Analyze the user content for a potential dedicated CTA section.</li>
        <li>Is there a clear headline intended for this purpose?</li>
        <li>Is there supporting copy? Is it concise and persuasive?</li>
        <li>Is the CTA button text strong and clear? Is the link/action defined?</li>
        <li>Does this section feel focused on a single, primary action?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
}