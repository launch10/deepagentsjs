import { renderPrompt } from "@prompts";

export const benefitsPrompt = async (): Promise<string> => {
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Benefits section is to explain *why* the features matter to the user. 
        It translates features into positive outcomes, solutions to problems, and value propositions. 
        This section addresses the "What's in it for me?" question and connects 
        with the user's needs and desires on an emotional or practical level.
      </section-goal>

      <key-components>
        <li>**Section Headline:** Clearly identifies the section, often focusing on outcomes (e.g., "Unlock Your Potential", "Why Choose Us?", "Experience the Difference").</li>
        <li>**Benefit Statements:** Clear statements describing the positive results or advantages users gain. Often starts with a verb or focuses on the outcome (e.g., "Save hours every week", "Reduce costly errors", "Impress your clients").</li>
        <li>**Elaboration/Proof (Optional but Recommended):** Briefly explain *how* the product/service delivers that benefit, potentially linking back to a specific feature. (e.g., "Save hours every week *with our automated reporting feature*.")</li>
        <li>**(Optional) Supporting Visuals:** Images or icons that illustrate the benefit or the positive outcome (e.g., someone relaxing because they saved time, a graph showing growth).</li>
      </key-components>

      <content-considerations>
        <li>Analyze the user content for statements describing value, outcomes, or solutions.</li>
        <li>Distinguish benefits (the *result*) from features (the *tool*). Does the content explain the "so what?" of the features?</li>
        <li>Are the benefits specific and credible?</li>
        <li>Do they address known pain points or desires of the target audience?</li>
        <li>Are visuals suggested or provided that reinforce the benefits?</li>
      </content-considerations>
    </section-specific-instructions>
  `);
}