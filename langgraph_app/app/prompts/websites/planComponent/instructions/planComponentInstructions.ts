import { Website } from "@types";
import { componentSpecificInstructions } from "../components/componentSpecificInstructions";
import { type PromptMetadata, renderPrompt } from '@prompts';

interface PlanSectionInstructionsProps {
    componentType: string;
    websiteId: number;
}

type ComponentTypeKey = keyof typeof Website.Component.ComponentTypeEnum;

export const planComponentInstructionsPrompt = async ({ componentType, websiteId }: PlanSectionInstructionsProps): Promise<string> => {
    const componentTypeKey = componentType as ComponentTypeKey;
    const specificInstructions = await componentSpecificInstructions({componentType: componentTypeKey, websiteId});
    return renderPrompt(`
      <instructions>
          1. **Analyze Input:** Carefully review the provided <section_overview> and <brand_guidelines>.
          2. **Analyze Existing Content:** You may find suggested content for your section. Use this to inform your content strategy.
          3. **Write Missing Content:** If the section needs content, write it. (E.g. if the section requires a headline, but does not have one, write the headline.)
          4. **Layout Design:** Describe a suitable visual structure (\'layoutDescription\') that fits the section type and content. Specify column counts, element arrangement (image left/right, centered text, etc.), and key element placement. Indicate the visual focus (\'layoutEmphasis\').
          5. **Visual Styling:** Suggest aesthetic choices (\'visualStyleNotes\') aligning with the \'brand_guidelines\'. Mention color usage, spacing, typography hints, and potential image/icon styles.
          6. **Responsiveness:** Briefly note how the layout should adapt on mobile (\'responsivenessNotes\').
          7. **Suggest Available Components:** Suggest available Shadcn UI components from the \'available-components\' list that you could be used to implement the section.
          8. **Output:** Generate a detailed section plan that adheres to the required detailed section schema. Follow the specific instructions provided for the given section type.

          ${specificInstructions}
      </instructions>
    `);
}

planComponentInstructionsPrompt.promptMetadata = {
    name: 'Plan Instructions',
    category: 'Code Generation',
    description: 'Instructions for planning a component',
} as PromptMetadata;