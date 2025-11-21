import { renderPrompt } from '@prompts';

export const teamPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Team section is to humanize the brand, build trust by showcasing the real people behind the company, 
        and potentially highlight relevant expertise (especially important for service-based businesses or startups).
      </section-goal>

      <key-components>
        <li>**Section Headline:** Introduces the team (e.g., "Meet the Team", "Our Experts", "The People Behind [Brand Name]").</li>
        <li>**Team Member Profiles:** Typically includes:
            <ul>
              <li>**Photo:** Professional, high-quality headshots. Consistency in style is good.</li>
              <li>**Name:** Full name of the team member.</li>
              <li>**Title/Role:** Their position within the company.</li>
            </ul>
        </li>
        <li>**(Optional) Short Bio:** Brief description highlighting relevant experience, expertise, or passion related to the company's mission. Keep it concise.</li>
        <li>**(Optional) Social Media Links:** Links to professional profiles like LinkedIn.</li>
      </key-components>

      <content-considerations>
        <li>Does the user provide names, titles, photos, or bios for team members?</li>
        <li>Are the photos professional and reasonably consistent?</li>
        <li>Are the titles clear?</li>
        <li>Do the optional bios add value by highlighting relevant expertise or personality?</li>
        <li>Is the selection of team members appropriate (e.g., key leadership, client-facing roles)?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};