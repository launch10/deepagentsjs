import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { DomainsAPIService, type SearchDomainsResponse } from "@rails_api";

const PLATFORM_DOMAIN_SUFFIX = ".launch10.site";

const searchDomainsSchema = z.object({
  subdomains: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe("List of subdomains to check availability for (without the .launch10.site suffix)"),
});

export type SearchDomainsResult = {
  results: Array<{
    domain: string;
    subdomain: string;
    available: boolean;
    status: SearchDomainsResponse["results"][number]["status"];
    existingId?: number | null;
  }>;
  credits?: SearchDomainsResponse["platform_subdomain_credits"];
  error?: string;
};

/**
 * Tool for searching domain availability.
 * Uses DomainsAPIService to check if subdomains are available across all users.
 */
export const createSearchDomainsTool = (jwt: string) =>
  tool(
    async (input): Promise<string> => {
      const { subdomains } = input;

      // Convert subdomains to full domain names
      const candidates = subdomains.map((s) => `${s}${PLATFORM_DOMAIN_SUFFIX}`);

      try {
        const service = new DomainsAPIService({ jwt });
        const response = await service.search(candidates);

        const result: SearchDomainsResult = {
          results: response.results.map((r) => ({
            domain: r.domain,
            subdomain: r.domain.replace(PLATFORM_DOMAIN_SUFFIX, ""),
            available: r.status === "available",
            status: r.status,
            existingId: r.existing_id,
          })),
          credits: response.platform_subdomain_credits,
        };

        return JSON.stringify(result);
      } catch (error) {
        const result: SearchDomainsResult = {
          error: `API call failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          results: candidates.map((domain) => ({
            domain,
            subdomain: domain.replace(PLATFORM_DOMAIN_SUFFIX, ""),
            available: false,
            status: "unavailable" as const,
          })),
        };

        return JSON.stringify(result);
      }
    },
    {
      name: "search_domains",
      description: `Search for available subdomains on launch10.site.
Pass an array of subdomain names (without the .launch10.site suffix).
Returns availability status for each, plus remaining subdomain credits.
You can call this multiple times if needed to find available domains.`,
      schema: searchDomainsSchema,
    }
  );
