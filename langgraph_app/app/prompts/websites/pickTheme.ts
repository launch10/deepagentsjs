import { z } from "zod";
import { 
    renderPrompt,
    structuredOutputPrompt,
    type PromptMetadata
} from "@prompts";
import { themeSchema } from "@types";
import { BaseMessage } from "@langchain/core/messages";
import { SearchThemesService } from "@services";
export interface ThemeServiceInterface {
  getAllThemeLabels(): Promise<string[]>;
}
export interface PickThemePromptProps {
  userRequest: BaseMessage;
  themeService?: ThemeServiceInterface;
}

export const pickThemePromptOutputSchema = z.object({
    themeId: z.number().describe("The ID of the theme to use for the website.")
});

export const pickThemePrompt = async ({ 
    userRequest,
    themeService,
}: PickThemePromptProps): Promise<string> => {
    if (!userRequest || !userRequest.content) {
        throw new Error('userRequest is required');
    }
    // Use injected service or create a new one
    const service = themeService || new SearchThemesService();

    const [themeLabelsStr, structuredOutputStr] = await Promise.all([
        service.getAllThemeLabels(),
        structuredOutputPrompt({ schema: pickThemePromptOutputSchema })
    ])

    return renderPrompt(`
        <role>
            You're an expert web designer. 
        </role>

        <task>
            Your task is to take a user request and pick a beautiful 
            color palette for their landing page.
            
            IMPORTANT: You must select ONE theme and return its ID.
        </task>

        <tools>
            You have access to a searchThemes tool that searches a database of color palettes.
            - Input: theme labels (e.g., "modern", "professional", "bold")
            - Output: matching themes with their IDs and color variables
            
            INSTRUCTIONS:
            1. Call the searchThemes tool ONCE (maximum twice if needed)
            2. Review the returned themes (each has an ID and colors)
            3. Select the BEST matching theme
            4. Return ONLY the themeId of your chosen theme
            
            DO NOT call the tool more than twice. Make a decision quickly.
        </tools>

        <available-theme-labels>
            ${themeLabelsStr.join(', ')}
        </available-theme-labels>

        <user-request>
            ${userRequest.content}
        </user-request>

        ${structuredOutputStr}
    `);
};

pickThemePrompt.promptMetadata = {
    name: 'Pick Theme',
    category: 'Website Design',
    description: 'Picks a color palette for a landing page',
    examples: []
} as PromptMetadata;