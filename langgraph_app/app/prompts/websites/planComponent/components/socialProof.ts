import { renderPrompt } from '@prompts';

export const socialProofPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of this Social Proof section is to quickly build credibility and trust by showcasing endorsements, recognition, scale, or association with reputable entities. 
        It uses borrowed authority (logos) or impressive numbers (stats) to reassure visitors. 
        Often placed relatively high on the page (below hero) or near CTAs.
      </section-goal>

      <key-components>
        <li>**Section Headline (Often Minimal):** Simple and direct (e.g., "Trusted By", "Featured In", "Join Thousands of Satisfied Customers", or sometimes no headline, just the logos/stats).</li>
        <li>**Logos:** High-quality logos of well-known clients, partners, or media publications where the company has been featured.</li>
        <li>**Statistics:** Impressive and relevant numbers (e.g., "10,000+ Users Worldwide", "98% Customer Satisfaction", "$5M Saved for Clients"). Should be easily verifiable or credible.</li>
        <li>**(Optional) Awards/Badges:** Official badges or names of awards won.</li>
      </key-components>

      <content-considerations>
        <li>Analyze user content for lists of client names, media mentions, statistics, or awards.</li>
        <li>**Logos:** Are specific company names or logo files provided? Are they recognizable and relevant to the target audience? Quality matters.</li>
        <li>**Stats:** Are specific numbers provided? Are they impactful and easy to understand? Do they have context (e.g., "users" of what? "saved" how?)?</li>
        <li>**Awards:** Are specific award names mentioned?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};
