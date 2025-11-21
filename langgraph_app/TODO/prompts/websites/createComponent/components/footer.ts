import { type Website } from "@types";
import { 
  linkingInstructionsPrompt,
  toXML,
  type PromptMetadata,
  renderPrompt
} from "@prompts";
interface FooterPromptProps {
  components?: string[];
}

export const footerPrompt = async ({ components }: FooterPromptProps): Promise<string> => {
  const linkingInstructions = await linkingInstructionsPrompt();
  return renderPrompt(`
    <section-specific-instructions>
      <section-goal>
        The goal of the Footer section is to provide a clear and concise 
        navigation menu for the website, as well as  any additional 
        important information such as copyright, links to social media, 
        links to important pages, etc.
        
        For context, here is a list of the
        available sections on the page. You may choose to include any or all
        of them in the navigation menu.
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

footerPrompt.promptMetadata = {
  name: "Footer Section",
  category: "Website Sections", 
  description: "Guidelines for creating a Footer section that details product capabilities and specifications",
  examples: [
    {
      availableSections: ["Nav", "Hero", "Features", "Benefits", "Pricing", "CTA", "Testimonials", "SocialProof", "Team", "FAQ", "Footer"],
    } as Website.Component.FooterComponentPlan
  ]
} as PromptMetadata;