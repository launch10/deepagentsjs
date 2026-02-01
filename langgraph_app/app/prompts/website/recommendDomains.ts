import { z } from "zod";
import type { DomainWithWebsite, PlatformSubdomainCredits } from "@rails_api";

// ============================================================================
// Types
// ============================================================================

export interface BrainstormContext {
  idea: string;
  audience: string;
  solution: string;
}

export interface DomainRecommendationsPromptInput {
  brainstorm: BrainstormContext;
  existingDomains: DomainWithWebsite[];
  credits: PlatformSubdomainCredits;
}

// ============================================================================
// Output Schema for Agent
// ============================================================================

export const domainRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      subdomain: z.string().describe("The subdomain (without .launch10.site)"),
      path: z
        .string()
        .describe("The recommended path on this domain (e.g., '/', '/landing', '/promo')"),
      score: z.number().min(0).max(100).describe("How well this domain fits the business (0-100)"),
      reasoning: z
        .string()
        .describe("Brief explanation of why this domain and path are a good fit"),
      source: z
        .enum(["existing", "generated"])
        .describe("Whether this is an existing or newly generated domain"),
      existingDomainId: z
        .number()
        .optional()
        .describe("Domain ID for existing domains - use this with search_paths tool"),
    })
  ),
  topRecommendation: z
    .object({
      subdomain: z.string(),
      path: z.string(),
      source: z.enum(["existing", "generated"]),
    })
    .describe("The single best domain + path recommendation"),
});

export type DomainRecommendationsOutput = z.infer<typeof domainRecommendationsOutputSchema>;

// ============================================================================
// System Prompt
// ============================================================================

export function buildDomainRecommendationsPrompt(input: DomainRecommendationsPromptInput): string {
  const { brainstorm, existingDomains, credits } = input;

  const hasExistingDomains = existingDomains.length > 0;
  const hasCredits = credits.remaining > 0;

  let existingDomainsSection = "";
  if (hasExistingDomains) {
    const domainList = existingDomains
      .map((d) => {
        const paths = d.website_urls?.map((u) => u.path).join(", ") || "none";
        return `- Domain ID ${d.id}: ${d.domain} (website: ${d.website_name || "unnamed"}, existing paths: ${paths})`;
      })
      .join("\n");

    existingDomainsSection = `
## User's Existing Domains
The user already has these domains on their account:
${domainList}

Evaluate whether any of these existing domains are a good fit for the current business.
A score of 80+ means the domain is highly relevant and should be recommended.
If recommending an existing domain, use search_paths with the Domain ID to find an available path.
`;
  }

  let creditsSection = "";
  if (hasCredits) {
    creditsSection = `
## Credits Available
The user has ${credits.remaining} subdomain credit(s) remaining (out of ${credits.limit}).
They can create new subdomains if needed.
`;
  } else {
    creditsSection = `
## Credits Exhausted
The user has used all ${credits.limit} subdomain credits.
However, you MUST still generate new subdomain suggestions so they can see what's available if they upgrade.
Mark these as source: "generated" - the UI will show them as disabled/greyed out.
${!hasExistingDomains ? "NOTE: User has no existing domains - new subdomain suggestions are their only option (requires upgrade)." : ""}
`;
  }

  return `You are a domain name expert helping pick the perfect subdomain for a landing page.

## Business Context
- **Business idea**: ${brainstorm.idea}
- **Target audience**: ${brainstorm.audience}
- **Solution offered**: ${brainstorm.solution}

${existingDomainsSection}
${creditsSection}

## Your Task
1. Identify if any existing domains is a good fit for the current business
2. Generate 3-5 creative, brandable subdomains which would be a good fit for the current business
3. Use the search_domains tool to check availability of the subdomain candidates you generated
4. For each domain, recommend what URL path would be used (e.g. paw-portraits.launch10.site/dogs)
5. Use the search_paths tool to find available paths for each domain (paths that do not already have a website launched there)
6. Return your final recommendations, including both existing and new, generated subdomain suggestions, with recommended paths

## Domain Requirements
- Lowercase letters, numbers, and hyphens only
- Maximum 30 characters
- Memorable and brandable
- Avoid generic terms like "landing", "page", "site", "app"
- Capture the essence of the business

## Path Requirements
- Paths MUST be single-level (e.g., "/landing" NOT "/marketing/landing")
- Lowercase letters, numbers, and hyphens only
- Keep paths short and descriptive
- For NEW domains, default path is "/" (root)
- For EXISTING domains, use search_paths to find an available path that doesn't conflict

## Scoring Guidelines
- **90-100**: Perfect match - domain strongly conveys the business value proposition
- **70-89**: Good match - domain is relevant and brandable
- **50-69**: Decent match - could work but not ideal
- **0-49**: Poor match - domain doesn't fit the business

## Search Strategy
1. Start with 5-7 creative subdomain ideas based on the business
2. Check their availability using search_domains
3. If most are taken, generate more variations and search again
4. Aim to find at least 3 available options
5. For NEW domains, recommend path "/" (root)

${
  hasExistingDomains
    ? `
## Path Strategy for Existing Domains
When recommending an existing domain:
1. Use the search_paths tool with the domain's ID
2. Pass 3-5 candidate paths derived from the page purpose
3. Choose an available path that best describes the landing page
4. Good path examples: "/promo", "/launch", "/beta", "/landing"
`
    : ""
}

Return exactly 3 recommendations, ranked by quality (best first).
Each recommendation MUST include both a domain AND a path.
${hasExistingDomains ? "Mix existing and new domains - include at least one generated suggestion." : ""}`;
}
