import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { SearchThemesService } from "@services";
import { type ThemeType } from "@types";
import type { GraphState } from "~/core/decorators/types";

// --- Helper to format ThemeType for LLM ---
// Format to clearly show the theme ID for selection
function formatThemeType(theme: ThemeType): string {
    const themeString = Object.entries(theme.colors) // 'colors' holds the theme object
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    return `
    - Theme ID: ${theme.id}
    - Theme Name: ${theme.name}
    - CSS Variables (Hexadecimal): { ${themeString} }`;
}

const DESCRIPTION = `Search for color themes using a list of descriptive labels.
Returns a list of matching themes with their Theme IDs, names, and color variables.
You must select one theme by its Theme ID from the results.

- Input: theme labels (e.g. "modern", "professional", "bold")
- Output: matching themes with their IDs and color variables`;

export class SearchThemesTool extends StructuredTool {
    name = "searchThemes";
    description = DESCRIPTION;

    schema = z.object({
        labels: z.array(z.string()).min(1, "At least one search label is required").describe(
            "List of descriptive labels to find themes (e.g., 'modern', 'professional', 'calm'). Must use labels from the available list."
        ),
        limit: z.number().int().positive().optional().default(5).describe("Maximum number of themes to return")
    });

    private themeService: SearchThemesService;
    private availableLabelsString: string;

    // Constructor accepts available labels to include in the description
    constructor(availableLabels: string[]) {
        super();
        this.themeService = new SearchThemesService();
        this.availableLabelsString = availableLabels.join(', ');
        this.description = DESCRIPTION;
        this.schema.shape.labels._def.description = `
            List of descriptive labels to find themes. 
            Must use labels from the available list: ${this.availableLabelsString}.`;
    }

    async _call(args: z.infer<typeof this.schema>): Promise<string> {
        try {
            const { labels, limit = 5 } = args;

            // Use the service to search for themes
            const results: ThemeType[] = await this.themeService.searchThemesByLabels(labels, limit);

            if (results.length === 0) {
                return "No themes found matching the specified labels.";
            }

            const formattedResults = results.map(formatThemeType).join('\n');
            const responseString = `Found ${results.length} themes matching labels [${labels.join(', ')}]:\n${formattedResults}\n\nSelect ONE theme by its Theme ID (e.g., if you choose the first theme, return themeId: ${results[0].id})`;

            return responseString;

        } catch (error: any) {
            console.error('Error searching themes:', error);
            // Provide a user-friendly error message back to the LLM/user
            return `Failed to search themes: ${error.message}`;
        }
    }
}

export async function initializeSearchThemes(): Promise<{ searchThemes: StructuredTool }> {
    // Instantiate the service once to fetch labels
    const themeService = new SearchThemesService();
    const availableLabels = await themeService.getAllThemeLabels();

    // Create the tool instance, passing the labels for the description
    const searchThemesTool = new SearchThemesTool(availableLabels);

    return {
        searchThemes: searchThemesTool
    };
}

export const initTools = async (state: GraphState): Promise<{ searchThemes: StructuredTool }> => {
    return initializeSearchThemes();
}