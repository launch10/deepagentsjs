/**
 * Advanced PostgreSQL-powered icon search tool with semantic vector embeddings.
 *
 * This tool provides intelligent icon discovery from the Lucide React icon library,
 * using OpenAI embeddings and PostgreSQL pgvector for semantic similarity search.
 * It can understand conceptual queries and find visually appropriate icons even when
 * exact name matches don't exist.
 *
 * KEY FEATURES:
 * - Semantic search using vector embeddings (understands concepts, not just keywords)
 * - Multi-query parallel search for batch icon discovery
 * - Automatic result caching with TTL for improved performance
 * - Exact text matching combined with semantic similarity
 * - Rich metadata including tags and categories for each icon
 *
 * SEARCH STRATEGIES:
 * - Concept-based: "navigation menu", "user authentication", "data visualization"
 * - Visual description: "three horizontal lines", "circular arrow", "filled star"
 * - Action-based: "save to disk", "upload file", "refresh page"
 * - Synonyms: "alert"/"notification", "settings"/"config", "trash"/"delete"
 * - Component names: "hamburger menu", "kebab menu", "breadcrumb"
 *
 * EXAMPLES:
 * Single icon search:
 *   { queries: ["heart"] }
 *
 * Multiple icon search for UI components:
 *   { queries: ["close", "minimize", "maximize", "menu"], limit: 3 }
 *
 * Concept-based search:
 *   { queries: ["social media", "sharing", "communication"] }
 *
 * Action-based search:
 *   { queries: ["save document", "export data", "print page"], limit: 5 }
 *
 * EXPECTED OUTPUT FORMAT:
 * {
 *   results: {
 *     "heart": ["Heart", "HeartHandshake", "HeartCrack"],
 *     "menu": ["Menu", "AlignJustify", "MoreHorizontal"],
 *     "save document": ["Save", "FileDown", "Download"]
 *   }
 * }
 *
 * OUTPUT DETAILS:
 * - Results are returned as a map of query -> array of icon names
 * - Icon names match Lucide React component names (PascalCase)
 * - Results are sorted by relevance (highest similarity first)
 * - Each query returns up to 'limit' results (default: 5)
 * - Empty arrays returned for queries with no matches
 * - Cached results are reused within 24-hour TTL window
 *
 * PERFORMANCE NOTES:
 * - Embeddings are pre-computed and stored in PostgreSQL
 * - Vector similarity search uses pgvector's optimized operators
 * - Parallel query execution for batch searches
 * - Automatic caching reduces API calls and improves response time
 *
 * LIMITATIONS:
 * - Limited to icons available in Lucide React library (~1000 icons)
 * - Some abstract concepts may not have direct icon representations
 * - Best results with common UI/UX terminology
 */

import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { SearchIconsService, type IconResult } from "@services";

const examples = `EXAMPLES:
Basic UI icons:
  queries: ["close", "settings", "search", "menu"]
Social media icons:
  queries: ["facebook", "twitter", "linkedin", "share"]
Status indicators:
  queries: ["loading", "success", "error", "warning"]
Navigation icons:
  queries: ["arrow right", "chevron down", "back button"]
Action icons with limit:
  queries: ["edit", "delete", "copy", "paste"], limit: 3`;

const description = `Semantic icon search tool powered by vector embeddings and PostgreSQL.
Searches Lucide React icon library using AI-powered similarity matching.

FEATURES:
• Semantic search understands concepts beyond exact matches
• Multi-query parallel execution for batch searches
• Combined exact + semantic matching for best results
• Automatic caching with 24-hour TTL
• Pre-computed embeddings for instant results

SEARCH STRATEGIES:
• Describe the concept: "user authentication" finds User, Lock, Key icons
• Visual description: "three dots" finds MoreVertical, MoreHorizontal
• Action-based: "save to disk" finds Save, Download, FileDown
• Use synonyms: "trash"/"delete", "settings"/"config"
• Component names: "hamburger menu", "spinner", "breadcrumb"

${examples}

TIPS FOR BEST RESULTS:
• Try multiple related terms for better coverage
• Use common UI/UX terminology
• Combine visual and conceptual descriptions
• Remember: limited to ~1000 Lucide icons`;

export class SearchIconsTool extends StructuredTool {
  name = "searchIcons";
  description = description;
  schema = z.object({
    queries: z
      .array(z.string())
      .min(1, "At least one search query is required")
      .describe(
        "Array of search terms to find icons. Each query is processed independently with semantic understanding. " +
          "Best practices:\n" +
          "1. Try conceptual queries: 'navigation menu' vs just 'menu'\n" +
          "2. Use visual descriptions: 'circular arrow' for refresh\n" +
          "3. Include synonyms: both 'alert' and 'notification'\n" +
          "4. Describe actions: 'save to disk' vs just 'save'\n" +
          "5. Multiple queries recommended for better coverage"
      ),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(5)
      .describe(
        "Maximum icons returned per query. Default: 5. Range: 1-20. Lower values return only top matches."
      ),
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
      console.error("Error searching icons:", error);
      throw new Error(`Failed to search icons: ${error.message}`);
    }
  }
}
