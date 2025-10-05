import { renderPrompt } from '@prompts';

export const testimonialsPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Testimonials section is to build trust, credibility, and social proof by showcasing positive feedback from real, satisfied customers or users. 
        It helps overcome skepticism by demonstrating that others have achieved success or satisfaction with the offering.
      </section-goal>

      <key-components>
        <li>**Section Headline:** Clearly identifies the section (e.g., "What Our Customers Say", "Trusted by Thousands", "Real Results").</li>
        <li>**Testimonial Quote:** The actual words from the customer. Should ideally be specific, benefit-oriented, and authentic. Highlight the most impactful part.</li>
        <li>**Attribution:** Name of the person providing the testimonial.</li>
        <li>**Title/Company (Context):** Job title, company name, or other relevant context (e.g., "Small Business Owner," "Marketing Manager at Acme Corp"). Adds credibility.</li>
        <li>**(Highly Recommended) Photo or Video:** A picture or video of the person significantly increases trust and authenticity.</li>
        <li>**(Optional) Location:** City/State or Country can add context.</li>
        <li>**(Optional) Star Rating:** A visual rating if applicable (e.g., for reviews).</li>
      </key-components>

      <content-considerations>
        <li>Analyze the user-provided testimonials.</li>
        <li>Does each testimonial include a quote, name, and context (title/company)?</li>
        <li>Are photos or video links provided?</li>
        <li>Are the quotes specific and impactful? Do they mention specific benefits or results?</li>
        <li>Is there a good variety of testimonials (e.g., representing different user types or benefits)?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};