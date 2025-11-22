import { renderPrompt } from '@prompts';

export const linkingInstructionsPrompt = async (): Promise<string> => {
    return renderPrompt(`
      Linking: If you need to link, use the id of the section you want to 
      link to as an anchor tag (e.g. /#sectionId)
      Prefer to use react-router-dom for navigation (DO NOT USE next/link)
    `);
}