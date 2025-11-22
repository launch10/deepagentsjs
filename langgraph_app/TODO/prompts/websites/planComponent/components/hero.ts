import { renderPrompt } from '@prompts';

export const heroPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Hero section is to immediately capture visitor attention, 
        clearly communicate the core value proposition, and compel them to learn more 
        (scroll down or click the CTA). It sets the first impression. 
        The primary visual (image/video) is crucial for conveying context, benefit, 
        or emotion quickly. It should ideally feature a single, clear, and 
        compelling Call to Action (CTA). The headline should be bold, 
        benefit-oriented, and concise, supported by a sub-headline that adds 
        clarity or context.
      </section-goal>

      <key-components>
        <li>**Primary Headline:** Large, prominent text. Focuses on the main benefit or solution. (e.g., "Effortless Project Management for Busy Teams")</li>
        <li>**Sub-headline:** Smaller text below the headline. Elaborates on the headline, clarifies the offering, or highlights a key feature/outcome. (e.g., "Stop juggling spreadsheets and emails. Our platform centralizes communication, tasks, and deadlines.")</li>
        <li>**Primary Visual:** High-quality image, video, or animation. Should show the product in use, visualize the benefit, represent the target audience, or evoke the desired emotion. Must be relevant and captivating.</li>
        <li>**Primary Call to Action (CTA):** Clearly defined button with action-oriented text. Should represent the primary conversion goal of the page. (e.g., "Get Started Free", "Request a Demo", "Download the Guide")</li>
        <li>**(Optional) Trust Signals:** Subtle logos, short testimonial snippet, or key stat placed non-intrusively.</li>
      </key-components>

      <content-considerations>
        <li>Analyze the user-provided content for elements matching the key components.</li>
        <li>**Headline:** Is it concise, impactful, and benefit-driven? Does it speak directly to the target audience's need or desire?</li>
        <li>**Sub-headline:** Does it effectively support the headline? Does it add necessary detail without being too long?</li>
        <li>**Visual:** Is a specific visual mentioned or provided? If described, does the description align with the goal (context, benefit, emotion)? Is it high-quality?</li>
        <li>**CTA:** Is the text clear, action-oriented, and aligned with the main goal? Is the destination link specified or implied?</li>
        <li>**Value Proposition:** Is the core value clearly communicated within the first few seconds through the combination of headline, sub-headline, and visual?</li>
      </content-considerations>

      <important>
        DO NOT make the Hero section cover the entire viewport, or be the full height of the page. The hero section should be the height of the content.
      </important>
    </section-specific-instructions>
  `);
};