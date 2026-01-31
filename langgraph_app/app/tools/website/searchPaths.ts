import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { createRailsApiClient } from "@rails_api";

const searchPathsSchema = z.object({
  domainId: z.number().describe("The domain ID to check paths on"),
  candidates: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe("List of paths to check availability for (e.g., '/landing', '/promo')"),
});

interface PathSearchResult {
  path: string;
  status: "available" | "existing";
  existing_id?: number;
  existing_website_id?: number;
}

interface PathSearchResponse {
  domain_id: number;
  domain: string;
  results: PathSearchResult[];
}

/**
 * Tool for searching path availability on a specific domain.
 * Calls Rails API to check if paths are available on the given domain.
 */
export const createSearchPathsTool = (jwt: string) =>
  tool(
    async (input) => {
      const { domainId, candidates } = input;

      try {
        const client = await createRailsApiClient({ jwt });
        const response = await client.POST("/api/v1/website_urls/search", {
          body: { domain_id: domainId, candidates },
        });

        if (response.error || !response.data) {
          return JSON.stringify({
            error: "Failed to check path availability",
            results: candidates.map((path) => ({
              path: path.startsWith("/") ? path : `/${path}`,
              status: "unknown",
            })),
          });
        }

        const data = response.data as PathSearchResponse;
        return JSON.stringify({
          domainId: data.domain_id,
          domain: data.domain,
          results: data.results.map((result) => ({
            path: result.path,
            available: result.status === "available",
            status: result.status,
            existingId: result.existing_id,
            existingWebsiteId: result.existing_website_id,
          })),
        });
      } catch (error) {
        return JSON.stringify({
          error: `API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          results: candidates.map((path) => ({
            path: path.startsWith("/") ? path : `/${path}`,
            status: "unknown",
          })),
        });
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
