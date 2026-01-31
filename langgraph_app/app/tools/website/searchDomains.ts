import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { createRailsApiClient } from "@rails_api";

const searchDomainsSchema = z.object({
  subdomains: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe("List of subdomains to check availability for (without the .launch10.site suffix)"),
});

/**
 * Tool for searching domain availability.
 * Calls Rails API to check if subdomains are available across all users.
 */
export const createSearchDomainsTool = (jwt: string) =>
  tool(
    async (input) => {
      const { subdomains } = input;
      const PLATFORM_DOMAIN_SUFFIX = ".launch10.site";

      // Convert subdomains to full domain names
      const domains = subdomains.map((s) => `${s}${PLATFORM_DOMAIN_SUFFIX}`);

      try {
        const client = await createRailsApiClient({ jwt });
        const response = await client.POST("/api/v1/domains/search", {
          body: { candidates: domains },
        });

        if (response.error || !response.data) {
          return JSON.stringify({
            error: "Failed to check domain availability",
            results: domains.map((d) => ({
              domain: d,
              subdomain: d.replace(PLATFORM_DOMAIN_SUFFIX, ""),
              available: false,
            })),
          });
        }

        const results = (response.data.results ?? []).map((result) => ({
          domain: result.domain,
          subdomain: result.domain.replace(PLATFORM_DOMAIN_SUFFIX, ""),
          available: result.status === "available",
          status: result.status,
        }));

        return JSON.stringify({ results });
      } catch (error) {
        return JSON.stringify({
          error: `API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          results: domains.map((d) => ({
            domain: d,
            subdomain: d.replace(PLATFORM_DOMAIN_SUFFIX, ""),
            available: false,
          })),
        });
      }
    },
    {
      name: "search_domains",
      description: `Search for available subdomains on launch10.site.
Pass an array of subdomain names (without the .launch10.site suffix).
Returns availability status for each.
You can call this multiple times if needed to find available domains.`,
      schema: searchDomainsSchema,
    }
  );
