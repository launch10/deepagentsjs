/**
 * Advanced PostgreSQL-powered file search tool for codebase exploration.
 * 
 * This tool provides high-performance, indexed full-text search across project files
 * with support for multiple parallel searches, different search modes, and flexible
 * targeting of file contents and/or paths.
 * 
 * KEY FEATURES:
 * - Execute multiple searches in parallel for maximum efficiency
 * - PostgreSQL full-text search with relevance ranking
 * - Support for plain text, exact phrase, and boolean searches
 * - Search in file contents, paths, or both
 * - Individual configuration per search query
 * 
 * SEARCH MODES:
 * - plain: Standard text search finding files with all words (any order)
 * - phrase: Exact phrase matching
 * - boolean: Complex queries with AND(&), OR(|), NOT(!) operators
 * 
 * EXAMPLES:
 * Single search:
 *   { searches: [{ content: "react component" }] }
 * 
 * Multiple parallel searches:
 *   { searches: [
 *     { content: "useState", searchMode: "plain", limit: 5 },
 *     { path: "components", limit: 10 },
 *     { content: "import React from", searchMode: "phrase", limit: 3 }
 *   ]}
 * 
 * Boolean search with path filter:
 *   { searches: [
 *     { content: "test & !mock", searchMode: "boolean", path: "tests", limit: 5 }
 *   ]}
 */

import { z } from "zod";
import { tool, Tool } from "@langchain/core/tools";
import type { GraphState } from "@state";
import { type FileType, fileSchema } from "@types";
import { CodeFileModel } from "@models";
import { compactObject } from "@utils";

const examples = `EXAMPLES:
Single content search:
  searches: [{ content: 'useState' }]
Multiple parallel searches:
  searches: [
    { content: 'react component', limit: 5 },
    { path: 'components', limit: 3 },
    { content: 'import React from', searchMode: 'phrase' }
  ]
Combined content + path filter:
  searches: [{ content: 'test', path: 'tests', limit: 10 }]
Boolean search:
  searches: [{ content: 'router & !test', searchMode: 'boolean' }]`;

const description = `Multi-search file tool with parallel execution and PostgreSQL full-text search.
Execute multiple searches simultaneously for maximum efficiency.

FEATURES:
• Parallel execution of multiple searches
• Content search with full-text indexing
• Path search with fuzzy matching
• Individual limits per search (default: 2)
• Three search modes: plain, phrase, boolean

${examples}

EXPECTED OUTPUT FORMAT:
{
  results: [
    {
      query: { content: 'benefits', searchMode: 'plain', limit: 2 },
      files: [
        { path: 'src/pages/benefits.tsx', content: '...file content...', rank: 0.95 },
        { path: 'src/components/BenefitCard.tsx', content: '...file content...', rank: 0.87 }
      ]
    }
  ],
  totalFiles: 2
}

OUTPUT DETAILS:
• Each search returns a result object with the original query and matching files
• Files are sorted by relevance rank (highest first) for all content search modes
• Plain search uses ts_rank(), phrase and boolean use ts_rank_cd() for better results
• Files include path, content, and rank score
• totalFiles counts unique files across all parallel searches
• Empty results return files: [] with optional error message
• Path-only searches work without content parameter (no rank)
• Boolean searches support complex queries like 'component & !test'`;

const SingleSearchSchema = z.object({
    content: z.string().optional().describe(
        "Query to search in file contents. Required unless only searching paths."
    ),
    path: z.string().optional().describe(
        "Query to search in file paths. Can be used alone or to filter content search results."
    ),
    searchMode: z.enum(["plain", "phrase", "boolean"]).optional().default("plain").describe(
        "Search mode for content search:\n" +
        "- 'plain': Finds files with all words in any order (default)\n" +
        "- 'phrase': Finds exact phrase matches\n" +
        "- 'boolean': Supports AND(&), OR(|), NOT(!) operators"
    ),
    limit: z.number().int().positive().optional().default(2).describe(
        "Maximum results for this search. Defaults to 2 for focused results."
    )
});

const FileSearchInputSchema = z.object({
    searches: z.array(SingleSearchSchema).min(1).describe(
        "Array of search queries to execute in parallel. Each search can target content and/or paths."
    )
});
  
// Infer the input type from the schema
type FileSearchInput = z.infer<typeof FileSearchInputSchema>;
type SingleSearch = z.infer<typeof SingleSearchSchema>;

const fileSearchSchema = fileSchema.extend({
    rank: z.number()
})
const SearchResultSchema = z.object({
    query: z.object({
        content: z.string().optional(),
        path: z.string().optional(),
        searchMode: z.string(),
        limit: z.number()
    }),
    files: z.array(fileSearchSchema),
    error: z.string().optional(),
});

const FileSearchOutputSchema = z.object({
    results: z.array(SearchResultSchema),
    totalFiles: z.number(),
});
type FileSearchOutput = z.infer<typeof FileSearchOutputSchema>;

export async function initSearchFiles(state: GraphState): Promise<{ searchFiles: Tool }> {
    let theState = state;
    const websiteId = state?.website?.id!;

    async function executeSearch(search: SingleSearch): Promise<{
        query: SingleSearch,
        files: FileType[],
        error?: string
    }> {
        if (!websiteId) {
            throw new Error("Cannot search files without specified website");
        }
        const { content, path, searchMode = "plain", limit = 2 } = search;

        try {
            let results: any[] = [];

            // Validate that at least one search target is specified
            if (!content && !path) {
                return {
                    query: search,
                    files: [],
                    error: "Must specify either 'content' or 'path' query"
                };
            }

            // Search in content if specified
            if (content) {
                // Pass path filter directly to search methods for database-level filtering
                switch (searchMode) {
                    case "plain":
                        results = await CodeFileModel.searchWithRank(content, websiteId, limit, path);
                        break;
                    case "phrase":
                        results = await CodeFileModel.searchPhrase(content, websiteId, limit, path);
                        break;
                    case "boolean":
                        results = await CodeFileModel.searchBoolean(content, websiteId, limit, path);
                        break;
                }
            } else if (path) {
                // Path-only search
                results = await CodeFileModel.pathFuzzy(path, websiteId, limit);
            }

            // ransform results to match expected FileType format
            const files: FileType[] = results.map((file: any) => {
                return compactObject({
                    path: file.path,
                    content: file.content,
                    fileSpecificationId: file.fileSpecificationId,
                    rank: file.rank
                });
            });

            return {
                query: search,
                files
            };
        } catch (error: any) {
            console.error(`Search error for query ${JSON.stringify(search)}: ${error.message}`);
            return {
                query: search,
                files: [],
                error: `Search failed: ${error.message}`
            };
        }
    }

    async function searchFiles(args: FileSearchInput): Promise<FileSearchOutput> {
        const { searches } = args;

        // Execute all searches in parallel
        const searchPromises = searches.map(search => executeSearch(search));
        const results = await Promise.all(searchPromises);

        // Calculate total unique files across all searches
        const allPaths = new Set<string>();
        results.forEach(result => {
            result.files.forEach(file => allPaths.add(file.path));
        });

        return {
            results,
            totalFiles: allPaths.size
        } as FileSearchOutput;
    }

    const searchFilesTool = tool(searchFiles, {
        name: "searchFiles",
        description,
        schema: FileSearchInputSchema,
    });

    return {
        searchFiles: searchFilesTool
    };
}

export const initTools = initSearchFiles;