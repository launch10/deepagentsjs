// app/lib/.server/langgraph/tools/searchThemes.ts
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { GraphState } from "../@shared/state/graph"; // Assuming this state exists
import { ThemeSearchService, type ThemeResult } from "../services/theme/search";

// --- Helper to format ThemeResult for LLM ---
// Updated to ONLY include Name/ID and CSS Variables (Theme Object)
function formatThemeResult(theme: ThemeResult): string {
    const themeString = Object.entries(theme.colors) // 'colors' holds the theme object
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    return `  - Theme Name: ${theme.name} (ID: ${theme.id})\n` +
           `    CSS Variables: { ${themeString} }`; // Output only CSS variables
}

export class SearchThemesTool extends StructuredTool {
    name = "searchThemes";
    // Description will be set dynamically based on available labels
    description = "Search for color themes using a list of descriptive labels. Returns a list of matching themes (up to the specified limit), selected randomly. Use labels from the provided list.";

    schema = z.object({
        labels: z.array(z.string()).min(1, "At least one search label is required").describe(
            "List of descriptive labels to find themes (e.g., 'modern', 'professional', 'calm'). Must use labels from the available list."
        ),
        limit: z.number().int().positive().optional().default(5).describe("Maximum number of themes to return")
    });

    private themeService: ThemeSearchService;
    private availableLabelsString: string;

    // Constructor accepts available labels to include in the description
    constructor(availableLabels: string[]) {
        super();
        this.themeService = new ThemeSearchService();
        this.availableLabelsString = availableLabels.join(', ');
        this.description = `Search for color themes using a list of descriptive labels. Returns a list of matching themes (up to the specified limit), selected randomly. Available labels are: ${this.availableLabelsString}.`;
        this.schema.shape.labels._def.description = `List of descriptive labels to find themes. Must use labels from the available list: ${this.availableLabelsString}.`;
    }

    async _call(args: z.infer<typeof this.schema>): Promise<string> {
        try {
            const { labels, limit = 5 } = args;
            console.log(`Tool call: searchThemes with labels=[${labels.join(', ')}], limit=${limit}`);

            // Use the service to search for themes
            const results: ThemeResult[] = await this.themeService.searchThemesByLabels(labels, limit);

            if (results.length === 0) {
                return "No themes found matching the specified labels.";
            }

            const formattedResults = results.map(formatThemeResult).join('\n');
            const responseString = `Found ${results.length} themes matching labels [${labels.join(', ')}] (randomly selected):\n${formattedResults}\nUse the 'CSS Variables' provided for styling.`;

            console.log("Tool response:", responseString);
            return responseString;

        } catch (error: any) {
            console.error('Error searching themes:', error);
            // Provide a user-friendly error message back to the LLM/user
            return `Failed to search themes: ${error.message}`;
        }
    }
}

export async function initializeTools(_state: GraphState): Promise<{ searchThemes: StructuredTool }> {
    // Instantiate the service once to fetch labels
    const themeService = new ThemeSearchService();
    const availableLabels = await themeService.getAllThemeLabels();

    // Create the tool instance, passing the labels for the description
    const searchThemesTool = new SearchThemesTool(availableLabels);

    return {
        searchThemes: searchThemesTool
    };
}
