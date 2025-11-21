import { renderPrompt } from '@prompts';

export const customPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of this Custom section is to fulfill a specific user request that 
        doesn't fit neatly into other predefined section types 
        (like Hero, Features, Benefits, FAQ, Social Proof, etc.). 
        It allows for unique content blocks, layouts, or specific messaging tailored 
        entirely to the user's explicit instructions for this part of the landing page. 
        Its purpose is dictated solely by the user's input for this section.
      </section-goal>

      <key-components>
        <li>**Highly Variable:** Components depend entirely on the user's prompt for this section.</li>
        <li>**Common Elements Often Requested:**
            <ul>
              <li>**Headline:** A title for the section.</li>
              <li>**Paragraphs:** Descriptive or explanatory content.</li>
              <li>**Visuals:** Specific images, videos, or illustrations described by the user.</li>
              <li>**Lists:** Bulleted or numbered points.</li>
              <li>**Call-to-Action (CTA):** A specific button or link request.</li>
              <li>**Specific Layout Instructions:** User might describe columns, arrangements, etc.</li>
            </ul>
        </li>
        <li>**Primary Component:** The user's raw instruction or description for what this section should contain and achieve.</li>
      </key-components>

      <content-considerations>
        <li>**PRIORITY: Interpret User's Intent:** Carefully analyze the user's 
            prompt specifically for this section. What content elements are they 
            explicitly asking for (text, images, lists, CTAs)? What is the apparent 
            purpose or message?</li>
        <li>**Identify Key Information:** Extract headlines, body text, descriptions 
            of visuals, list items, CTA text, and any layout preferences mentioned.</li>
        <li>**Tone and Style:** Match the tone requested or implied in the user's 
            prompt for this section, while ensuring it aligns overall with the page's context.</li>
        <li>**Placement Context:** Consider where this section might logically fit 
            based on its content, if the user hasn't specified placement. Does it 
            support the sections before and after it?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};