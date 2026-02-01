import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { WebsiteUrlsAPIService, type SearchWebsiteUrlsResponse } from "@rails_api";

const searchPathsSchema = z.object({
  domainId: z.number().describe("The domain ID to check paths on"),
  candidates: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe("List of paths to check availability for (e.g., '/landing', '/promo')"),
});

export type SearchPathsResult = {
  domainId: number;
  domain: string;
  results: Array<{
    path: string;
    available: boolean;
    status: SearchWebsiteUrlsResponse["results"][number]["status"];
    existingId?: number | null;
    existingWebsiteId?: number | null;
  }>;
  error?: string;
};

/**
 * Tool for searching path availability on a specific domain.
 * Uses WebsiteUrlsAPIService to check if paths are available on the given domain.
 */
export const createSearchPathsTool = (jwt: string) =>
  tool(
    async (input): Promise<string> => {
      const { domainId, candidates } = input;

      try {
        const service = new WebsiteUrlsAPIService({ jwt });
        const response = await service.search(domainId, candidates);

        const result: SearchPathsResult = {
          domainId: response.domain_id,
          domain: response.domain,
          results: response.results.map((r) => ({
            path: r.path,
            available: r.status === "available",
            status: r.status,
            existingId: r.existing_id,
            existingWebsiteId: r.existing_website_id,
          })),
        };

        return JSON.stringify(result);
      } catch (error) {
        const result: SearchPathsResult = {
          domainId,
          domain: "",
          error: `API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          results: candidates.map((path) => ({
            path: path.startsWith("/") ? path : `/${path}`,
            available: false,
            status: "unavailable" as const,
          })),
        };

        return JSON.stringify(result);
      }
    },
    {
      name: "search_paths",
      description: `Search for available paths on a specific domain.
Pass the domain ID and an array of candidate paths (e.g., '/landing', '/promo').
Returns availability status for each path on that domain.
Use this AFTER selecting a domain to find an available path that doesn't conflict with existing pages.`,
      schema: searchPathsSchema,
    }
  );
