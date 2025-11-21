import { renderPrompt } from '@prompts';

export const howItWorksPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the 'How It Works' section is to clearly and concisely explain the process a user goes through to use the product/service or achieve the main outcome. 
        It simplifies complexity and builds confidence by showing the steps involved.
      </section-goal>

      <key-components>
        <li>**Section Headline:** Clearly indicates the section's purpose (e.g., "How It Works", "Get Started in 3 Easy Steps", "Our Simple Process").</li>
        <li>**Numbered or Sequential Steps:** The core of the section, typically 3-5 steps.</li>
        <li>**Step Title/Headline:** A short, action-oriented title for each step (e.g., "Sign Up", "Connect Your Account", "Launch Your Campaign", "See Results").</li>
        <li>**Step Description:** A brief explanation (1-2 sentences) of what happens in that step or what the user needs to do.</li>
        <li>**(Optional) Visuals per Step:** Simple icons or illustrations representing each step can greatly improve clarity and engagement.</li>
      </key-components>

      <content-considerations>
        <li>Identify the core process steps from the user-provided content or product description.</li>
        <li>Is the process broken down into logical, sequential steps?</li>
        <li>Are the step titles and descriptions clear, concise, and easy to follow?</li>
        <li>Is the number of steps appropriate (usually 3-5 is ideal)? Too many can be overwhelming.</li>
        <li>Are there visuals suggested or provided for each step?</li>
        <li>Does the flow make sense from the user's perspective?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};
