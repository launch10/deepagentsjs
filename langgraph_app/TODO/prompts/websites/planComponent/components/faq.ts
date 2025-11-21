import { renderPrompt } from '@prompts';

export const faqPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the FAQ section is to proactively address common questions, concerns, and potential objections that visitors might have. 
        It aims to reduce uncertainty, build trust, save support time, and help users make an informed decision.
      </section-goal>

      <key-components>
        <li>**Section Headline:** Clearly identifies the section (e.g., "Frequently Asked Questions", "Have Questions?", "Answers to Your Questions").</li>
        <li>**List of Questions:** Clear, concise questions that reflect genuine user queries or potential barriers.</li>
        <li>**List of Answers:** Direct, helpful, and easy-to-understand answers to each question.</li>
        <li>**(Optional) Categorization:** For extensive FAQs, group questions by topic (e.g., General, Pricing, Technical).</li>
        <li>**(Optional) Expand/Collapse Functionality:** Allows users to easily scan questions and expand only the ones relevant to them.</li>
      </key-components>

      <content-considerations>
        <li>Analyze the user-provided questions and answers.</li>
        <li>Are the questions relevant to the product/service and target audience?</li>
        <li>Are the answers clear, concise, and accurate?</li>
        <li>Do the Q&As address potential objections or points of confusion?</li>
        <li>Is the list long enough to warrant categorization?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};