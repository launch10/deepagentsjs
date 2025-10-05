import { 
  linkingInstructionsPrompt,
  toXML,
  renderPrompt
} from "@prompts";
interface NavPromptProps {
  components?: string[];
}

export const navPrompt = async ({ components }: NavPromptProps): Promise<string> => {
  const linkingInstructions = await linkingInstructionsPrompt();
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Nav section is to provide a clear and concise 
        navigation menu for the website. For context, here is a list of the
        available sections on the page. You may choose to include any or all
        of them in the navigation menu.

        Please be sure to include all important links the user should know about.
      </section-goal>

      ${toXML({
        values: components || [],
        tag: "available-sections",
        itemTag: "section",
        sortOption: 'none'
      })}

      ${linkingInstructions}
    </section-specific-instructions>
  `);
};