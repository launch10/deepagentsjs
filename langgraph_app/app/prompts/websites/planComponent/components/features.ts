import { renderPrompt } from '@prompts';

export const featuresPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Features section is to detail *what* the product or 
        service specifically *does* or *includes*. 
        It focuses on the concrete capabilities, components, or specifications. 
        This section helps logical buyers understand the tangible aspects of the offering.
      </section-goal>

      <key-components>
        <li>**Section Headline:** Clearly identifies the section 
        (e.g., "Explore Key Features", "What's Included", "Packed with Powerful Tools").</li>
        <li>**Feature List:** Typically presented as distinct blocks or list items.</li>
        <li>**Feature Title/Name:** A concise name for each feature.</li>
        <li>**Feature Description:** A brief explanation (1-3 sentences) of 
        what the feature does. Should be clear and easy to understand.</li>
        <li>**(Optional) Icons or Small Visuals:** An icon or simple graphic 
        representing each feature can improve scannability and visual appeal.</li>
      </key-components>

      <content-considerations>
        <li>Identify the list of features provided by the user.</li>
        <li>Does each feature have a clear name and description?</li>
        <li>Are the descriptions focused on *what it is* or *what it does* 
        (not *why* it matters - that's for Benefits)?</li>
        <li>Is the level of technical detail appropriate for the target audience?</li>
        <li>Are there suggestions or assets for icons/visuals?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
};