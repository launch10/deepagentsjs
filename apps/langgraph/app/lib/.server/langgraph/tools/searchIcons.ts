import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import type { GraphState } from "../@shared/state/graph";
import { SearchIconsService, type IconResult } from "../services/searchIconsService";

export class SearchIconsTool extends StructuredTool {
  name = "searchIcons";
  description = "Search for icons using one or more queries. Returns a map of query -> array of matching icons, " +
                "sorted by relevance. These are lucide-react icons, so be sure to search for icons that might exist (e.g. search for heart, not 'active aging', as this might represent aging visually).";
  schema = z.object({
    queries: z.array(z.string()).min(1, "At least one search query is required").describe(
      "List of search terms to find icons. The search is semantic, so try different approaches to find the best matches: " +
      "1. Describe the concept: 'navigation menu' instead of just 'menu', 'security shield' instead of just 'shield' " +
      "2. Use synonyms: 'notification bell' or 'alert bell' will find similar icons " +
      "3. Describe the visual: 'right-pointing arrow' or 'circular loading spinner' " +
      "4. Describe the action: 'save to disk' might find better icons than just 'save'" +
      "5. Try a couple different queries, because lucide-icons doesn't have an icon for every possible concept"
    ),
    limit: z.number().int().positive().optional().default(5).describe("Maximum number of results per query")
  });

  private iconService: SearchIconsService;

  constructor() {
    super();
    this.iconService = new SearchIconsService();
  }

  async _call(args: z.infer<typeof this.schema>) {
    try {
      const { queries, limit = 5 } = args;
      
      // Use the service to search for icons
      const results = await this.iconService.toolCall(queries, limit);
      
      return { results };
    } catch (error: any) {
      console.error('Error searching icons:', error);
      throw new Error(`Failed to search icons: ${error.message}`);
    }
  }
}

export async function initializeTools(_state: GraphState): Promise<{ searchIcons: StructuredTool }> {
  return {
    searchIcons: new SearchIconsTool()
  };
}